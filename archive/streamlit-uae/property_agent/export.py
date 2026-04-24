"""Pack a generated Listing into an in-memory ZIP for download."""

from __future__ import annotations

import io
import json
import zipfile

from .models import Listing
from .output import _render_platform_file, _slug
from .pricing import format_price_table


def listing_to_zip(listing: Listing) -> bytes:
    """Serialize every platform/language file plus market research and JSON
    into a single ZIP archive returned as bytes."""
    buffer = io.BytesIO()
    folder = _slug(listing.property_reference)
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for pl in listing.platform_listings:
            name = f"{folder}/{_slug(pl.platform)}_{pl.language.value}.md"
            zf.writestr(name, _render_platform_file(pl))

        if listing.market_research:
            mr = listing.market_research
            lines = ["# Market research", "", mr.summary or "", ""]
            if mr.suggested_price_range_aed:
                low, high = mr.suggested_price_range_aed
                lines.append(f"**Suggested price range (AED):** {low:,.0f} – {high:,.0f}\n")
            if mr.positioning_notes:
                lines.extend(["## Positioning", "", mr.positioning_notes, ""])
            if mr.comparables:
                lines.extend(["## Comparables", ""])
                for c in mr.comparables:
                    lines.append(f"- **{c.source}** — {c.title}")
                    if c.url:
                        lines.append(f"  - {c.url}")
            zf.writestr(f"{folder}/market_research.md", "\n".join(lines))

        zf.writestr(
            f"{folder}/listing.json",
            listing.model_dump_json(indent=2, exclude_none=True),
        )
    return buffer.getvalue()
