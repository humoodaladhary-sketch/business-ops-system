"""Data models for the property listing agent."""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PropertyType(str, Enum):
    APARTMENT = "apartment"
    VILLA = "villa"
    TOWNHOUSE = "townhouse"
    PENTHOUSE = "penthouse"
    STUDIO = "studio"
    DUPLEX = "duplex"
    LAND = "land"
    OFFICE = "office"


class CompletionStatus(str, Enum):
    READY = "ready"
    OFF_PLAN = "off_plan"
    UNDER_CONSTRUCTION = "under_construction"


class ListingIntent(str, Enum):
    SALE = "sale"
    RENT = "rent"


class Language(str, Enum):
    EN = "en"
    AR = "ar"


class Render(BaseModel):
    """A single render or photo of the property."""

    path: Path
    caption: Optional[str] = None  # populated by vision analysis
    room: Optional[str] = None     # e.g. "living room", "master bedroom"
    is_hero: bool = False


class Price(BaseModel):
    """Monetary amount in a specific currency."""

    amount: Decimal
    currency: str = "AED"   # ISO 4217

    @field_validator("currency")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()


class Property(BaseModel):
    """Canonical property record. One Property produces many PlatformListings."""

    # Identity
    reference_id: str                  # internal SKU, e.g. "ALW-PALM-2045"
    name: Optional[str] = None         # e.g. "Villa 2045, Palm Jumeirah"

    # Classification
    property_type: PropertyType
    completion_status: CompletionStatus = CompletionStatus.READY
    intent: ListingIntent = ListingIntent.SALE

    # Location
    community: str                     # e.g. "Palm Jumeirah"
    sub_community: Optional[str] = None
    city: str = "Dubai"
    country: str = "United Arab Emirates"

    # Physical
    bedrooms: int
    bathrooms: float                   # half-baths allowed
    built_up_area_sqft: float
    plot_area_sqft: Optional[float] = None
    floors: Optional[int] = None
    year_built: Optional[int] = None
    furnishing: Optional[str] = None   # "furnished", "unfurnished", "semi-furnished"

    # Commercial
    price: Price
    service_charge_aed_per_sqft: Optional[float] = None

    # Feature set — free-form strings; agent normalizes via branding vocabulary
    amenities: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)

    # Inputs the agent ingests
    renders: list[Render] = Field(default_factory=list)
    sales_offer_document: Optional[Path] = None

    # Compliance
    rera_permit: Optional[str] = None
    dld_permit: Optional[str] = None

    # Free-form context the broker wants the agent to know
    broker_notes: Optional[str] = None


class MarketComparable(BaseModel):
    """A comparable listing pulled from the web for context."""

    source: str               # "bayut.com", "propertyfinder.ae", etc.
    title: str
    price_aed: Optional[float] = None
    bedrooms: Optional[int] = None
    area_sqft: Optional[float] = None
    url: Optional[str] = None
    notes: Optional[str] = None


class MarketResearch(BaseModel):
    """Aggregated market research output."""

    comparables: list[MarketComparable] = Field(default_factory=list)
    summary: str
    suggested_price_range_aed: Optional[tuple[float, float]] = None
    positioning_notes: str = ""


class PriceTable(BaseModel):
    """Multi-currency price table."""

    base: Price
    converted: dict[str, Decimal] = Field(default_factory=dict)   # ISO code -> amount


class PlatformListing(BaseModel):
    """A platform-specific rendered listing, one language."""

    platform: str          # "website" | "instagram" | "dubizzle" | ...
    language: Language
    title: str
    body: str              # markdown or plain text depending on platform
    hashtags: list[str] = Field(default_factory=list)
    cta: str = ""
    price_table: Optional[PriceTable] = None
    warnings: list[str] = Field(default_factory=list)  # e.g. "title exceeded N chars, truncated"


class Listing(BaseModel):
    """The full set of generated listings across every platform/language."""

    property_reference: str
    platform_listings: list[PlatformListing] = Field(default_factory=list)
    market_research: Optional[MarketResearch] = None

    def for_platform(self, platform: str, language: Language = Language.EN) -> Optional[PlatformListing]:
        for pl in self.platform_listings:
            if pl.platform == platform and pl.language == language:
                return pl
        return None
