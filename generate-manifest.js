// generate-manifest.js
// Node.js equivalent of generate_manifest.py -- same logic, same output,
// for machines without Python installed. Run from the repo root:
//   node generate-manifest.js

const fs = require('fs');
const path = require('path');

// Every extension actually present in countries/ (10,765 .png + 10 .jpg as
// of writing). Matching is case-insensitive since not every contributor
// uses a lowercase extension.
const IMAGE_EXT = /\.(png|jpe?g|webp|svg|gif)$/i;

function walk(dir, baseDir, logos, stats) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, baseDir, logos, stats);
    } else if (entry.isFile()) {
      if (!IMAGE_EXT.test(entry.name)) {
        stats.skippedExt++;
        continue;
      }
      const relDir = path.relative(baseDir, dir).split(path.sep).join('/');
      const stem = entry.name.replace(IMAGE_EXT, '');
      logos.push({
        name: entry.name,
        path: `/countries/${relDir}/${entry.name}`,
        // Matches the naming convention generate-thumbnails.js writes to --
        // if that script hasn't been run for a given image yet, the path is
        // still predictable, and app.js falls back to the full image if the
        // thumbnail 404s.
        thumb: `/thumbs/${relDir}/${stem}.webp`,
        country: relDir,
      });
    }
  }
}

function generateManifest() {
  const basePath = path.join(__dirname, 'countries');
  const logos = [];
  const stats = { skippedExt: 0 };

  walk(basePath, basePath, logos, stats);

  // Stable, sorted output -- makes manifest diffs in git actually readable
  // instead of being reordered by filesystem walk order on every run.
  logos.sort((a, b) => {
    if (a.country !== b.country) return a.country < b.country ? -1 : 1;
    const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
    return an < bn ? -1 : an > bn ? 1 : 0;
  });

  const manifest = {
    generated: 'auto',
    total: logos.length,
    logos,
  };

  fs.writeFileSync(
    path.join(__dirname, 'logos-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  console.log(`\n✓ Generated manifest with ${logos.length} logos`);
  if (stats.skippedExt) {
    console.log(`  (${stats.skippedExt} non-image files skipped, e.g. README.md -- expected)`);
  }
}

generateManifest();
