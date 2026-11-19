# 05 — Liên Hoa Bạch Ngọc Đài: Không Gian Sen Hồng Linh Thiêng & Vòm Tường Vân (Ref 05)

**Reference:** [05_lotus_pink_stage.jpg](../05_lotus_pink_stage.jpg)
**Scene Group Names:** `PlazaSacredLotus`, `LotusColumnArcade` (Inner Core), `DaiLienHoaLotusSanctuary` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone:** Plaza twin ponds `(±28, 34)`, One Pillar Pagoda `(-48, 22)`, Turtle Tower `(52, 22)`.
- **Macro Expansion Zone:** `(0, -560)` — **`260m × 240m`** (`x ∈ [-130, 130]`, `z ∈ [-680, -440]`) sculpted as a circular imperial white-marble lotus lake island (`r = 54m` lotus basin surrounded by a `r = 54..92m` marble esplanade).
**Default Mood:** Lantern night (`timeOfDay 22.0`) or Dawn mist (`6.0`) so pink luminous petals reflect vividly on still water.

## 1. Visual Breakdown of `05_lotus_pink_stage.jpg`

- **Colossal Glowing Pink Sacred Lotus Centerpiece (`Đại Liên Hoa Đài`):** Dominating the central horizon axis is a monumental multi-layered **pink lotus blossom** with richly veined, translucent cupped petals (`#E8749A` → `#F7D3DE` → `#FFE6EF`), radiant golden seed pod (`gương sen vàng`), and layered stamens.
- **Lotus-Etched Crimson Columns on Carved White-Jade Bases:** Framing both left and right sides are tall **red-pink lacquered columns** etched with **glowing golden lotus stem, leaf, and bud line art** climbing vertically up the shafts, resting on **carved white-jade/celadon cloud-and-lotus pedestal bases (`chân tảng liên hoa`)**.
- **Overhead Lotus-Scroll Archway Frieze:** Linking the columns overhead is a wide, curved crimson-and-rose **lotus-and-scroll relief cornice** carved with five blooming pink lotuses amid swirling cloud tendrils.
- **3D Cyan & Blue `Tường Vân` Auspicious Cloud Scrolls:** Sweeping horizontally across both flanks behind the columns are layered **luminous cyan-turquoise (`#2BB3B1`) and deep sapphire-cobalt auspicious cloud motifs (`tường vân lam ngọc`)** intertwined with glowing magenta lotus medallions.
- **Excluded Theatre Props:** Audience heads, seats, trusses, spotlight beams on stage floor, and white-clad dancers are excluded; the central stage becomes a mirror-still lotus lake and carved marble promenade.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Sen Hồng Đồng Tháp / Kiến Trúc Lý–Trần) |
|---|---|
| **Sacred Lotus (`Nelumbo nucifera` — Quốc Hoa)** | Flowers `Ø 18–26 cm` with `24–32` cupped petals in 3–4 concentric whorls, bright magenta-pink tips grading to creamy white bases around a flat golden-green `gương sen` receptacle; leaves (`Ø 45–80 cm`) float flat or rise `0.4–1.3 m` on slender stems. |
| **Lý–Trần Lotus Stone Pedestal (`Đá Tảng Hoa Sen`)** | Square marble plinth supporting a sculpted 16-petal upturned lotus cushion (`bệ sen`) carved in crisp shallow relief (`#E6E2D8` / pale celadon jade). |
| **Tường Vân (Auspicious Cloud Scroll)** | Traditional Vietnamese spiral *ruyi* cloud ribbons layered in turquoise, cobalt, and gold leaf borders framing Buddhist and imperial lotus sanctuaries. |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (0, 1.4, 34)` → `lookAt (18, 0.8, 34)`, FOV `55°`.
- **Macro Hero Camera (`DaiLienHoaLotusSanctuary`):** `pos (0, 2.6, -494)` → `lookAt (0, 5.2, -562)`, FOV `58°` looking across the lotus-filled mirror lake between the flanking gold-etched red lotus colonnades toward the colossal `9.6m` glowing pink `Đại Liên Hoa Đài`.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Colossal `Đại Liên Hoa Đài` Monument** | Inner + Macro | 36 individually curved & cupped multi-whorl petals (`Ø 3.6m` inner / `Ø 9.6m` macro), carved golden `gương sen` pod & stamens on a 3-tier white-jade lotus pedestal | `2` inner + `1` macro (`9.6m` Ø) | Gradient pink petal shader with subsurface vein glow (`#E8749A` → `#FFE3EC`) |
| **Lotus-Etched Crimson Column Arcades** | Inner + Macro | Cylindrical red lacquer columns (`Ø 0.65m × 8.5m` in macro) with procedural golden lotus stem/flower SDF shader + 3-tier white-jade carved lotus bases | `8` inner + `16` macro | `son_red` clearcoat + gold SDF line art + `whiteMarble` |
| **Carved Lotus-Scroll Archway Frieze** | Macro | Overhead arched crimson-gold relief header (`36m` span) with sculpted lotus blossoms & cloud scrolls | `1` merged archway | `crimsonLacquer` + `lotus_pink` + `gold` |
| **3D Cyan-Cobalt `Tường Vân` Cloud Scrolls** | Macro | Layered beveled cloud scroll reliefs flanking left and right of the lotus lake (`y = 3.5..10m`) | `18` sculpted scrolls (`InstancedMesh`) | Emissive `cloud_teal` `#2BB3B1` & `#1E4FA8` rim |
| **Living Lotus Lake Field** | Macro | `600` cupped multi-petal lotus flowers (`bud / half-open / full`) + `720` floating & elevated notched lotus pads + stems | `600` flowers + `720` pads (`InstancedMesh`) | `lotus_pink` translucent petals, `lotus_leaf` waxy pads |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 14` draw calls, `<= 150k` triangles.
- **Vitest Assertions:** `PlazaSacredLotus`, `LotusColumnArcade`, and `DaiLienHoaLotusSanctuary` exist and dispose cleanly.
