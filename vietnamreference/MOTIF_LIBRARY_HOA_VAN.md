# Thư Viện Hoa Văn Chuẩn (Motif Library) — Bản Đồ Việt Nam Kỳ Vĩ

> **Mục đích**: Chuẩn hóa **từng hoa văn** dùng trong 300 component (`MB-*`, `MT-*`, `MN-*`) thành một mã định danh `HV-xxx` duy nhất, kèm hình thái thực tế, kỹ thuật dựng 3D, kích thước, ngân sách tam giác, LOD, vật liệu và helper code.
> **Áp dụng cho**: [MASTER_300_COMPONENTS_DETAIL_LIST.md](MASTER_300_COMPONENTS_DETAIL_LIST.md) và 3 file phân rã hoa văn theo khu vực:
> - [MOTIF_PLAN_MIEN_BAC.md](MOTIF_PLAN_MIEN_BAC.md) (`MB-001` → `MB-100`)
> - [MOTIF_PLAN_MIEN_TRUNG.md](MOTIF_PLAN_MIEN_TRUNG.md) (`MT-001` → `MT-100`)
> - [MOTIF_PLAN_MIEN_NAM.md](MOTIF_PLAN_MIEN_NAM.md) (`MN-001` → `MN-100`)

---

## 0. Quy Ước Kỹ Thuật Chung

### 0.1. Kỹ thuật dựng (cột **KT**)

| Mã | Kỹ thuật | Khi nào dùng |
|---|---|---|
| `G-EXT` | `ExtrudeGeometry` từ `THREE.Shape` (có bevel) | Hoa văn phẳng nổi/chìm có đường viền rõ: chữ Thọ, hồi văn, mắt cửa, ô thoáng |
| `G-LATHE` | `LatheGeometry` từ profile 2D | Vật tròn xoay: lọ, đỉnh, búp sen, chân tảng, con tiện |
| `G-TUBE` | `TubeGeometry` / `createSmoothTaperedTubeGeometry` theo `CatmullRomCurve3` | Thân rồng, dây lá cuốn, râu, mây xoắn, quai đỉnh |
| `G-DISP` | Lưới chia nhỏ + dịch đỉnh theo heightmap/hàm | Phù điêu nông (bas-relief) Cửu Đỉnh, trống đồng, vảy rồng |
| `G-INST` | `InstancedMesh` một module lặp | Hàng con tiện, ngói ống, đinh đồng cửa, chân tảng, nhũ đá |
| `T-NRM` | Canvas → Normal + Roughness map (bake), gắn lên mặt phẳng | Hoa văn rất mịn (< 2 cm): thổ cẩm, khắc chìm bia, vân gỗ chạm nông |
| `T-ATLAS` | `SignageAtlas` / `createVietnamSignageTexture` | Chữ Hán-Nôm, chữ Quốc ngữ, tranh sơn mài, kính màu |
| `S-SHD` | Shader (UV world-space / triplanar) | Vân lưu ly, pháp lam, gốm men rạn, kính màu phát sáng |

### 0.2. LOD theo khoảng cách camera

| Tầng | Khoảng cách | Biểu diễn hoa văn |
|---|---|---|
| **L0 — Cận cảnh** | `< 25m` | Hình học thật (`G-*`) đầy đủ cạnh vát, độ sâu chạm `1–8 cm` |
| **L1 — Trung cảnh** | `25–120m` | Hình học đơn giản hóa 30–50% + `T-NRM` bù độ sâu |
| **L2 — Viễn cảnh** | `> 120m` | Chỉ màu/albedo + silhouette mái/đao; hoa văn tắt |

### 0.3. Ngân sách tam giác (tri) & vật liệu
- Mỗi hoa văn ghi **tri L0 / 1 đơn vị** (một module). Tổng ngân sách toàn bản đồ giữ `< 3.46M tri` (test `scaleMapOptimization`) và shadow-caster `<= 900k`.
- **Không tạo material mới cho hoa văn**: luôn gộp vào bucket sẵn có (`goldParts`, `crimsonParts`, `stoneParts`, `woodParts`, `bronzeParts`, `roofParts`, `marbleParts`, `chamBrick`, `plasterParts`…) trước `mergeNormalized()` → **0 draw call phát sinh**.
- Hoa văn mịn ưu tiên `T-NRM` trên material đã có (thêm `normalMap` vào atlas dùng chung), giữ `uniqueMaterials <= 250`.

### 0.4. Tag QC bắt buộc
Mỗi mesh/merge chứa hoa văn gắn `mesh.userData.motifIds = ['HV-A03', 'HV-D02', …]`. `MultiAngleQcAgent` sẽ được mở rộng để kiểm tra **motif coverage** (mục 11).

---

## 1. Nhóm A — RỒNG (LONG) & BIẾN THỂ

| Mã | Tên | Hình thái thực tế (đối chiếu ảnh) | KT | Kích thước | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---|---|---:|---|---|
| `HV-A01` | **Rồng thời Lý** | Thân tròn trơn uốn **12 khúc sin đều** thon dần như giun, không sừng, mào lửa liên tục dọc lưng, đầu ngẩng ngậm ngọc, chân 3 móng mảnh | `G-TUBE` | Dài `1.2–6m`, Ø thân `6–25cm` | 1 800 | `stoneParts` · `createSmoothDragonParts({style:'ly'})` | `39`, `72` |
| `HV-A02` | **Rồng Lê Sơ (bậc thềm Kính Thiên)** | Thân mập uốn **9 khúc**, vảy cá chép nổi, bờm mây cụm (*đao mây*) 3 lớp, mũi sư tử, râu xoắn, chân 5 móng bám bậc | `G-TUBE` + `G-DISP` | Dài `5.5–7m` | 3 200 | `stoneParts` · `createCarvedDragonBalustradeParts` | `39`, `72` |
| `HV-A03` | **Rồng thời Nguyễn** | Đầu to mắt lồi, sừng nai 2 nhánh, râu dài, thân vảy rõ, uốn vòng chữ S, đuôi xòe lửa, chân 5 móng (vua) | `G-TUBE` + `G-DISP` | `0.4–3m` | 2 400 | `goldParts`/`crimsonParts` · `createSmoothDragonParts({style:'nguyen'})` | `40`, `53`, `106b` |
| `HV-A04` | **Lưỡng long chầu nguyệt / chầu nhật** | 2 rồng đối xứng trên bờ nóc, đầu quay vào quả cầu lửa/mặt trời ở giữa, thân khảm sành sứ | `G-TUBE` + `G-LATHE` (quả cầu) | Dài `2–8m` mỗi rồng | 2×1 400 | `roofParts`+`goldParts` · `createRoofFinialSetParts` | `40`, `106` |
| `HV-A05` | **Long hóa (rồng hóa lá/mây)** | Đầu rồng cách điệu, thân tan thành lá lật/mây xoắn — dùng ở đầu đao, đầu dư, cửa võng | `G-EXT` (mặt cắt) + bevel | `0.3–1.2m` | 420 | `goldParts`/`woodParts` | `106b`, `116` |
| `HV-A06` | **Đầu đao rồng cuốn (đầu đao mái)** | Góc mái vút cong, đắp vữa/sứ hình đầu rồng ngửa, mây lửa cuộn | `G-TUBE` + `G-EXT` | `0.8–2.4m` | 650 | `roofParts` · `createRoofFinialSetParts` | `40`, `63b` |
| `HV-A07` | **Đầu dư chạm rồng** | Đầu xà nhô ra khỏi cột, chạm đầu rồng ngậm ngọc (đình Bắc Bộ) | `G-EXT` profile + bevel | `0.5–0.9m` | 380 | `woodParts`/`goldParts` · `createTimberBracketSetParts` | `116` |
| `HV-A08` | **Rồng Cầu Rồng (thép xếp vảy)** | Tấm thép cắt uốn xếp vảy, bờm lửa tỏa tròn, mắt LED trái tim | `G-EXT` (tấm vảy) + `G-INST` | Đầu `12m`, vảy `0.8m` | 6 000 | `goldParts` | `21`, `57` |
| `HV-A09` | **Rồng Ngai vàng / Bửu tán (9 rồng)** | 9 đầu rồng chạm lộng trên tựa & tay vịn ngai, rồng mây quấn bửu tán | `G-TUBE` nhỏ + `G-EXT` | `0.15–0.6m` | 9×260 | `goldParts` | `53`, `106b` |
| `HV-A10` | **Long vân (rồng ẩn mây vẽ cột)** | Rồng vàng vẽ cuộn quanh cột sơn son, nền mây | `S-SHD`/`T-NRM` | Cột cao `6–9m` | 0 (shader) | `createRedLacquerColumnShaderMat('longVan')` | `106b` |

## 2. Nhóm B — TỨ LINH & LINH VẬT

| Mã | Tên | Hình thái thực tế | KT | Kích thước | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---|---|---:|---|---|
| `HV-B01` | **Phượng hoàng (phượng múa)** | Mỏ quặp, mào lửa, cổ dài cong, cánh xòe 5 lớp lông, đuôi 3–5 dải lông công | `G-EXT` lớp + `G-TUBE` (cổ) | `0.4–2m` | 900 | `goldParts`/`roofParts` | `40` |
| `HV-B02` | **Phượng ngậm thư (đầu hồi)** | Phượng đứng giữa trán bờ nóc, mỏ ngậm cuộn thư | `G-EXT` | `0.6–1.2m` | 520 | `roofParts` | `40`, `79` |
| `HV-B03` | **Kỳ lân** | Đầu rồng, thân hươu phủ vảy, sừng một nhánh, đuôi lửa, ngồi chống chân trước trên bệ | `G-*` tổ hợp | Cao `0.8–1.6m` | 1 400 | `bronzeParts`/`stoneParts` · `createGuardianBeastParts('kylan')` | `65`, `106` |
| `HV-B04` | **Nghê** | Đầu chó-sư tử, bờm xoáy ốc 3 lọn, mõm rộng nhe nanh, ngồi bệ vuông | `G-*` tổ hợp | Cao `0.6–1.2m` | 1 100 | `plasterParts`/`stoneParts` · `createGuardianBeastParts('nghe')` | `65`, `69` |
| `HV-B05` | **Rùa đội bia (Quy)** | Mai lục giác phân múi (13 múi chính + viền), cổ vươn, mắt mũi rõ, 4 chân móng bấm đế, đuôi ngắn | `G-DISP` (mai) + `G-LATHE` | Dài `1.2–2.2m` | 1 300 | `stoneParts` · `createCarvedTurtleSteleParts` | `47` |
| `HV-B06` | **Hạc chầu trên lưng Quy** | Hạc đứng 2 chân thẳng, cổ cong chữ S, mỏ ngậm cành sen; rùa đế | `G-TUBE` + `G-LATHE` | Cao `1.0–2.4m` | 900 | `bronzeParts` · `createBronzeCraneOnTortoiseParts` | `110` |
| `HV-B07` | **Cóc (trên trống đồng / Đài Nghiên)** | Cóc ngồi 4 chân, lưng nổi u, mắt lồi | `G-LATHE`+`G-DISP` | `0.15–0.6m` | 260 | `bronzeParts`/`stoneParts` · `createDongSonDrum3DParts` | `38`, `03` |
| `HV-B08` | **Cá chép hóa rồng** | Thân cá vảy tròn, đầu rồng, đuôi xòe, vây lưng lửa | `G-TUBE` + `G-DISP` | `2–8m` | 2 200 | `marbleParts` | `21` |
| `HV-B09` | **Chó & Khỉ Chùa Cầu** | Tượng gỗ ngồi, tai/mõm/chân rõ khối, mặc áo | `G-*` | Cao `0.7m` | 900 | `woodParts` · `createGuardianBeastParts('dog'/'monkey')` | `56` |
| `HV-B10` | **Sư tử đá / Lân sư cổng Hội Quán** | Bờm xoăn, chân đè quả cầu (đực) / sư tử con (cái) | `G-*` | Cao `1.0m` | 1 200 | `stoneParts` | `115` |

## 3. Nhóm C — THỰC VẬT

| Mã | Tên | Hình thái thực tế | KT | Kích thước | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---|---|---:|---|---|
| `HV-C01` | **Cánh sen đế (bệ sen / tòa sen)** | Hàng cánh sen nhọn đầu, có gân giữa, xếp 2–3 tầng so le, mép hơi cuộn ra | `G-INST` (1 cánh) | Cánh `0.06–0.6m`, 16–32 cánh/tầng | 48/cánh | `goldParts`/`stoneParts` | `45`, `75` |
| `HV-C02` | **Chân tảng hoa sen 16 cánh** | Đá tròn chạm 16 cánh sen úp quanh đế cột | `G-LATHE` + `G-DISP` | Ø `0.5–1.0m` | 320 | `stoneParts`/`marbleParts` | `27`, `106b` |
| `HV-C03` | **Búp sen (đỉnh trụ biểu)** | Búp nhọn 3 lớp cánh khép, đế đài tròn | `G-LATHE` | Cao `0.4–1.0m` | 180 | `plasterParts` · `createLotusFinialParts` | `69` |
| `HV-C04` | **Hoa sen nở (đài sen + gương sen)** | 24–32 cánh nhiều lớp, nhị vàng, gương sen có hạt | `G-INST` + `G-LATHE` | Ø `0.3–10m` | 1 200 | `createForegroundLotusFlowerParts`/`createMonumentalLotusParts` | `45` |
| `HV-C05` | **Lá sen (peltate, mép gợn)** | Lá tròn khum lòng chảo, mép gợn sóng, gân tỏa | `G-DISP` | Ø `0.4–1.2m` | 64 | `createNotchedLotusPadGeometry` | `45` |
| `HV-C06` | **Lá súng khuyết V** | Lá tròn phẳng có khe chữ V, nổi sát mặt nước | `G-EXT` mỏng | Ø `0.2–0.5m` | 32 | lá xanh riêng (sửa bug B5) | `107` |
| `HV-C07` | **Cúc dây (hoa cúc leo)** | Dây lượn sin có hoa cúc 8–12 cánh tròn xen lá | `G-TUBE` + `G-INST` | Băng cao `8–20cm` | 140/m | `goldParts`/`stoneParts` | `47` |
| `HV-C08` | **Tứ quý (Mai–Lan–Cúc–Trúc)** | 4 ô hộc chạm nổi: cành mai 5 cánh, khóm lan, bông cúc, đốt trúc + lá | `G-DISP`/`T-NRM` | Ô `0.4×0.6m` | 260/ô | `woodParts`/`goldParts` | `106` |
| `HV-C09` | **Lá đề** | Lá hình tim đuôi nhọn dài, gân tỏa; dùng làm khung hào quang/vòm | `G-EXT` | `0.2–2m` | 90 | `goldParts`/`chamBrick` | `41`, `75` |
| `HV-C10` | **Dây lá cuốn Chăm** | Dây xoắn ốc liên tục kiểu acanthus, lá cuộn tròn | `G-TUBE` / `T-NRM` | Băng `10–30cm` | 180/m | `chamBrick`/`stoneParts` | `41`, `86b` |
| `HV-C11` | **Lá lật (lá hóa)** | Lá cuộn ngược, mép răng cưa, dùng ở đầu kẻ, đầu bẩy | `G-EXT` | `0.2–0.5m` | 110 | `woodParts` | `116` |
| `HV-C12` | **Đào — Lựu — Phật thủ (tam đa)** | Quả trong đĩa/khay chạm trên cửa võng, hương án | `G-LATHE` nhỏ | `4–12cm` | 60/quả | `goldParts` | `110`, `121` |
| `HV-C13` | **Hoa chanh 4 cánh** | Hoa 4 cánh tròn đối xứng — module gốm thông gió | `G-EXT` (lỗ thủng) | Ô `20–30cm` | 36/ô | `plasterParts` · `createPiercedBalustradeParts('hoa_chanh_ceramic')` | `71` |
| `HV-C14` | **Hoa thị (hoa 6–8 cánh)** | Hoa tròn cánh đều, dùng ô cửa thông gió, đinh cửa | `G-EXT` | `10–40cm` | 48 | `plasterParts`/`bronzeParts` | `04` |
| `HV-C15` | **Đốt trúc (brise-soleil Dinh Độc Lập)** | Thanh đứng thắt eo theo đốt, khớp nổi, lá trúc cách điệu ở mặt bằng | `G-LATHE` + `G-INST` | Thanh `2.8–3.2m` | 96/thanh | `whiteParts` | `60` |

## 4. Nhóm D — HÌNH HỌC & CHỮ TƯỢNG HÌNH

| Mã | Tên | Hình thái thực tế | KT | Kích thước | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---|---|---:|---|---|
| `HV-D01` | **Hồi văn (key-fret, chữ "Công" liên hoàn)** | Đường gấp khúc vuông góc chạy liên tục làm viền | `G-EXT` (băng) | Băng cao `4–15cm` | 60/m | mọi bucket | `47`, `106` |
| `HV-D02` | **Chữ Thọ tròn (團壽)** | Chữ Thọ cách điệu trong khung tròn, đối xứng | `G-EXT` | Ø `0.15–0.8m` | 140 | `goldParts`/`plasterParts` | `106`, `112` |
| `HV-D03` | **Chữ Thọ dài (長壽)** | Chữ Thọ kéo dọc, ô cửa sổ/lan can | `G-EXT` | `0.2×0.5m` | 120 | `goldParts`/`woodParts` | `112` |
| `HV-D04` | **Chữ Vạn 卍 liên hoàn** | Ô gạch/gỗ thủng hình chữ Vạn lặp | `G-EXT` thủng / `G-INST` | Ô `20–30cm` | 40/ô | `createPiercedBalustradeParts('chu_van')` | `40` |
| `HV-D05` | **Mây xoắn (vân cuốn)** | Cụm mây 3 xoắn ốc đầu tròn đuôi nhọn | `G-TUBE` / `G-EXT` | `0.1–1m` | 120 | mọi bucket | `39`, `106b` |
| `HV-D06` | **Sóng nước (thủy ba)** | Sóng nhọn đầu cuộn xếp lớp, chân bệ/chân bia | `G-EXT` băng | Cao `8–30cm` | 90/m | `stoneParts`/`goldParts` | `54`, `83` |
| `HV-D07` | **Triện / ô triện** | Khung chữ nhật góc lõm vuông chứa chữ/hoa | `G-EXT` | `0.2–1.5m` | 40 | `goldParts`/`woodParts` | `110` |
| `HV-D08` | **Mắt cửa Hội An (Môn thần)** | Bát giác/tròn viền gỗ, 8 cánh cúc, tâm âm dương đỏ-đen-vàng | `G-EXT` + `G-LATHE` | Ø `0.22–0.35m` | 180 | `woodParts`+`goldParts` · `createHoiAnDoorEyesParts` | `55` |
| `HV-D09` | **Đồng tiền (tiền xu lỗ vuông) liên hoàn** | Vòng tròn chồng mép, lỗ vuông giữa — ô thông gió | `G-EXT` thủng | Ô `20cm` | 48 | `plasterParts` | `84` |
| `HV-D10` | **Con tiện gỗ (baluster)** | Thanh tiện tròn 3 bầu/2 eo trên đế vuông | `G-LATHE` + `G-INST` | Cao `0.4–0.8m` | 56 | `createPiercedBalustradeParts('con_tien')` | `49`, `84` |
| `HV-D11` | **Cửa sổ mặt trời (8 tia)** | Khung tròn gỗ 2 tầng, 8 nan tỏa tâm | `G-TUBE` (vòng) + `G-INST` (nan) | Ø `1.0–1.4m` | 320 | `woodParts`/`crimsonParts` | `49` |
| `HV-D12` | **Cửa võng chạm lộng** | Khung vòm cong xuống chạm thủng rồng-phượng-hoa lá | `G-EXT` thủng nhiều lớp | `2–4m × 0.6–1.2m` | 1 600 | `goldParts` | `106b`, `121` |
| `HV-D13` | **Cửa bức bàn 3 ô** | Ô trên lá sách / chấn song, ô giữa chạm tứ quý, ô dưới pano kín | `G-EXT` + `T-NRM` | Cánh `0.8×2.4m` | 220 | `woodParts`/`crimsonParts` | `116`, `110` |
| `HV-D14` | **Đinh đồng cửa thành (Ngọ Môn)** | Hàng đinh bán cầu đồng 9×9 trên cánh cửa son | `G-INST` (bán cầu) | Ø `6–9cm` | 24/đinh | `bronzeParts` | `82` |
| `HV-D15` | **Ngói ống trích thủy & ngói mũi hài** | Ngói ống tròn có đầu tròn chạm hoa (*ngói câu đầu*) và giọt nước; ngói mũi hài cánh vảy | `G-INST` | Ống `0.12×0.4m` | 40/viên | `roofParts` | `40`, `63b` |

## 5. Nhóm E — ĐÔNG SƠN & CỔ VẬT

| Mã | Tên | Hình thái thực tế | KT | Kích thước | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---|---|---:|---|---|
| `HV-E01` | **Ngôi sao 14 cánh tâm mặt trống** | Mặt trời nổi 14 tia nhọn, giữa các tia là họa tiết lông công | `G-DISP` | Ø `0.3–22m` | 800 | `bronzeParts` · `createDongSonDrum3DParts` | `38` |
| `HV-E02` | **Vành chim Lạc bay** | 18 chim Lạc mỏ dài, cánh xòe, bay ngược chiều kim đồng hồ | `G-DISP`/`G-EXT` | Chim `6–60cm` | 40/chim | `bronzeParts` | `38` |
| `HV-E03` | **Người hóa trang lông chim & nhà sàn mái cong** | Đoàn người đội mũ lông vũ cầm nhạc cụ, nhà sàn mái thuyền | `G-DISP`/`T-NRM` | Băng `5–40cm` | 1 200/vành | `bronzeParts` | `38` |
| `HV-E04` | **Vòng tròn tiếp tuyến & răng cưa** | Vòng tròn đồng tâm có chấm, nối tiếp tuyến; vạch răng lược | `G-DISP`/`T-NRM` | Băng `2–15cm` | 300/vành | `bronzeParts` | `38` |
| `HV-E05` | **Cửu Đỉnh phù điêu (núi sông, sản vật)** | Mỗi đỉnh 17 ô phù điêu nổi: núi, sông, thú, cây, vũ khí, thuyền | `G-DISP` (heightmap/ô) | Ô `0.25×0.3m` | 17×180 | `bronzeParts` · `createImperialUrnParts` | `54`, `83` |
| `HV-E06` | **Đại Hồng Chung (quai bồ lao & 4 núm gõ)** | Quai 2 rồng bồ lao chung lưng, thân chia ô có chữ, 4 núm gõ hoa sen | `G-LATHE`+`G-TUBE` | Cao `1.5–3m` | 1 400 | `bronzeParts` · `createBronzeBellParts` | `82` |
| `HV-E07` | **Đỉnh đồng 3 chân 2 quai chạm rồng** | Thân tròn bụng phình, nắp có núm lân, chân thú | `G-LATHE`+`G-TUBE` | Cao `0.5–2.5m` | 900 | `bronzeParts` · `createBronzeIncenseTripodParts` | `110` |

## 6. Nhóm F — CHĂM PA

| Mã | Tên | Hình thái thực tế | KT | Kích thước | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---|---|---:|---|---|
| `HV-F01` | **Kala (mặt quái vật đỉnh vòm)** | Mặt nạ mắt lồi, nanh, không hàm dưới, 2 tay giữ dây hoa | `G-DISP` | `0.4–1.2m` | 700 | `chamBrick`/`stoneParts` · `createChamReliefTympanumParts('kala_makara')` | `41` |
| `HV-F02` | **Makara (thủy quái vòi voi)** | Thân cá sấu, vòi cuộn, nhả dây hoa — 2 chân vòm | `G-DISP` | `0.3–0.8m` | 480 | `chamBrick` | `41` |
| `HV-F03` | **Vòm cuốn lá đề nhiều lớp (tympanum)** | 3–5 lớp vòm nhọn lồng nhau, viền dây lá | `G-EXT` lớp | Cao `1–4m` | 600 | `chamBrick` · `createChamTowerGeometry` | `86b`, `87` |
| `HV-F04` | **Cột áp tường khía rãnh** | Trụ vuông ốp tường có 3–5 rãnh dọc, đầu cột hoa sen | `G-EXT` | Cao `2–6m` | 120 | `chamBrick` | `86b` |
| `HV-F05` | **Cửa giả 3 tầng giật cấp** | Khung cửa lồng 3 lớp lùi dần, vòm đỉnh lá đề | `G-EXT` | `1.2×3m` | 420 | `chamBrick` | `86b` |
| `HV-F06` | **Apsara (vũ nữ)** | Dáng múa uốn hông, tay bắt ấn, đội mũ tháp, chân co | `G-DISP` | Cao `0.4–1m` | 600 | `stoneParts` | `41` |
| `HV-F07` | **Gandharva (nhạc công trời)** | Ngồi chơi đàn, sáo; đầu đội mũ, khăn bay | `G-DISP` | Cao `0.4m` | 500 | `stoneParts` | `41` |
| `HV-F08` | **Durga Mahishasuramardini** | 4–10 tay cầm khí giới, đứng trên đầu trâu | `G-DISP` | Cao `1.2m` | 1 200 | `stoneParts` · `createChamReliefTympanumParts('durga')` | `66` |
| `HV-F09` | **Linga-Yoni** | Bệ vuông có máng nước (Yoni) đỡ trụ tròn (Linga) | `G-LATHE` + `G-EXT` | `0.6–1.2m` | 260 | `stoneParts` | `66` |
| `HV-F10` | **Tháp góc (kudu / tháp mô hình góc tầng)** | Tháp nhỏ thu nhỏ hình tháp chính đặt 4 góc mỗi tầng | `G-*` thu nhỏ | Cao `0.6–1.5m` | 220 | `chamBrick` | `24`, `98` |
| `HV-F11` | **Gạch Chăm mài chập** | Mạch gạch gần như vô hình, mặt gạch đỏ sẫm, rêu đen | `T-NRM` + `S-SHD` | Gạch `0.3×0.15m` | 0 | material `chamBrick` | `86b` |

## 7. Nhóm G — TÂY NGUYÊN & THỔ CẨM

| Mã | Tên | Hình thái thực tế | KT | Kích thước | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---|---|---:|---|---|
| `HV-G01` | **Hoa văn thổ cẩm hình thoi & răng cưa** | Dải đen-đỏ-trắng-vàng, thoi lồng thoi, răng cưa | `T-NRM`/`T-ATLAS` | Dải `5–40cm` | 0 | `cachedTextures.brocade` | `42`, `43` |
| `HV-G02` | **Mặt trời & sao (vách Nhà Rông)** | Hình tròn tia tỏa vẽ đỏ-đen trên phên nứa | `T-ATLAS` | Ø `0.5–1.5m` | 0 | phên nứa | `90`, `122` |
| `HV-G03` | **Phên nứa đan lóng mốt (chữ nhân)** | Nan nứa đan chéo tạo xương cá | `T-NRM` + `S-SHD` | Toàn vách | 0 | `bambooWeave` | `90` |
| `HV-G04` | **Bầu sữa & trăng khuyết (cầu thang độc mộc)** | Đầu thang chạm đôi bầu sữa, trăng khuyết | `G-LATHE`/`G-EXT` | `0.2–0.5m` | 160 | `woodParts` | `122` |
| `HV-G05` | **Sừng trâu đỉnh mái & cột thần** | Cặp sừng cong vút gỗ/đắp, khiên mây đan | `G-TUBE` | `0.8–2m` | 220 | `woodParts` | `122` |
| `HV-G06` | **Tượng nhà mồ (người ôm mặt, mẹ bồng con)** | Đẽo rìu thô, khối mặt phẳng | `G-*` low-poly | Cao `1–1.8m` | 600 | `createNhaMoFolkStatueParts` | `27` |
| `HV-G07` | **Núm chiêng & vành chiêng** | Núm bầu tròn bóng, vành dập chữ/hoa | `G-LATHE` | Ø `0.3–0.9m` | 140 | `bronzeParts` | `91` |

## 8. Nhóm H — KIẾN TRÚC PHÁP / GOTHIC / HIỆN ĐẠI

| Mã | Tên | Hình thái thực tế | KT | Kích thước | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---|---|---:|---|---|
| `HV-H01` | **Hoa hồng kính màu (rose window)** | Vòng tròn chia 12–16 cánh, lưới chì, kính đa sắc phát sáng | `G-EXT` + `S-SHD` | Ø `3–8m` | 900 | `createRoseWindowGeometry` + `stainedGlass` | `30`, `61` |
| `HV-H02` | **Cửa sổ lancet & lưới đá (tracery)** | Vòm nhọn hẹp, chia 2 ô có vòng tròn đỉnh | `G-EXT` | `1.2×5m` | 260 | `createPointedArchedWallGeometry` | `120` |
| `HV-H03` | **Vòm cuốn Romanesque nhiều lớp** | 3–4 lớp vòm bán nguyệt lùi dần, cột nhỏ đỡ | `G-TUBE` | Ø `2–6m` | 300 | `stoneParts`/`brickParts` | `61`, `120` |
| `HV-H04` | **Gờ phào (cornice) & con sơn (corbel)** | Phào nhiều lớp lồi lõm; con sơn cuộn | `G-EXT` profile quét | `0.1–0.5m` | 40/m | `plasterParts`/`whiteParts` | `105` |
| `HV-H05` | **Cửa chớp lá sách (louver shutter)** | Khung gỗ chứa 18–24 lá nghiêng 30° | `G-INST` | `0.6×2.2m` | 120 | màu xanh lá/xanh rêu | `84`, `105`, `109` |
| `HV-H06` | **Gạch bông lập phương 3D** | 3 hình thoi sáng-trung-tối tạo ảo giác khối | `T-ATLAS` + `S-SHD` | Viên `0.2m` | 0 | sàn Nhà Thờ Đức Bà | `120` |
| `HV-H07` | **Gạch bông hoa văn Nam Bộ** | Hoa 4 cánh/ngôi sao trong ô vuông, viền | `T-ATLAS` | Viên `0.2m` | 0 | sàn nhà cổ, Dinh | `118` |
| `HV-H08` | **Mặt đồng hồ La Mã & kim** | Vòng số La Mã nổi, kim sắt hoa văn | `G-EXT` + `T-ATLAS` | Ø `1–2.5m` | 280 | `goldParts`/`whiteParts` | `29`, `30` |
| `HV-H09` | **Hoa văn song sắt cổng Dinh** | Song đứng xen vòng tròn, đầu giáo | `G-INST` | Cao `2.5–3m` | 60/song | `ironParts` | `28` |
| `HV-H10` | **Đèn chùm hình học thập niên 60** | Khung vuông nhiều tầng, ống thủy tinh | `G-INST` | `1.2–2.8m` | 600 | `goldParts`/`whiteParts` | `118` |
| `HV-H11` | **Gạch Vauban & góc đá giật bậc (quoin)** | Góc tường xen đá dài-ngắn, gạch xếp chẻ | `G-INST` + `T-NRM` | Khối `0.4–0.6m` | 24/khối | `stoneParts` | `123` |

## 9. Nhóm I — CHỮ & THƯ PHÁP

| Mã | Tên | Hình thái thực tế | KT | Kích thước | Ghi chú | Ảnh ref |
|---|---|---|---|---|---|---|
| `HV-I01` | **Hoành phi (đại tự)** | Bảng ngang nền son chữ Hán thếp vàng, viền rồng mây | `T-ATLAS` + khung `G-EXT` | `1.5–4m × 0.6–1m` | Nội dung bắt buộc đúng thực tế: `萬世師表`, `端門`, `午門`, `太和殿`, `來遠橋`, `高山景行`… | `110`, `82` |
| `HV-I02` | **Câu đối (liễn) cong / phẳng** | Bảng dọc ôm cột, chữ Hán thếp vàng | `T-ATLAS` trên mặt cong | `0.3×2.4m` | Cặp đối xứng | `114`, `110` |
| `HV-I03` | **Bia Hán-Nôm khắc chìm** | Chữ chìm `3–5mm`, trán bia chạm lưỡng long | `T-NRM` | `1–1.8m` | Sinh từ `createVietnamSignageTexture('han_nom_stele')` | `47` |
| `HV-I04` | **Biển hiệu Quốc ngữ / Pháp** | Chữ nổi kim loại, phông serif | `T-ATLAS` | — | `"CHỢ BẾN THÀNH"`, `"DI TÍCH LỊCH SỬ CẦU TÀU 914"` | `29`, `105` |
| `HV-I05` | **Nhất thi nhất họa (cổ diêm Huế)** | Ô xen kẽ: 1 ô thơ chữ Hán / 1 ô tranh tứ quý men lam | `T-ATLAS` | Ô `0.4×0.4m` | Điện Thái Hòa, Thế Miếu | `106` |

## 10. Nhóm J — GỐM, KHẢM & SƠN

| Mã | Tên | Hình thái thực tế | KT | Ghi chú | Ảnh ref |
|---|---|---|---|---|---|
| `HV-J01` | **Khảm sành sứ (mảnh chai, đĩa vỡ)** | Mảnh gốm men lam-trắng, xanh lục ghép trên vữa | `S-SHD` voronoi màu + `T-NRM` | Rồng phượng bờ nóc Huế, Cổng Hiển Nhơn | `40` |
| `HV-J02` | **Pháp lam Huế (đồng tráng men)** | Men xanh-vàng-trắng trong khung đồng, hoa lá | `S-SHD` | Trụ biểu, ô cổ diêm | `40` |
| `HV-J03` | **Ngói lưu ly (hoàng / thanh)** | Men vàng hoặc xanh lục bóng, phản chiếu | `S-SHD` (`jadeRoof` / gold glaze) | Huế | `17`, `106` |
| `HV-J04` | **Sơn son thếp vàng** | Nền đỏ son, viền & hoa văn vàng lá | material `crimsonLacquer` + `gold` | Mọi điện thờ | `110`, `106b` |
| `HV-J05` | **Sơn mài (tranh Bình Ngô Đại Cáo, phong cảnh)** | Lớp vàng bạc, trứng, đỏ đen, bóng sâu | `T-ATLAS('lacquer_mural')` | Dinh Độc Lập | `119` |
| `HV-J06` | **Gốm men Biên Hòa (xanh đồng trổ)** | Phù điêu men xanh lam-lục, vàng đất | `G-DISP` + `S-SHD` | 4 cửa Chợ Bến Thành | `59` |
| `HV-J07` | **Khảm xà cừ** | Mảnh xà cừ óng ánh trên nền gỗ đen: hoa, chim, chữ | `T-ATLAS` + roughness thấp | Nhà cổ Tấn Ký | `114` |

## 10b. Nhóm K — 40 Hoa Văn Đặc Thù 3 Miền (Chuẩn Hóa Từ Plan Phân Rã)

### Miền Bắc (`HV-NEW-MB-01` → `HV-NEW-MB-12`)
| Mã | Tên hoa văn | KT | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---:|---|---|
| `HV-NEW-MB-01` | **Tứ phượng giao đầu đỉnh trụ biểu** | `G-EXT`+`G-TUBE` | 680 | `plasterParts` · `createPhoenixFinialParts('quad_pillar')` | `01`, `69` |
| `HV-NEW-MB-02` | **Đá ong lỗ rỗ xứ Đoài (Laterite)** | `T-NRM`+`S-SHD` | 0 | `lateriteHoneycomb` | `13`, `69` |
| `HV-NEW-MB-03` | **Gạch Bát Tràng lát xương cá / gạch vồ cổ** | `T-NRM`+`S-SHD` | 0 | `batTrangFloor` | `01`, `71`, `123` |
| `HV-NEW-MB-04` | **Đầu rồng / đầu phượng đất nung Lý–Trần** | `G-EXT`+`G-DISP` | 540 | `roofParts` · `createPhoenixFinialParts` | `04`, `39` |
| `HV-NEW-MB-05` | **Đấu củng chồng rường & kẻ truyền Bắc Bộ** | `G-EXT`+`G-INST` | 160 | `woodParts` · `createTimberBracketSetParts` | `02`, `50`, `116` |
| `HV-NEW-MB-06` | **Khau Cút (sừng gỗ đầu hồi nhà sàn Thái)** | `G-EXT`+`G-TUBE` | 240 | `woodParts` · `createKhauCutGableParts` | `77` |
| `HV-NEW-MB-07` | **Thổ cẩm Tây Bắc (H'Mông — Thái — Lô Lô)** | `T-ATLAS`+`T-NRM` | 0 | `brocade` atlas | `05`, `77` |
| `HV-NEW-MB-08` | **Nhũ đá, măng đá & đá tai mèo Karst** | `G-LATHE`+`G-DISP` | 140 | `stoneParts` | `06`, `11`, `80` |
| `HV-NEW-MB-09` | **Tôn thép lượn sóng & kết cấu quân sự D67/De Castries** | `G-DISP`+`G-INST` | 90 | `metalParts`/`steelParts` | `14`, `81`, `117` |
| `HV-NEW-MB-10` | **Phù điêu lịch sử đúc đồng / đá xanh hiện đại** | `G-DISP` | 620 | `bronzeParts` · `createBasReliefPanelParts('lich_su')` | `14`, `65`, `81` |
| `HV-NEW-MB-11` | **Buồm cánh dơi nan tre & thân thuyền cổ Bắc Bộ** | `G-EXT`+`G-TUBE` | 280 | `woodParts` | `15`, `68`, `80`, `107` |
| `HV-NEW-MB-12` | **Đèn đá sân vườn cổ 4 mặt chạm mây** | `G-LATHE`+`G-EXT` | 360 | `stoneParts` · `createAncientStoneLanternParts` | `10`, `63`, `79` |

### Miền Trung & Tây Nguyên (`HV-NEW-MT-01` → `HV-NEW-MT-16`)
| Mã | Tên hoa văn | KT | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---:|---|---|
| `HV-NEW-MT-01` | **Đèn lồng lụa Hội An (khung tre bọc gấm)** | `G-LATHE`+`G-INST` | 180 | `createRibbedLanternShellGeometry` | `20`, `44`, `84` |
| `HV-NEW-MT-02` | **Ngói âm dương & giọt nước đầu mái Miền Trung** | `G-INST` | 32 | `roofParts` | `19`, `84` |
| `HV-NEW-MT-03` | **Vỏ thép CNC khoét lỗ hoa văn Cầu Vàng** | `G-EXT`+`G-INST` | 160 | `goldParts` | `48`, `85` |
| `HV-NEW-MT-04` | **Gờ đá vôi canxit, hồ nhũ Gour Pools & vết nứt bàn tay** | `G-DISP`+`T-NRM` | 420 | `stoneParts` | `22`, `23`, `48`, `58` |
| `HV-NEW-MT-05` | **Văn khắc Chăm cổ & chữ Phạn (Bia ký / Hang Bi Ký)** | `T-NRM`+`T-ATLAS` | 0 | `stoneParts` | `41`, `86`, `92` |
| `HV-NEW-MT-06` | **Tượng Hộ Pháp Dvarapala Chăm Pa** | `G-DISP`+`G-LATHE` | 1 100 | `createGuardianBeastParts('dvarapala')` | `41`, `86` |
| `HV-NEW-MT-07` | **Bờ nóc mái hình thuyền yên ngựa Chăm (Kosa B5)** | `G-EXT`+`G-TUBE` | 540 | `createBoatSaddleRoofGeometry` | `86`, `86b` |
| `HV-NEW-MT-08` | **Nhạc cụ lễ hội Katê Chăm (Paranưng, Ghi-năng, Saranai)** | `G-LATHE`+`G-TUBE` | 240 | `woodParts`+`bronzeParts` | `25`, `87` |
| `HV-NEW-MT-09` | **Khung kính đa giác Diagrid hình hoa Đà Lạt** | `G-INST`+`S-SHD` | 48 | `roofParts`+`goldParts` | `26`, `89` |
| `HV-NEW-MT-10` | **Họa tiết Art Deco hình học 3 chóp Đà Lạt 1930s** | `G-EXT` | 140 | `plasterParts`/`whiteParts` | `26`, `89` |
| `HV-NEW-MT-11` | **Ché rượu cần Tây Nguyên men da lươn đắp nổi** | `G-LATHE`+`G-DISP` | 320 | `chamBrick`/`urnParts` | `42`, `90`, `122` |
| `HV-NEW-MT-12` | **Cây nêu lễ hội Tây Nguyên (tua tre & chim Pơ-lang)** | `G-TUBE`+`G-EXT` | 680 | `woodParts`+`crimsonParts` | `90`, `122` |
| `HV-NEW-MT-13` | **Trống Hơgơr (da trâu) & Đàn T'rưng Tây Nguyên** | `G-LATHE`+`G-INST` | 360 | `woodParts` | `91`, `122` |
| `HV-NEW-MT-14` | **Nhang vòng xoắn ốc & Mô hình Thuyền buồm Hội Quán** | `G-TUBE`+`G-EXT` | 280 | `goldParts`+`woodParts` | `115` |
| `HV-NEW-MT-15` | **Bộ Bát Bửu cung đình & Tán lọng nghi trượng triều Nguyễn** | `G-EXT`+`G-LATHE` | 320 | `goldParts`+`crimsonParts` | `40`, `53`, `106b` |
| `HV-NEW-MT-16` | **Họa tiết đúc đồng Súng Thần Công triều Nguyễn** | `G-LATHE`+`G-TUBE` | 620 | `bronzeParts` | `17`, `18` |

### Miền Nam & Hải Đảo (`HV-NEW-MN-01` → `HV-NEW-MN-12`)
| Mã | Tên hoa văn | KT | Tri L0 | Bucket / Helper | Ảnh ref |
|---|---|---|---:|---|---|
| `HV-NEW-MN-01` | **Mắt thuyền Nam Bộ (nhãn thuyền sông / biển)** | `T-ATLAS`+`G-EXT` | 90 | `crimsonParts`/`woodParts` | `33`, `64`, `99`, `103` |
| `HV-NEW-MN-02` | **Thánh giá Roman-Gothic & hoa móc chóp thép** | `G-EXT`+`G-TUBE` | 420 | `bronzeParts`/`goldParts` | `30`, `61`, `120` |
| `HV-NEW-MN-03` | **Phù điêu 14 Chặng Đàng Thánh Giá & Tượng Công giáo** | `G-DISP`+`G-EXT` | 380 | `goldParts`/`marbleParts` | `30`, `61`, `120` |
| `HV-NEW-MN-04` | **Gạch trần Marseille & vòm gạch voussoir** | `T-NRM`+`G-EXT` | 160 | `marseilleBrick` | `30`, `61`, `120` |
| `HV-NEW-MN-05` | **Tượng Nữ thần Po Nagar / Shiva Chăm Kauthara** | `G-DISP`+`G-LATHE` | 1 600 | `createSculptedDeityParts('ponagar')` | `32`, `66` |
| `HV-NEW-MN-06` | **Gốm Bàu Trúc Chăm khắc vạch sóng nước** | `G-LATHE`+`T-NRM` | 180 | `chamBrick` | `32`, `98` |
| `HV-NEW-MN-07` | **Bia ký chữ Phạn & Chăm cổ Kauthara** | `G-EXT`+`T-NRM` | 220 | `stoneParts` | `32`, `66`, `98` |
| `HV-NEW-MN-08` | **Bộ nhạc cụ Chăm Kauthara (Ginăng, Paranưng, Saranai)** | `G-LATHE`+`G-TUBE` | 240 | `woodParts`/`bronzeParts` | `32`, `98` |
| `HV-NEW-MN-09` | **Trần ô cờ & bông gió chữ Cát/Khẩu/Hưng (Ngô Viết Thụ)** | `G-EXT`+`G-INST` | 64 | `whiteParts` | `28`, `60`, `118`, `119` |
| `HV-NEW-MN-10` | **Vì kèo thép đinh tán & cột gang khía 12 rãnh (Chợ Bến Thành)** | `G-INST`+`G-LATHE` | 320 | `ironParts` | `29`, `93` |
| `HV-NEW-MN-11` | **Họa tiết buộc mây, nút lạt & lan can tre quả trám Nam Bộ** | `G-INST`+`T-NRM` | 80 | `woodParts` | `31`, `33`, `34`, `100` |
| `HV-NEW-MN-12` | **Ngôi sao 5 cánh đắp nổi & ký hiệu quân sự — di tích** | `G-EXT`+`T-ATLAS` | 120 | `goldParts`/`ironParts` | `28`, `31`, `95`, `96`, `104` |

---

## 11. Quy Trình QC Hoa Văn (Motif QC)

1. **Gắn tag** `userData.motifIds` cho mọi mesh chứa hoa văn (bảo toàn qua `mergeNormalized` bằng cách gắn trên mesh merge).
2. **Mở rộng `MultiAngleQcAgent`**:
   - `motifCoverage`: số `HV-*` riêng biệt trong group ≥ ngưỡng (Văn Miếu ≥ 14, Đại Nội Huế ≥ 18, Mỹ Sơn ≥ 9, Nhà Thờ Đức Bà ≥ 8…).
   - `requiredMotifs`: danh sách `HV-*` bắt buộc theo từng component (từ 3 file `MOTIF_PLAN_*`) — thiếu một mã → fail.
   - `motifDepthCheck`: với `G-*`, độ lồi/lõm (bounding depth) của module ≥ `1cm` (L0) — tránh hoa văn "dán phẳng".
3. **Chụp QC 10 góc** (8 phương + top + low-hero) cho mỗi component, đặt cạnh ảnh ref tương ứng trong báo cáo.
4. **Ngân sách**: `tri L0 × số lượng` mỗi component cộng dồn vào bảng tổng; vượt ngân sách vùng → hạ xuống `T-NRM`.

## 12. Thứ Tự Triển Khai Helper Mới

| Ưu tiên | Helper mới / mở rộng | Phục vụ mã |
|---|---|---|
| P0 | `createMotifBandParts(kind: 'hoi_van'\|'cuc_day'\|'song_nuoc'\|'day_la_cham', path, height)` — quét băng hoa văn theo đường | `HV-D01`, `C07`, `D06`, `C10` |
| P0 | `createShouCharacterParts(kind:'tron'\|'dai')`, `createSwastikaLatticeParts` | `HV-D02`, `D03`, `D04` |
| P0 | `createLotusPetalRingParts(petals, tiers, r)` (InstancedMesh) | `HV-C01`, `C02`, `C04` |
| P1 | `createPhoenixParts(pose)` | `HV-B01`, `B02` |
| P1 | `createCuaVongParts(width, height, motif:'long_phung'\|'hoa_la')` | `HV-D12`, `A05` |
| P1 | `createBasReliefPanelParts(heightmapFn, w, h, segs)` | `HV-E05`, `F06`, `F07`, `C08` |
| P1 | `createSunWindowParts`, `createDoorStudGridParts` | `HV-D11`, `D14` |
| P2 | `createMosaicShardMaterial` (shader khảm sành sứ / pháp lam) | `HV-J01`, `J02` |
| P2 | `createLouverShutterParts`, `createCorniceSweepParts` | `HV-H04`, `H05` |
| P2 | Bake `T-NRM` atlas: thổ cẩm, khắc bia, xà cừ, gạch bông | `HV-G01`, `I03`, `J07`, `H06`, `H07` |
