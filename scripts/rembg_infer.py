#!/usr/bin/env python3
"""Background removal inference for Scanonix using rembg."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="rembg background removal")
    parser.add_argument("--input", required=True, help="Input image path")
    parser.add_argument("--output", required=True, help="Output PNG path")
    parser.add_argument(
        "--model",
        default="birefnet-general",
        help="rembg model name (default: birefnet-general)",
    )
    parser.add_argument(
        "--model-dir",
        default="",
        help="Optional rembg/U2Net model directory (sets U2NET_HOME when provided)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.is_file():
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        return 1

    if args.model_dir:
        os.environ["U2NET_HOME"] = args.model_dir

    try:
        from rembg import remove, new_session
    except ImportError as exc:
        print(
            "ERROR: rembg is not installed. Install with: pip install rembg onnxruntime",
            file=sys.stderr,
        )
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    try:
        session = new_session(args.model)
    except Exception as exc:  # noqa: BLE001
        print(
            f"ERROR: Could not load rembg model '{args.model}': {exc}",
            file=sys.stderr,
        )
        return 1

    try:
        input_bytes = input_path.read_bytes()
        # Alpha matting intentionally disabled — testing showed worse edge bleed.
        output_bytes = remove(
            input_bytes,
            session=session,
            alpha_matting=False,
        )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(output_bytes)
        print(f"MODEL={args.model}")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: rembg inference failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
