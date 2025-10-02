import os
import json

def generate_manifest():
    """
    Generates a JSON manifest of all PNG logos in the repository
    """
    logos = []
    base_path = "countries"
    
    # Walk through all directories
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith('.png'):
                # Get the relative path from countries directory
                rel_path = os.path.relpath(root, base_path)
                
                logo_entry = {
                    "name": file,
                    "path": f"/countries/{rel_path}/{file}",
                    "country": rel_path
                }
                logos.append(logo_entry)
    
    # Create manifest
    manifest = {
        "generated": "auto",
        "total": len(logos),
        "logos": logos
    }
    
    # Write to JSON file
    with open('logos-manifest.json', 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"✓ Generated manifest with {len(logos)} logos")
    print(f"✓ Saved to logos-manifest.json")

if __name__ == "__main__":
    generate_manifest()
