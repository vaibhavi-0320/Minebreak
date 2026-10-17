# Embervale Blender pipeline

Procedural cozy-voxel assets generated with **bpy** (Blender Python).

## Environment

| Target | Notes |
|--------|--------|
| Requested | Blender / bpy **5.1.2** |
| Available here | **Blender 4.5.11 LTS** |

Scripts intentionally avoid 5.1-only APIs so they run on 4.5+ and 5.1.x.

## Generate

From the `embervale` repo root:

```bash
npm run assets:generate
# or
blender --background --python tools/blender/generate_assets.py
```

Outputs GLB files to `public/assets/models/`.

## Layout

- `conventions.py` — naming, palette, budgets (no bpy)
- `generators/props.py` — trees, cottage, shrine, rocks, lanterns
- `generators/characters.py` — player, mobs, boss
- `generators/voxel_ops.py` — cube assembly + GLB export
- `generate_assets.py` — CLI entry

## Runtime

The game ships **runtime voxel meshes** (Three.js) that match these blueprints 1:1, so gameplay works without a Blender pass. Drop exported GLBs into `public/assets/models/` for optional GLTF swap later.
