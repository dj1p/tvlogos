import os
import json

def generate_manifest():
    logos = []
    base_path = "countries"
    
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith('.png'):
                rel_path = os.path.relpath(root, base_path)
                logo_entry = {
                    "name": file,
                    "path": f"/countries/{rel_path}/{file}",
                    "country": rel_path
                }
                logos.append(logo_entry)
    
    manifest = {
        "generated": "auto",
        "total": len(logos),
        "logos": logos
    }
    
    with open('logos-manifest.json', 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"✓ Generated manifest with {len(logos)} logos")

if __name__ == "__main__":
    generate_manifest()
