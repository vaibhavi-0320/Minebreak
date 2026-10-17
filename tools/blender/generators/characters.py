"""Character voxel blueprints for Embervale."""

from __future__ import annotations

from typing import List, Tuple

Voxel = Tuple[float, float, float, float, str]


def build_player() -> List[Voxel]:
    return [
        (-0.25, 0.15, 0.05, 0.28, "wood"),
        (0.25, 0.15, 0.05, 0.28, "wood"),
        (-0.22, 0.4, 0.0, 0.28, "player_cloak"),
        (0.22, 0.4, 0.0, 0.28, "player_cloak"),
        (0.0, 0.75, 0.0, 0.55, "player_cloak"),
        (0.0, 0.75, 0.22, 0.28, "plaster"),
        (-0.45, 0.72, 0.05, 0.24, "player_body"),
        (0.45, 0.72, 0.05, 0.24, "player_body"),
        (0.0, 1.2, 0.0, 0.42, "player_body"),
        (0.0, 1.48, 0.0, 0.38, "player_hat"),
        (0.0, 1.65, 0.0, 0.22, "player_hat"),
        (0.1, 1.0, 0.2, 0.18, "ember"),
    ]


def build_slime() -> List[Voxel]:
    return [
        (0.0, 0.25, 0.0, 0.7, "slime"),
        (0.0, 0.55, 0.0, 0.55, "slime"),
        (-0.15, 0.62, 0.22, 0.12, "boss"),
        (0.15, 0.62, 0.22, 0.12, "boss"),
        (0.0, 0.35, 0.28, 0.16, "white"),
    ]


def build_mushroom() -> List[Voxel]:
    return [
        (0.0, 0.35, 0.0, 0.4, "plaster"),
        (0.0, 0.7, 0.0, 0.75, "mushroom"),
        (0.2, 0.75, 0.15, 0.16, "plaster"),
        (-0.18, 0.78, -0.1, 0.14, "plaster"),
    ]


def build_imp() -> List[Voxel]:
    return [
        (0.0, 0.35, 0.0, 0.4, "imp"),
        (0.0, 0.7, 0.0, 0.42, "imp"),
        (-0.28, 0.95, 0.0, 0.16, "imp"),
        (0.28, 0.95, 0.0, 0.16, "imp"),
        (-0.1, 0.78, 0.18, 0.1, "gold"),
        (0.1, 0.78, 0.18, 0.1, "gold"),
    ]


def build_beetle() -> List[Voxel]:
    return [
        (0.0, 0.28, 0.0, 0.7, "beetle"),
        (0.0, 0.45, 0.15, 0.45, "beetle"),
        (-0.35, 0.2, 0.2, 0.14, "stone"),
        (0.35, 0.2, 0.2, 0.14, "stone"),
        (-0.35, 0.2, -0.2, 0.14, "stone"),
        (0.35, 0.2, -0.2, 0.14, "stone"),
    ]


def build_boss() -> List[Voxel]:
    return [
        (0.0, 0.7, 0.0, 1.4, "boss"),
        (0.0, 1.4, 0.0, 1.1, "boss"),
        (0.0, 2.05, 0.0, 0.7, "boss_accent"),
        (-0.45, 2.25, 0.0, 0.28, "ember"),
        (0.45, 2.25, 0.0, 0.28, "ember"),
        (0.0, 2.4, 0.0, 0.32, "gold"),
        (-1.0, 1.1, 0.2, 0.55, "boss"),
        (1.0, 1.1, 0.2, 0.55, "boss"),
        (-0.28, 1.55, 0.5, 0.22, "ember"),
        (0.28, 1.55, 0.5, 0.22, "ember"),
        (-0.7, 1.65, 0.0, 0.4, "stone"),
        (0.7, 1.65, 0.0, 0.4, "stone"),
    ]
