# 01 — Thung Lũng Lúa Vàng Tràng An – Tam Cốc & Hoàng Hôn Núi Đá Vôi (Ref 01)

**Reference:** [01_karst_sunset.jpg](../01_karst_sunset.jpg)
**Scene Group Names:** `TrangAnGoldenRiceKarst` (Inner Core), `TamCocMacroKarstValley` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone:** `(120, -110)` — `110m × 80m` between Hoàng Thành `(0, -68)` and Chùa Hương `(195, -180)`, east of central causeway exclusion (`|x| < 15`).
- **Macro Expansion Zone:** `(680, -320)` — **`420m × 320m`** (`x ∈ [470, 890]`, `z ∈ [-480, -160]`) recreating the wide golden Tam Cốc / Tràng An alluvial basin at monumental scale.
**Default Mood:** Golden sunset (`timeOfDay 17.5`, weather `clear`).

## 1. Visual Breakdown of `01_karst_sunset.jpg`

- **Foreground & Lower Half (35% of frame):** An expansive, flat sea of **ripe golden rice** (`Oryza sativa`) glowing amber-gold under low-angle warm backlighting, segmented by narrow earthen paddy bunds (`bờ ruộng`) and a winding reflective irrigation channel.
- **Rural Agricultural Props (Left & Right Flanks):**
  - Left foreground/midground: a **bamboo-and-thatch stilt watch hut** (`chòi canh lúa`) with steep pitched palm-straw roof, elevated bamboo deck, ladder, and warm oil-lamp glow.
  - Scattered along both left and right field edges: clusters of tall **conical straw stacks** (`đống rơm`) built around central bamboo poles.
- **Midground & Horizon Silhouette (20–25% of frame):** Three distinct depth layers of **domed limestone fenglin karst towers** (Tràng An / Tam Cốc morphology — rounded dome crowns and steep vegetated slopes rather than jagged needles): dark emerald-moss foreground karsts framing both flanks (`L1`), medium-hazed ridges (`L2`), and faint apricot-washed distant peaks (`L3`) stretching across the horizon.
- **Sky (40–45% of frame):** Dramatic **crimson-to-apricot sunset clouds** lit fiercely from below (`#D2452B` → `#F29A4A`) parting around a luminous turquoise-peach horizon glow directly behind the central karst saddle.
- **Excluded Theatre Props:** Audience heads, red seats, top truss fixtures, and the central mirrored stage doorway/performers are excluded and replaced by pure rural landscape and Ngô Đồng river channel.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Ninh Bình — Tràng An / Tam Cốc) |
|---|---|
| **Tràng An / Tam Cốc Fenglin Karst** | UNESCO World Heritage tower karst rising `50–165 m` above flat alluvial valleys. Steep `60°–85°` limestone flanks capped with rounded domes and dense green tropical scrub on ledges below `70°` slope. |
| **Ripening Rice (`Lúa chín vụ mùa`)** | Stalk height `0.90–1.10 m`; heavy golden panicles (`bông lúa trĩu hạt`) bend `35°–60°` outward. Plots measure `15–45 m` bounded by `0.45 m` wide earthen `bờ ruộng` bunds. |
| **Conical Straw Stacks (`Đống rơm`)** | Built post-harvest around a `3.6–4.8 m` bamboo pole (`cây sào`), base `Ø 2.6–3.4 m`, weathered `straw_ochre` `#B98A4A` bundles with slight natural lean (`2°–5°`). |
| **Stilt Field Watch Hut (`Chòi canh lúa`)** | 4 bamboo/ironwood corner posts, raised slatted platform at `1.4 m`, `2.8m × 2.8m` footprint, steep `48°` nipa/rice-straw thatch roof (`height 4.2 m`), bamboo ladder, and hanging oil lantern. |
| **Ngô Đồng Canal & Sampans** | Gentle meandering `12 m` wide water channel threading between paddies with rustic bamboo-canopy rowing sampans (`thuyền nan Tam Cốc`). |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (120, 3.0, -62)` → `lookAt (120, 28, -165)`, FOV `55°`.
- **Macro Hero Camera (`TamCocMacroKarstValley`):** `pos (680, 4.2, -175)` → `lookAt (680, 32, -410)`, FOV `56°`.
- **Value Structure:** Glowing sunset sky `42%`, shadowed multi-plane karst skyline `22%`, sunlit golden rice ocean `36%`.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Domed Karst Towers (L1/L2/L3)** | Inner + Macro | Displaced `IcosahedronGeometry` with rounded top dome clamp & strata ridges + outer moss vegetation caps (`55–165m` tall in Macro) | `9` inner + `19` macro (`28` total) | Triplanar limestone `#6B6A62` + `karst_moss` `#3E5A3A` |
| **Ripening Golden Rice Clumps** | Inner + Macro | `InstancedMesh` of 4–5 curved drooping blades (`0.95m` tall) with vertex gust-wave shader | `2,400` inner + `5,800` macro (`8,200` total) | `#D9A441` / `#C49334` translucent rim glow |
| **Conical Straw Stacks (`Đống rơm`)** | Inner + Macro | Merged Lathe/Cone thatch cones (`Ø 3.1m × 3.5m`) + protruding bamboo center poles | `7` inner + `11` macro (`18` total) | `straw_ochre` `#B98A4A` + timber pole |
| **Stilt Field Watch Huts (`Chòi canh`)** | Inner + Macro | 4 timber/bamboo stilts, deck, bamboo ladder, pitched 4-slope thatch roof, warm oil lamp sphere | `1` inner + `2` macro (`3` total) | Timber `#73573B`, straw thatch, `#FFB347` lamp |
| **Earthen Bunds (`Bờ ruộng`)** | Inner + Macro | Grid of `0.45m` wide raised earthen walkways bisecting rice plots | Merged per zone | `#6B5A3A` tamped earth |
| **Ngô Đồng River Sampans** | Macro | 4 rustic curved wooden rowing boats (`6.5m`) floating along the central water channel | `4` vessels | `ironwood_dark` + bamboo awnings |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 14` draw calls, `<= 160k` triangles, zero external downloads.
- **Vitest Assertions:** Both `TrangAnGoldenRiceKarst` and `TamCocMacroKarstValley` exist in scene graph, have 0 NaN vertices, and dispose cleanly.
