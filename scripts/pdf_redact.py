#!/usr/bin/env python3
"""Apply secure PDF redactions with PyMuPDF."""

from __future__ import annotations

import argparse
import json
import sys

try:
    import pymupdf
except ImportError:
    print(
        "PyMuPDF is required for secure PDF redaction. Install with: pip install pymupdf",
        file=sys.stderr,
    )
    sys.exit(2)


def parse_areas(raw: str) -> list[dict]:
    parsed = json.loads(raw)
    if not isinstance(parsed, list):
        raise ValueError("areas must be a JSON array")

    areas: list[dict] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        page_index = item.get("pageIndex")
        x = item.get("x")
        y = item.get("y")
        width = item.get("width")
        height = item.get("height")
        if not all(isinstance(v, (int, float)) for v in (page_index, x, y, width, height)):
            continue
        if width <= 0 or height <= 0:
            continue
        areas.append(
            {
                "pageIndex": int(page_index),
                "x": float(x),
                "y": float(y),
                "width": float(width),
                "height": float(height),
            }
        )
    return areas


def apply_redactions(input_path: str, output_path: str, areas: list[dict]) -> None:
    if not areas:
        raise ValueError("Select at least one area to redact.")

    doc = pymupdf.open(input_path)
    try:
        if doc.page_count == 0:
            raise ValueError("This PDF contains no pages.")

        by_page: dict[int, list[dict]] = {}
        for area in areas:
            page_index = area["pageIndex"]
            if page_index < 0 or page_index >= doc.page_count:
                continue
            by_page.setdefault(page_index, []).append(area)

        if not by_page:
            raise ValueError("No valid redaction areas matched PDF pages.")

        for page_index, page_areas in by_page.items():
            page = doc[page_index]
            for area in page_areas:
                rect = pymupdf.Rect(
                    area["x"],
                    area["y"],
                    area["x"] + area["width"],
                    area["y"] + area["height"],
                )
                page.add_redact_annot(rect, fill=(0, 0, 0))
            page.apply_redactions()

        doc.save(output_path, garbage=4, deflate=True, clean=True)
    finally:
        doc.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Secure PDF redaction via PyMuPDF")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--areas", required=True, help="JSON array of redaction areas")
    args = parser.parse_args()

    try:
        areas = parse_areas(args.areas)
        apply_redactions(args.input, args.output, areas)
    except Exception as exc:  # noqa: BLE001 - surface to Node caller
        print(str(exc), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
