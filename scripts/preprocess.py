"""
Turns the raw datasets into the small JSON files the app bundles.

Inputs
  - courses.json (repo root, supplied, ~28 MB): one record per course *per term*.
  - ust-archive/schedule `classes.parquet` (downloaded from Hugging Face and cached):
    one record per section *per scrape*, so a section appears once for every snapshot.

Outputs (app/data/generated/)
  - courses.json   one entry per course code (15k term records -> ~4k courses),
                   with the prerequisite string parsed into an AND/OR tree and a
                   precomputed reverse index ("unlocks"). Loaded at startup.
  - course-details.json  { courseCode: long text fields }. Descriptions are ~60% of
                   the catalogue bytes but only the detail screen needs them, so the
                   app loads this file lazily.
  - sections.json  { termCode: { courseCode: Section[] } }, latest snapshot only.
  - terms.json     the terms present in the catalogue, newest first.

Run from the repo root:  python scripts/preprocess.py
Requires: pandas, pyarrow
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_COURSES = REPO_ROOT / "courses.json"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
CLASSES_PARQUET = CACHE_DIR / "classes.parquet"
CLASSES_URL = "https://huggingface.co/datasets/ust-archive/schedule/resolve/main/classes.parquet"
OUT_DIR = REPO_ROOT / "app" / "data" / "generated"

# "COMP 4211", "COMP4211", "COMP 1022P"
COURSE_CODE = re.compile(r"\b([A-Z]{4})\s?(\d{4}[A-Z]?)\b")


# ---------------------------------------------------------------------------
# Prerequisite parsing
#
# Prerequisites are free text, but ~80% are course codes joined by AND / OR with
# brackets, e.g. "COMP 2211 AND (ELEC 2600 OR MATH 2411)". The rest mix in
# conditions such as "Grade B- or above", "(prior to 2021-22)" or HKDSE levels.
#
# Approach (deliberately not a natural-language parser):
#   1. Normalise: [] -> (), & -> AND, "or above" is protected so "or" isn't split.
#   2. Tokenise into CODE / AND / OR / COMMA / ( / ) / TEXT.
#   3. Nest tokens by brackets, then split each group on OR, then on AND
#      (AND binds tighter, as in the catalogue's own convention).
#   4. Text next to a course code becomes a note on that code
#      ("MATH 1012 (prior to 2025-26)"); text on its own becomes a text leaf.
# The raw string is always shipped too, so the UI can show the source.
# ---------------------------------------------------------------------------

_PROTECTED_PHRASE = re.compile(r"\b(or|and)\s+(above|below|equivalent|higher|better)\b", re.IGNORECASE)
_TOKEN = re.compile(
    r"(?P<code>\b[A-Z]{4}\s?\d{4}[A-Z]?\b)"
    r"|(?P<number>(?<![\w-])\d{4}[A-Z]?(?![\w-]))"  # not the "2021" in "2021-22"
    r"|(?P<and>\bAND\b|\band\b)"
    r"|(?P<or>\bOR\b|\bor\b|;)"
    r"|(?P<comma>,)"
    r"|(?P<one_of>\b(?:[Oo]ne of|[Ee]ither)\b)"
    r"|(?P<open>\()"
    r"|(?P<close>\))"
    r"|(?P<text>[^(),;\s]+)"
)


def normalise_code(raw: str) -> str:
    match = COURSE_CODE.match(raw)
    return f"{match.group(1)} {match.group(2)}" if match else raw


def tokenise(text: str) -> list[tuple[str, str]]:
    text = text.replace("[", "(").replace("]", ")").replace("&", " AND ")
    # "Grade B- or above" must not be read as "Grade B-" OR "above".
    text = _PROTECTED_PHRASE.sub(lambda m: f"{m.group(1)}_{m.group(2)}", text)
    # "COMP 2011/COMP 2012" -> alternatives
    text = re.sub(r"(\b[A-Z]{4}\s?\d{4}[A-Z]?)\s*/\s*(?=[A-Z]{4}\s?\d{4})", r"\1 OR ", text)

    tokens: list[tuple[str, str]] = []
    last_prefix = None
    for match in _TOKEN.finditer(text):
        kind = match.lastgroup
        value = match.group()
        if kind == "code":
            value = normalise_code(value)
            last_prefix = value[:4]
        elif kind == "number":
            # "UFUG 1103 or 1106": a bare number after an operator reuses the last prefix.
            if last_prefix and tokens and tokens[-1][0] in ("and", "or", "comma"):
                kind, value = "code", f"{last_prefix} {value}"
            else:
                kind = "text"
        elif kind == "text":
            value = value.replace("_", " ")
        tokens.append((kind, value))
    return tokens


def nest(tokens: list[tuple[str, str]]) -> list:
    """Group tokens by brackets. Unbalanced brackets are tolerated, not fatal."""
    root: list = []
    stack = [root]
    for token in tokens:
        if token[0] == "open":
            group: list = []
            stack[-1].append(group)
            stack.append(group)
        elif token[0] == "close":
            if len(stack) > 1:
                stack.pop()
        else:
            stack[-1].append(token)
    return root


def _contains_code(items: list) -> bool:
    return any(_contains_code(i) if isinstance(i, list) else i[0] == "code" for i in items)


def _split(items: list, operator: str) -> list[list]:
    parts: list[list] = [[]]
    for item in items:
        if not isinstance(item, list) and item[0] == operator:
            parts.append([])
        else:
            parts[-1].append(item)
    return [p for p in parts if p]


def _combine(kind: str, children: list[dict]) -> dict | None:
    flat: list[dict] = []
    for child in children:
        if child is None:
            continue
        # (A AND (B AND C)) -> (A AND B AND C), unless the inner group carries a note.
        if child["kind"] == kind and "note" not in child:
            flat.extend(child["children"])
        else:
            flat.append(child)
    if not flat:
        return None
    return flat[0] if len(flat) == 1 else {"kind": kind, "children": flat}


def _flatten_text(items: list) -> str:
    words = []
    for item in items:
        if isinstance(item, list):
            words.append(f"({_flatten_text(item)})")
        elif item[0] != "one_of":
            words.append(item[1])
    return " ".join(words)


def _parse_operand(items: list) -> dict | None:
    """A run of items with no operator between them, e.g. `MATH 1012 (prior to 2025-26)`."""
    nodes = []
    notes = []
    for item in items:
        if isinstance(item, list):
            if _contains_code(item):
                nodes.append(parse_group(item))
            else:
                notes.append(_flatten_text(item))
        elif item[0] == "code":
            nodes.append({"kind": "course", "code": item[1]})
        elif item[0] == "text":
            notes.append(item[1])

    note = " ".join(notes).strip(" .")
    node = _combine("all", nodes)
    if node is None:
        return {"kind": "text", "text": note} if note else None
    if note:
        node = {**node, "note": note}
    return node


def parse_group(items: list) -> dict | None:
    top_level = [i for i in items if not isinstance(i, list)]
    has_one_of = any(t[0] == "one_of" for t in top_level)
    has_and = any(t[0] == "and" for t in top_level)
    has_or = any(t[0] == "or" for t in top_level)
    # A comma means OR in "One of A, B or C" and in "A, B or C"; otherwise AND ("A, B and C").
    comma_as = "or" if has_one_of or (has_or and not has_and) else "and"
    items = [
        (comma_as, ",") if not isinstance(i, list) and i[0] == "comma" else i
        for i in items
        if isinstance(i, list) or i[0] != "one_of"
    ]

    alternatives = []
    for alternative in _split(items, "or"):
        required = [_parse_operand(part) for part in _split(alternative, "and")]
        alternatives.append(_combine("all", required))
    return _combine("any", alternatives)


def parse_prerequisite(text: str) -> dict | None:
    text = text.strip()
    if not text:
        return None
    return parse_group(nest(tokenise(text)))


def referenced_codes(node: dict | None) -> set[str]:
    if node is None:
        return set()
    if node["kind"] == "course":
        return {node["code"]}
    if node["kind"] == "text":
        return set()
    return set().union(*(referenced_codes(child) for child in node["children"]))


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------


def format_credits(record: dict) -> str:
    low, high = record["min_credits"], record["max_credits"]
    fmt = lambda n: f"{n:g}"  # noqa: E731
    return fmt(low) if low == high else f"{fmt(low)}-{fmt(high)}"


def build_courses(raw: list[dict]) -> tuple[list[dict], dict, list[dict]]:
    by_code: dict[str, list[dict]] = defaultdict(list)
    for record in raw:
        by_code[f"{record['prefix']} {record['number']}"].append(record)

    terms = {r["term_code"]: (r["term_num"], r["term_name"]) for r in raw}
    term_list = [
        {"code": code, "name": name}
        for code, (_, name) in sorted(terms.items(), key=lambda t: -t[1][0])
    ]

    courses = []
    details = {}
    for code, records in by_code.items():
        records.sort(key=lambda r: -r["term_num"])
        # The newest term's record wins when details changed between terms (117 courses).
        latest = records[0]
        courses.append(
            {
                "code": code,
                # The subject prefix ("COMP"), not department_code: the owning-department
                # codes are opaque to students (IELM owns IEDA, CSE owns COMP and CSIT).
                "department": latest["prefix"],
                "title": latest["title"].strip(),
                "credits": format_credits(latest),
                "career": latest["career_type"],
                "terms": [r["term_code"] for r in records],
                "prerequisiteText": latest["prerequisite"].strip(),
                "prerequisite": parse_prerequisite(latest["prerequisite"]),
                "unlocks": [],
            }
        )
        details[code] = {
            "description": latest["description"].strip(),
            "corequisite": latest["corequisite"].strip(),
            "exclusion": latest["exclusion"].strip(),
            "attributes": sorted({a["description"] for a in latest["attributes"]}),
        }

    # Reverse index: which courses list this one as a prerequisite.
    index = {c["code"]: c for c in courses}
    for course in courses:
        for required in referenced_codes(course["prerequisite"]):
            if required in index and required != course["code"]:
                index[required]["unlocks"].append(course["code"])
    for course in courses:
        course["unlocks"].sort()

    courses.sort(key=lambda c: c["code"])
    return courses, details, term_list


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------


def download_classes() -> None:
    if CLASSES_PARQUET.exists():
        return
    CACHE_DIR.mkdir(exist_ok=True)
    print(f"Downloading {CLASSES_URL}")
    urllib.request.urlretrieve(CLASSES_URL, CLASSES_PARQUET)


def format_time(value) -> str | None:
    return value.strftime("%H:%M") if value is not None else None


def build_sections(raw: list[dict], term_codes: set[str]) -> tuple[dict, dict]:
    code_by_id = {r["id"]: f"{r['prefix']} {r['number']}" for r in raw}

    df = pd.read_parquet(CLASSES_PARQUET)
    df = df[df["term_code"].isin(term_codes) & df["course_id"].isin(code_by_id.keys())]
    # The dataset keeps every scrape of a section; keep only the most recent one.
    df = df.sort_values("timestamp").drop_duplicates(["term_code", "course_id", "section"], keep="last")
    updated_at = df.groupby("term_code")["timestamp"].max().map(lambda t: t.isoformat()).to_dict()
    df = df[df["status"] == "ACTIVE"]

    sections: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for row in df.sort_values("number").itertuples():
        sections[row.term_code][code_by_id[row.course_id]].append(
            {
                "section": row.section,
                "type": row.type,
                "capacity": int(row.capacity),
                "enrolled": int(row.enroll),
                "waitlist": int(row.wait),
                "consentRequired": bool(row.consent),
                "remarks": (row.remarks or "").strip(),
                "meetings": [
                    {
                        "weekday": m["weekday"],
                        "start": format_time(m["time_from"]),
                        "end": format_time(m["time_to"]),
                        "venue": m["venue_name"] or m["venue"] or "TBA",
                        "instructors": list(m["instructors"]),
                    }
                    for m in row.schedules
                ],
            }
        )
    return sections, updated_at


def write_json(name: str, data) -> None:
    path = OUT_DIR / name
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  {path.relative_to(REPO_ROOT)}  {path.stat().st_size / 1024:,.0f} KB")


def main() -> None:
    raw = json.loads(RAW_COURSES.read_text(encoding="utf-8"))
    courses, details, terms = build_courses(raw)

    download_classes()
    sections, updated_at = build_sections(raw, {t["code"] for t in terms})
    for term in terms:
        term["sectionsUpdatedAt"] = updated_at.get(term["code"])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"{len(raw):,} catalogue records -> {len(courses):,} courses")
    write_json("courses.json", courses)
    write_json("course-details.json", details)
    write_json("sections.json", sections)
    write_json("terms.json", terms)


if __name__ == "__main__":
    sys.exit(main())
