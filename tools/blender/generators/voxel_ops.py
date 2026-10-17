"""Shared bpy voxel helpers for Embervale generators.

Compatible with Blender 4.5+ / bpy 5.x style mesh APIs.
Target environment note: this machine ships Blender 4.5.11 LTS;
scripts avoid 5.1-only APIs so they run on both.
"""

from __future__ import annotations

from typing import Iterable, List, Sequence, Tuple

import bpy
from mathutils import Vector

from conventions import MATERIAL_ATLAS, MATERIAL_EMISSIVE, PALETTE

Color = Tuple[float, float, float]
Voxel = Tuple[float, float, float, float, str]  # x, y, z, size, palette_key


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def ensure_material(name: str, color: Color, emissive: bool = False) -> bpy.types.Material:
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.85
    if emissive:
        bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
        # Blender 4.x uses Emission Strength
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 1.2
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def palette_material(key: str) -> bpy.types.Material:
    color = PALETTE.get(key, PALETTE["stone"])
    emissive = key in {"ember", "gold", "boss_accent", "flower_yellow"}
    name = f"{MATERIAL_EMISSIVE}_{key}" if emissive else f"{MATERIAL_ATLAS}_{key}"
    return ensure_material(name, color, emissive=emissive)


def add_voxel_cube(
    collection: bpy.types.Collection,
    x: float,
    y: float,
    z: float,
    size: float,
    color_key: str,
    name: str,
) -> bpy.types.Object:
    # Blender Z-up: game Y-up maps (x, y, z)_game -> (x, z, y)_blender
    bpy.ops.mesh.primitive_cube_add(size=size * 0.98, location=(x, z, y))
    obj = bpy.context.active_object
    obj.name = name
    mat = palette_material(color_key)
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    collection.objects.link(obj)
    if obj.name in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.unlink(obj)
    return obj


def build_from_voxels(
    name: str,
    voxels: Sequence[Voxel],
    join: bool = True,
) -> bpy.types.Object:
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)

    objects: List[bpy.types.Object] = []
    for i, (x, y, z, size, key) in enumerate(voxels):
        objects.append(add_voxel_cube(col, x, y, z, size, key, f"{name}_v{i:03d}"))

    if not objects:
        raise RuntimeError(f"No voxels for {name}")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    if join and len(objects) > 1:
        bpy.ops.object.join()

    root = bpy.context.active_object
    root.name = name
    # origin to base center
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    # snap base to Z=0
    min_z = min((v.co.z for v in root.data.vertices), default=0.0)
    root.location.z -= min_z
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return root


def export_glb(obj: bpy.types.Object, path: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
