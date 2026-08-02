#!/usr/bin/env python3
"""
2.5D depth parallax renderer for ListingReel.

Given a still photo and a depth map, it moves a virtual camera so that near
objects shift/scale more than far ones — real dimensional parallax, unlike a
flat Ken Burns zoom. Output is encoded to an .mp4 via ffmpeg.

Depth sources, in priority order:
  1. --depth FILE            a grayscale depth map (white = near)
  2. --depth-cmd "TEMPLATE"  a shell command that writes a depth PNG; supports
                             {image} and {out} placeholders
  3. Depth-Anything          auto, if `transformers` + `torch` are installed
  4. heuristic fallback      crude vertical gradient (warns; install a real
                             estimator for good results)

Only numpy + Pillow are required for the warp itself. ffmpeg must be on PATH
(or pass --ffmpeg).

Usage:
  python3 parallax.py --image room.jpg --out clip.mp4 \
      --width 1080 --height 1920 --fps 30 --duration 4 --motion parallax-push
"""
import argparse
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter


def log(msg):
    print(f"[parallax] {msg}", file=sys.stderr, flush=True)


def smoothstep(p):
    return p * p * (3 - 2 * p)


def cover_resize(img, W, H):
    """Scale to cover W x H then center-crop (no distortion)."""
    iw, ih = img.size
    scale = max(W / iw, H / ih)
    nw, nh = int(round(iw * scale)), int(round(ih * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - W) // 2
    top = (nh - H) // 2
    return img.crop((left, top, left + W, top + H))


def load_depth(args, base_img, W, H):
    # 1. explicit depth file
    if args.depth and os.path.exists(args.depth):
        log(f"using depth file {args.depth}")
        d = Image.open(args.depth).convert("L")
        d = cover_resize(d, W, H)
        return normalize_depth(np.asarray(d, dtype=np.float32), args.invert_depth)

    # 2. depth command template
    if args.depth_cmd:
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.close()
        cmd = args.depth_cmd.replace("{image}", args.image).replace("{out}", tmp.name)
        log(f"running depth-cmd: {cmd}")
        subprocess.run(cmd, shell=True, check=True)
        d = Image.open(tmp.name).convert("L")
        d = cover_resize(d, W, H)
        os.unlink(tmp.name)
        return normalize_depth(np.asarray(d, dtype=np.float32), args.invert_depth)

    # 3. Depth-Anything via transformers, if available
    try:
        depth = estimate_depth_anything(args.image)
        if depth is not None:
            log("estimated depth with Depth-Anything")
            d = cover_resize(Image.fromarray(depth), W, H)
            return normalize_depth(np.asarray(d, dtype=np.float32), args.invert_depth)
    except Exception as e:  # pragma: no cover - env dependent
        log(f"Depth-Anything unavailable ({e}); using heuristic depth")

    # 4. heuristic fallback: nearer toward the bottom of the frame, softened by
    #    local brightness. Crude, but gives some parallax with zero models.
    log("WARNING: no depth model — using heuristic depth. Install torch + "
        "transformers (see tools/estimate_depth.py) for realistic parallax.")
    gray = np.asarray(base_img.convert("L"), dtype=np.float32) / 255.0
    yy = np.linspace(0.0, 1.0, H, dtype=np.float32)[:, None] * np.ones((1, W), np.float32)
    depth = 0.65 * yy + 0.35 * (1.0 - gray)  # bottom + darker => nearer
    return normalize_depth(depth * 255.0, args.invert_depth)


def estimate_depth_anything(image_path):
    from transformers import pipeline  # noqa: WPS433 (optional import)
    pipe = pipeline(
        task="depth-estimation",
        model=os.environ.get("DEPTH_MODEL", "depth-anything/Depth-Anything-V2-Small-hf"),
    )
    out = pipe(Image.open(image_path).convert("RGB"))
    depth = np.asarray(out["depth"], dtype=np.float32)
    # transformers returns near = large; scale to 0..255 for uniform handling.
    depth = depth - depth.min()
    if depth.max() > 0:
        depth = depth / depth.max()
    return (depth * 255.0).astype(np.uint8)


def normalize_depth(arr, invert):
    d = arr.astype(np.float32)
    d = d - d.min()
    if d.max() > 0:
        d = d / d.max()
    if invert:
        d = 1.0 - d
    # Soften so warps don't tear at hard depth edges.
    d_img = Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))
    return np.asarray(d_img, dtype=np.float32) / 255.0


def bilinear_sample(img, map_x, map_y):
    H, W = img.shape[:2]
    x0 = np.floor(map_x).astype(np.int32)
    y0 = np.floor(map_y).astype(np.int32)
    x1 = x0 + 1
    y1 = y0 + 1
    wx = (map_x - x0)[..., None]
    wy = (map_y - y0)[..., None]
    x0 = np.clip(x0, 0, W - 1)
    x1 = np.clip(x1, 0, W - 1)
    y0 = np.clip(y0, 0, H - 1)
    y1 = np.clip(y1, 0, H - 1)
    Ia = img[y0, x0]
    Ib = img[y0, x1]
    Ic = img[y1, x0]
    Id = img[y1, x1]
    top = Ia * (1 - wx) + Ib * wx
    bot = Ic * (1 - wx) + Id * wx
    return (top * (1 - wy) + bot * wy).astype(np.uint8)


def frame_maps(x, y, cx, cy, depth, motion, p, amp_px, zoom):
    """Return (map_x, map_y): source coords to sample for each output pixel."""
    disp = depth  # 0 (far) .. 1 (near)
    # A little base zoom hides the empty edges created by lateral shifts.
    base_zoom = 1.0 + (zoom - 1.0) * p
    mx = cx + (x - cx) / base_zoom
    my = cy + (y - cy) / base_zoom

    if motion in ("parallax-push", "parallax-pull", "parallax"):
        # Depth-scaled magnification: near pixels expand faster than far ones.
        k = (zoom - 1.0) + 0.10  # extra depth-driven zoom
        f = p if motion != "parallax-pull" else (1.0 - p)
        z = 1.0 + k * disp * f
        mx = cx + (x - cx) / (base_zoom * z)
        my = cy + (y - cy) / (base_zoom * z)
        if motion == "parallax":
            mx = mx + amp_px * (p - 0.5) * disp  # gentle lateral drift
    elif motion == "parallax-left":
        mx = mx - amp_px * p * disp
    elif motion == "parallax-right":
        mx = mx + amp_px * p * disp
    elif motion == "parallax-up":
        my = my - amp_px * p * disp
    elif motion == "parallax-down":
        my = my + amp_px * p * disp
    return mx, my


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, required=True)
    ap.add_argument("--height", type=int, required=True)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--duration", type=float, default=4.0)
    ap.add_argument("--motion", default="parallax-push")
    ap.add_argument("--amplitude", type=float, default=0.04,
                    help="max lateral shift for nearest pixels, as fraction of width")
    ap.add_argument("--zoom", type=float, default=1.06)
    ap.add_argument("--depth", default=None)
    ap.add_argument("--depth-cmd", default=None)
    ap.add_argument("--invert-depth", action="store_true")
    ap.add_argument("--ffmpeg", default=os.environ.get("FFMPEG_PATH", "ffmpeg"))
    args = ap.parse_args()

    W, H = args.width, args.height
    n_frames = max(1, int(round(args.duration * args.fps)))

    base = cover_resize(Image.open(args.image).convert("RGB"), W, H)
    img = np.asarray(base, dtype=np.float32)
    depth = load_depth(args, base, W, H)

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = (W - 1) / 2.0, (H - 1) / 2.0
    amp_px = args.amplitude * W

    ff = subprocess.Popen(
        [args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(args.fps),
         "-i", "-",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18",
         "-pix_fmt", "yuv420p", "-an", args.out],
        stdin=subprocess.PIPE,
    )
    try:
        for i in range(n_frames):
            p = smoothstep(i / (n_frames - 1)) if n_frames > 1 else 1.0
            mx, my = frame_maps(xx, yy, cx, cy, depth, args.motion, p, amp_px, args.zoom)
            frame = bilinear_sample(img, mx, my)
            ff.stdin.write(frame.tobytes())
        ff.stdin.close()
        rc = ff.wait()
        if rc != 0:
            raise SystemExit(f"ffmpeg encode failed (code {rc})")
    finally:
        if ff.poll() is None:
            ff.kill()
    log(f"wrote {args.out} ({n_frames} frames)")


if __name__ == "__main__":
    main()
