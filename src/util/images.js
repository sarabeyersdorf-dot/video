// Collect and order property photos from a directory.

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp', '.tif', '.tiff']);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);

export function isImage(file) {
  return IMG_EXT.has(path.extname(file).toLowerCase());
}

export function isVideo(file) {
  return VIDEO_EXT.has(path.extname(file).toLowerCase());
}

export function isMedia(file) {
  return isImage(file) || isVideo(file);
}

// Skip depth maps produced by estimate_depth.py so they aren't treated as photos.
function isDepthMap(file) {
  return /\.depth\.(png|jpg|jpeg)$/i.test(file);
}

// Natural sort so "photo2.jpg" comes before "photo10.jpg".
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Collect photos and video clips from a folder, in natural filename order.
// (Depth maps like `01-living.depth.png` are ignored.)
export function collectImages(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    throw new Error(`Media folder not found: ${dir}`);
  }
  const files = entries
    .filter((f) => isMedia(f) && !isDepthMap(f))
    .filter((f) => {
      try {
        return statSync(path.join(dir, f)).isFile();
      } catch {
        return false;
      }
    })
    .sort(naturalCompare)
    .map((f) => path.join(dir, f));
  return files;
}
