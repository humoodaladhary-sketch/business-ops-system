"""Core Claude-powered listing agent.

Responsibilities:
  * Analyze render images via Claude vision.
  * Research comparable listings via the web_search server tool.
  * Generate platform + language-specific listings with adaptive thinking.
  * Cache the brand/platform system prompt (stable) so every call after the
    first is cheap.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Iterable, Optional

import anthropic

from .inputs import extract_sales_offer_text, load_renders_as_vision_blocks
from .models import (
    Language,
    Listing,
    MarketComparable,
    MarketResearch,
    PlatformListing,
    PriceTable,
    Property,
    Render,
)
from .pricing import build_price_table, format_price_table
from .prompts import (
    MARKET_RESEARCH_PROMPT,
    RENDER_ANALYSIS_PROMPT,
    load_branding,
    load_platforms,
    render_listing_request,
    render_system_prompt,
)


log = logging.getLogger(__name__)

MODEL = "claude-opus-4-7"
MAX_TOKENS = 16_000


def _extract_first_json(text: str) -> dict:
    """Best-effort JSON extraction. Strips code fences, finds the first {...}."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # Find first balanced JSON object.
    start = text.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found in response: {text[:200]}")
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : i + 1])
    raise ValueError("Unbalanced JSON in response")


class PropertyListingAgent:
    """High-level orchestrator. Construct once per process; call ``generate``
    per property."""

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        target_currencies: Iterable[str] = ("AED", "USD", "EUR", "GBP", "SAR"),
    ) -> None:
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
        self.branding = load_branding()
        self.platforms = load_platforms()
        self.system_prompt = render_system_prompt(self.branding, self.platforms)
        self.target_currencies = list(target_currencies)

    # ------------------------------------------------------------------
    # Cached system prompt helper
    # ------------------------------------------------------------------

    def _system_blocks(self) -> list[dict]:
        """System prompt as a list of text blocks with cache_control on the
        last block, so brand + platform specs are cached across calls."""
        return [
            {
                "type": "text",
                "text": self.system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ]

    # ------------------------------------------------------------------
    # Render analysis (Claude vision)
    # ------------------------------------------------------------------

    def analyze_renders(self, renders: list[Render]) -> list[Render]:
        """Populate ``caption``, ``room``, ``is_hero`` for each render using
        Claude's vision API."""
        if not renders:
            return renders

        image_blocks = load_renders_as_vision_blocks(renders)
        if not image_blocks:
            return renders

        content: list[dict] = [{"type": "text", "text": RENDER_ANALYSIS_PROMPT}]
        content.extend(image_blocks)

        response = self.client.messages.create(
            model=MODEL,
            max_tokens=4_000,
            messages=[{"role": "user", "content": content}],
        )
        text = next(b.text for b in response.content if b.type == "text")

        try:
            payload = _extract_first_json(text)
        except Exception as exc:
            log.warning("render analysis returned non-JSON; skipping enrichment: %s", exc)
            return renders

        for entry in payload.get("summaries", []):
            idx = entry.get("index")
            if not isinstance(idx, int) or idx >= len(renders):
                continue
            renders[idx].caption = entry.get("caption")
            renders[idx].room = entry.get("room")
            renders[idx].is_hero = bool(entry.get("is_hero_candidate"))
        return renders

    # ------------------------------------------------------------------
    # Market research (web_search server tool)
    # ------------------------------------------------------------------

    def research_market(self, property_: Property) -> Optional[MarketResearch]:
        """Use Claude's web_search tool to pull comparable listings and
        synthesize pricing/positioning notes."""
        prompt = (
            MARKET_RESEARCH_PROMPT
            + json.dumps(property_.model_dump(mode="json"), indent=2, default=str)
        )

        # The web_search server tool runs a server-side loop; we may need to
        # send the conversation back when we hit pause_turn.
        messages: list[dict] = [{"role": "user", "content": prompt}]

        for _ in range(6):  # safety cap on server-tool continuations
            response = self.client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                tools=[{"type": "web_search_20260209", "name": "web_search"}],
                messages=messages,
            )
            if response.stop_reason == "pause_turn":
                messages.append({"role": "assistant", "content": response.content})
                continue
            break
        else:
            log.warning("market research exceeded continuation cap")
            return None

        text_blocks = [b.text for b in response.content if b.type == "text"]
        if not text_blocks:
            return None

        try:
            payload = _extract_first_json("\n".join(text_blocks))
        except Exception as exc:
            log.warning("market research returned non-JSON: %s", exc)
            return None

        comps = [MarketComparable(**c) for c in payload.get("comparables", [])]
        price_range = payload.get("suggested_price_range_aed")
        price_tuple = tuple(price_range) if isinstance(price_range, list) and len(price_range) == 2 else None
        return MarketResearch(
            comparables=comps,
            summary=payload.get("summary", ""),
            suggested_price_range_aed=price_tuple,
            positioning_notes=payload.get("positioning_notes", ""),
        )

    # ------------------------------------------------------------------
    # Per-platform listing generation
    # ------------------------------------------------------------------

    def _platform_languages(self, platform: str) -> list[Language]:
        spec = self.platforms.get(platform, {})
        langs = spec.get("languages", ["en"])
        return [Language(l) for l in langs]

    def _render_summaries_text(self, renders: list[Render]) -> str:
        if not renders:
            return ""
        lines = []
        for i, r in enumerate(renders):
            parts = [f"Render {i + 1}"]
            if r.room:
                parts.append(f"[{r.room}]")
            if r.is_hero:
                parts.append("(hero candidate)")
            if r.caption:
                parts.append("— " + r.caption)
            lines.append(" ".join(parts))
        return "\n".join(lines)

    def _market_summary_text(self, research: Optional[MarketResearch]) -> str:
        if not research:
            return ""
        lines = [research.summary, research.positioning_notes]
        if research.suggested_price_range_aed:
            low, high = research.suggested_price_range_aed
            lines.append(f"Suggested price range (indicative): AED {low:,.0f} – {high:,.0f}")
        return "\n".join(filter(None, lines))

    def _generate_one(
        self,
        *,
        property_: Property,
        platform: str,
        language: Language,
        market: Optional[MarketResearch],
        price_table: PriceTable,
        sales_offer_text: str,
    ) -> PlatformListing:
        property_dict = property_.model_dump(mode="json", exclude={"renders", "sales_offer_document"})
        if sales_offer_text:
            property_dict["sales_offer_excerpt"] = sales_offer_text[:6_000]

        user_prompt = render_listing_request(
            platform=platform,
            language=language.value,
            property_dict=property_dict,
            render_summaries=self._render_summaries_text(property_.renders),
            market_summary=self._market_summary_text(market),
            price_table_text=format_price_table(price_table),
        )

        response = self.client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            thinking={"type": "adaptive"},
            system=self._system_blocks(),
            messages=[{"role": "user", "content": user_prompt}],
        )

        text = "\n".join(b.text for b in response.content if b.type == "text")
        try:
            payload = _extract_first_json(text)
        except Exception as exc:
            log.error("listing JSON parse failed for %s/%s: %s", platform, language, exc)
            return PlatformListing(
                platform=platform,
                language=language,
                title=f"[generation failed]",
                body=text,
                warnings=[f"JSON parse failed: {exc}"],
            )

        warnings = self._enforce_platform_limits(platform, payload)
        return PlatformListing(
            platform=platform,
            language=language,
            title=payload.get("title", ""),
            body=payload.get("body", ""),
            cta=payload.get("cta", ""),
            hashtags=payload.get("hashtags", []) or [],
            price_table=price_table,
            warnings=warnings,
        )

    def _enforce_platform_limits(self, platform: str, payload: dict) -> list[str]:
        spec = self.platforms.get(platform, {})
        warnings: list[str] = []
        title_max = spec.get("title_max_chars")
        body_max = spec.get("description_max_chars")
        if title_max and len(payload.get("title", "")) > title_max:
            warnings.append(f"title exceeded {title_max} chars; truncating")
            payload["title"] = payload["title"][: title_max - 1].rstrip() + "…"
        if body_max and len(payload.get("body", "")) > body_max:
            warnings.append(f"body exceeded {body_max} chars; truncating")
            payload["body"] = payload["body"][: body_max - 1].rstrip() + "…"
        return warnings

    # ------------------------------------------------------------------
    # Top-level entry point
    # ------------------------------------------------------------------

    def generate(
        self,
        property_: Property,
        *,
        platforms: Optional[list[str]] = None,
        do_market_research: bool = True,
        analyze_renders: bool = True,
    ) -> Listing:
        """Generate listings across every requested platform and language."""
        platforms = platforms or list(self.platforms.keys())

        # 1. Enrich renders with vision captions.
        if analyze_renders and property_.renders:
            property_.renders = self.analyze_renders(property_.renders)

        # 2. Extract sales offer text if provided.
        sales_offer_text = ""
        if property_.sales_offer_document and Path(property_.sales_offer_document).exists():
            sales_offer_text = extract_sales_offer_text(property_.sales_offer_document)

        # 3. Market research.
        market: Optional[MarketResearch] = None
        if do_market_research:
            try:
                market = self.research_market(property_)
            except Exception as exc:
                log.warning("market research failed, continuing without it: %s", exc)

        # 4. Build price table (multi-currency).
        price_table = build_price_table(property_.price, self.target_currencies)

        # 5. Generate listings.
        listings: list[PlatformListing] = []
        for platform in platforms:
            if platform not in self.platforms:
                log.warning("unknown platform %s, skipping", platform)
                continue
            for language in self._platform_languages(platform):
                listing = self._generate_one(
                    property_=property_,
                    platform=platform,
                    language=language,
                    market=market,
                    price_table=price_table,
                    sales_offer_text=sales_offer_text,
                )
                listings.append(listing)
                log.info(
                    "generated %s/%s for %s (%d chars body%s)",
                    platform,
                    language.value,
                    property_.reference_id,
                    len(listing.body),
                    "; warnings: " + ", ".join(listing.warnings) if listing.warnings else "",
                )

        return Listing(
            property_reference=property_.reference_id,
            platform_listings=listings,
            market_research=market,
        )
