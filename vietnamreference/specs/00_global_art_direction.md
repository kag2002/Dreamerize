# 00 — Global Art Direction, Macro-Map Architecture & Budgets (Vietnam Heritage v2.0)

Applies to every 1-to-1 Vietnam cultural spec (`01`–`15`). Engine bindings match the production Three.js pipeline: `WebGLRenderer`, `AgXToneMapping` (enum `6`), `CinematicPipeline` (bloom, screen-space god rays, auto-exposure, cavity AO, letterbox), `setAtmosphereState({ timeOfDay, weather })`, and `createVolumetricCloudDome` with a cached 3D noise `DataTexture`.

## 1. v2.0 Macro-Map Expansion & Dual-Ring Spatial Architecture

To elevate `vietnam-heritage` into a monumental **23.04 km²** living cultural panorama without crowding or visual collisions, the map expands by **4.76× total terrain area** (**5.47× navigable wander area**):

| Parameter | v1.0 Baseline | v2.0 Macro Expansion | Scale Factor |
|---|---|---|---|
| Terrain & Water Plane | `2200m × 2200m` (`4.84 km²`) | **`4800m × 4800m` (`23.04 km²`)** | **4.76×** |
| Navigable `wanderRadius` | `620m` (`1.21 km²`) | **`1450m` (`6.61 km²`)** | **5.47×** |
| `SkyDome` Radius | `1800m` | **`4200m`** | **2.33×** |
| `VolumetricCloudDome` Radius | `850m` | **`2200m`** | **2.59×** |
| Camera Far Plane (`camera.far`) | `4200m` | **`8500m`** | **2.02×** |
| Outer Mountain Border Ring | `\|x\| > 720m` or `z > 680m` | **`\|x\| > 1650m` or `z > 1580m`** | **~2.3×** |
| Scenic Curated POIs | `30` (10 per region) | **`45` (15 per region)** | **1.50×** |

### Dual-Ring Layout
1. **Inner Core (`r < 540m`) — Historic Crossroads:** Preserves every original 3-region landmark (`Khuê Văn Các`, `Chùa Một Cột`, `Tháp Rùa`, `Hoàng Thành`, `Cầu Vàng`, `Vịnh Hạ Long`, `Huế`, `Hội An`, `Cầu Rồng`, `Sài Gòn`, `Mekong`, `Phú Quốc`, `Côn Đảo`) plus the inner photo-reference upgrades (`Z1`, `Z4`, `Z9`, `Z10`).
2. **Outer Grand Cultural Sanctuary Ring (`r ∈ [540m, 1400m]`) — Macro 1:1 Cultural Worlds:** 14 dedicated large-scale cultural zones (`240m × 240m` to `480m × 380m` each), each recreating one of the 15 reference scenes at full architectural majesty and maximum detail:
   - `TamCocMacroKarstValley` `(680, -320)` — `420m × 320m` (Ref 01)
   - `HoiAnGrandLanternQuarter` `(640, 140)` — `260m × 220m` (Ref 02)
   - `HoaiRiverNightPromenade` `(760, 260)` — `320m × 240m` (Ref 03)
   - `HueGrandImperialPalace` `(-680, 80)` — `300m × 260m` (Ref 04)
   - `DaiLienHoaLotusSanctuary` `(0, -560)` — `260m × 240m` (Ref 05)
   - `DuongLamAncientVillageMacro` `(-640, -180)` — `320m × 280m` (Ref 06)
   - `LongVanLacquerValleyMacro` `(820, -80)` — `360m × 300m` (Ref 07)
   - `DongSonSunSanctuaryMacro` `(-680, 420)` — `340m × 300m` (Ref 08)
   - `TayNguyenBrocadeSanctuaryMacro` `(-840, 120)` — `340m × 280m` (Ref 09)
   - `DatNuocHeroicCanyonMacro` `(-560, -640)` — `380m × 260m` (Ref 10)
   - `HistoricalMemoryColonnadeMacro` `(0, -320)` — `280m × 240m` (Ref 11)
   - `TruongSonMonsoonJungleGorge` `(740, -560)` — `420m × 340m` (Ref 13)
   - `DienBienHighlandCitadelMacro` `(-820, -520)` — `400m × 340m` (Ref 14)
   - `BachDangGrandArmadaMacro` `(-240, -760)` — `480m × 380m` (Ref 15)

## 2. Visual Pillars (from all 15 Reference Photographs)

1. **Son-Red & Lacquer-Gold against Deep Cool Fields.** Every composition pairs warm saturated focal keys (`son_red`, `lacquer_gold`, `lantern_amber`, `sunset_crimson`) against expansive cool/dark grounds (`night_indigo`, `night_cobalt`, `karst_shadow`, emerald river mist). Keep warm key area ≈ 15–30% of the frame and cool/dark field ≈ 50–70%.
2. **Multi-Plane Atmospheric Layering.** Karsts, palace colonnades, banyan canopies, hero reliefs, and war-junk armadas stack into **3–5 distinct depth silhouettes**, separated by `FogExp2` and low-lying valley mist.
3. **Instanced Rhythmic Light & Pattern.** Lantern canopies (Refs 02, 03), palace lanterns (Ref 04), floating `hoa đăng` (Ref 03), volumetric beams (Ref 12), and rain streaks (Ref 13) build visual cadence exclusively via `InstancedMesh` and shader animation.
4. **Structural Motifs Over Flat Decals.** `Tường vân` auspicious clouds, carved 16-petal lotus stone bases (`chân tảng`), Đông Sơn sun-and-Lạc-bird bronze reliefs, `thổ cẩm` weaves, and bamboo-battened sails are modeled into 3D geometry and normal-mapped materials.
5. **Material Authenticity at Human Eye Height (1.7 m).** Up close, surfaces read as real Vietnamese heritage materials: glossy *sơn son* lacquer, pitted *đá ong* laterite, weathered *ngói âm dương* terracotta, dark *gỗ lim* ironwood, patinated bronze, and woven silk.

## 3. Master Palette (sRGB Hex Targets before AgX Tone Mapping)

| Token | Hex | Use | Seen in |
|---|---|---|---|
| `son_red` | `#A4221B` | Lacquered columns, gates, boat hulls, lacquer peaks | 04, 05, 07, 15 |
| `imperial_red` | `#C8102E` | Silk lanterns, ceremonial banners, war-junk sails | 02, 04, 15 |
| `lacquer_gold` | `#D4A43A` | Gold leaf, dragon scales, throne dais, Đông Sơn highlights | 04, 07, 08 |
| `old_gold` | `#B08A3E` | Weathered gilding, grazed cliff bas-reliefs | 04, 10 |
| `lantern_amber` | `#FFB347` | Silk lantern core glow, warm interior lamps | 02, 03, 04 |
| `lantern_ember` | `#FF6A2B` | Sky lanterns, river `hoa đăng`, fire braziers | 02, 03, 15 |
| `rice_gold` | `#D9A441` | Ripening paddy panicles | 01 |
| `straw_ochre` | `#B98A4A` | Conical straw stacks (`đống rơm`), nipa/palm thatch | 01, 06, 08 |
| `karst_moss` | `#3E5A3A` | Sunlit limestone vegetation caps | 01, 13, 15 |
| `karst_shadow` | `#1F2E2A` | Stratified karst shadow faces | 01, 13, 14 |
| `laterite` | `#8B5A3C` | Đường Lâm `đá ong` village walls, earthen plinths | 06 |
| `terracotta_tile` | `#9C4A2F` | `Âm-dương` and `mũi hài` clay tiles | 02, 06 |
| `imperial_glaze` | `#E1B12C` | Huế `hoàng lưu ly` glazed imperial roof tiles | 04 |
| `ironwood_dark` | `#3B2418` | `Gỗ lim` trusses, Bạch Đằng stakes, bridge timbers | 03, 04, 15 |
| `bronze_patina` | `#4F6B5A` | Đông Sơn recessed patina, ancient bronze urns | 08, 10 |
| `bronze_fresh` | `#A9773A` | Burnished Đông Sơn raised relief | 08 |
| `lotus_pink` | `#E8749A` | Sacred lotus petals (blending to `#F7D3DE` at base) | 05 |
| `lotus_leaf` | `#4C7A3A` | Floating & elevated lotus pads | 05 |
| `cloud_teal` | `#2BB3B1` | `Tường vân` auspicious cloud scrolls | 05, 09 |
| `cloud_jade` | `#5BBF6A` | Lacquer-style emerald clouds | 07 |
| `brocade_violet` | `#5B2A86` | `Thổ cẩm` brocade pillar base | 09 |
| `night_indigo` | `#13204A` | Starry night zenith | 06, 13, 14 |
| `night_cobalt` | `#1E4FA8` | Night sky midtone, Điện Biên mountain shadows | 06, 14 |
| `sunset_crimson` | `#D2452B` | Sunset cloud underbellies, filmstrip sun | 01, 11 |
| `sunset_apricot` | `#F29A4A` | Golden-hour horizon glow | 01, 11 |
| `storm_slate` | `#3A4A63` | Monsoon storm clouds & wet granite | 13, 15 |
| `mist_white` | `#DCE6EE` | Low river & valley vapor ribbons | 13, 15 |

**Albedo floor/ceiling rule:** keep darkest non-black albedos `>= #141414` and brightest non-emissive albedos `<= #E8E8E8` so AgX tone mapping retains surface texture without clipping.

## 4. Time-of-Day Presets (`setAtmosphereState`)

| Preset | `timeOfDay` | Sun / Moon | Sun / Moon Intensity | Hemi Sky / Ground | Fog Colour / `FogExp2` Density | Primary Zones |
|---|---|---|---|---|---|---|
| Dawn mist | `6.0` | Sun 4° E | `#FFC9A0` / `1.2` | `#9DB4D6` / `#4A4A3A` @ `0.45` | `#D9D2C8` / `0.00022` | Bạch Đằng (15), Sen (05), Relief (10) |
| Day | `13.0` | Sun 62° S | `#FFF4E2` / `2.6` | `#8EC5E8` / `#5B6B3A` @ `0.55` | `#CFE0EE` / `0.00009` | All zones |
| Golden sunset | `17.5` | Sun 6° W | `#FF9A55` / `2.2` | `#E8875A` / `#3A2A22` @ `0.40` | `#EAB780` / `0.000085` | Tràng An (01), Đông Sơn (08), Filmstrip (11) |
| Lantern night | `22.0` | Moon 38° SE | `#9FB6FF` / `0.35` | `#1E4FA8` / `#0E1220` @ `0.18` | `#1B2440` / `0.00012` | Hội An (02, 03), Huế (04), Sen (05), Cây Đa (06), Rồng (07), Thổ Cẩm (09), Đèn Hội (12), Điện Biên (14) |
| Monsoon storm | any + `rain` | Occluded | `#B8C6D8` / `0.8` | `#3A4A63` / `#1E2622` @ `0.35` | `#5E6E80` / `0.00035` | Trường Sơn Monsoon (13), Bạch Đằng (15) |

## 5. Performance & Resource Rules

- **Static architectural geometry** per zone is merged by material via `mergeNormalized` so each macro cultural zone uses **8–22 draw calls**.
- **Repeated elements** (rice stalks, lanterns, `hoa đăng`, leaves, sandbags, Bạch Đằng stakes, brocade pillars, filmstrip steles, rain streaks) MUST use `InstancedMesh` or `ShaderMaterial` wrap volumes.
- **Procedural textures** are synthesized deterministically (no external image fetches) and registered in `ctx.extraTextures`; materials in `ctx.extraMaterials` so `ThreeResourceDisposer` and `scene.dispose()` release 100% of GPU memory.
- **Terrain evaluation speed:** outer-ring height overrides in `getVietnamHeritageHeight(x, z)` MUST be guarded behind bounding-box checks so 100,000 samples execute in `< 50 ms`.

## 6. Stage-Photo Exclusions (Do NOT Replicate)

- **Zero** audience heads, theatre seats, seat numbers (`07`), ceiling rigging, lighting trusses, moving-head spotlights, speaker stacks, or LED panel borders/seams.
- **Zero** floating stage subtitles or title banners (`"ĐẤT NƯỚC"`, `"Ai mua ánh sáng ghé thăm trăng ngà?"`).
- **Zero** flat stage floor aprons — all scenes sit directly on sculpted natural terrain, granite/stone plazas, timber docks, or water.
- **Full View (`F`)** stays 100% HUD-free (`0` buttons, `0` overlay text).

## 7. QC Verification Gates

1. `toneMapping === 6` (AgX), `gl.getError() === 0`, 0 NaN vertex coordinates or bounding spheres across the full `4800m × 4800m` scene graph.
2. `getVietnamHeritageHeight(x, z)` returns finite values across `[-2200, 2200]` and satisfies existing inner-core landmark & water basin assertions (`(0, -360) < -1.0`, `(-120, -450) < -1.0`, etc.).
3. `getWanderBounds().radius === 1450` and `getPointsOfInterest().length === 45` (`15` per region).
4. `ThreeResourceDisposer` and `VietnamHeritageScene.dispose()` cleanly release all resources and support deterministic re-initialization.
