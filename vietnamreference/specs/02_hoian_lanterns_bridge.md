# 02 — Quảng Trường Hội Quán & Phố Đèn Lồng Hội An Đêm Nguyên Tiêu (Ref 02)

**Reference:** [02_hoian_lanterns_bridge.jpg](../02_hoian_lanterns_bridge.jpg)
**Scene Group Names:** `HoiAnPavilionGates`, `HoiAnLanternCanopy` (Inner Core), `HoiAnGrandLanternQuarter` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone:** `(175, 45)` upgrading existing Phố cổ Hội An.
- **Macro Expansion Zone:** `(640, 140)` — **`260m × 220m`** (`x ∈ [510, 770]`, `z ∈ [30, 250]`), creating a full-scale Hội An lantern square & twin assembly halls (`Hội Quán`).
**Default Mood:** Lantern night (`timeOfDay 22.0`, weather `clear`).

## 1. Visual Breakdown of `02_hoian_lanterns_bridge.jpg`

- **Symmetric Two-Tier Architectural Pavilions (Left & Right):** Two monumental **two-storey wooden Chinese-Vietnamese assembly hall pavilions (`Lầu Vọng Nguyệt / Cổng Hội Quán`)** framing the street axis. Each features sweeping upturned `đao cong` eaves, terracotta `âm-dương` roof tiles lit warm orange from beneath, second-storey timber verandas with turned wooden balusters (`lan can con tiện`), inward ceremonial staircases, and tall red-lacquered timber pillars wrapped in **vertical strings of glowing cylindrical crimson lanterns**.
- **Dense Overhead Catenary Lantern Grid:** Spanning the entire central courtyard between the twin pavilions (`8+` columns × `6+` tiers in perspective), hundreds of glowing **warm white-cream and amber cylindrical/garlic silk lanterns** hang in crisp rhythmic rows against the pitch-black night sky.
- **Central Stacked Lantern Tower (`Tháp Đèn Lồng Trung Tâm`):** Rising on axis behind an **arched red-lacquered wooden bridge**, an ornate multi-tier pagoda-like lantern edifice displays concentric glowing discs and rings in **imperial red, cobalt blue, and gold**, flanked by receding perspectives of warm lantern-lit shophouse arcades.
- **Upper Sky:** Dozens of warm orange **sky lanterns (`đèn thiên đăng`)** drifting upward into the dark indigo-black sky.
- **Excluded Theatre Props:** Audience heads, seats, overhead trusses, stage floor, and the floating subtitle text (`"Ai mua ánh sáng..."`) are completely excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Phố Cổ Hội An — UNESCO 1999) |
|---|---|
| **Hội Quán Two-Tier Pavilion** | Timber post-and-beam structure on carved stone plinths; lower roof eave at `4.5 m`, upper observation balcony at `4.8 m`, upper roof ridge at `11.5 m` with `0.85 m` upturned `đao cong` corners and `lưỡng long` roof finials. |
| **Đèn Lồng Hội An (Silk Lanterns)** | Split-bamboo rib frame (`12–16` ribs) wrapped in silk: garlic-bulb (`củ tỏi`, `Ø 0.38m × 0.48m`), cylinder (`đèn ống`, `Ø 0.28m × 0.56m`), and diamond shapes in cream-amber (`#FFE08A`), saffron (`#FFB347`), and imperial crimson (`#C8102E`) with wooden caps and red silk tassels. |
| **Hội An Merchant Shophouses** | Timber-framed tube houses (`nhà ống`, `5–7m` frontage), weathered ochre-lime plaster walls (`#E3B23C`), dark *gỗ kiền kiền* folding shutter doors (`cửa bức bàn`), and `âm-dương` terracotta roofs. |
| **Stacked Lantern Pavilion Tower** | `9.5m`-tall ceremonial wooden festival pagoda structure holding stacked red, sapphire-blue, and gold silk lantern drums above a red-lacquered pedestrian bridge. |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (175, 1.7, 68)` → `lookAt (175, 3.5, 42)`, FOV `60°`.
- **Macro Hero Camera (`HoiAnGrandLanternQuarter`):** `pos (640, 2.2, 206)` → `lookAt (640, 5.8, 128)`, FOV `58°` looking straight down the lantern-canopied square between both 2-tier pavilions toward the central arched red bridge and multi-colored lantern tower.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Twin Two-Tier Hội Quán Pavilions** | Inner + Macro | Merged `son_red` columns, upper balcony balustrade frames, ceremonial stairs, and 2-tier `đao cong` curved terracotta roofs | `2` inner + `2` monumental macro (`16m × 12m × 11.5m`) | `crimsonLacquer`, `terracottaRoof`, `gold` |
| **Central Multi-Tier Lantern Tower & Red Bridge** | Inner + Macro | 7-tier stacked luminous rings (`red`, `cobalt`, `gold`) over a carved crimson arched bridge (`12m` span) | `1` inner + `1` macro (`9.5m` tall) | `crimsonLacquer`, `gold`, emissive silk bands |
| **Overhead Street Lantern Canopy** | Inner + Macro | `InstancedMesh` ribbed silk lanterns suspended on sagging catenary cords (`y = y0 - sag*4t(1-t)`) | `320` inner + `640` macro | Silk emissive shader with vertex sway & subtle flicker |
| **Pillar Vertical Lantern Strings** | Macro | Vertical `InstancedMesh` strings of glowing crimson cylindrical lanterns wrapping pavilion gate columns | `96` lanterns across 8 gate columns | `#C8102E` silk + `#FFB347` inner core |
| **Colonnaded Shophouses (`Nhà cổ`)** | Macro | 12 two-bay ochre-yellow timber shophouses lining both sides of the square (`60m` street corridor) with lit lattice windows | `12` buildings (merged by material) | `yellowOchrePlaster`, `darkWood`, `terracottaRoof` |
| **Light Pools** | Inner + Macro | Additive ground glow discs beneath lantern clusters (no point light spam) | `8` inner + `16` macro | Additive radial amber shader |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 16` draw calls, `<= 150k` triangles.
- **Vitest Assertions:** `HoiAnPavilionGates`, `HoiAnLanternCanopy`, and `HoiAnGrandLanternQuarter` exist and dispose without GPU leaks.
