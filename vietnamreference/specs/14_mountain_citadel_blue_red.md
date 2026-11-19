# 14 — Quần Thể Cứ Điểm Núi Cao & Chiến Trường Điện Biên — Tây Bắc (Ref 14)

**Reference:** [14_mountain_citadel_blue_red.jpg](../14_mountain_citadel_blue_red.jpg)
**Scene Group Names:** `DienBienMountainBastion` (Inner Core), `DienBienHighlandCitadelMacro` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone (`Z9`):** `(-300, -255)` — `52m × 48m` along northwestern ridge.
- **Macro Expansion Zone:** `(-820, -520)` — **`400m × 340m`** (`x ∈ [-1020, -620]`, `z ∈ [-690, -350]`), creating an expansive 180° Mường Thanh basin mountain ridge crowned by the fortified stone citadel, twin watchtowers, multi-line sandbag trenches, and timber barricades.
**Default Mood:** Lantern night (`timeOfDay 22.0`) or Dawn mist (`6.0`).

## 1. Visual Breakdown of `14_mountain_citadel_blue_red.jpg`

- **Jagged Cobalt-Blue Night Mountain Skyline (`Núi Cao Tây Bắc`):** Sweeping across the full horizon and surging on the right flank are steep, deeply creased **cobalt-indigo mountain peaks (`#16489E` / `#13204A`)** etched with silvery-blue moonlit ridge streaks against an indigo-cobalt night sky.
- **Fortified Hilltop Citadel & Twin Timber Watchtowers (`Cứ Điểm Đồi A1`):** Rising at the center crest of the hill is a tiered stone-and-earth bastion wall crowned by **two distinctive hexagonal/square timber-roofed defensive watchtowers (`tháp canh đồn bốt`)** with conical eaves, silhouetted fiercely against intense **crimson-red flare smoke** (`#FF3B2F`) behind the battlements.
- **Multi-Course Burlap Sandbag Trench Emplacements (`Hào Giao Thông & Bao Cát`):** Across the foreground slope sit **four semicircular defensive sandbag trenches** built from hundreds of staggered weathered burlap sandbags (`#9A8262`) reinforced with wooden revetment stakes and timber ammo crates.
- **Crossed Timber Chevaux-de-Frise Barricades (`Hàng Rào Cọc Gỗ Chữ X`):** Extending diagonally along the right ridge slope is a long defensive perimeter fence of **sharpened crossed X-shaped timber anti-infantry obstacles**.
- **Dramatic Warm-Red Flare Glow vs Cool Cobalt Shadow:** Intense crimson-scarlet flare wash illuminates the citadel walls, sandbags, and drifting battlefield smoke against deep blue nocturnal stone.
- **Excluded Theatre Props:** Audience heads, seats, overhead trusses, stage glass panels, flat stage floor, and soldiers are excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Cứ Điểm Đồi A1 — Điện Biên Phủ 1954) |
|---|---|
| **Hilltop Bastion & Watchtowers** | Terraced laterite/stone command redoubt atop a `28–36 m` hill overlooking the Mường Thanh valley, anchored by timber-and-sheet-metal observation cupolas (`tháp canh`) and buried log-crib command bunkers. |
| **Sandbag Parapets (`Công Sự Bao Cát`)** | Running-bond burlap sacks (`0.55 × 0.18 × 0.35 m`, `#9A8262`) stacked `4–6` courses high around circular machine-gun pits and communication trenches. |
| **Chevaux-de-Frise (`Hàng Rào Cọc Chéo`)** | Paired sharpened `2.2 m` timber stakes lashed in repeating `X`-frames along ridge approaches. |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (-282, 3.2, -224)` → `lookAt (-306, 12.0, -264)`, FOV `56°`.
- **Macro Hero Camera (`DienBienHighlandCitadelMacro`):** `pos (-820, 31.5, -422)` → `lookAt (-820, 44.0, -545)`, FOV `58°` looking across the foreground sandbag trenches and right-flank wooden X-barricades toward the red-flare-lit hilltop stone citadel, twin watchtowers, and jagged cobalt mountain crags.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **180° Jagged Cobalt Highland Crag Range** | Inner + Macro | `5` inner crags + `14` massive displaced folded granite/shale peaks (`35m–85m` tall) forming a sweeping horseshoe mountain ridge | `5` inner + `14` macro | Cobalt-slate granite `#253658` with icy ridge mineral highlight |
| **Fortified Stone Citadel & Twin Timber Watchtowers** | Macro | Tiered stone bastion walls + `2` detailed timber observation watchtowers with pointed conical roofs + log-crib command bunkers | `1` citadel + `2` watchtowers + `4` bunkers | `stone`, `granite`, `darkWood` |
| **Multi-Pit Burlap Sandbag Trenches** | Inner + Macro | `180` inner + `420` macro staggered beveled burlap sandbags forming `4` semicircular firing pits | `180` inner + `420` macro (`InstancedMesh`) | Burlap `#9A8262` (`roughness 0.94`) |
| **Crossed Timber Chevaux-de-Frise Line** | Inner + Macro | `48` inner + `110` macro crossed `X`-frame sharpened timber barricades sweeping `95m` across the right ridge | `110` X-frames (`InstancedMesh`) | Weathered `ironwood_dark` `#3B2418` |
| **Crimson Battle Flare Wash & Smoke Plumes** | Inner + Macro | Glowing copper flare pots + soft translucent crimson/indigo backlit smoke ribbons behind the citadel walls | `8` flare pots + `14` smoke plumes | Additive crimson `#FF3B2F` glow + soft smoke shader |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 12` draw calls, `<= 110k` triangles.
- **Vitest Assertions:** `DienBienMountainBastion` and `DienBienHighlandCitadelMacro` exist and dispose cleanly.
