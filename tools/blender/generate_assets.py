#!/usr/bin/env python3
"""Generate Embervale procedural voxel GLB assets via Blender bpy.

Usage:
  blender --background --python tools/blender/generate_assets.py

Compatible with Blender 4.5+ (tested on 4.5.11 LTS). Written to also run on
Blender 5.1.x / bpy 5.1.2 when available — avoids version-specific APIs.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow imports when run inside Blender
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "generators"))

import bpy

from conventions import format_name
from generators import (
    build_beetle,
    build_boss,
    build_cottage,
    build_imp,
    build_lantern,
    build_mushroom,
    build_player,
    build_rock,
    build_shrine,
    build_slime,
    build_tree,
)
from generators.voxel_ops import build_from_voxels, clear_scene, export_glb

# repo root: tools/blender -> tools -> embervale
OUT_DIR = ROOT.parents[1] / "public" / "assets" / "models"


ASSETS = [
    ("prop", "tree", 0, lambda: build_tree(False)),
    ("prop", "tree", 1, lambda: build_tree(True)),
    ("prop", "rock", 0, build_rock),
    ("prop", "lantern", 0, build_lantern),
    ("prop", "shrine", 0, build_shrine),
    ("prop", "cottage", 0, build_cottage),
    ("player", "hearthkeeper", 0, build_player),
    ("mob", "slime", 0, build_slime),
    ("mob", "mushroom", 0, build_mushroom),
    ("mob", "imp", 0, build_imp),
    ("mob", "beetle", 0, build_beetle),
    ("boss", "tyrant", 0, build_boss),
]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[embervale] Blender {bpy.app.version_string}")
    print(f"[embervale] Writing GLBs → {OUT_DIR}")

    for category, name, variant, builder in ASSETS:
        clear_scene()
        asset_name = format_name(category, name, variant)
        voxels = builder()
        obj = build_from_voxels(asset_name, voxels, join=True)
        out_path = OUT_DIR / f"{asset_name}.glb"
        export_glb(obj, str(out_path))
        tris = len(obj.data.polygons)
        print(f"  ✓ {asset_name}.glb  ({tris} faces, {len(voxels)} voxels)")

    # manifest
    manifest = OUT_DIR / "manifest.json"
    names = [format_name(c, n, v) for c, n, v, _ in ASSETS]
    manifest.write_text(
        "{\n  \"assets\": [\n"
        + ",\n".join(f'    \"{n}\"' for n in names)
        + "\n  ],\n"
        + f'  \"generator\": \"embervale-blender\",\n'
        + f'  \"blender\": \"{bpy.app.version_string}\"\n'
        + "}\n",
        encoding="utf-8",
    )
    print(f"[embervale] Manifest → {manifest}")
    print("[embervale] Done.")


if __name__ == "__main__":
    main()
