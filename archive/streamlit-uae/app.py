"""Alwalaa Listing Studio — web app.

Run with:

    streamlit run app.py

Upload an inventory sheet, optionally attach renders and a sales-offer PDF,
pick the platforms + languages you want, and the AI generates publication-
ready listings you can copy straight into the Alwalaa CMS, Instagram,
Dubizzle, OpenSouq, Bayut, and Property Finder.
"""

from __future__ import annotations

import logging
import os
import tempfile
from decimal import Decimal
from pathlib import Path
from typing import Optional

import streamlit as st
from dotenv import load_dotenv

from property_agent import PropertyListingAgent
from property_agent.export import listing_to_zip
from property_agent.inputs import parse_inventory
from property_agent.models import (
    CompletionStatus,
    Language,
    ListingIntent,
    Listing,
    Price,
    Property,
    PropertyType,
    Render,
)
from property_agent.pricing import format_price_table
from property_agent.prompts import load_branding, load_platforms

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------------------------------------------------------------------------
# Page config & global styles
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="Alwalaa Listing Studio",
    page_icon="🏛",
    layout="wide",
    initial_sidebar_state="expanded",
)

BRANDING = load_branding()
PLATFORMS = load_platforms()

PRIMARY = BRANDING["visual"]["primary_color_hex"]
GOLD = BRANDING["visual"]["secondary_color_hex"]
IVORY = BRANDING["visual"]["neutral_color_hex"]

st.markdown(
    f"""
    <style>
        .alwalaa-header {{
            background: linear-gradient(135deg, {PRIMARY} 0%, #145C44 100%);
            color: {IVORY};
            padding: 1.5rem 2rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
        }}
        .alwalaa-header h1 {{
            font-family: 'Playfair Display', Georgia, serif;
            margin: 0;
            color: {IVORY};
        }}
        .alwalaa-header .tagline {{
            color: {GOLD};
            font-style: italic;
            margin-top: 0.25rem;
        }}
        .platform-badge {{
            display: inline-block;
            background: {GOLD};
            color: {PRIMARY};
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-right: 6px;
        }}
        .char-counter {{
            font-size: 0.85rem;
            color: #6b6b6b;
        }}
        .char-counter.over {{
            color: #b00020;
            font-weight: 600;
        }}
    </style>
    <div class="alwalaa-header">
        <h1>Alwalaa Listing Studio</h1>
        <div class="tagline">{BRANDING['brand']['tagline_en']}</div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Session state defaults
# ---------------------------------------------------------------------------

if "properties" not in st.session_state:
    st.session_state.properties = []           # list[Property]
if "listings" not in st.session_state:
    st.session_state.listings = {}             # reference_id -> Listing
if "agent" not in st.session_state:
    st.session_state.agent = None              # PropertyListingAgent

# ---------------------------------------------------------------------------
# Sidebar — settings and API key
# ---------------------------------------------------------------------------

with st.sidebar:
    st.header("⚙️ Settings")

    # Look for the key in Streamlit Cloud secrets first, then env, then UI input.
    try:
        api_key_default = st.secrets.get("ANTHROPIC_API_KEY", "")
    except Exception:
        api_key_default = ""
    if not api_key_default:
        api_key_default = os.getenv("ANTHROPIC_API_KEY", "")
    api_key = st.text_input(
        "Anthropic API key",
        value=api_key_default,
        type="password",
        help="Reads from Streamlit secrets / ANTHROPIC_API_KEY env var. Override here for ad-hoc use.",
    )

    st.subheader("Platforms")
    selected_platforms = []
    for plat, spec in PLATFORMS.items():
        label = f"{plat.replace('_', ' ').title()}  ·  {', '.join(spec.get('languages', ['en']))}"
        if st.checkbox(label, value=True, key=f"plat_{plat}"):
            selected_platforms.append(plat)

    st.subheader("Currencies")
    all_currencies = ["AED", "USD", "EUR", "GBP", "SAR", "QAR", "KWD", "INR", "CNY", "RUB", "EGP", "TRY"]
    selected_currencies = st.multiselect(
        "Show prices in",
        options=all_currencies,
        default=["AED", "USD", "EUR", "GBP", "SAR"],
    )

    do_research = st.checkbox(
        "Run live market research (web search)",
        value=True,
        help="Uses Claude's web_search tool to find comparable listings on Bayut/Property Finder. Adds ~30s per property.",
    )
    do_vision = st.checkbox(
        "Analyze uploaded renders with vision",
        value=True,
        help="Captions each render so the copywriter can reference what's in the photos.",
    )

    st.divider()
    st.caption("Brand voice + platform rules are loaded from `config/branding.yaml` and `config/platforms.yaml`. Edit those to retune the AI.")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def get_agent() -> Optional[PropertyListingAgent]:
    if not api_key:
        st.error("Add an Anthropic API key in the sidebar to start.")
        return None
    if (
        st.session_state.agent is None
        or st.session_state.agent.target_currencies != selected_currencies
    ):
        try:
            st.session_state.agent = PropertyListingAgent(
                api_key=api_key,
                target_currencies=selected_currencies or ["AED"],
            )
        except Exception as exc:
            st.error(f"Could not initialize agent: {exc}")
            return None
    return st.session_state.agent


def save_uploads_to_tempdir(uploaded_files) -> list[Path]:
    """Persist Streamlit UploadedFile objects to a temp dir and return paths."""
    if not uploaded_files:
        return []
    tmp = Path(tempfile.mkdtemp(prefix="alwalaa_renders_"))
    paths = []
    for uf in uploaded_files:
        out = tmp / uf.name
        out.write_bytes(uf.getvalue())
        paths.append(out)
    return paths


def render_property_summary(prop: Property) -> str:
    parts = [
        f"**{prop.bedrooms}BR** {prop.property_type.value}",
        f"{prop.community}",
        f"{prop.built_up_area_sqft:,.0f} sqft",
        f"{prop.price.currency} {prop.price.amount:,.0f}",
    ]
    return "  ·  ".join(parts)


def render_listing_panel(listing: Listing) -> None:
    """Render every platform/language for a Listing as tabs with copy & download."""
    if not listing.platform_listings:
        st.warning("No listings generated.")
        return

    if listing.market_research:
        with st.expander("📊 Market research", expanded=False):
            mr = listing.market_research
            if mr.suggested_price_range_aed:
                low, high = mr.suggested_price_range_aed
                st.metric("Suggested price (AED)", f"{low:,.0f} – {high:,.0f}")
            if mr.summary:
                st.markdown(mr.summary)
            if mr.positioning_notes:
                st.markdown("**Positioning:** " + mr.positioning_notes)
            if mr.comparables:
                st.markdown("**Comparables:**")
                for c in mr.comparables:
                    bits = [f"**{c.source}**", c.title]
                    if c.price_aed:
                        bits.append(f"AED {c.price_aed:,.0f}")
                    if c.bedrooms is not None:
                        bits.append(f"{c.bedrooms}BR")
                    if c.area_sqft:
                        bits.append(f"{c.area_sqft:,.0f} sqft")
                    line = " · ".join(str(b) for b in bits if b)
                    if c.url:
                        line += f"  ·  [link]({c.url})"
                    st.markdown(f"- {line}")

    tabs = st.tabs(
        [f"{pl.platform}  ·  {pl.language.value}" for pl in listing.platform_listings]
    )
    for tab, pl in zip(tabs, listing.platform_listings):
        with tab:
            spec = PLATFORMS.get(pl.platform, {})
            title_max = spec.get("title_max_chars")
            body_max = spec.get("description_max_chars")

            if pl.warnings:
                for w in pl.warnings:
                    st.warning(w)

            col1, col2 = st.columns([4, 1])
            with col1:
                st.markdown(f"<span class='platform-badge'>TITLE</span>", unsafe_allow_html=True)
            with col2:
                if title_max:
                    over = len(pl.title) > title_max
                    cls = "char-counter over" if over else "char-counter"
                    st.markdown(
                        f"<div class='{cls}'>{len(pl.title)} / {title_max}</div>",
                        unsafe_allow_html=True,
                    )
            st.code(pl.title, language=None)

            col1, col2 = st.columns([4, 1])
            with col1:
                st.markdown(f"<span class='platform-badge'>BODY</span>", unsafe_allow_html=True)
            with col2:
                if body_max:
                    over = len(pl.body) > body_max
                    cls = "char-counter over" if over else "char-counter"
                    st.markdown(
                        f"<div class='{cls}'>{len(pl.body)} / {body_max}</div>",
                        unsafe_allow_html=True,
                    )
            st.text_area(
                "body_textarea",
                value=pl.body,
                height=320,
                key=f"body_{listing.property_reference}_{pl.platform}_{pl.language.value}",
                label_visibility="collapsed",
            )

            if pl.cta:
                st.markdown(f"<span class='platform-badge'>CTA</span>  {pl.cta}", unsafe_allow_html=True)

            if pl.hashtags:
                st.markdown(
                    f"<span class='platform-badge'>HASHTAGS</span>  "
                    + " ".join(f"`#{h.lstrip('#')}`" for h in pl.hashtags),
                    unsafe_allow_html=True,
                )

            if pl.price_table:
                with st.expander("Pricing in all currencies"):
                    st.code(format_price_table(pl.price_table))

    st.download_button(
        "⬇️ Download all listings as ZIP",
        data=listing_to_zip(listing),
        file_name=f"{listing.property_reference}.zip",
        mime="application/zip",
        key=f"zip_{listing.property_reference}",
    )


def generate_for_property(prop: Property) -> None:
    agent = get_agent()
    if not agent:
        return
    with st.status(f"Generating listings for {prop.reference_id}…", expanded=True) as status:
        if prop.renders:
            status.write(f"📷 Analyzing {len(prop.renders)} render(s)…")
        if do_research:
            status.write("🔎 Researching market comparables…")
        status.write(f"✍️ Writing for {len(selected_platforms)} platform(s)…")
        try:
            listing = agent.generate(
                prop,
                platforms=selected_platforms,
                do_market_research=do_research,
                analyze_renders=do_vision,
            )
            st.session_state.listings[prop.reference_id] = listing
            status.update(
                label=f"✅ Done — {len(listing.platform_listings)} listing(s) generated",
                state="complete",
            )
        except Exception as exc:
            status.update(label=f"❌ Failed: {exc}", state="error")
            st.exception(exc)


# ---------------------------------------------------------------------------
# Main UI — three tabs: inventory upload, single-property form, results
# ---------------------------------------------------------------------------

tab_inventory, tab_single, tab_results = st.tabs(
    ["📋 Inventory upload", "✍️ Single property", "📤 Generated listings"]
)

# --- Inventory tab ---------------------------------------------------------

with tab_inventory:
    st.subheader("Upload an inventory file")
    uploaded = st.file_uploader(
        "CSV or Excel — see `sample_data/sample_inventory.csv` for the column shape",
        type=["csv", "xlsx", "xls"],
    )
    if uploaded is not None:
        tmp = Path(tempfile.mkdtemp()) / uploaded.name
        tmp.write_bytes(uploaded.getvalue())
        try:
            props = parse_inventory(tmp)
            st.session_state.properties = props
            st.success(f"Parsed {len(props)} properties.")
        except Exception as exc:
            st.error(f"Could not parse inventory: {exc}")

    if st.session_state.properties:
        st.divider()
        st.subheader("Properties")
        for i, prop in enumerate(st.session_state.properties):
            with st.expander(f"{prop.reference_id} — {prop.name or prop.community}", expanded=False):
                st.markdown(render_property_summary(prop))
                renders_uploads = st.file_uploader(
                    "Renders (optional)",
                    type=["jpg", "jpeg", "png", "webp"],
                    accept_multiple_files=True,
                    key=f"renders_{i}",
                )
                offer_upload = st.file_uploader(
                    "Sales offer PDF (optional)",
                    type=["pdf"],
                    key=f"offer_{i}",
                )
                if st.button("Generate listings", key=f"gen_{i}", type="primary"):
                    if renders_uploads:
                        prop.renders = [Render(path=p) for p in save_uploads_to_tempdir(renders_uploads)]
                    if offer_upload:
                        tmp = Path(tempfile.mkdtemp()) / offer_upload.name
                        tmp.write_bytes(offer_upload.getvalue())
                        prop.sales_offer_document = tmp
                    generate_for_property(prop)

        st.divider()
        if st.button("⚡ Generate for ALL properties", type="primary"):
            for prop in st.session_state.properties:
                generate_for_property(prop)

# --- Single-property tab ---------------------------------------------------

with tab_single:
    st.subheader("Quick listing — one property at a time")
    with st.form("single_property_form"):
        c1, c2, c3 = st.columns(3)
        with c1:
            ref = st.text_input("Reference ID", value="ALW-NEW-001")
            name = st.text_input("Name (optional)")
            ptype = st.selectbox("Property type", [t.value for t in PropertyType])
            status = st.selectbox("Completion status", [s.value for s in CompletionStatus])
            intent = st.selectbox("For", [i.value for i in ListingIntent])
        with c2:
            community = st.text_input("Community", value="Palm Jumeirah")
            sub_community = st.text_input("Sub-community (optional)")
            city = st.text_input("City", value="Dubai")
            country = st.text_input("Country", value="United Arab Emirates")
            year_built = st.number_input("Year built (optional)", min_value=1980, max_value=2030, value=2024, step=1)
        with c3:
            bedrooms = st.number_input("Bedrooms", min_value=0, max_value=20, value=3)
            bathrooms = st.number_input("Bathrooms", min_value=0.0, max_value=20.0, value=3.5, step=0.5)
            built_up = st.number_input("Built-up area (sqft)", min_value=200.0, value=2400.0, step=100.0)
            price_amt = st.number_input("Price", min_value=0.0, value=4500000.0, step=100000.0)
            price_ccy = st.selectbox("Currency", ["AED", "USD", "EUR", "GBP", "SAR"])

        amenities_raw = st.text_input(
            "Amenities (comma-separated)",
            value="Private Pool, Smart Home, Sea View, Covered Parking",
        )
        features_raw = st.text_input(
            "Features (comma-separated)",
            value="Floor-to-ceiling windows, Italian kitchen",
        )
        rera = st.text_input("RERA permit (optional)")
        notes = st.text_area("Broker notes (optional)", height=80)

        c1, c2 = st.columns(2)
        with c1:
            renders_uploads = st.file_uploader(
                "Renders",
                type=["jpg", "jpeg", "png", "webp"],
                accept_multiple_files=True,
                key="single_renders",
            )
        with c2:
            offer_upload = st.file_uploader(
                "Sales offer PDF",
                type=["pdf"],
                key="single_offer",
            )

        submitted = st.form_submit_button("✨ Generate listings", type="primary")

    if submitted:
        prop = Property(
            reference_id=ref.strip(),
            name=name.strip() or None,
            property_type=PropertyType(ptype),
            completion_status=CompletionStatus(status),
            intent=ListingIntent(intent),
            community=community.strip(),
            sub_community=sub_community.strip() or None,
            city=city.strip(),
            country=country.strip(),
            bedrooms=int(bedrooms),
            bathrooms=float(bathrooms),
            built_up_area_sqft=float(built_up),
            year_built=int(year_built) if year_built else None,
            price=Price(amount=Decimal(str(price_amt)), currency=price_ccy),
            amenities=[a.strip() for a in amenities_raw.split(",") if a.strip()],
            features=[f.strip() for f in features_raw.split(",") if f.strip()],
            rera_permit=rera.strip() or None,
            broker_notes=notes.strip() or None,
        )
        if renders_uploads:
            prop.renders = [Render(path=p) for p in save_uploads_to_tempdir(renders_uploads)]
        if offer_upload:
            tmp = Path(tempfile.mkdtemp()) / offer_upload.name
            tmp.write_bytes(offer_upload.getvalue())
            prop.sales_offer_document = tmp

        # Add to inventory list so it shows under "results" too.
        existing = next((i for i, p in enumerate(st.session_state.properties) if p.reference_id == prop.reference_id), None)
        if existing is not None:
            st.session_state.properties[existing] = prop
        else:
            st.session_state.properties.append(prop)
        generate_for_property(prop)

# --- Results tab -----------------------------------------------------------

with tab_results:
    if not st.session_state.listings:
        st.info("No listings generated yet. Use the **Inventory upload** or **Single property** tab.")
    else:
        for ref_id, listing in st.session_state.listings.items():
            prop = next((p for p in st.session_state.properties if p.reference_id == ref_id), None)
            header = f"{ref_id}"
            if prop:
                header += f" — {prop.name or prop.community}"
            with st.container(border=True):
                st.subheader(header)
                if prop:
                    st.caption(render_property_summary(prop))
                render_listing_panel(listing)
