"""Persist generated listings to disk in per-platform files the marketing
team can hand off directly."""

from __future__ import annotations

import json
from pathlib import Path

from .models import Listing, PlatformListing
from .pricing import format_price_table


def _slug(text: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in text).strip("_")


def _render_platform_file(pl: PlatformListing) -> str:
    parts = [
        f"# {pl.title}",
        "",
        f"_Platform: **{pl.platform}** · Language: **{pl.language.value}**_",
        "",
    ]
    if pl.warnings:
        parts.extend(["> ⚠️ " + w for w in pl.warnings])
        parts.append("")
    parts.append(pl.body)
    parts.append("")
    if pl.cta:
        parts.extend(["---", "", f"**Call to action:** {pl.cta}", ""])
    if pl.hashtags:
        parts.extend(["---", "", " ".join(f"#{h.lstrip('#')}" for h in pl.hashtags), ""])
    if pl.price_table:
        parts.extend(["---", "", "**Pricing:**", "", format_price_table(pl.price_table), ""])
    return "\n".join(parts)


def save_listing(listing: Listing, output_dir: Path) -> Path:
    """Write one folder per property containing every platform/language file
    plus a consolidated JSON dump and a market-research summary."""
    output_dir = Path(output_dir)
    target = output_dir / _slug(listing.property_reference)
    target.mkdir(parents=True, exist_ok=True)

    for pl in listing.platform_listings:
        filename = f"{_slug(pl.platform)}_{pl.language.value}.md"
        (target / filename).write_text(_render_platform_file(pl), encoding="utf-8")

    # Market research
    if listing.market_research:
        mr = listing.market_research
        lines = [
            "# Market research summary",
            "",
            mr.summary or "",
            "",
        ]
        if mr.suggested_price_range_aed:
            low, high = mr.suggested_price_range_aed
            lines.append(f"**Suggested price range (AED):** {low:,.0f} – {high:,.0f}")
            lines.append("")
        if mr.positioning_notes:
            lines.extend(["## Positioning", "", mr.positioning_notes, ""])
        if mr.comparables:
            lines.extend(["## Comparables", ""])
            for c in mr.comparables:
                lines.append(f"- **{c.source}** — {c.title}")
                bits = []
                if c.price_aed:
                    bits.append(f"AED {c.price_aed:,.0f}")
                if c.bedrooms is not None:
                    bits.append(f"{c.bedrooms} BR")
                if c.area_sqft:
                    bits.append(f"{c.area_sqft:,.0f} sqft")
                if bits:
                    lines.append("  - " + " · ".join(bits))
                if c.url:
                    lines.append(f"  - {c.url}")
                if c.notes:
                    lines.append(f"  - _{c.notes}_")
        (target / "market_research.md").write_text("\n".join(lines), encoding="utf-8")

    # JSON dump
    (target / "listing.json").write_text(
        listing.model_dump_json(indent=2, exclude_none=True),
        encoding="utf-8",
    )

    return target
