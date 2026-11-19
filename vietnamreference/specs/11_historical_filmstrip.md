# 11 — Quảng Trường Ký Ức Lịch Sử & Rừng Bia Phim Tư Liệu 35mm (Ref 11)

**Reference:** [11_historical_filmstrip.jpg](../11_historical_filmstrip.jpg)
**Scene Group Names:** `HoangThanhMemoryGallery` (Inner Core), `HistoricalMemoryColonnadeMacro` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone:** Behind Hoàng Thành Thăng Long — Đoan Môn `(0, -92)`, flanking `x = ±24..±38, z = -84..-102`.
- **Macro Expansion Zone:** `(0, -320)` — **`280m × 240m`** (`x ∈ [-136, 136]`, `z ∈ [-370, -250]`), laid out as two monumental symmetric colonnade terraces flanking the central northern Hạ Long vista channel (`|x| < 26` stays water at `z <= -345` so `(0, -360)` preserves its `< -1.0` Hạ Long Bay depth!).
**Default Mood:** Golden sunset (`timeOfDay 17.5`) or Lantern night (`22.0`).

## 1. Visual Breakdown of `11_historical_filmstrip.jpg`

- **Three-Rank Vertical Archival Filmstrip Colonnade:** Towering vertical monoliths (`9.5m..14m` tall) stand in receding perspective ranks (foreground hero piers on left & right, staggered midground pairs, and distant back panels), framing an open ceremonial central avenue.
- **35mm Sprocket Perforation Borders & Warm Amber Edge Glow:** Each pillar features wide black/dark-bronze margins perforated by authentic **rectangular 35mm film sprocket holes**, lit internally by warm **amber-vermilion edge glow (`#FF8C3A`)** that illuminates the silver-gelatin documentary vignettes.
- **Monochrome Archival Documentary Frames:** Five stacked frames per stele depict evocative **black-and-white / silver-gelatin historical silhouettes**: mountain transport truck convoys, historic command conference rooms, highland march formations, trench defenders, and portraits of soldiers in pith helmets and rain ponchos.
- **Luminous Vermilion Setting Solar Sphere & Open `Nón Lá` Crown:** Centered at the far end of the colonnade corridor glows a huge **crimson-vermilion setting sun disc (`#E85A24`)** framed beneath an **open 16-ribbed conical bronze `nón lá` lattice crest**.
- **Excluded Theatre Props:** Audience heads, seats, trusses, LED panel borders, and the single foreground soldier performer are excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Bia Ký Ức Tư Liệu Điện Ảnh Cách Mạng Việt Nam) |
|---|---|
| **35mm Archival Filmstrip Format** | Classic `24 × 36 mm` (`2:3`) archival silver-gelatin frames with `8` rectangular sprocket perforations per frame edge along dark leader margins, scaled to monumental `2.2m × 11.5m` brushed-bronze & etched tempered-glass museum steles. |
| **Reflective Basalt Memorial Promenade** | Dark honed basalt paving slabs (`#1E1A18`) with subtle damp specular sheen reflecting the warm backlit archival glass steles. |
| **Solar Horizon Monument & `Nón Lá` Finial** | `Ø 11m` backlit amber-vermilion solar sanctuary monument anchored at the northern vista terrace behind the colonnade, topped by an architectural `Ø 6.4m` bronze `nón lá` frame. |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (28, 2.0, -76)` → `lookAt (32, 3.8, -104)`, FOV `56°`.
- **Macro Hero Camera (`HistoricalMemoryColonnadeMacro`):** `pos (0, 2.4, -274)` → `lookAt (0, 6.2, -338)`, FOV `58°` looking straight down the dark reflective basalt causeway between the 3-rank colonnade of `16` glowing 35mm filmstrip steles toward the vermilion solar monument and bronze `nón lá` crown.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **3-Rank Archival 35mm Filmstrip Steles** | Inner + Macro | `8` inner steles (`7.6m` tall) + `16` monumental macro steles (`9.5m..14.0m` tall) with beveled oxidized-iron frames, stone plinths, and 5-frame backlit archival panels | `8` inner + `16` macro (`InstancedMesh`) | Procedural 35mm sprocket & multi-vignette halftone archival shader (`#FF8C3A` backlight) |
| **Vermilion Solar Horizon Disc Monument** | Macro | Layered warm glowing vermilion-amber frosted solar sphere/disc (`Ø 11m`) seated on a carved stone pier at the vista focal end (`z = -342`) | `1` hero monument | Soft radial solar emissive shader (`#D2452B` → `#FF9A44`) |
| **Open Bronze `Nón Lá` Lattice Crest** | Macro | `16` radial bronze rafters + `5` concentric purlin rings (`Ø 6.4m`) suspended over the central axis | `1` merged bronze lattice | `lacquer_gold` / aged bronze |
| **Basalt Memorial Causeway & Flank Terraces** | Macro | Dark basalt-paved promenade bridging `(0, -310)` + twin flanking stone terraces at `x ∈ [±28, ±132], z ∈ [-360, -280]` | Merged terrace masonry | Dark honed basalt `#241E1C` |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 8` draw calls, `<= 32k` triangles.
- **Vitest Assertions:** `HoangThanhMemoryGallery` and `HistoricalMemoryColonnadeMacro` exist and dispose cleanly, while `(0, -360)` stays `< -1.0` in `getVietnamHeritageHeight`.
