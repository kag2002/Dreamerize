# 04 — Đại Nội Huế: Điện Thái Hòa, Cột Sơn Son Thếp Vàng & Đại Triều Nghi (Ref 04)

**Reference:** [04_imperial_court_red_gold.jpg](../04_imperial_court_red_gold.jpg)
**Scene Group Names:** `HueThaiHoaThroneHall`, `HuePalaceLanterns` (Inner Core), `HueGrandImperialPalace` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone:** `(-235, 42)` directly behind Ngọ Môn `(-185, 42)` along the Citadel axis.
- **Macro Expansion Zone:** `(-680, 80)` — **`300m × 260m`** (`x ∈ [-830, -530]`, `z ∈ [-50, 210]`), creating the full Đại Nội imperial court courtyard (`Sân Đại Triều Nghi`), flanking Tả/Hữu Vu halls, and full-scale Thái Hòa Throne Hall.
**Default Mood:** Lantern night (`timeOfDay 22.0`) for red-gold drama, or Day (`13.0`) for god rays through open bays.

## 1. Visual Breakdown of `04_imperial_court_red_gold.jpg`

- **Monumental `Sơn Son Thếp Vàng` Pillars:** Towering foreground and midground **crimson lacquered columns** wrapped in glowing **gilded dragon-and-cloud (`long vân`) surface relief** and grounded on **carved white-silver/jade ornamental bases** with scroll and lotus molding.
- **Ornate Gilded Openwork Frieze (`Cửa Võng Chạm Lộng`):** Spanning high across the hall between the columns, an intricate white-gold/gilded wooden lattice frieze carved with repeating lotus medallions and fretwork meanders (`hồi văn chữ công`).
- **Hexagonal Palace Lanterns (`Đèn Lồng Cung Đình Huế`):** Seven monumental **hexagonal gold-framed lanterns** with glowing amber-silk panels, ornate dragon-corner finials, and tassels hang symmetrically across the upper nave, paired with smaller vertical rectangular lanterns flanking each bay.
- **Central Throne Niche & Ceremonial Court Regalia:** At center sits the **three-tier gilded dais and Imperial Dragon Throne (`Ngai Vàng` under `Bửu Tán` canopy)** against an embroidered golden backdrop, flanked symmetrically by **tall blue-and-white porcelain vases (`đồ sứ ký kiểu`)** holding flower arrangements and tall **red-and-white ceremonial round fans and parasols (`quạt & lọng nghi trượng`)**.
- **Excluded Theatre Props:** Audience heads, red theatre seats, overhead light trusses, white stage spotlights, and performers are excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Điện Thái Hòa — Đại Nội Huế, UNESCO 1993) |
|---|---|
| **Điện Thái Hòa Architecture** | `44m × 30.5m` `trùng thiềm điệp ốc` (paired front *Tiền Điện* and main *Chính Điện* halls linked by a shared drainage gutter), glazed yellow **`hoàng lưu ly`** imperial tiles (`#E1B12C`), ridge adorned with `lưỡng long chầu nhật` (two dragons facing a blazing sun pearl). |
| **80 Ironwood Columns (`Cột Gỗ Lim`)** | `Ø 0.50–0.65m`, height `7.2–8.5m`, coated in crimson *sơn son* lacquer with gilded spiral dragon-cloud bands (`long vân`). Rest on **white marble/limestone `chân tảng`** bases (`Ø 0.95m`) carved with 16 lotus petals. |
| **Ngai Vàng & Bửu Tán** | Elevated on a 3-step timber-and-gold dais (`điện bệ`). Carved wooden dragon throne gilded in 24k gold leaf, surmounted by an ornate octagonal gilded wooden `Bửu Tán` canopy. |
| **Đèn Cung Đình & Nghi Trượng** | Carved hexagonal gilded wooden frame (`1.15m` tall) with silk-painted phoenix/cloud panels; blue-and-white `đồ sứ ký kiểu` baluster vases (`1.55m`); paired `lọng` parasols and circular ceremonial `quạt vả` fans (`Ø 1.1m`). |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (-223, 1.7, 42)` → `lookAt (-245, 2.5, 42)`, FOV `58°`.
- **Macro Hero Camera (`HueGrandImperialPalace`):** `pos (-646, 2.0, 80)` → `lookAt (-692, 4.2, 80)`, FOV `58°` positioned inside the grand central nave looking straight down the symmetrical red-and-gold column colonnade under the 7 hexagonal lanterns toward the `Ngai Vàng` throne.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Grand Throne Hall & Tả/Hữu Vu Wings** | Inner + Macro | Double-tier `trùng thiềm điệp ốc` curved yellow-glazed roofs + stepped Thanh Hóa stone `Sân Đại Triều` esplanade (`72m × 58m`) | `1` inner + `3` macro buildings | `yellowGlazeMat` (`#E1B12C`), `stone`, `gold` |
| **`Sơn Son Thếp Vàng` Lacquered Columns + `Chân Tảng`** | Inner + Macro | `InstancedMesh` crimson columns with cylindrical procedural gold `long vân` shader bands + carved stepped lotus marble bases | `24` inner + `48` macro | `MeshPhysicalMaterial` (`clearcoat 0.65`) + gold procedural band mask |
| **Gilded `Cửa Võng` Openwork Friezes** | Macro | Procedural lotus-medallion & key-fret screen strips spanning every central column bay (`y = 5.4..7.2m`) | `6` bay spans | `lacquer_gold` `#D4A43A` + alpha openwork |
| **Hexagonal `Đèn Cung Đình` Lanterns** | Inner + Macro | 7 hero hexagonal gold-framed silk lanterns (`1.15m`) + 24 aisle lanterns (`0.68m`) with corner finials & tassels | `23` inner + `31` macro | Silk `#FFC56A` emissive + gold lattice ribs |
| **Throne Dais, `Ngai Vàng` & `Bửu Tán`** | Inner + Macro | 3-tier golden dais, carved dragon-armchair throne, 5-panel gilded backdrop screen, suspended octagonal canopy | `1` inner + `1` grand macro | `lacquer_gold`, `crimsonLacquer` |
| **Ceremonial Vases, Parasols & Fans** | Inner + Macro | Lathe blue-and-white `ký kiểu` porcelain vases + lotus floral tops + 6 crimson-gold round `nghi trượng` fans/parasols | `4+4` inner + `6+6` macro | Procedural cobalt-on-porcelain shader + red/white rings |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 16` draw calls, `<= 145k` triangles.
- **Vitest Assertions:** `HueThaiHoaThroneHall`, `HuePalaceLanterns`, and `HueGrandImperialPalace` exist and dispose cleanly.
