# 08 — Quảng Trường Trống Đồng Đông Sơn & Không Gian Văn Hoá Lạc Việt (Ref 08)

**Reference:** [08_dong_son_bronze_drum.jpg](../08_dong_son_bronze_drum.jpg)
**Scene Group Names:** `DongSonPlazaMedallion`, `DongSonDrumReplica`, `MekongBananaGarden`, `NipaThatchPavilion` (Inner Core), `DongSonSunSanctuaryMacro` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone:** Plaza Medallion `(0, 16)` + 1:1 Drum Replica `(17.5, 16)` + Mekong Banana Garden & Nipa Pavilion `(-95, 320)`.
- **Macro Expansion Zone:** `(-680, 420)` — **`340m × 300m`** (`x ∈ [-850, -510]`, `z ∈ [270, 570]`), uniting all visual elements of `08_dong_son_bronze_drum.jpg` into a monumental Lạc Việt solar plaza & tropical banana-grove sanctuary.
**Default Mood:** Golden sunset (`timeOfDay 17.5`) or Lantern night (`22.0`).

## 1. Visual Breakdown of `08_dong_son_bronze_drum.jpg`

- **Colossal Glowing Đông Sơn Bronze Drum Sun Disc (`Mặt Trống Đồng Ngọc Lũ`):** Rising monolithically on the central horizon axis in warm **vermilion-orange and antique gold** (`#FF6A2B` → `#D4A43A`) is a huge circular **Đông Sơn drum face**, displaying crisp concentric bands of geometric tangent circles, costumed feathered warriors, stilt houses, and flying `chim Lạc` birds radiating from its central multi-pointed sun star, framed by a blazing crimson corona.
- **Overarching Concentric Ring Canopy (`Vòm Vầng Nhật Nguyệt`):** Sweeping overhead across the upper third of the frame are **five vast concentric, slightly tilted golden-orange bamboo/rattan ring ribs** glowing from beneath, echoing the sun-orbit motif and traditional woven bamboo roofing.
- **Central Woven Bamboo Pyramid / Fish-Trap Pavilion (`Nơm Tre Đan Truyền Thống`):** Grounding the central plaza axis in front of the glowing drum is an open geometric **woven-bamboo pyramidal pavilion/fish-trap sculpture** (`nơm cá` / ceremonial bamboo frame), flanked left and right by low golden-lit pitched thatch eaves.
- **Lush Tropical Banana Groves Heavy with Green Bunches (`Vườn Chuối Tiêu / Chuối Xiêm`):** Framing both left and right sides are towering **banana plants (`Musa`)** with broad arched **torn leaves** (`rách gân lá`) and prominent hanging clusters of **vibrant green banana bunches (`buồng chuối xanh`)** tipped with purple-red `bắp chuối` blossoms.
- **Excluded Theatre Props:** Audience heads, seats, trusses, stage floor, and costumed stage performers are excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Văn Hoá Đông Sơn — Ngọc Lũ Heger Type I, 500 BCE – 100 CE) |
|---|---|
| **Ngọc Lũ Bronze Drum Face** | `14-pointed central sun star` with `lông công` feather chevron fillers; `16` alternating geometric (tangent-linked circles, comb hatches, sawtooth) and figurative bands (feathered dancers, stilt houses with boat-shaped roofs, rice pounders, deer, and **`18` counter-clockwise flying `chim Lạc`** cranes). |
| **Nơm Tre / Woven Bamboo Lattice** | Traditional Vietnamese split-bamboo conical/pyramidal lattice frame woven with cross-braced hexagonal/diamond splints (`#C99A48`). |
| **Cây Chuối Tiêu & Buồng Chuối** | `3.2–4.8 m` succulent green pseudostem, `8–12` arching broad leaves (`2.2m × 0.5m`) naturally wind-split along parallel lateral veins, hanging peduncles carrying `6–10` tiers of green bananas (`#7FA43A`) and a teardrop maroon `bắp chuối` flower (`#7A1F3D`). |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (0, 2.2, 26)` → `lookAt (0, 0.2, 16)`, FOV `56°`.
- **Macro Hero Camera (`DongSonSunSanctuaryMacro`):** `pos (-680, 2.6, 488)` → `lookAt (-680, 8.5, 385)`, FOV `58°` looking beneath the 5 sweeping concentric golden canopy rings past the woven bamboo pyramidal centerpiece and flanking bunch-laden banana trees directly toward the monumental 22m glowing Đông Sơn Sun Disc.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Monumental 22m Upright Đông Sơn Sun Monument** | Macro (+ Inner Medallion & 1:1 Replica) | `Ø 22m` circular carved bronze face + beveled crimson-gold halo ring mounted on a stepped laterite-and-stone ceremonial altar | `1` colossal upright drum (`Ø 22m`) + `1` horizontal plaza replica | `createDongSonBronzeTextures(512)` + warm sunset/amber emissive pattern mask |
| **Overarching 5-Tier Concentric Ring Canopy** | Macro (+ Inner Nipa Pavilion) | `5` huge tilted concentric arched timber/bamboo rings (`Ø 28m..48m`) supported on perimeter ironwood columns overhead (`y = 14..24m`) | `5` concentric ring tiers | Warm backlit `straw_ochre` / `#E09638` rattan glaze |
| **Central Woven Bamboo Pyramidal `Nơm` Frame** | Macro | Open 4-sided criss-cross split-bamboo lattice pyramid (`Ø 8.5m × 5.2m`) on stone plinth | `1` merged bamboo lattice | `straw_ochre` `#C99A48` + subtle lantern uplight |
| **Flanking Thatch Village Roofs** | Macro | `4` traditional curved palm-thatch pavilions flanking the plaza edges | `4` pavilions | `thatchMat` + `darkWood` |
| **Tropical Banana Grove with Bunches & Flowers** | Inner + Macro | `36` inner + `110` macro banana plants with shredded-strip leaf geometry + `64` multi-hand green banana bunches + teardrop purple blossoms | `110` plants + `64` bunches (`InstancedMesh`) | `#4C7A3A` leaves, `#7FA43A` fruit, `#7A1F3D` blossom |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 14` draw calls, `<= 135k` triangles.
- **Vitest Assertions:** `DongSonPlazaMedallion`, `DongSonDrumReplica`, `MekongBananaGarden`, `NipaThatchPavilion`, and `DongSonSunSanctuaryMacro` exist and dispose cleanly.
