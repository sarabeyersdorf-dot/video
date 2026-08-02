// Collect and order property photos from a directory.

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp', '.tif', '.tiff']);

export function isImage(file) {
  return IMG_EXT.has(path.extname(file).toLowerCase());
}

// Natural sort so "photo2.jpg" comes before "photo10.jpg".
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function collectImages(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    throw new Error(`Photo folder not found: ${dir}`);
  }
  const files = entries
    .filter(isImage)
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
