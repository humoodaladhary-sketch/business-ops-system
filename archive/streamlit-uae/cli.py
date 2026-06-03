"""Alwalaa property listing agent — CLI.

Typical usage:

    # Full inventory at once
    python cli.py batch --inventory sample_data/sample_inventory.csv

    # Single property with renders and a sales offer PDF
    python cli.py single \\
        --inventory sample_data/sample_inventory.csv \\
        --reference ALW-PALM-2045 \\
        --renders renders/palm/*.jpg \\
        --offer offers/palm_2045.pdf \\
        --platform website --platform instagram

    # Skip market research (faster, offline-friendlier)
    python cli.py batch --inventory inv.csv --no-research
"""

from __future__ import annotations

import glob
import logging
import os
import sys
from pathlib import Path

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.logging import RichHandler
from rich.table import Table

from property_agent import PropertyListingAgent, Render
from property_agent.inputs import parse_inventory
from property_agent.output import save_listing


console = Console()
load_dotenv()


def _configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(message)s",
        handlers=[RichHandler(console=console, show_path=False, markup=True)],
    )


def _expand_renders(patterns: tuple[str, ...]) -> list[Render]:
    paths: list[Path] = []
    for p in patterns:
        matches = sorted(Path(m) for m in glob.glob(p))
        paths.extend(matches if matches else [Path(p)])
    return [Render(path=p) for p in paths if p.exists()]


@click.group()
@click.option("--verbose", "-v", is_flag=True, help="Verbose logging.")
def cli(verbose: bool) -> None:
    """Alwalaa AI listing generator."""
    _configure_logging(verbose)


@cli.command()
@click.option("--inventory", type=click.Path(exists=True, path_type=Path), required=True)
@click.option("--platform", "platforms", multiple=True, help="Platform to generate for; repeatable. Default: all.")
@click.option("--output-dir", type=click.Path(path_type=Path), default=Path(os.getenv("OUTPUT_DIR", "./generated")))
@click.option("--research/--no-research", default=True, help="Run web-search market research.")
@click.option(
    "--currencies",
    default="AED,USD,EUR,GBP,SAR",
    help="Comma-separated target currencies.",
)
def batch(
    inventory: Path,
    platforms: tuple[str, ...],
    output_dir: Path,
    research: bool,
    currencies: str,
) -> None:
    """Generate listings for every property in an inventory sheet."""
    properties = parse_inventory(inventory)
    if not properties:
        console.print("[red]No properties parsed from inventory.[/red]")
        sys.exit(1)

    agent = PropertyListingAgent(target_currencies=[c.strip() for c in currencies.split(",") if c.strip()])
    output_dir.mkdir(parents=True, exist_ok=True)

    table = Table("Reference", "Platforms", "Output", title="Generated")
    for prop in properties:
        console.print(f"[bold cyan]→ generating[/] {prop.reference_id} · {prop.community}")
        listing = agent.generate(
            prop,
            platforms=list(platforms) if platforms else None,
            do_market_research=research,
        )
        target = save_listing(listing, output_dir)
        table.add_row(
            prop.reference_id,
            ", ".join(sorted({pl.platform for pl in listing.platform_listings})),
            str(target),
        )
    console.print(table)


@cli.command()
@click.option("--inventory", type=click.Path(exists=True, path_type=Path), required=True)
@click.option("--reference", required=True, help="Reference ID from the inventory sheet.")
@click.option("--renders", multiple=True, help="Render file path or glob; repeatable.")
@click.option("--offer", type=click.Path(exists=True, path_type=Path), default=None, help="Sales offer PDF.")
@click.option("--platform", "platforms", multiple=True, help="Platform to generate for; repeatable. Default: all.")
@click.option("--output-dir", type=click.Path(path_type=Path), default=Path(os.getenv("OUTPUT_DIR", "./generated")))
@click.option("--research/--no-research", default=True)
@click.option("--currencies", default="AED,USD,EUR,GBP,SAR")
def single(
    inventory: Path,
    reference: str,
    renders: tuple[str, ...],
    offer: Path | None,
    platforms: tuple[str, ...],
    output_dir: Path,
    research: bool,
    currencies: str,
) -> None:
    """Generate listings for a single property, with optional renders/offer."""
    properties = parse_inventory(inventory)
    match = next((p for p in properties if p.reference_id == reference), None)
    if not match:
        console.print(f"[red]No property with reference {reference} in {inventory}.[/red]")
        sys.exit(1)

    if renders:
        match.renders = _expand_renders(renders)
        console.print(f"[dim]attached {len(match.renders)} render(s)[/dim]")
    if offer:
        match.sales_offer_document = offer
        console.print(f"[dim]attached sales offer {offer}[/dim]")

    agent = PropertyListingAgent(target_currencies=[c.strip() for c in currencies.split(",") if c.strip()])
    listing = agent.generate(
        match,
        platforms=list(platforms) if platforms else None,
        do_market_research=research,
    )
    target = save_listing(listing, output_dir)
    console.print(f"[green]✓ saved to[/] {target}")
    for pl in listing.platform_listings:
        warn = " [yellow](⚠)[/yellow]" if pl.warnings else ""
        console.print(f"  • {pl.platform}/{pl.language.value}{warn}")


if __name__ == "__main__":
    cli()
