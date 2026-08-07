#!/usr/bin/env python3
"""
Batch depth-map estimator for ListingReel's 2.5D parallax engine.

Generates a grayscale depth map (white = near) next to each photo, which
parallax.py then uses. Depth-Anything V2 runs on CPU and needs no GPU.

Install once:
    pip install torch transformers pillow numpy

Usage:
    python3 tools/estimate_depth.py photos/            # all images in a folder
    python3 tools/estimate_depth.py room.jpg           # a single image
    python3 tools/estimate_depth.py photos/ --suffix .depth.png

The depth files are written alongside the source as <name>.depth.png, which is
the path parallax.py looks for automatically.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def iter_images(path):
    if os.path.isdir(path):
        for name in sorted(os.listdir(path)):
            if os.path.splitext(name)[1].lower() in IMG_EXT and ".depth" not in name:
                yield os.path.join(path, name)
    else:
        yield path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="image file or folder")
    ap.add_argument("--suffix", default=".depth.png")
    ap.add_argument("--model", default="depth-anything/Depth-Anything-V2-Small-hf")
    args = ap.parse_args()

    try:
        from transformers import pipeline
    except ImportError:
        print("This tool needs torch + transformers:\n"
              "    pip install torch transformers pillow numpy", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {args.model} …", file=sys.stderr)
    pipe = pipeline(task="depth-estimation", model=args.model)

    for img_path in iter_images(args.path):
        base, _ = os.path.splitext(img_path)
        out = base + args.suffix
        depth = np.asarray(pipe(Image.open(img_path).convert("RGB"))["depth"], dtype=np.float32)
        depth -= depth.min()
        if depth.max() > 0:
            depth /= depth.max()
        Image.fromarray((depth * 255).astype(np.uint8)).save(out)
        print(f"  {img_path} -> {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
