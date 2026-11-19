# 13 — Hẻm Núi Đá Vôi & Rừng Nhiệt Đới Mùa Mưa Bão Trường Sơn (Ref 13)

**Reference:** [13_stormy_rain_jungle.jpg](../13_stormy_rain_jungle.jpg)
**Scene Group Names:** `VietnamMonsoonRainSystem` (Global Monsoon Rain System), `TruongSonMonsoonJungleGorge` (Macro Expansion Zone)
**Anchors & Footprints:**
- **Global Weather Layer:** `VietnamMonsoonRainSystem` active map-wide whenever `weather === 'rain'`.
- **Macro Expansion Zone:** `(740, -560)` — **`420m × 340m`** (`x ∈ [530, 950]`, `z ∈ [-730, -390]`), creating a permanent dramatic Trường Sơn limestone karst gorge, lush rain-drenched jungle slopes, cascading waterfall ledges, and drifting monsoon mist ribbons.
**Default Mood:** Monsoon storm (`weather: 'rain'`, `timeOfDay: 16.0` or `20.0`).

## 1. Visual Breakdown of `13_stormy_rain_jungle.jpg`

- **Heavy Slanted Tropical Rain Wall:** Thousands of crisp **slanted rain streaks (`~21°` wind tilt)** slice diagonally from upper-right to lower-left across the entire sky and jungle canopy.
- **Brooding Cobalt-Slate Storm Sky & Sun/Lightning Shafts:** Turbulent layers of **deep royal-cobalt and slate storm clouds (`#1C3B72` → `#3A5A8C`)** break open near the center to cast dramatic **diagonal silver-blue storm light shafts** through mist.
- **Towering Mossy Limestone Cliffs & Terraced Wet Rock Ledges:** On the right and left rise sheer dark wet limestone karst cliffs (`núi đá vôi Trường Sơn`), framing **stepped wet rock outcrops** and cascading mountain runoff in the lower foreground.
- **Wind-Bent Tropical Palm, Banana & Fern Jungle Canopy:** Dense tropical **coconut/areca palms, giant tree ferns, and broad-leafed banana plants** frame the midground, shimmering with wet specular highlights.
- **Swirling Low Valley Mist:** Luminous white-blue vapor ribbons (`sương mù thung lũng`) drift softly across rock ledges and jungle basins.
- **Excluded Theatre Props:** Audience heads, seats, trusses, glass frame borders, and stage performers dragging equipment are excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Mưa Bão Nhiệt Đới Dãy Trường Sơn) |
|---|---|
| **Tropical Monsoon Downpour (`Mưa Rào Nhiệt Đới`)** | Wind-deflected raindrop sheets tilted `18°–24°` (`~20.8°`), drop velocity `9–12 m/s`, motion-blurred threads `0.6–0.9 m` long. |
| **Wet Limestone & Jungle Foliage PBR** | Rain-soaked limestone darkens by `~22%` and drops surface roughness toward `0.10–0.20`, catching cool cobalt sky reflections and bright specular streaks. |
| **Trường Sơn Karst Jungle Flora** | Multi-story tropical broadleaf forest, wild jungle palms (`cọ rừng / dừa rừng`), `2.5–4.5 m` banana clumps, and low stream mist hugging karst saddles. |

## 3. Composition Target & Hero Cameras

- **Global Rain View:** Any spawn or landmark camera when `weather === 'rain'`.
- **Macro Hero Camera (`TruongSonMonsoonJungleGorge`):** `pos (740, 5.5, -432)` → `lookAt (740, 22.0, -595)`, FOV `58°` looking straight into the mist-filled limestone karst gorge framed by tropical palms, wet stepped rock waterfalls, and storm light shafts.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Camera-Wrapped Slanted Rain System** | Global (`weather = 'rain'`) | `3,500` billboarded capsule-SDF streaks modulo-wrapped inside a `64m × 36m × 64m` box tracking `camera.position` | `3,500` streaks (`InstancedMesh`) | Capsule-SDF `ShaderMaterial` (`20.8°` slant, zero square artifacts) |
| **Sheer Trường Sơn Limestone Gorge Cliffs** | Macro | `14` towering wet stratified limestone peaks (`34m–82m` tall) lining both gorge walls + stepped central waterfall rock ledges | `14` peaks + stepped cascades | Wet dark limestone `#2C3A3F` + glossy moss caps `#2C522E` |
| **Cascading Mountain Waterfall Sheets** | Macro | Animated translucent white-foam water ribbons tumbling down the central `18m` terraced rock ledges | `4` cascade ribbons | Scrolling foam UV shader (`#DCE6EE`) |
| **Monsoon Jungle Palms, Ferns & Banana Groves** | Macro | `96` arching multi-frond tropical jungle palms & broad-leaf clusters swaying along gorge ridges | `96` trees (`InstancedMesh`) | Glossy wet tropical foliage (`roughness 0.32`) |
| **Drifting Valley Mist Ribbons & Storm Light Shafts** | Macro | `28` elongated soft-Gaussian mist cards drifting through the gorge + `6` subtle silver-blue storm light shafts | `28` mist + `6` shafts | Soft radial alpha & additive scatter shader |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 12` draw calls, `<= 115k` triangles; `VietnamMonsoonRainSystem` uses `1` draw call (`<= 7k` tris).
- **Vitest Assertions:** `VietnamMonsoonRainSystem` and `TruongSonMonsoonJungleGorge` exist and dispose cleanly; `setAtmosphereState({ timeOfDay: 16, weather: 'rain' })` sets `VietnamMonsoonRainSystem.visible = true`.
