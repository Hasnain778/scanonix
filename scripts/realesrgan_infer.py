#!/usr/bin/env python3
"""Real-ESRGAN inference for Scanonix image upscaler.

Requires the realesrgan package (and dependencies) to be installed in the
Python environment pointed to by REALESRGAN_PYTHON. Exits with a clear error
when the package or model is unavailable.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Real-ESRGAN upscale inference")
    parser.add_argument("--input", required=True, help="Input image path")
    parser.add_argument("--output", required=True, help="Output PNG path")
    parser.add_argument("--scale", type=int, choices=[2, 4], default=2)
    parser.add_argument("--tile", type=int, default=0, help="Tile size (0 = no tiling)")
    parser.add_argument("--onnx-path", default="", help="Optional ONNX model path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.is_file():
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        return 1

    try:
        import cv2  # noqa: F401
        import numpy as np
        from realesrgan import RealESRGANer
        from basicsr.archs.rrdbnet_arch import RRDBNet
    except ImportError as exc:
        print(
            "ERROR: realesrgan is not installed. "
            "Install with: pip install realesrgan basicsr opencv-python-headless",
            file=sys.stderr,
        )
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    try:
        import cv2

        model_name = "RealESRGAN_x4plus"
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
        netscale = 4

        if args.onnx_path:
            upsampler = RealESRGANer(
                scale=netscale,
                model_path=args.onnx_path,
                model=model,
                tile=args.tile if args.tile > 0 else 0,
                tile_pad=10,
                pre_pad=0,
                half=False,
            )
        else:
            upsampler = RealESRGANer(
                scale=netscale,
                model_path=f"weights/{model_name}.pth",
                model=model,
                tile=args.tile if args.tile > 0 else 0,
                tile_pad=10,
                pre_pad=0,
                half=False,
            )

        image = cv2.imread(str(input_path), cv2.IMREAD_UNCHANGED)
        if image is None:
            print(f"ERROR: Could not read input image: {input_path}", file=sys.stderr)
            return 1

        output, _ = upsampler.enhance(image, outscale=args.scale)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        if not cv2.imwrite(str(output_path), output):
            print(f"ERROR: Could not write output image: {output_path}", file=sys.stderr)
            return 1

        print("OK")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: Real-ESRGAN inference failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
