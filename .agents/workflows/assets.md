# Workflow — Blender assets

## When

Regenerating or adding procedural GLBs under `public/assets/models/`.

## Requirements

- Blender on `PATH` (project tested on **4.5.x LTS**)
- Prefer `--background` headless; avoid 5.1-only APIs in scripts

## Commands

```bash
npm run assets:generate
# equivalent:
# blender --background --python tools/blender/generate_assets.py
```

See `tools/blender/README.md` for script details.

## After generate

- [ ] GLBs load in title/scene (`BlenderAssets.tsx` / props)
- [ ] Shadows / flat shading still applied on traverse
- [ ] Manifest or README note if new asset names
- [ ] If prop footprint changed, update `collision.ts` radii + `PropCollider`

## Do not

- Hand-edit binary GLBs when a bpy script exists
- Commit huge unreferenced experiments without owner OK
