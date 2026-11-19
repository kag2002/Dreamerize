# 03 — Bến Sông Hoài Đêm Hoa Đăng & Cầu Gỗ Phố Cổ (Ref 03)

**Reference:** [03_hoian_river_lanterns.jpg](../03_hoian_river_lanterns.jpg)
**Scene Group Names:** `HoaiRiverFlowerLanterns`, `HoiAnSkyLanterns` (Inner Core), `HoaiRiverNightPromenade` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone:** `(175, 45)` Hoài River canal bisecting Hội An.
- **Macro Expansion Zone:** `(760, 260)` — **`320m × 240m`** (`x ∈ [600, 920]`, `z ∈ [140, 380]`), adjacent to `HoiAnGrandLanternQuarter` along a broad winding deep-indigo Hoài River estuary.
**Default Mood:** Lantern night (`timeOfDay 22.0`, weather `clear`).

## 1. Visual Breakdown of `03_hoian_river_lanterns.jpg`

- **Riverside Timber Bridge & Continuous Lantern Curtain:** Stretching across the full right half of the frame over the water, a long **wooden balustraded bridge** (`cầu gỗ Sông Hoài`) supported on timber pilings carries a continuous overhead row of glowing warm-white and amber lanterns, reflected softly in the water below.
- **Corner Assembly Pavilion & Riverside Shophouses:** To the left of the bridge stands a two-tier traditional pavilion with red-lantern-wrapped columns and curved tiled eaves, transitioning into lower riverside tiled roofs along the far bank.
- **Sapphire-Indigo Night River & Floating `Hoa Đăng`:** The calm water glows **deep cobalt-indigo** (`#1E4FA8` → `#13204A`) speckled with dozens of bright **orange-pink paper lotus lanterns (`hoa đăng`)** casting crisp vertical shimmering reflection streaks down the water surface.
- **Rising Sky Lanterns:** Scores of warm amber-orange **sky lanterns (`đèn trời`)** float upward across the midnight-blue sky above the far shoreline silhouette.
- **Excluded Theatre Props:** Audience heads/seats, top rigging trusses, left glass stage partitions, and foreground performers are completely excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Bến Bạch Đằng & Sông Hoài, Hội An) |
|---|---|
| **Cầu An Hội / Timber River Bridge** | `65–75 m` multi-span ironwood pedestrian bridge (`4.2 m` wide) with carved square timber balustrade posts (`1.1 m` high), sturdy river piers, and overhead bamboo lantern crossbeams every `1.8 m`. |
| **Hoa Đăng (River Flower Lanterns)** | Hand-folded colored paper lotus bowls (`Ø 16–22 cm`, 2 tiers of 8 pointed petals in `#FF7A45`, `#FFB347`, `#E8749A`) floating on wooden/cardboard bases with glowing beeswax candle cores. |
| **Thuyền Đèn Hoa Đăng (Sampans)** | `6.5 m` curved wooden river sampans (`thuyền gỗ Sông Hoài`) with two raised bow/stern silk lanterns guiding visitors across the slow (`0.2 m/s`) nocturnal river. |
| **Riverside Old-Quarter Facades** | Weathered yellow plaster walls, mossy `âm-dương` roof ridges, timber dock bollards, and stone embankment steps descending into the Hoài River. |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (162, 2.2, 58)` → `lookAt (182, 1.0, 42)`, FOV `55°`.
- **Macro Hero Camera (`HoaiRiverNightPromenade`):** `pos (705, 2.8, 318)` → `lookAt (775, 3.2, 248)`, FOV `56°` looking diagonally across the `hoa đăng`-filled river basin toward the lantern-strung wooden bridge and rising sky lanterns.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Long Wooden Balustrade Bridge** | Macro | `68m` multi-pier timber deck bridge (`y = 2.6m` above water) with 48 carved railing posts & overhead lantern crossbars | `1` merged bridge structure | `ironwood_dark`, `crimsonLacquer` accents |
| **Bridge Lantern Row** | Inner + Macro | Continuous `InstancedMesh` chain of cylindrical warm lanterns hung along the bridge railing | `140` macro lanterns | Emissive silk `#FFE2A8` / `#FFB347` |
| **Floating `Hoa Đăng` Lotus Bowls** | Inner + Macro | Multi-petal cupped lotus bowl (`Cone` + outer ring) + bright candle flame core + vertical water reflection streak quad | `220` inner + `450` macro | Vertex bob & slow current drift (`0.2 m/s`) |
| **Sky Lanterns (`Đèn Trời`)** | Inner + Macro | Soft tapered paper lanterns rising continuously in a `160m × 160m` sky box with curl drift | `180` inner + `260` macro | Emissive `#FF6A2B` with cyclic vertical float |
| **Wooden River Sampan Fleet** | Macro | 6 animated curved wooden sampans each bearing 2 hanging bow/stern lanterns | `6` vessels (`JunkBoatMotion`) | `darkWood` + `lanternSilk` |
| **Stone Embankment & Riverside Shophouses** | Macro | Stepped stone quay walls + 10 riverside ochre shophouses along northern bank | Merged per material | `stone`, `yellowOchrePlaster`, `terracottaRoof` |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 14` draw calls, `<= 130k` triangles.
- **Vitest Assertions:** `HoaiRiverFlowerLanterns`, `HoiAnSkyLanterns`, and `HoaiRiverNightPromenade` exist and dispose cleanly.
