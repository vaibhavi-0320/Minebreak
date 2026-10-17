"""Prop voxel blueprints (pure data) + optional bpy builders."""

from __future__ import annotations

from typing import List, Tuple

Voxel = Tuple[float, float, float, float, str]


def build_tree(tall: bool = False) -> List[Voxel]:
    voxels: List[Voxel] = []
    trunk_h = 4 if tall else 3
    for i in range(trunk_h):
        voxels.append((0.0, 0.25 + i * 0.45, 0.0, 0.45, "wood"))
    layers = 4 if tall else 3
    crown_y = trunk_h * 0.45
    for li in range(layers):
        r = (layers - li) * 0.55 + 0.2
        y = crown_y + li * 0.45
        for k in range(8):
            import math

            a = (k / 8) * math.pi * 2
            voxels.append((math.cos(a) * r * 0.7, y, math.sin(a) * r * 0.7, 0.55, "leaf"))
        voxels.append((0.0, y + 0.1, 0.0, 0.7, "leaf"))
    return voxels


def build_rock() -> List[Voxel]:
    return [
        (0.0, 0.25, 0.0, 0.55, "stone"),
        (0.25, 0.2, 0.1, 0.4, "stone"),
        (-0.2, 0.18, -0.15, 0.35, "stone"),
        (0.05, 0.4, -0.05, 0.3, "stone"),
    ]


def build_lantern() -> List[Voxel]:
    return [
        (0.0, 0.2, 0.0, 0.2, "wood"),
        (0.0, 0.55, 0.0, 0.16, "wood"),
        (0.0, 0.95, 0.0, 0.35, "stone"),
        (0.0, 0.95, 0.0, 0.22, "gold"),
        (0.0, 1.2, 0.0, 0.28, "wood"),
    ]


def build_shrine() -> List[Voxel]:
    import math

    voxels: List[Voxel] = []
    for y in range(4):
        voxels.append((0.0, 0.3 + y * 0.45, 0.0, 0.55, "stone"))
    voxels.append((0.0, 2.1, 0.0, 0.5, "gold"))
    voxels.append((0.0, 2.45, 0.0, 0.28, "ember"))
    for i in range(6):
        a = (i / 6) * math.pi * 2
        voxels.append((math.cos(a) * 1.1, 0.2, math.sin(a) * 1.1, 0.35, "stone"))
    return voxels


def build_cottage() -> List[Voxel]:
    voxels: List[Voxel] = []
    for x in range(-2, 3):
        for y in range(0, 3):
            for z in range(-2, 3):
                edge = x in (-2, 2) or z in (-2, 2) or y == 0
                if not edge:
                    continue
                if z == 2 and x == 0 and y in (0, 1):
                    continue
                key = "stone" if y == 0 else "plaster"
                voxels.append((x * 0.55, y * 0.55 + 0.3, z * 0.55, 0.55, key))
    for xi in range(-5, 6):
        for zi in range(-5, 6):
            x = xi * 0.5
            z = zi * 0.5
            h = 1.7 - abs(x) * 0.35
            voxels.append((x * 0.55, h + 1.1, z * 0.55, 0.5, "roof"))
    for y in range(3):
        voxels.append((0.9, 2.2 + y * 0.4, -0.6, 0.4, "stone"))
    voxels.append((-0.9, 1.0, 1.15, 0.35, "gold"))
    voxels.append((0.9, 1.0, 1.15, 0.35, "gold"))
    return voxels
