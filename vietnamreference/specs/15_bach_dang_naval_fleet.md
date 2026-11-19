# 15 — Đại Thuỷ Chiến Sông Bạch Đằng & Hạm Đội Thuyền Chiến Đại Việt (Ref 15)

**Reference:** [15_bach_dang_naval_fleet.jpg](../15_bach_dang_naval_fleet.jpg)
**Scene Group Names:** `BachDangNavalFleet` (Inner Core), `BachDangGrandArmadaMacro` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone (`Z10`):** `(-120, -400)` — `130m × 95m` western Hạ Long tidal channel.
- **Macro Expansion Zone:** `(-240, -760)` — **`480m × 380m`** (`x ∈ [-480, 0]`, `z ∈ [-950, -570]`), recreating the full historic Bạch Đằng river estuary bordered by forested riverbanks, emerald-blue mist, 11 Đại Việt warships, and 180 tilted iron-tipped `cọc gỗ lim`.
**Default Mood:** Dawn mist (`timeOfDay 6.0`) or Storm (`weather: 'rain'`) so scarlet sails, bow fire beacons, and mist glow dramatically against brooding storm clouds.

## 1. Visual Breakdown of `15_bach_dang_naval_fleet.jpg`

- **Colossal Central Flagship War Junk (`Soái Hạm Đại Việt`):** Anchoring dead-center over emerald river mist is a wide **wooden war junk (`thuyền chiến`)** bearing **painted `mắt thuyền` (ship eyes)** on the bow, carved red-and-timber bulwark shields, a tall central mast, and a monumental **rectangular crimson-scarlet bamboo-battened sail (`#C83E2B`)** emblazoned near the top-center with a glowing **royal-blue circular crest carrying a golden crescent & winged solar/dragon emblem (`huy hiệu lam-vàng`)**.
- **Twin-Beacon Fire-Brazier Escort Warships (Left & Right):** Flanking the flagship in the midground are two heavy warships equipped with **twin towering bow/stern signal fire beacon poles (`cột lửa hiệu`)** blazing bright orange-amber (`#FF8A2B`) against the stormy indigo sky, plus **8 staggered escort battened-sail junks** receding into deep fog on both flanks to form a grand 11-ship naval armada.
- **Foreground `Cọc Gỗ Lim Bạch Đằng` Ambush Line:** Rising diagonally at `15°–28°` out of glowing **emerald-turquoise low-tide water and swirling mist (`#DCE6EE`)** across the immediate foreground are rows of **sharpened dark ironwood stakes tipped with forged steel points**, ringed by tidal wake ripples.
- **Forested Riverbanks & Storm Cloud Sky:** Low dark-green forested river shorelines frame the far left and right banks beneath turbulent cobalt-slate monsoon clouds.
- **Excluded Theatre Props:** Audience heads, seats, trusses, LED panel seams, stage floor, and foreground actors on the walkway are excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Chiến Thắng Bạch Đằng 938 & 1288) |
|---|---|
| **Thuyền Chiến Đại Việt (Lý–Trần War Junks)** | Shallow-draft *gỗ lim / gỗ kiền kiền* estuary warships (`22–32 m` flagship, `14–20 m` escorts) with upturned bow, raised stern `sàn lái`, painted protective bow eyes (`mắt thuyền`), side wooden shields (`mộc chắn`), and tall **bamboo-battened crimson lugsails (`buồm vuông nẹp tre`, 9 horizontal battens)** carrying the golden-sun & cobalt crest. |
| **Cọc Gỗ Lim Bạch Đằng** | Debarked ironwood trunks (`Ø 0.28–0.42 m`, `3.6–4.8 m` long) sharpened and shod with `0.45 m` 4-sided forged iron tips, driven at `14°–28°` leaning toward the incoming fleet in staggered ambush rows (`emerging 0.9–2.2 m` above low tide). |
| **Hỏa Hiệu (Naval Fire Beacons)** | Tall wrought-iron masthead/bow fire cages burning resinous pinewood to signal tide turn and fleet maneuvers through estuary fog. |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (-120, 3.8, -338)` → `lookAt (-120, 12.5, -408)`, FOV `52°`.
- **Macro Hero Camera (`BachDangGrandArmadaMacro`):** `pos (-240, 4.8, -618)` → `lookAt (-240, 15.0, -780)`, FOV `54°` looking low across the emerald-misted foreground field of `180` iron-tipped `cọc Bạch Đằng` stakes toward the colossal scarlet-sailed flagship and flaming twin-beacon warships.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Hero Flagship War Junk (`32m`)** | Inner + Macro | Curved extruded wooden hull, raised stern quarterdeck, painted bow `mắt thuyền`, bulwark shields, tall mast + yardarms, `12m × 15m` curved crimson battened sail with **royal-blue & gold winged sun/moon emblem** | `1` inner (`25m`) + `1` macro (`32m`) | `darkWood`, `crimsonLacquer`, enhanced `createRedEmblemSailTexture` (with blue-gold crest) |
| **Flanking Armada Escort & Fire-Beacon Junks** | Inner + Macro | `2` heavy twin-beacon fire-pole war junks (`22m`) + `8` depth-staggered battened-sail escort junks (`14–18m`) pitching & rocking via `JunkBoatMotion` | `4` inner + `10` macro escorts | `darkWood`, crimson battened sails, blazing `flareMat` beacon baskets |
| **`Cọc Gỗ Lim Bạch Đằng` Iron-Tipped Stakes** | Inner + Macro | Waterlogged ironwood trunk (`Ø 0.36m`) merged with 4-sided forged steel tip (`0.48m`) leaning `14°–28°` upstream in 5 V-ambush formations | `85` inner + `180` macro (`InstancedMesh`) | Wet `ironwood_dark` `#2B1C14` + dark forged iron `#4A4E54` |
| **Tidal Wake Foam Collars & Swirling Estuary Mist** | Inner + Macro | Pulsing foam wake rings around every stake + `24` low emerald-white estuary mist ribbons rolling across the river water | `180` wakes + `24` mist cards | Soft foam alpha + scrolling vapor shader |
| **Forested Riverbank Shorelines** | Macro | Low tree-topped estuary mudbank islands framing far-west `(-445)` and far-east `(-35)` edges of the `480m` channel | `2` flanking tree banks | `karst_moss`, `granite`, `leafAtlas` |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 14` draw calls, `<= 125k` triangles.
- **Vitest Assertions:** `BachDangNavalFleet` and `BachDangGrandArmadaMacro` exist and dispose cleanly.
