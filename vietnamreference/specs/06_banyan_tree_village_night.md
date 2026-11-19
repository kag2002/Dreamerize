# 06 — Làng Cổ Đồng Bằng Bắc Bộ (Đường Lâm / Kinh Bắc): Cây Đa · Giếng Làng · Sân Đình · Tường Đá Ong (Ref 06)

**Reference:** [06_banyan_tree_village_night.jpg](../06_banyan_tree_village_night.jpg)
**Scene Group Names:** `LangCoBanyanVillage`, `LangCoBanyanHero`, `LangCoLateriteWalls`, `LangCoVillageGate` (Inner Core), `DuongLamAncientVillageMacro` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone (`Z4`):** `(-60, 132)` — radius `26m` Northern village showcase.
- **Macro Expansion Zone:** `(-640, -180)` — **`320m × 280m`** (`x ∈ [-800, -480]`, `z ∈ [-320, -40]`) full-scale Red River Delta ancient village (`Cây Đa – Giếng Nước – Sân Đình`) nestled among Đường Lâm laterite lanes.
**Default Mood:** Lantern night (`timeOfDay 22.0`, weather `fireflies` or `clear`).

## 1. Visual Breakdown of `06_banyan_tree_village_night.jpg`

- **Two Colossal Framing Banyan Trunks (Left & Right):** Thick, gnarled **ancient banyan trunks (`gốc đa cổ thụ`)** twisted with braided root buttresses and hanging aerial vines frame the immediate left and right edges, bathed dramatically from below in **warm crimson-amber firelight** (`#FF5A2A`) against cool cobalt night shadows. Carved stone steps wrap the root base on the right trunk.
- **Monumental Central Village Banyan (`Cây Đa Đầu Làng`):** Rising dead-center across the courtyard (`26m` tall, `38m` spread), an enormous multi-trunk banyan arches wide horizontal limbs hung with a dense **curtain of vertical aerial roots (`rễ phụ`)** reaching into the brick courtyard, crowned overhead by a vast **dark leafy canopy ceiling** framing the starry sky.
- **Porous Laterite Walls & Paired Village Side Gates (`Cổng Làng & Tường Đá Ong`):** Flanked symmetrically on left and right are weathered **laterite (`đá ong`) and fieldstone compound walls** (`1.8–2.2m` tall) pierced by traditional **wooden-barred brick village gates** topped with tiny curved terracotta tile roofs.
- **Traditional `Nhà Gỗ Mái Ngói Mũi Hài` Courtyard Houses:** Eight low, wide single-storey northern village houses with dark `mũi hài` terracotta roofs, timber veranda columns, a bamboo garden pergola/frame, and warm **red-orange oil-lamp doorways** glowing across a cool blue moonlit herringbone brick `sân đình`.
- **Excluded Theatre Props:** Audience silhouettes, seats, overhead ceiling lights/trusses, LED rectangle frame borders, and seated village performers are excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Làng Cổ Đường Lâm, Sơn Tây, Hà Nội) |
|---|---|
| **Cây Đa Cổ Thụ (`Ficus benghalensis`)** | `20–28 m` tall, `35–50 m` canopy spread. Trunk comprises `7–14` fused braided root columns (`Ø 3–5 m`), horizontal gnarled branches, and curtains of slender `Ø 2–6 cm` aerial roots + thick `Ø 0.3–0.6 m` pillar roots. |
| **Tường Đá Ong (Laterite Stone Masonry)** | Hand-cut porous volcanic iron-rich laterite blocks (`40 × 25 × 20 cm`, `#8B5A3C`) laid in staggered ashlar courses with weathered lime mortar and damp moss along the bottom `0.4 m`. |
| **Cổng Làng & Giếng Làng** | Brick-and-laterite gateway piers with arched wooden double gates (`cánh cổng song gỗ`), upturned `ngói mũi hài` rooflet; circular village well (`giếng đá ong`, `Ø 2.6 m` stone apron + `0.75 m` wall). |
| **Nhà Cổ Bắc Bộ & Sân Gạch** | `3–5` gian timber frame (`gỗ xoan / gỗ lim`), `38°` pitched terracotta `ngói mũi hài` roof, herringbone red-brick `sân đình` courtyard lit by ground oil lamps and fireflies. |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (-60, 1.6, 152)` → `lookAt (-60, 6.0, 120)`, FOV `62°`.
- **Macro Hero Camera (`DuongLamAncientVillageMacro`):** `pos (-640, 2.2, -108)` → `lookAt (-640, 8.5, -196)`, FOV `62°` framing both glowing red-uplit foreground banyan trunks left and right, flanking `đá ong` village gates, and the colossal central banyan & lit traditional courtyard.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Monumental Central Banyan & Twin Framing Trunks** | Inner + Macro | Braided multi-trunk core (`9–12` twisted cylinders), arching limbs, `120+` vertical aerial root threads & pillar roots + carved stone root steps | `3` inner + `3` macro (`26m` tall center + `2` massive framing trunks) | `barkMat` (`#5F4938`) with warm bottom-up uplight shader gradient + stone steps |
| **Overarching Banyan Leaf Canopy Ceiling** | Inner + Macro | `InstancedMesh` alpha-clipped ovate leaf cards clustered across limb tips and upper canopy crown | `1,200` inner + `4,500` macro | `#2F5A2A` `leafAtlas` (`alphaTest 0.42`) |
| **Laterite (`Đá Ong`) Village Walls & Arched Side Gates** | Inner + Macro | `280m` of laterite perimeter walls (`1.9m` tall) + 2 detailed `Cổng Làng` gateways with wooden vertical grill bars & curved tile eaves | `2` inner + `8` macro wall runs + `2` detailed side gates | `lateriteMat` (`#8B5A3C`) + `terracottaRoof` + `darkWood` |
| **Traditional `Nhà Gỗ` Houses & Courtyard `Sân Đình`** | Inner + Macro | 8 `3–5` bay houses with timber veranda posts, `ngói mũi hài` roofs, warm oil-lamp open doorways, bamboo pergola frame, round `giếng làng` well, and herringbone brick yard | `3` inner + `8` macro houses + well + yard | `laterite`, `darkRoof`, `terracottaRoof`, warm `#FF7A38` doorway glow |
| **Nocturnal Fireflies & Warm Ground Pools** | Inner + Macro | Local glowing firefly cluster under banyan limbs + warm additive light pools beneath flanking trunks and open doors | `450` fireflies + `12` light pools | `#D8FF7A` blinking emissive + radial amber pool |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 18` draw calls, `<= 195k` triangles.
- **Vitest Assertions:** `LangCoBanyanVillage`, `LangCoBanyanHero`, `LangCoLateriteWalls`, `LangCoVillageGate`, and `DuongLamAncientVillageMacro` exist and dispose cleanly.
