# 12 — Đại Quảng Trường Ánh Sáng Lễ Hội Đỏ – Lam (Ref 12)

**Reference:** [12_red_blue_stage_beams.jpg](../12_red_blue_stage_beams.jpg)
**Scene Group Names:** `VietnamFestivalLightBeams` (Global Night Ceremonial Light Layer)
**Anchors & Footprints:**
- Distributed symmetrically across the Inner Heritage Crossroads (Khuê Văn Các `±16, -4`, Hoàng Thành `±22, -68`, Hội An `165/185, 45`) **and** the Outer Grand Cultural Sanctuaries (`HueGrandImperialPalace` `(-680, 80)`, `HoiAnGrandLanternQuarter` `(640, 140)`, `DaiLienHoaLotusSanctuary` `(0, -560)`, `LongVanLacquerValleyMacro` `(820, -80)`, `TayNguyenBrocadeSanctuaryMacro` `(-840, 120)`).
**Default Mood:** Lantern night (`timeOfDay >= 19.0 || timeOfDay < 5.0` and `weather !== 'rain'`).

## 1. Visual Breakdown of `12_red_blue_stage_beams.jpg`

- **Intersecting Volumetric Crimson & Cobalt Light Cones:** Dramatic angled shafts of **electric cobalt blue (`#1E5BFF`)** and **saturated crimson red (`#E02424`)** sweep across dense nocturnal atmospheric haze, crossing diagonally in crisp V- and X-patterns above the ceremonial plaza.
- **Soft Atmospheric Haze & Ground Glow Pools:** Light cones dissolve seamlessly along their outer fringes and high altitude via Fresnel falloff and rising dust shimmer, bathing ground stone courtyards in warm magenta-red and cool cobalt pools.
- **Excluded Theatre Props:** Overhead black ceiling trusses, moving-head fixture cans, stage performers, audience heads, and seats are **100% excluded**. In the open-air 3D world, beams originate cleanly from low architectural **bronze/stone ceremonial uplight pedestals** seated at monument plaza edges.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Chiếu Sáng Lễ Hội Di Sản Quốc Gia) |
|---|---|
| **Architectural Heritage Uplighting** | Ground-mounted weatherproof bronze floodlight sconces (`đèn rọi di tích`) set into carved stone bollards around citadel gates, temples, and festival bridges, projecting narrow `8°–14°` volumetric shafts `38–58 m` skyward during national festival nights. |
| **Atmospheric Dispersion** | Humid tropical evening haze creates visible Mie scattering corridors along high-lumen beams without crisp polygonal cylinder seams. |

## 3. Composition Target & Hero Camera

- **Spawn & Plaza Hero Camera:** `pos (0, 2.2, 58)` → `lookAt (0, 8.5, -12)`, FOV `60°` at `timeOfDay: 22.0` showing symmetric crossed cobalt and crimson shafts framing Khuê Văn Các and Hoàng Thành against the night sky.

## 4. Geometry & Shader Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Crossed Volumetric Light Shafts** | Global Night Layer | `InstancedMesh` open-ended `CylinderGeometry(0.40, 5.4, 48, 16, 1, true)` tilted `±22°–38°` (`0` trusses) | `24` beams across inner plazas & outer sanctuaries | Additive `ShaderMaterial` with `pow(abs(dot(vNormV, vDir)), 2.2)` edge softness + rising dust shimmer (`uTime`) |
| **Architectural Bronze Uplight Pedestals** | Ground Anchors | Compact carved stone-and-bronze floodlight sconces (`0.45m` tall) grounding every beam origin | `24` pedestals (`InstancedMesh`) | `bronze` + glowing core lens |

## 5. Budget & Verification

- **Global Layer Budget:** `<= 3` draw calls, `<= 2.5k` triangles; automatically hidden (`visible = false`) during clear daytime (`13h`) and heavy monsoon `rain`.
- **Vitest Assertions:** `VietnamFestivalLightBeams` exists, toggles `visible = true` at `22:00 / clear`, and `visible = false` during `rain`.
