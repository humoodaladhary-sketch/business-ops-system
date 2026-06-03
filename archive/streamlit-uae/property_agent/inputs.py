"""Input ingestion: inventory files, sales offer PDFs, and render images.

Renders are described using Claude's vision capabilities so the language model
that later writes the listing has a textual summary of what's in every image.
"""

from __future__ import annotations

import base64
import mimetypes
from decimal import Decimal
from pathlib import Path
from typing import Iterable

import pandas as pd

from .models import CompletionStatus, ListingIntent, Price, Property, PropertyType, Render


# ---------------------------------------------------------------------------
# Inventory parsing
# ---------------------------------------------------------------------------

# Tolerant column map. Header names are lower-cased and stripped before lookup.
COLUMN_ALIASES: dict[str, str] = {
    "ref": "reference_id",
    "reference": "reference_id",
    "reference id": "reference_id",
    "sku": "reference_id",
    "name": "name",
    "property name": "name",
    "type": "property_type",
    "property type": "property_type",
    "status": "completion_status",
    "completion": "completion_status",
    "intent": "intent",
    "for": "intent",
    "community": "community",
    "area": "community",
    "sub community": "sub_community",
    "sub-community": "sub_community",
    "city": "city",
    "country": "country",
    "bedrooms": "bedrooms",
    "beds": "bedrooms",
    "br": "bedrooms",
    "bathrooms": "bathrooms",
    "baths": "bathrooms",
    "ba": "bathrooms",
    "bua": "built_up_area_sqft",
    "built up area": "built_up_area_sqft",
    "built-up area": "built_up_area_sqft",
    "size sqft": "built_up_area_sqft",
    "size": "built_up_area_sqft",
    "plot": "plot_area_sqft",
    "plot area": "plot_area_sqft",
    "floors": "floors",
    "year": "year_built",
    "year built": "year_built",
    "furnishing": "furnishing",
    "price": "price_amount",
    "price aed": "price_amount",
    "currency": "price_currency",
    "service charge": "service_charge_aed_per_sqft",
    "amenities": "amenities",
    "features": "features",
    "rera": "rera_permit",
    "rera permit": "rera_permit",
    "dld": "dld_permit",
    "notes": "broker_notes",
    "broker notes": "broker_notes",
}


def _normalize_header(name: str) -> str:
    return str(name).strip().lower()


def _split_list_cell(value) -> list[str]:
    if pd.isna(value):
        return []
    return [item.strip() for item in str(value).split(",") if item.strip()]


def _coerce_enum(value, enum_cls, default):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return default
    raw = str(value).strip().lower().replace(" ", "_").replace("-", "_")
    try:
        return enum_cls(raw)
    except ValueError:
        return default


def parse_inventory(path: Path) -> list[Property]:
    """Parse a CSV or Excel inventory sheet into Property records."""
    path = Path(path)
    if path.suffix.lower() in {".xlsx", ".xls"}:
        df = pd.read_excel(path)
    else:
        df = pd.read_csv(path)

    # Rename columns to canonical names.
    df = df.rename(columns={c: COLUMN_ALIASES.get(_normalize_header(c), _normalize_header(c)) for c in df.columns})

    properties: list[Property] = []
    for _, row in df.iterrows():
        price_amount = row.get("price_amount")
        if pd.isna(price_amount):
            continue  # skip rows with no price
        currency = row.get("price_currency")
        if pd.isna(currency) or not currency:
            currency = "AED"

        prop = Property(
            reference_id=str(row["reference_id"]).strip(),
            name=(str(row["name"]).strip() if "name" in row and not pd.isna(row.get("name")) else None),
            property_type=_coerce_enum(row.get("property_type"), PropertyType, PropertyType.APARTMENT),
            completion_status=_coerce_enum(row.get("completion_status"), CompletionStatus, CompletionStatus.READY),
            intent=_coerce_enum(row.get("intent"), ListingIntent, ListingIntent.SALE),
            community=str(row.get("community", "")).strip(),
            sub_community=(str(row["sub_community"]).strip() if "sub_community" in row and not pd.isna(row.get("sub_community")) else None),
            city=str(row.get("city", "Dubai")).strip() or "Dubai",
            country=str(row.get("country", "United Arab Emirates")).strip() or "United Arab Emirates",
            bedrooms=int(row["bedrooms"]),
            bathrooms=float(row["bathrooms"]),
            built_up_area_sqft=float(row["built_up_area_sqft"]),
            plot_area_sqft=(float(row["plot_area_sqft"]) if "plot_area_sqft" in row and not pd.isna(row.get("plot_area_sqft")) else None),
            floors=(int(row["floors"]) if "floors" in row and not pd.isna(row.get("floors")) else None),
            year_built=(int(row["year_built"]) if "year_built" in row and not pd.isna(row.get("year_built")) else None),
            furnishing=(str(row["furnishing"]).strip() if "furnishing" in row and not pd.isna(row.get("furnishing")) else None),
            price=Price(amount=Decimal(str(price_amount)), currency=str(currency).strip()),
            service_charge_aed_per_sqft=(float(row["service_charge_aed_per_sqft"]) if "service_charge_aed_per_sqft" in row and not pd.isna(row.get("service_charge_aed_per_sqft")) else None),
            amenities=_split_list_cell(row.get("amenities")),
            features=_split_list_cell(row.get("features")),
            rera_permit=(str(row["rera_permit"]).strip() if "rera_permit" in row and not pd.isna(row.get("rera_permit")) else None),
            dld_permit=(str(row["dld_permit"]).strip() if "dld_permit" in row and not pd.isna(row.get("dld_permit")) else None),
            broker_notes=(str(row["broker_notes"]).strip() if "broker_notes" in row and not pd.isna(row.get("broker_notes")) else None),
        )
        properties.append(prop)
    return properties


# ---------------------------------------------------------------------------
# Sales offer PDF
# ---------------------------------------------------------------------------

def extract_sales_offer_text(path: Path, max_chars: int = 20_000) -> str:
    """Extract plain text from a sales-offer PDF."""
    from pypdf import PdfReader   # lazy — avoids hard dep when no PDF is used

    reader = PdfReader(str(path))
    chunks: list[str] = []
    total = 0
    for page in reader.pages:
        text = page.extract_text() or ""
        chunks.append(text)
        total += len(text)
        if total >= max_chars:
            break
    return "\n\n".join(chunks)[:max_chars]


# ---------------------------------------------------------------------------
# Render loading (for Claude vision)
# ---------------------------------------------------------------------------

SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def load_renders_as_vision_blocks(renders: Iterable[Render]) -> list[dict]:
    """Build Claude message content blocks for a set of render images.

    Each image is base64-encoded inline. For very large galleries consider the
    Files API instead; that's an easy follow-up and lives in the agent module.
    """
    blocks: list[dict] = []
    for render in renders:
        path = Path(render.path)
        media_type, _ = mimetypes.guess_type(path.name)
        if media_type not in SUPPORTED_IMAGE_TYPES:
            continue
        data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
        blocks.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": data,
                },
            }
        )
    return blocks
