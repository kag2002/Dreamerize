# 09 — Không Gian Văn Hoá Thổ Cẩm Tây Nguyên – Tây Bắc & Vòm Nón Lá Khổng Lồ (Ref 09)

**Reference:** [09_clouds_brocade_non_la.jpg](../09_clouds_brocade_non_la.jpg)
**Scene Group Names:** `FestivalTuongVanClouds`, `TayNguyenBrocadeBanners` (Inner Core), `TayNguyenBrocadeSanctuaryMacro` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone:** Biển Hồ T'Nưng / Nhà Rông `(-405, 42)`.
- **Macro Expansion Zone:** `(-840, 120)` — **`340m × 280m`** (`x ∈ [-1010, -670]`, `z ∈ [-20, 260]`), building a grand Highland Cultural Pavilion (`Không Gian Thổ Cẩm & Vòm Nón Lá`) overlooking the Tây Nguyên highlands.
**Default Mood:** Lantern night (`timeOfDay 22.0`, weather `clear`).

## 1. Visual Breakdown of `09_clouds_brocade_non_la.jpg`

- **Towering Vertical `Thổ Cẩm` Brocade Pillars (`Cột Thổ Cẩm Hoa Văn`):** Framing both foreground flanks and arranged in multi-plane perspective ranks across the plaza are **tall rectangular woven-brocade totem pillars** displaying crisp geometric **diamond (`hình thoi`), zigzag (`răng cưa`), and 8-point star motifs** in **deep violet (`#5B2A86`), crimson (`#C8102E`), golden-amber (`#D4A43A`), and cyan-teal (`#2BB3B1`)**, with sculptural **curled scroll bases** wrapping onto low platform pedestals.
- **Monumental Tilted Conical `Nón Lá` Dome Beneath Bamboo Truss:** Suspended high at dead-center is a **giant tilted Vietnamese conical `nón lá` (`Ø 14m`)** revealing its underside radial bamboo ribbing in warm crimson-gold, anchored inside an open **conical/pyramidal bamboo lattice crown** above a wide crimson Đông Sơn patterned backdrop arch.
- **Giant Magenta-Violet Brocade Flower Discs (`Đoá Hoa Thổ Cẩm`):** Behind the central tiered dais rise **two monumental circular radiating magenta-purple floral mandala wheels** accented by an emerald-green pleated silk fan disc on the right.
- **Drifting Multi-Colored `Tường Vân` Auspicious Cloud Scrolls:** Floating across both upper and mid-air layers are crisp **layered 3D `tường vân` auspicious clouds** sculpted with swirling spiral *ruyi* heads in **crimson-orange, cerulean blue, turquoise (`#2BB3B1`), and golden outline rims**.
- **Excluded Theatre Props:** Audience heads, seats, trusses, stage floor apron, and red-clad stage dancers/aerialists are excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Thổ Cẩm Tây Nguyên – Tây Bắc & Nón Bài Thơ) |
|---|---|
| **Dệt Thổ Cẩm (Hand-Loomed Brocade)** | Authentic motifs of the Ê Đê, Jrai, Bahnar, Thái, and H'Mông peoples: interlocking *hình thoi* diamonds, *răng cưa* zigzags, *ngôi sao tám cánh* eight-pointed sun stars, and striped borders in indigo/violet, madder red, turmeric gold, and ivory. |
| **Nón Lá Việt Nam** | `16` concentric bamboo split rings (`vành nón`), apex angle `108°`, dried `lá nón` palm leaves, reinforced with fine red silk thread ribs (`nón bài thơ Huế`) and paired silk chin straps. |
| **Cột Nêu & Tường Vân** | `15 m` carved Tây Nguyên ceremonial `cột nêu` totem pole with red/white streamers alongside `tường vân` auspicious cloud banners. |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (-405, 4.0, 72)` → `lookAt (-405, 14.0, 42)`, FOV `58°`.
- **Macro Hero Camera (`TayNguyenBrocadeSanctuaryMacro`):** `pos (-840, 16.5, 198)` → `lookAt (-840, 26.0, 106)`, FOV `58°` looking down the grand colonnade of `16` towering `thổ cẩm` brocade pillars and floating `tường vân` clouds toward the giant tilted `nón lá` dome and crimson-violet brocade medallions.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Towering `Thổ Cẩm` Brocade Totem Pillars** | Inner + Macro | `14` inner banners + `16` macro rigid architectural pillars (`1.6m × 13.5m × 0.45m`) with spiral curled scroll bases (`chân cuộn vân`) | `14` inner + `16` macro | Procedural 512px diamond/zigzag/star `thổ cẩm` texture (`anisotropy 8`) |
| **Giant Tilted Conical `Nón Lá` Dome + Open Truss** | Inner + Macro | `Ø 14m` tilted conical `nón lá` (`108°` apex) with `16` radial inner ribs & `16` concentric purlins, framed beneath an open bamboo pyramid truss | `1` inner (`Ø 8.4m`) + `1` macro (`Ø 14m`) | Warm rattan `#D8C9A0` outer leaf + `son_red` inner rib glow |
| **Giant Floral Brocade Rosette Discs & Backdrop Arch** | Macro | `3` huge concentric magenta-violet floral mandala discs (`Ø 7.2m`) + emerald pleated semicircle + carved Đông Sơn crimson-gold arch (`24m` wide) | `1` composite backdrop assembly | Emissive magenta/violet brocade shader + `crimsonLacquer` |
| **3D Multi-Colored `Tường Vân` Cloud Scrolls** | Inner + Macro | Sculpted beveled multi-scroll cloud reliefs with 4 color layers (teal, cobalt, ember-orange, gold) | `28` inner + `48` macro (`InstancedMesh`) | Multi-tone emissive/vertex-colored cloud shader |
| **Tây Nguyên `Cột Nêu` Ceremonial Pole** | Inner + Macro | Carved `15m` totem pole with carved torus rings, top mythical bird (`chim thần`), and floating ribbons | `1` inner + `1` macro (`15m`) | `darkWood` + `imperial_red` + `lacquer_gold` |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 14` draw calls, `<= 120k` triangles.
- **Vitest Assertions:** `FestivalTuongVanClouds`, `TayNguyenBrocadeBanners`, and `TayNguyenBrocadeSanctuaryMacro` exist and dispose cleanly.
