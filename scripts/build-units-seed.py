#!/usr/bin/env python3
"""
build-units-seed.py — Alwalaa Real Estate: Master Listing Tracker -> DB seed.

Parses the flattened Google Sheet export (markdown tables inside a JSON
{fileContent: ...} wrapper) and emits:
  1. alwalaa-units-seed.csv                 (review artifact)
  2. supabase/seeds/units_seed.sql          (idempotent seed)

Blocks in the export (detected by header signatures, not hardcoded offsets):
  A. MAIN tab            — curated broker stock. Ref No = external_id.
  B. Second small tab    — one The Great Escape row (TGE1, dup of main).
  C. Dubizzle Oman block — ad-slot rows with NO unit ref -> UNMATCHED-*.
  D. Sarooj tab          — one SAR1 row.
  E. Developer price list (Floor | Unit No ID | Sky Villa/... ) —
     project EVIDENCED as Yenaier Residence: the ID:100.* scheme is exactly
     the main tab's YEN1..YEN4 unit numbers, and ID:100.PH.01 matches YEN4's
     price 506,077 to the rial. (NOT Sarooj Oasis.)
  F. AIDA OCEANA list    — sq.ft -> sqm (x 0.092903), price col is OMR.
  G. Availability list   — project EVIDENCED as Wadi Zaha: E22/E24/E26/E27
     unit codes are the same scheme as main-tab WAZ1..WAZ5 (all Wadi Zaha,
     e.g. E24-V001=WAZ4, E26-B401=WAZ1). Includes "phase 3" Garden Row Homes
     rows without unit codes -> UNMATCHED-*.

Dedup rule (per spec): same external_id twice -> keep the richer row
(most non-empty, non-link cells; tie -> first occurrence), note the dup,
report the dropped rows.
"""

import csv
import json
import os
import re
import sys

ORG_ID = "6a32be59-155d-4662-9058-3a74fb2b6872"
REVIEW_PROJECT = "Review — unmatched listings"
SQFT_TO_SQM = 0.092903

DEFAULT_INPUT = (
    "/root/.claude/projects/-home-user-business-ops-system/"
    "7d98c1b0-cb22-5d2f-abfb-f97d14a71ae1/tool-results/"
    "mcp-Google_Drive-read_file_content-1784900046519.txt"
)
REPO = "/home/user/business-ops-system"
CSV_OUT = os.path.join(REPO, "alwalaa-units-seed.csv")
SQL_OUT = os.path.join(REPO, "supabase", "seeds", "units_seed.sql")

# --------------------------------------------------------------------------
# Project resolution: sheet project name -> (catalog name, developer, note)
# Catalog names are EXACTLY the 0007_projects_seed.up.sql names.
# Developer: task mapping list first; else the catalog project's developer
# (from migration 0007); else blank.
# --------------------------------------------------------------------------
PROJECT_MAP = {
    "ahed sarooj oasis":        ("Sarooj Oasis", "Sarooj Development", None),
    "sarooj oasis":             ("Sarooj Oasis", "Sarooj Development", None),
    "aida":                     ("AIDA", "Dar Global / AIDA", None),
    "aida oceana by darglobal": ("AIDA", "Dar Global / AIDA", None),
    "amazi":                    ("Jebel Sifah / Hawana Salalah", "Muriya",
                                 "Amazi (Hawana Salalah sub-project) mapped to catalog Jebel Sifah / Hawana Salalah"),
    "amour sans detour":        ("AIDA", "Dar Global / AIDA",
                                 "project inferred as AIDA (Yiti location, AD-* unit code)"),
    "armani":                   ("AIDA", "Dar Global / AIDA", None),
    "bellevue residence":       ("Bellevue", "Ideal Buildings", "developer from project catalog"),
    "hawana salalah":           ("Jebel Sifah / Hawana Salalah", "Muriya", "developer from project catalog"),
    "hay al wafa":              ("Hay Al Wafa", "Al Abrar", "developer from project catalog"),
    "iconic tower":             (REVIEW_PROJECT, "", "project 'Iconic Tower' not in project catalog — review"),
    "jebel sifa":               ("Jebel Sifah / Hawana Salalah", "Muriya", "developer from project catalog"),
    "jebel sifah":              ("Jebel Sifah / Hawana Salalah", "Muriya", "developer from project catalog"),
    "jebel sifah farms":        ("Jebel Sifah / Hawana Salalah", "Muriya", "developer from project catalog"),
    "jinan island - alaya":     ("Al Mouj Muscat", "Al Mouj Muscat (MAF)", None),
    "luma residence":           ("Muscat Bay", "Saraya Bandar Jissah",
                                 "LUMA Residence mapped to Muscat Bay master plan; developer from project catalog"),
    "marriot":                  ("AIDA", "Dar Global / AIDA", None),
    "marriot golf residences":  ("AIDA", "Dar Global / AIDA", None),
    "marriott residences":      ("AIDA", "Dar Global / AIDA", None),
    "muscat bay":               ("Muscat Bay", "Saraya Bandar Jissah", "developer from project catalog"),
    "nickelodeon hotels & resorts": ("AIDA", "Dar Global / AIDA", None),
    "olive farms":              ("Jebel Sifah / Hawana Salalah", "Muriya", None),
    "raya villa":               ("Jebel Sifah / Hawana Salalah", "Muriya", None),
    "riviera residences":       ("Jebel Sifah / Hawana Salalah", "Muriya", None),
    "solaris apartment":        ("Jebel Sifah / Hawana Salalah", "Muriya", None),
    "standalone":               (REVIEW_PROJECT, "", "project 'Standalone' not in project catalog — review"),
    "sustainable city":         ("The Sustainable City — Yiti", "Diamond Developers", "developer from project catalog"),
    "sustainable city yiti":    ("The Sustainable City — Yiti", "Diamond Developers", "developer from project catalog"),
    "the great escape":         ("AIDA", "Dar Global / AIDA", None),
    "trump cliff villas":       ("AIDA", "Dar Global / AIDA", "Trump = AIDA branded residence (per catalog)"),
    "trump golf villa":         ("AIDA", "Dar Global / AIDA", "Trump = AIDA branded residence (per catalog)"),
    "villa coconut":            (REVIEW_PROJECT, "", "project 'Villa Coconut' not in project catalog — review"),
    "wadi zaha":                ("Wadi Zaha", "Al Ahly Sabbour", None),
    "yenaier residence":        ("Yenaier Residences / Hay Al We'am", "Adrak / Adanté",
                                 "developer from project catalog"),
}


def norm_project(name):
    n = name.strip().lower()
    n = n.replace("é", "e").replace("–", "-").replace("—", "-")
    n = re.sub(r"\s+", " ", n)
    return n


def resolve_project(sheet_name, unresolved_log):
    key = norm_project(sheet_name)
    if key in PROJECT_MAP:
        return PROJECT_MAP[key]
    unresolved_log.append(sheet_name)
    return (REVIEW_PROJECT, "", f"project '{sheet_name}' not in project catalog — review")


# --------------------------------------------------------------------------
# Cell / value parsing helpers
# --------------------------------------------------------------------------
def split_row(line):
    cells = re.split(r"(?<!\\)\|", line)
    cells = [re.sub(r"\\(.)", r"\1", c).strip() for c in cells]
    if cells and cells[0] == "":
        cells = cells[1:]
    if cells and cells[-1] == "":
        cells = cells[:-1]
    return cells


LINKISH = {"link", "no link", "lnk", "2 ads link", "no  link"}


def richness(cells):
    return sum(1 for c in cells if c and c.lower() not in LINKISH)


def parse_price(s):
    if not s:
        return None
    m = re.search(r"[\d,]+(?:\.\d+)?", s.replace(" ", ""))
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def parse_beds(s):
    """Return (bedrooms:int|None, note:str|None)."""
    if not s:
        return None, None
    t = s.strip()
    if t.lower().startswith("studio"):
        return 0, None
    m = re.match(r"^(\d+)\s*\+\s*(.+)$", t)
    if m:
        base = int(m.group(1))
        extra = m.group(2).strip()
        if extra == "1":
            return base, f"+1 maid room (sheet beds '{t}')"
        if extra == "!":
            return base, f"sheet beds '{t}' — typo, assumed {base}+1 maid room"
        return base, f"+{extra} extra room(s) (sheet beds '{t}')"
    m = re.match(r"^(\d+)", t)
    if m:
        return int(m.group(1)), None
    return None, f"unparsed beds '{t}'"


def parse_baths(s):
    if not s:
        return None
    m = re.match(r"^(\d+(?:\.\d+)?)", s.strip())
    return float(m.group(1)) if m else None


def parse_size(s):
    """Return (area_sqm:float|None, note:str|None) for the messy main-tab Size cell."""
    if not s:
        return None, "no size in sheet"
    t = s.strip()
    low = t.lower()
    if "gfa" in low:
        gfa = re.search(r"gfa:?\s*([\d.]+)", low)
        plot = re.search(r"plot\s*area:?\s*([\d.]+)", low)
        note = None
        if plot:
            note = f"GFA used; plot area {plot.group(1)} sqm"
        return (float(gfa.group(1)) if gfa else None), note
    m = re.match(r"^([\d.]+)\s*\+\s*([\d.]+)$", t)
    if m:
        return float(m.group(1)), f"size '{t}' — first figure used, +{m.group(2)} likely terrace/plot"
    m = re.match(r"^([\d.]+)\s+and\s+([\d.]+)$", low)
    if m:
        return float(m.group(1)), f"size '{t}' — first figure used, second likely plot/garden"
    m = re.match(r"^([\d.]+)\s*-\s*([\d.]+)$", t)
    if m:
        return float(m.group(1)), f"size range '{t}' — lower bound used"
    m = re.search(r"([\d.]+(?:\.\d+)?)", t)
    if m:
        note = None
        rest = t.replace(m.group(1), "").replace("SQM", "").replace("sqm", "").strip()
        if rest:
            note = f"size cell was '{t}'"
        return float(m.group(1)), note
    return None, f"unparsed size '{t}'"


BATHS_RE = re.compile(r"(\d+)\s*BD")


def beds_from_type(t):
    low = t.lower()
    if "studio" in low:
        return 0
    m = re.search(r"(\d+)\s*\+\s*1\s*br", low)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+)\s*(?:bd|br|bhk)", low)
    if m:
        return int(m.group(1))
    return None


def map_unit_type(raw, beds_raw=""):
    """Map sheet type text -> unit_type enum. Returns (enum, extra_note|None)."""
    r = (raw or "").lower()
    b = (beds_raw or "").lower()
    if "loggia" in r or r.strip() == "studio" or "studio" in b:
        return "studio", None
    if "sky palace" in r:
        return "penthouse", f"sheet type '{raw}' mapped to penthouse (ID:100.PH.* = penthouse)"
    if "pent house" in r or "penthouse" in r:
        return "penthouse", None
    if "sky villa" in r:
        return "sky_villa", None
    if "sky residence" in r:
        return "apartment", f"sheet type '{raw}' mapped to apartment"
    if "townhouse" in r or "town house" in r:
        return "townhouse", None
    if "row home" in r or "row homes" in r:
        return "townhouse", f"sheet type '{raw}' mapped to townhouse"
    if "farmhouse" in r:
        return "villa", f"sheet type '{raw}' mapped to villa"
    if "villa" in r:
        return "villa", None
    if "duplex" in r:
        return "duplex", None
    if "apartment" in r or "apt" in r or "bhk" in r or "residence" in r:
        return "apartment", None
    if "studio" in r:
        return "studio", None
    return "apartment", f"unmappable sheet type '{raw}' — defaulted to apartment"


def join_notes(*parts):
    return "; ".join(p for p in parts if p)


# --------------------------------------------------------------------------
# Unit record + dedup store
# --------------------------------------------------------------------------
class Unit:
    __slots__ = ("external_id", "project", "developer", "unit_type_raw", "unit_type_enum",
                 "bedrooms", "bathrooms", "area_sqm", "price_omr", "status", "review_flag",
                 "source_tab", "notes", "richness", "raw_line")

    def __init__(self, **kw):
        for k in self.__slots__:
            setattr(self, k, kw.get(k))


units = {}          # external_id -> Unit (kept)
order = []          # kept external_ids in first-seen order
dropped = []        # (external_id, source_tab, reason, summary)
unresolved_projects = []
unmatched_counter = 0


def add_unit(u: Unit):
    ext = u.external_id
    if ext not in units:
        units[ext] = u
        order.append(ext)
        return
    kept = units[ext]
    if u.richness > kept.richness:
        winner, loser = u, kept
    else:
        winner, loser = kept, u
    summary = (f"{loser.source_tab}: {loser.unit_type_raw or '?'} | {loser.project} | "
               f"{loser.area_sqm or '?'} sqm | {loser.price_omr or '?'} OMR")
    winner.notes = join_notes(
        winner.notes,
        f"ref '{ext}' reused in sheet — dup dropped ({summary}); fix refs in tracker")
    dropped.append((ext, loser.source_tab, "duplicate external_id — kept richer row", summary))
    if winner is not kept:
        units[ext] = winner


def next_unmatched():
    global unmatched_counter
    unmatched_counter += 1
    return f"UNMATCHED-{unmatched_counter:03d}"


# --------------------------------------------------------------------------
# Load input
# --------------------------------------------------------------------------
def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INPUT
    with open(src) as f:
        content = json.load(f)["fileContent"]
    lines = content.split("\n")

    main_unit_numbers = {}   # unit-number text -> ref (for cross-tab same-unit notes)

    # ---- locate blocks by header signature -------------------------------
    i = 0
    broker_header_seen = 0
    n = len(lines)
    while i < n:
        line = lines[i]

        # A/B/D: broker-tab headers ("Unit Type | Ref No | Category | ...")
        if "Unit Type | Ref No | Category" in line:
            broker_header_seen += 1
            tab = {1: "main", 2: "main_tab2", 3: "sarooj_tab"}.get(broker_header_seen,
                                                                   f"broker_tab_{broker_header_seen}")
            i += 1
            while i < n and lines[i].strip():
                cells = split_row(lines[i])
                if len(cells) >= 12 and cells[1]:
                    parse_broker_row(cells, tab, main_unit_numbers)
                i += 1
            continue

        # C: Dubizzle ad-slot block
        if "Dubizzle Oman" in line:
            i += 1
            new_package = False
            while i < n and lines[i].strip():
                cells = split_row(lines[i])
                nonempty = [c for c in cells if c]
                first = nonempty[0] if nonempty else ""
                if first.startswith("New Packge") or first.startswith("New Package"):
                    new_package = True
                elif first.rstrip() in ("Elite Ads", "Feature Ads", "Premium Ads",
                                        "Elite", "Feature", "Premium"):
                    parse_dubizzle_row(nonempty, new_package)
                i += 1
            continue

        # E: developer price list (Yenaier)
        if "| Unit No ID |" in line:
            i += 1
            while i < n and lines[i].strip():
                cells = split_row(lines[i])
                if len(cells) >= 7 and cells[1].startswith("ID:"):
                    parse_price_list_row(cells, main_unit_numbers)
                i += 1
            continue

        # F: AIDA OCEANA
        if "Saleable Area (sq.ft.)" in line:
            i += 1
            while i < n and lines[i].strip():
                cells = split_row(lines[i])
                if len(cells) >= 8 and cells[2]:
                    parse_oceana_row(cells)
                i += 1
            continue

        # G: availability list (Wadi Zaha) + phase-3 Garden Row Homes
        if "| Unit Code |" in line and "Unit Gross Price" in line:
            i += 1
            phase3 = False
            while i < n:
                if not lines[i].strip():
                    i += 1
                    continue
                cells = split_row(lines[i])
                first = cells[0] if cells else ""
                code = cells[1] if len(cells) > 1 else ""
                if first.lower().startswith("phase 3"):
                    phase3 = True
                elif re.match(r"^E\d\d-", code):
                    parse_availability_row(cells)
                elif first == "Garden Row Homes":
                    parse_garden_row(cells, phase3)
                i += 1
            continue

        i += 1

    write_outputs()


# --------------------------------------------------------------------------
# Row parsers
# --------------------------------------------------------------------------
def parse_broker_row(cells, tab, main_unit_numbers):
    # 17-col main tab: ...| Project Name | OLX | Opensooq | website | IG | Comments
    # 16-col tabs 2/4: col 11 is the project ("Location" second header), last col Comments
    unitno, ref, category, _loc, beds_s, baths_s = cells[0], cells[1], cells[2], cells[3], cells[4], cells[5]
    size_s, price_s, project_s = cells[9], cells[10], cells[11]
    comment = cells[16] if len(cells) >= 17 else (cells[15] if len(cells) >= 16 else "")
    if comment.lower() in LINKISH:
        comment = ""

    beds, beds_note = parse_beds(beds_s)
    baths = parse_baths(baths_s)
    area, size_note = parse_size(size_s)
    price = parse_price(price_s)
    catalog, developer, proj_note = resolve_project(project_s, unresolved_projects)

    enum, type_note = map_unit_type(category, beds_s)
    review = catalog == REVIEW_PROJECT

    unitno_note = None
    if unitno and not re.fullmatch(r"\d+", unitno):
        unitno_note = f"unit no: {unitno}"
        main_unit_numbers[unitno] = ref

    sheet_proj_note = None
    if catalog != project_s.strip():
        sheet_proj_note = f"sheet project: {project_s.strip()}"

    notes = join_notes(unitno_note, sheet_proj_note, proj_note, beds_note, size_note,
                       type_note, comment,
                       "no price in sheet" if price is None else None)
    add_unit(Unit(external_id=ref, project=catalog, developer=developer,
                  unit_type_raw=category, unit_type_enum=enum,
                  bedrooms=beds, bathrooms=baths, area_sqm=area, price_omr=price,
                  status="hold" if review else "available", review_flag=review,
                  source_tab=tab, notes=notes, richness=richness(cells)))


def parse_dubizzle_row(nonempty, new_package):
    ext = next_unmatched()
    ad_type = nonempty[0]
    count = nonempty[1] if len(nonempty) > 1 else ""
    duration = nonempty[2] if len(nonempty) > 2 else ""
    detail = f"ad slot: {ad_type}" + (f" x{count}" if count else "") + \
             (f", {duration}" if duration else "")
    if new_package:
        detail += " (new package, expiry Feb 2027)"
    notes = join_notes("Dubizzle-only ad — no unit ref; review before selling",
                       detail, "no price in sheet")
    enum, type_note = "apartment", f"unmappable sheet type '{ad_type}' — defaulted to apartment"
    notes = join_notes(notes, type_note)
    add_unit(Unit(external_id=ext, project=REVIEW_PROJECT, developer="",
                  unit_type_raw=ad_type, unit_type_enum=enum,
                  bedrooms=None, bathrooms=None, area_sqm=None, price_omr=None,
                  status="hold", review_flag=True, source_tab="dubizzle_ads",
                  notes=notes, richness=len(nonempty)))


def parse_price_list_row(cells, main_unit_numbers):
    floor_s, ext, type_s = cells[0], cells[1], cells[2]
    bua, terrace, sellable = parse_price(cells[3]), parse_price(cells[4]), parse_price(cells[5])
    price1, price2 = parse_price(cells[6]), parse_price(cells[7])
    dub = cells[8] if len(cells) > 8 else ""

    beds = beds_from_type(ext)  # ID:100.L1.3BHK.02 -> 3; SD -> studio
    if "SD" in ext:
        beds = 0
    if ".PH." in ext:
        beds = beds if beds is not None else None
    enum, type_note = map_unit_type(type_s)

    cross = None
    if ext in main_unit_numbers:
        cross = (f"same physical unit as main-tab ref {main_unit_numbers[ext]} "
                 f"(kept both; external ids differ)")
    floor_note = None
    if floor_s and floor_s not in ("#REF!",):
        floor_note = floor_s.title()
    elif floor_s == "#REF!":
        floor_note = "floor: #REF! error in sheet"

    notes = join_notes(
        "project inferred: Yenaier Residence (ID:100.* scheme matches main-tab YEN refs; "
        "ID:100.PH.01 price equals YEN4)",
        floor_note,
        f"BUA {bua} + terrace {terrace} = sellable {sellable} sqm",
        f"second (current) list price {price2:,.0f} OMR — first price column used" if price2 else None,
        f"dub {dub}" if dub else None,
        type_note, cross)
    add_unit(Unit(external_id=ext, project="Yenaier Residences / Hay Al We'am",
                  developer="Adrak / Adanté", unit_type_raw=type_s, unit_type_enum=enum,
                  bedrooms=beds, bathrooms=None, area_sqm=sellable, price_omr=price1,
                  status="available", review_flag=False, source_tab="sky_price_list",
                  notes=notes, richness=richness(cells)))


def parse_oceana_row(cells):
    ext, beds_s, type_s, view = cells[2], cells[3], cells[4], cells[5]
    sqft = parse_price(cells[6])
    price = parse_price(cells[7])
    currency = cells[8] if len(cells) > 8 else ""
    sqm = round(sqft * SQFT_TO_SQM, 2) if sqft else None
    beds, beds_note = parse_beds(beds_s)
    enum, type_note = map_unit_type(type_s)
    notes = join_notes(f"AIDA OCEANA; view: {view}" if view else "AIDA OCEANA",
                       f"{sqft} sq.ft -> {sqm} sqm" if sqft else "no size in sheet",
                       beds_note, type_note,
                       None if currency == "OMR" else f"currency col: {currency}",
                       "AED column ignored")
    add_unit(Unit(external_id=ext, project="AIDA", developer="Dar Global / AIDA",
                  unit_type_raw=type_s, unit_type_enum=enum,
                  bedrooms=beds, bathrooms=None, area_sqm=sqm, price_omr=price,
                  status="available", review_flag=False, source_tab="aida_oceana",
                  notes=notes, richness=richness(cells)))


STATUS_MAP = [("sold", "sold"), ("reserved", "reserved"), ("booked", "reserved"), ("hold", "hold")]


def parse_availability_row(cells):
    ext, type_s, building, floor_s, status_s = cells[1], cells[2], cells[3], cells[4], cells[5]
    area = parse_price(cells[6])
    garden = parse_price(cells[7]) if len(cells) > 7 else None
    terrace = parse_price(cells[8]) if len(cells) > 8 else None
    view = cells[9] if len(cells) > 9 else ""
    position = cells[11] if len(cells) > 11 else ""
    price = parse_price(cells[12]) if len(cells) > 12 else None
    pct5 = parse_price(cells[13]) if len(cells) > 13 else None
    delivery = cells[14] if len(cells) > 14 else ""
    total = parse_price(cells[16]) if len(cells) > 16 else None

    status = "available"
    st_note = None
    low = status_s.lower()
    for k, v in STATUS_MAP:
        if k in low:
            status = v
            break
    else:
        if low and low != "available":
            st_note = f"sheet status '{status_s}' — treated as available"

    beds = beds_from_type(type_s)
    enum, type_note = map_unit_type(type_s)
    bldg_note = f"bldg {building}" if building else None
    if building and building != ext and re.match(r"^E\d\d-", building):
        bldg_note = f"bldg col says {building} (differs from unit code — review typo)"
    notes = join_notes(
        "project inferred: Wadi Zaha (E2x unit codes match main-tab WAZ1–WAZ5 refs)",
        bldg_note,
        f"floor {floor_s}" if floor_s and floor_s != "-" else None,
        f"garden {garden} sqm" if garden else None,
        f"terrace {terrace} sqm" if terrace else None,
        f"view {view}" if view else None,
        f"position {position}" if position else None,
        f"gross price + 5% ({pct5:,.2f}) = {total:,.2f} OMR total" if pct5 and total else None,
        f"delivery {delivery}" if delivery and delivery != "-" else None,
        type_note, st_note)
    add_unit(Unit(external_id=ext, project="Wadi Zaha", developer="Al Ahly Sabbour",
                  unit_type_raw=type_s, unit_type_enum=enum,
                  bedrooms=beds, bathrooms=None, area_sqm=area, price_omr=price,
                  status=status, review_flag=False, source_tab="availability_wadi_zaha",
                  notes=notes, richness=richness(cells)))


def parse_garden_row(cells, phase3):
    ext = next_unmatched()
    position = cells[1] if len(cells) > 1 else ""
    type_s = cells[2] if len(cells) > 2 else ""
    price = parse_price(cells[3]) if len(cells) > 3 else None
    area = parse_price(cells[4]) if len(cells) > 4 else None
    delivery = cells[5] if len(cells) > 5 else ""
    beds, beds_note = parse_beds(type_s.replace("BR", "").strip())
    enum, type_note = map_unit_type("Garden Row Homes", type_s)
    notes = join_notes(
        "no unit code",
        "Garden Row Homes — Wadi Zaha phase 3 (heading in availability tab)" if phase3
        else "Garden Row Homes (availability tab)",
        f"position {position}" if position else None,
        beds_note,
        f"delivery {delivery}" if delivery else None,
        type_note)
    add_unit(Unit(external_id=ext, project="Wadi Zaha", developer="Al Ahly Sabbour",
                  unit_type_raw=f"Garden Row Homes {type_s}".strip(), unit_type_enum=enum,
                  bedrooms=beds, bathrooms=None, area_sqm=area, price_omr=price,
                  status="hold", review_flag=True, source_tab="availability_phase3_garden",
                  notes=notes, richness=richness(cells)))


# --------------------------------------------------------------------------
# Outputs
# --------------------------------------------------------------------------
def sql_str(s):
    if s is None or s == "":
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def sql_num(v):
    return "null" if v is None else (str(int(v)) if float(v) == int(v) else str(v))


def write_outputs():
    kept = [units[e] for e in order]

    # cross-note main-tab rows whose unit number reappears as a price-list id
    # (done in parse; also add reverse note on the main-tab YEN row)
    for u in kept:
        if u.source_tab == "sky_price_list" and "same physical unit as main-tab ref" in (u.notes or ""):
            m = re.search(r"main-tab ref (\S+)", u.notes)
            if m and m.group(1) in units:
                mu = units[m.group(1)]
                tag = f"also in developer price list as {u.external_id} ({u.unit_type_raw}, sellable {u.area_sqm} sqm)"
                if tag not in (mu.notes or ""):
                    mu.notes = join_notes(mu.notes, tag)

    # ---- validation ------------------------------------------------------
    problems = []
    for u in kept:
        if not u.external_id:
            problems.append(f"missing external_id: {u.__dict__}")
        if (u.price_omr is None or u.price_omr <= 0) and "no price in sheet" not in (u.notes or ""):
            problems.append(f"{u.external_id}: price missing without note")
        if not u.project:
            problems.append(f"{u.external_id}: unresolved project")

    # ---- CSV -------------------------------------------------------------
    with open(CSV_OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["external_id", "reference", "project", "developer", "unit_type_raw",
                    "bedrooms", "bathrooms", "area_sqm", "price_omr", "status",
                    "review_flag", "source_tab", "notes"])
        for u in kept:
            w.writerow([
                u.external_id, u.external_id, u.project, u.developer or "",
                u.unit_type_raw or "",
                "" if u.bedrooms is None else u.bedrooms,
                "" if u.bathrooms is None else (int(u.bathrooms) if u.bathrooms == int(u.bathrooms) else u.bathrooms),
                "" if u.area_sqm is None else u.area_sqm,
                "" if u.price_omr is None else u.price_omr,
                u.status, str(u.review_flag).lower(), u.source_tab, u.notes or ""])

    # ---- SQL -------------------------------------------------------------
    os.makedirs(os.path.dirname(SQL_OUT), exist_ok=True)
    catalog_names = sorted({u.project for u in kept})
    header = f"""-- =====================================================================
-- units_seed.sql — Alwalaa REAL unit inventory (Master Listing Tracker)
-- Generated by scripts/build-units-seed.py — DO NOT hand-edit; re-run the
-- script against a fresh sheet export instead.
--
-- Idempotent: upserts on the partial unique index units_org_ext_uniq
-- (organization_id, external_id) WHERE external_id IS NOT NULL (0006).
-- Projects are resolved by name against the 0007 catalog seed; stock that
-- cannot map to the catalog lands in the '{REVIEW_PROJECT}'
-- holding project below (review_flag rows: status=hold, feed=private).
--
-- Evidence-based project attribution (see script header):
--   * Sky Villa / Loggia Studio price list  -> Yenaier Residence
--     (ID:100.* ids match main-tab YEN1..YEN4; ID:100.PH.01 price = YEN4)
--   * Availability list + Garden Row Homes  -> Wadi Zaha
--     (E22/E24/E26/E27 codes match main-tab WAZ1..WAZ5)
-- =====================================================================

insert into projects (organization_id, name, notes)
values ('{ORG_ID}', '{REVIEW_PROJECT}',
        'Holding project for Dubizzle-only ads and unmapped stock')
on conflict (organization_id, name) do nothing;

"""
    conflict = ("on conflict (organization_id, external_id) where external_id is not null\n"
                "do update set\n"
                "  price_omr    = excluded.price_omr,\n"
                "  status       = excluded.status,\n"
                "  area_sqm     = excluded.area_sqm,\n"
                "  bedrooms     = excluded.bedrooms,\n"
                "  broker_notes = excluded.broker_notes;")

    def row_sql(u: Unit):
        proj_sub = (f"(select id from projects where organization_id = '{ORG_ID}' "
                    f"and name = {sql_str(u.project)})")
        feed = "private" if u.review_flag else "published"
        return ("  ('%s', %s, %s, %s, '%s', %s, %s, %s, %s, '%s', '%s', %s)" % (
            ORG_ID, proj_sub, sql_str(u.external_id), sql_str(u.external_id),
            u.unit_type_enum, sql_num(u.bedrooms), sql_num(u.bathrooms),
            sql_num(u.area_sqm), sql_num(u.price_omr), u.status, feed,
            sql_str(u.notes)))

    with open(SQL_OUT, "w") as f:
        f.write(header)
        BATCH = 50
        for b in range(0, len(kept), BATCH):
            batch = kept[b:b + BATCH]
            f.write(f"-- batch {b // BATCH + 1}: rows {b + 1}-{b + len(batch)}\n")
            f.write("insert into units (organization_id, project_id, reference_id, external_id,\n"
                    "                   unit_type, bedrooms, bathrooms, area_sqm, price_omr,\n"
                    "                   status, feed, broker_notes)\nvalues\n")
            f.write(",\n".join(row_sql(u) for u in batch))
            f.write("\n" + conflict + "\n\n")

    # ---- report ----------------------------------------------------------
    from collections import Counter
    tab_counts = Counter(u.source_tab for u in kept)
    proj_counts = Counter(u.project for u in kept)
    review = [u for u in kept if u.review_flag]
    sellable = [u for u in kept if not u.review_flag]
    unmatched = [u for u in kept if u.external_id.startswith("UNMATCHED-")]
    no_price = [u.external_id for u in kept if u.price_omr is None]

    print("=" * 70)
    print(f"TOTAL units kept: {len(kept)}   sellable: {len(sellable)}   "
          f"review-flagged: {len(review)}   UNMATCHED: {len(unmatched)}")
    print("-" * 70)
    print("Per source tab:")
    for t, c in sorted(tab_counts.items()):
        print(f"  {t:32s} {c}")
    print("-" * 70)
    print("Per catalog project:")
    for p, c in proj_counts.most_common():
        print(f"  {p:42s} {c}")
    print("-" * 70)
    print(f"Rows without price (noted): {len(no_price)} -> {no_price}")
    print("-" * 70)
    print(f"Dropped duplicate rows: {len(dropped)}")
    for ext, tab, reason, summary in dropped:
        print(f"  {ext:14s} [{tab}] {summary}")
    if unresolved_projects:
        print("-" * 70)
        print(f"Sheet projects sent to '{REVIEW_PROJECT}' via fallback: "
              f"{sorted(set(unresolved_projects))}")
    if problems:
        print("-" * 70)
        print("VALIDATION PROBLEMS:")
        for p in problems:
            print("  " + p)
        sys.exit(1)
    print("=" * 70)
    print(f"OK — wrote {CSV_OUT} and {SQL_OUT}")


if __name__ == "__main__":
    main()
