// generate-thumbnails.js
// Generates small WebP thumbnails for every logo in countries/, mirrored
// into thumbs/. Run this after adding new logos (or after generate-manifest.js).
//
// Why this exists: source logos are ~512px wide (per this project's own
// naming convention), but the browser grid displays them at 72px tall.
// Every visible logo was downloading its full source image just to be
// shrunk by CSS -- by far the biggest cost on the page. Thumbnails here are
// small enough for the grid; the ORIGINAL full-res file is still what gets
// copied/hotlinked when someone clicks a logo, so nothing changes for
// anyone actually using the URLs in their IPTV app.
//
// Requires: npm install sharp   (one-time, in this repo's directory)

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMAGE_EXT = /\.(png|jpe?g|webp|svg|gif)$/i;
const THUMB_MAX_DIM = 120; // ~2x the 72px CSS display height -- benchmarked against 160/100/80px, this is the sweet spot: close enough to true retina (144px) to stay sharp for these flat-color/text logos, while cutting ~28% more size than 160px
const THUMB_QUALITY = 80;
const CONCURRENCY = 8; // parallel sharp jobs -- keeps CPU busy without exhausting memory across 10,000+ files

function walk(dir, baseDir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, baseDir, files);
    } else if (entry.isFile() && IMAGE_EXT.test(entry.name)) {
      files.push({ fullPath, relDir: path.relative(baseDir, dir) });
    }
  }
}

function thumbPathFor(relDir, name) {
  const stem = name.replace(IMAGE_EXT, '');
  return path.join('thumbs', relDir, `${stem}.webp`);
}

async function processOne(file, stats) {
  const outPath = thumbPathFor(file.relDir, path.basename(file.fullPath));
  const outDir = path.dirname(outPath);

  try {
    const srcStat = fs.statSync(file.fullPath);
    if (fs.existsSync(outPath)) {
      const outStat = fs.statSync(outPath);
      if (outStat.mtimeMs >= srcStat.mtimeMs) { stats.skipped++; return; }
    }

    fs.mkdirSync(outDir, { recursive: true });

    if (path.extname(file.fullPath).toLowerCase() === '.svg') {
      await sharp(file.fullPath, { density: 300 })
        .resize(THUMB_MAX_DIM, THUMB_MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(outPath);
    } else {
      await sharp(file.fullPath)
        .resize(THUMB_MAX_DIM, THUMB_MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(outPath);
    }
    stats.generated++;
  } catch (err) {
    stats.errors++;
    console.error(`  ! ${file.fullPath}: ${err.message}`);
  }
}

async function runPool(items, worker, concurrency) {
  let i = 0;
  async function next() {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  const basePath = path.join(__dirname, 'countries');
  const files = [];
  walk(basePath, basePath, files);

  console.log(`Found ${files.length} source images. Generating thumbnails (${THUMB_MAX_DIM}px, WebP q${THUMB_QUALITY})...`);

  const stats = { generated: 0, skipped: 0, errors: 0 };
  const start = Date.now();
  await runPool(files, (f) => processOne(f, stats), CONCURRENCY);
  const seconds = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n? Done in ${seconds}s`);
  console.log(`  generated: ${stats.generated}`);
  console.log(`  skipped (already up to date): ${stats.skipped}`);
  if (stats.errors) console.log(`  errors: ${stats.errors} (see above)`);
}

main();