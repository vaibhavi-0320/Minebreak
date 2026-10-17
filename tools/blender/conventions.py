"""Embervale asset conventions — bpy-free, unit-testable.

Scale: 1 Blender unit = 1 metre.
Origins: base-centered on ground plane (Z-up in Blender, converted on export).
Naming: ember_{category}_{name}_{variant:02d}
Materials: M_VoxelAtlas (palette) + optional M_Emissive
Budgets: props 40–400 tris, characters 80–600, bosses 400–2000
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional, Tuple

UNIT_METERS = 1.0
PLAYER_HEIGHT = 1.15
GRID_SNAP = 0.25

NAME_PATTERN = r"^ember_([a-z][a-z0-9]*)_([a-z][a-z0-9]*)_([0-9]{2})$"
NAME_RE = re.compile(NAME_PATTERN)

MATERIAL_ATLAS = "M_VoxelAtlas"
MATERIAL_EMISSIVE = "M_Emissive"

TRI_BUDGET_PROP = (40, 400)
TRI_BUDGET_CHAR = (80, 600)
TRI_BUDGET_BOSS = (400, 2000)

# Cozy voxel palette (sRGB 0–1)
PALETTE = {
    "grass": (0.373, 0.561, 0.361),
    "grass_dark": (0.290, 0.451, 0.286),
    "dirt": (0.545, 0.420, 0.290),
    "path": (0.769, 0.647, 0.455),
    "water": (0.416, 0.659, 0.722),
    "stone": (0.541, 0.561, 0.525),
    "wood": (0.627, 0.404, 0.290),
    "leaf": (0.435, 0.678, 0.408),
    "flower_pink": (0.910, 0.627, 0.690),
    "flower_yellow": (0.941, 0.816, 0.416),
    "roof": (0.769, 0.361, 0.290),
    "plaster": (0.941, 0.894, 0.816),
    "player_body": (0.941, 0.761, 0.478),
    "player_cloak": (0.310, 0.478, 0.541),
    "player_hat": (0.878, 0.478, 0.227),
    "slime": (0.494, 0.812, 0.541),
    "mushroom": (0.831, 0.518, 0.478),
    "imp": (0.608, 0.420, 0.722),
    "beetle": (0.353, 0.478, 0.541),
    "boss": (0.420, 0.227, 0.478),
    "boss_accent": (0.941, 0.627, 0.353),
    "ember": (1.0, 0.541, 0.290),
    "gold": (0.957, 0.773, 0.427),
    "white": (0.96, 0.96, 0.94),
}


@dataclass(frozen=True)
class AssetName:
    category: str
    name: str
    variant: int

    def __str__(self) -> str:
        return f"ember_{self.category}_{self.name}_{self.variant:02d}"


def format_name(category: str, name: str, variant: int) -> str:
    return f"ember_{category}_{name}_{variant:02d}"


def parse_name(asset_name: str) -> Optional[AssetName]:
    m = NAME_RE.match(asset_name)
    if not m:
        return None
    return AssetName(category=m.group(1), name=m.group(2), variant=int(m.group(3)))


def budget_for(category: str) -> Tuple[int, int]:
    if category in {"boss"}:
        return TRI_BUDGET_BOSS
    if category in {"player", "mob", "character"}:
        return TRI_BUDGET_CHAR
    return TRI_BUDGET_PROP
