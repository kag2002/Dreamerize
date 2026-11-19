# 10 — Đại Tượng Đài Phù Điêu Đá Núi "Đất Nước — Thiên Hùng Ca" (Ref 10)

**Reference:** [10_heroic_rock_relief.jpg](../10_heroic_rock_relief.jpg)
**Scene Group Names:** `DenHungHeroicCliffRelief` (Inner Core), `DatNuocHeroicCanyonMacro` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone:** Đền Hùng cliff flank `(-195, -226)`.
- **Macro Expansion Zone:** `(-560, -640)` — **`380m × 260m`** (`x ∈ [-750, -370]`, `z ∈ [-770, -510]`), sculpted into a sweeping semicircular canyon amphitheater of monumental carved mountain reliefs.
**Default Mood:** Golden sunset (`timeOfDay 17.5`) or Dawn mist (`6.0`) to rake dramatic grazing shadows across every carved figure.

## 1. Visual Breakdown of `10_heroic_rock_relief.jpg`

- **Monumental Sweeping Bas-Relief Canyon Wall (`Phù Điêu Đá Núi Trường Sơn / Nghĩa Lĩnh`):** A massive, continuous **dark weathered granite-and-basalt mountain cliff face** curving around three flanks (left wing, deep central cleft, right wing), sculpted into deep **3D high-relief historical figures** representing millennia of Vietnamese history and resilience:
  - **Left Cliff Wing:** 20th-century soldiers in pith helmets (`mũ cối`) standing shoulder-to-shoulder, followed inward by medieval armored defenders with spears and ancient Lạc Việt feathered warriors.
  - **Central Sacred Cleft:** Anchored by a towering vertical **bronze Đông Sơn drum pillar** flanked symmetrically by a **soaring `Chim Lạc` phoenix-crane** on the left, a **coiling Vietnamese Dragon** on the right, and legendary Lạc Việt founders rising from sculpted crags.
  - **Right Cliff Wing:** Medieval bowmen and vanguard warriors, a serene **scholar/monk figure** (`Trần Nhân Tông / Hiền Triết`), and on the far right pedestal a **monumental standing Leader statue** raising a hand in salute.
- **Grazing Warm Bronze-Amber Lighting (`#D4A43A` / `#FF8A3A`):** Strong side-grazing warm amber light picks out sculpted shoulders, helmets, armor, dragon scales, and rock cleavage ridges against deep dark slate-obsidian recessed crevices (`#261D19`).
- **Suspended Conical `Nón Lá` Bronze Lattice Crown:** Hanging high above the central sacred cleft against the dark sky is a delicate open **16-ribbed conical bronze `nón lá` wireframe finial** (`Ø 9.6m`).
- **Excluded Theatre Props:** Audience heads, seats, trusses, LED panel seams, stage floor, white/gold performers, and the floating `"ĐẤT NƯỚC / THIÊN HÙNG CA"` subtitle text are strictly excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Phù Điêu Đá Núi Monumental Heritage Scale) |
|---|---|
| **Monumental Granite Bas-Relief** | Carved monolithic mountain relief panels (`80–120 m` curved span, `18–26 m` cliff height, `0.45–1.35 m` relief projection) modeled after Vietnam's national mountain memorials (Đền Hùng, Điện Biên Phủ, Tượng Đài Bà Mẹ VNAH). |
| **Geological Strata & Stone** | Weathered dark metamorphic basalt-granite (`#46352C` recessed matrix, `#8B6E52` chiselled faces, `#B08A3E` warm oxidized bronze highlights) with fractured 15° stratified bedding planes. |
| **Architectural `Nón Lá` Bronze Finial** | `Ø 9.6 m` open-lattice conical bronze dome (`16` radial rafters, `6` concentric purlin rings, `108°` apex) suspended over the central ceremonial stone altar. |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (-195, 2.5, -162)` → `lookAt (-195, 11.5, -225)`, FOV `52°`.
- **Macro Hero Camera (`DatNuocHeroicCanyonMacro`):** `pos (-560, 22.0, -562)` → `lookAt (-560, 29.0, -680)`, FOV `58°` standing on the carved granite amphitheater terrace gazing straight into the `110m` curving heroic bas-relief cliff wall and suspended bronze `nón lá` halo.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Semicircular `110m` Bas-Relief Mountain Wall** | Inner + Macro | Curved multi-segment displaced granite cliff (`110m` arc × `26m` high in macro) with deep 3D sculpted hero relief clusters (`11` distinct relief figure/emblem compositions) + jagged flanking crags | `1` inner (`38m`) + `1` macro (`110m` horseshoe) | High-contrast bronze/granite chiselled relief shader (`normalScale 2.4`) |
| **Embedded Central Đông Sơn Drum & Dragon/Lạc Bird Relief** | Macro | `Ø 5.4m` carved Đông Sơn bronze medallion centerpiece flanked by sculpted 3D dragon & `Chim Lạc` wings carved directly into the central rock pillar | `1` central relief assembly | `bronze` + `old_gold` patina highlights |
| **Suspended `Nón Lá` Open Bronze Lattice Canopy** | Inner + Macro | `16` radial bronze ribs + `6` concentric horizontal rings (`Ø 4.8m` inner / `Ø 9.6m` macro) suspended above the central cleft | `1` inner + `1` macro | `lacquer_gold` / burnished bronze |
| **Ceremonial Granite Steps & Bronze Incense Braziers** | Macro | Stepped semicircular granite terrace (`r = 56m`) + `6` monumental bronze tripod incense braziers casting warm amber grazing pools | `1` terrace + `6` braziers | `granite`, `bronze`, emissive `#FF8A3A` ember cores |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 10` draw calls, `<= 95k` triangles.
- **Vitest Assertions:** `DenHungHeroicCliffRelief` and `DatNuocHeroicCanyonMacro` exist and dispose cleanly with zero HUD text overlays.
