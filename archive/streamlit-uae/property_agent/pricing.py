"""Multi-currency price formatting.

Uses a static rate table by default so the agent works offline. Override
``EXCHANGE_RATES`` at runtime to plug in a live FX feed.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable

from .models import Price, PriceTable

# Rates expressed as units-of-X per 1 AED.
# Update periodically; the agent treats these as indicative.
EXCHANGE_RATES: dict[str, Decimal] = {
    "AED": Decimal("1.000"),
    "USD": Decimal("0.272"),
    "EUR": Decimal("0.252"),
    "GBP": Decimal("0.215"),
    "SAR": Decimal("1.020"),
    "QAR": Decimal("0.990"),
    "KWD": Decimal("0.083"),
    "INR": Decimal("22.80"),
    "CNY": Decimal("1.960"),
    "RUB": Decimal("25.10"),
    "EGP": Decimal("13.40"),
    "TRY": Decimal("9.350"),
}

SYMBOL: dict[str, str] = {
    "AED": "AED",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "SAR": "SAR",
    "QAR": "QAR",
    "KWD": "KWD",
    "INR": "₹",
    "CNY": "¥",
    "RUB": "₽",
    "EGP": "E£",
    "TRY": "₺",
}


def convert(price: Price, target: str) -> Decimal:
    """Convert ``price`` into ``target`` currency using the static table."""
    target = target.upper()
    if target not in EXCHANGE_RATES:
        raise ValueError(f"Unsupported currency: {target}")
    if price.currency not in EXCHANGE_RATES:
        raise ValueError(f"Unsupported source currency: {price.currency}")
    aed_amount = price.amount / EXCHANGE_RATES[price.currency]
    converted = aed_amount * EXCHANGE_RATES[target]
    return converted.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def build_price_table(price: Price, currencies: Iterable[str]) -> PriceTable:
    converted = {
        c.upper(): convert(price, c)
        for c in currencies
        if c.upper() != price.currency
    }
    return PriceTable(base=price, converted=converted)


def format_amount(amount: Decimal, currency: str) -> str:
    """Render an amount with thousands separators and the currency symbol."""
    symbol = SYMBOL.get(currency.upper(), currency.upper())
    # Strip trailing zeros for large round numbers.
    formatted = f"{int(amount):,}"
    if symbol in {"$", "€", "£", "₹", "¥", "₽", "₺"}:
        return f"{symbol}{formatted}"
    return f"{symbol} {formatted}"


def format_price_table(table: PriceTable) -> str:
    """Multi-line human-readable price table for website/brochure use."""
    lines = [f"{format_amount(table.base.amount, table.base.currency)} (primary)"]
    for code, amount in table.converted.items():
        lines.append(f"~ {format_amount(amount, code)}")
    return "\n".join(lines)
