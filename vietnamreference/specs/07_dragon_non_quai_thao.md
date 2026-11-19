# 07 — Thung Lũng Sơn Mài Long Vân & Kinh Bắc Quan Họ: Rồng Đại Việt, Núi Sơn Mài & Nón Quai Thao (Ref 07)

**Reference:** [07_dragon_non_quai_thao.jpg](../07_dragon_non_quai_thao.jpg)
**Scene Group Names:** `LacquerKarstGarden`, `DragonBridgeFireShow`, `FestivalNonQuaiThaoDrift` (Inner Core), `LongVanLacquerValleyMacro` (Macro Expansion)
**Anchors & Footprints:**
- **Inner Zone:** Dragon Bridge `(335, -35)` & riverbank garden `(335, 6)`.
- **Macro Expansion Zone:** `(820, -80)` — **`360m × 300m`** (`x ∈ [640, 1000]`, `z ∈ [-230, 70]`), creating an immersive 3D Vietnamese *sơn mài* (lacquerware) dragon-and-mountain sanctuary valley.
**Default Mood:** Lantern night (`timeOfDay 22.0`, weather `clear`).

## 1. Visual Breakdown of `07_dragon_non_quai_thao.jpg`

- **Monumental Coiling Vietnamese Dragon (`Rồng Đại Việt`):** Rising proudly in the center of the valley from a sea of **emerald-jade clouds**, a grand **cinnabar-red and burnished-gold scaled dragon** curls upward with flowing **white-silver mane**, swept branched horns, fierce golden eyes, and open jaws.
- **Gilded Sun/Moon Concentric Halo Disc (`Vầng Nhật Nguyệt`):** Framed directly behind the dragon's head and upper coils is a monumental **concentric circular bronze-gold medallion ring** etched with subtle cloud/dragon motifs, glowing warmly against the crimson night sky.
- **Stylized `Sơn Mài` (Lacquerware) Contour-Striped Karst Peaks:** Flanking left and right across multiple depth layers are dramatic **red-cinnabar limestone mountains** (`#A4221B`) etched with **gleaming golden topographical contour lines (`#D4A43A`)**, capturing traditional Vietnamese *sơn mài* eggshell-and-gold-leaf lacquer art in full 3D.
- **Luminous Emerald-Jade Clouds (`Vân Mây Ngọc Bích`):** Billowing across the valley floor and wrapping around the mountain bases are sculpted puffs of **jade-green and turquoise-rimmed clouds** (`#5BBF6A` / `#2BB3B1`).
- **Floating `Nón Quai Thao` Hats with Flowing Crimson Ribbons:** Suspended gracefully at multiple altitudes across the sky are giant **flat circular Kinh Bắc `nón quai thao` hats** displaying finely ribbed natural palm crowns, glossy red-lacquered undersides, and trailing **scarlet silk chin ribbons (`quai thao`)**.
- **Excluded Theatre Props:** Audience silhouettes, seats, overhead ceiling fixtures/trusses, and blue-clad stage singers are excluded.

## 2. Real-World Vietnamese Authenticity Data

| Element | Real-World Specification (Sơn Mài Việt Nam & Quan Họ Kinh Bắc) |
|---|---|
| **Rồng Đại Việt (Vietnamese Dragon)** | Sinous S-curved serpentine body (`thân uốn khúc hình sin`), flowing dorsal crest (`vây lưng`), branched antlers (`sừng chạc`), swept mane (`bờm trắng`), and imperial 5-clawed limbs amidst auspicious clouds. |
| **Tranh Sơn Mài (Vietnamese Lacquer)** | `10–20` layers of natural *sơn ta* tree resin inlaid with 24k gold leaf (`thếp vàng`), cinnabar (`son`), dark *cánh gián* umber, and silver, wet-sanded to a deep mirror clearcoat (`clearcoat 0.85`). |
| **Nón Quai Thao (Bắc Ninh / Kinh Bắc)** | Flat cylindrical bamboo-and-palm hat (`Ø 72–76 cm`, deep flat rim `12 cm` with `18` concentric bamboo ribs, underside lacquered `son_red` or black), worn with long flowing crimson braided silk straps and tassels (`dải lụa quai thao`). |

## 3. Composition Target & Hero Cameras

- **Inner Hero Camera:** `pos (335, 3.0, 55)` → `lookAt (335, 18.0, -35)`, FOV `56°`.
- **Macro Hero Camera (`LongVanLacquerValleyMacro`):** `pos (820, 4.5, 42)` → `lookAt (820, 18.0, -96)`, FOV `56°` looking across the rolling emerald-jade clouds and flanking gold-contoured red lacquer peaks directly at the colossal coiling dragon framed inside the concentric golden halo disc with `nón quai thao` floating overhead.

## 4. Geometry & Instancing Specs

| Component | Zone | Technique & Scale | Count | Material / Shader |
|---|---|---|---|---|
| **Monumental Sculpted Coiling Dragon (`Rồng Đại Việt`)** | Macro | `CatmullRomCurve3` serpentine body tube (`32m` long, `r = 1.9m → 0.5m`) with procedural diamond scale normal/color shader, sculpted horned dragon head, open jaws, white mane spines, and dorsal fins | `1` hero dragon (`32m` span) | `MeshPhysicalMaterial` (`son_red` + `lacquer_gold` scale relief + `clearcoat 0.8`) |
| **Concentric Gilded Moon-Halo Disc** | Inner + Macro | Multi-ring carved concentric golden halo (`Ø 28m`) placed behind the dragon head along the valley axis | `1` inner + `1` macro (`Ø 28m`) | Burnished `lacquer_gold` + concentric ring shader glow |
| **`Sơn Mài` Gold-Contour Lacquer Peaks** | Inner + Macro | `7` inner + `18` macro towering displaced rock spires (`6m–34m` tall) with high-gloss clearcoat & procedural golden contour-line shader | `7` inner + `18` macro | `MeshPhysicalMaterial` (`#A4221B` → `#D4A43A` elevation contour bands, `clearcoat 0.85`) |
| **Emerald-Jade Lacquer Cloud Banks** | Inner + Macro | Clustered smooth metaball-like sculpted cloud puffs cradling peak bases & dragon coils | `5` inner + `24` macro clusters | `#5BBF6A` base with `#2BB3B1` Fresnel glow |
| **Floating `Nón Quai Thao` with Silk Ribbons** | Inner + Macro | Flat circular palm-ribbed hat (`16` radial ribs + deep flat rim + `son_red` interior) with twin flowing crimson ribbon strips (`vertex shader wind`) | `36` inner + `48` macro (`InstancedMesh`) | Warm rattan `#D8C9A0` top, `#A4221B` inner underside & crimson silk ribbons |

## 5. Budget & Verification

- **Macro Zone Budget:** `<= 14` draw calls, `<= 145k` triangles.
- **Vitest Assertions:** `LacquerKarstGarden`, `DragonBridgeFireShow`, `FestivalNonQuaiThaoDrift`, and `LongVanLacquerValleyMacro` exist and dispose cleanly.
