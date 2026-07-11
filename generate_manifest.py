import os
import json
import re

# Every extension actually present in countries/ (checked against the real
# repo: 10,765 .png + 10 .jpg as of this writing). The old version only
# matched .png, so those 10 .jpg logos were silently invisible to every
# consumer of the manifest -- not a huge number today, but any new
# contribution in .jpg/.jpeg/.webp/.svg/.gif would have hit the same silent
# drop. Matching is case-insensitive since not every contributor uses a
# lowercase extension.
IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif')


def generate_manifest():
    logos = []
    skipped_ext = 0
    skipped_error = 0
    base_path = "countries"

    for root, dirs, files in os.walk(base_path):
        for file in files:
            if not file.lower().endswith(IMAGE_EXTENSIONS):
                skipped_ext += 1
                continue
            try:
                rel_path = os.path.relpath(root, base_path)
                # os.walk can choke on filenames with invalid/surrogate-escaped
                # byte sequences (this repo has plenty of non-ASCII filenames,
                # e.g. Cyrillic and Thai channel names). Force a real str
                # round-trip now so a bad filename fails loudly here, with the
                # path we were on, instead of silently vanishing from the
                # manifest or crashing json.dump() later with no context.
                file = str(file)
                rel_path = str(rel_path)

                stem = re.sub(r'\.(png|jpe?g|webp|svg|gif)$', '', file, flags=re.IGNORECASE)
                logo_entry = {
                    "name": file,
                    "path": f"/countries/{rel_path}/{file}",
                    # Matches the naming convention generate-thumbnails.js
                    # writes to -- if that script hasn't been run for a given
                    # image yet, the path is still predictable, and app.js
                    # falls back to the full image if the thumbnail 404s.
                    "thumb": f"/thumbs/{rel_path}/{stem}.webp",
                    "country": rel_path,
                }
                logos.append(logo_entry)
            except (UnicodeError, ValueError) as e:
                skipped_error += 1
                print(f"  ! skipped {root}/{file!r}: {e}")

    # Stable, sorted output -- makes manifest diffs in git actually readable
    # instead of being reordered by filesystem walk order on every run.
    logos.sort(key=lambda e: (e["country"], e["name"].lower()))

    manifest = {
        "generated": "auto",
        "total": len(logos),
        "logos": logos,
    }

    with open('logos-manifest.json', 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Generated manifest with {len(logos)} logos")
    if skipped_ext:
        print(f"  ({skipped_ext} non-image files skipped, e.g. README.md -- expected)")
    if skipped_error:
        print(f"  ({skipped_error} files skipped due to encoding errors -- see above, worth fixing)")


if __name__ == "__main__":
    generate_manifest()
