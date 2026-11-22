# Kế Hoạch Phân Rã Hoa Văn — Khu Vực Miền Bắc (`MB-001` → `MB-100`)

> **Phạm vi**: Phân rã chi tiết hoa văn 3D, kỹ thuật dựng (`G-*`, `T-*`, `S-SHD`), kích thước, ngân sách tam giác L0, material bucket và tiêu chí QC cho toàn bộ **100 component** thuộc **Khu vực 1 — Miền Bắc** (9 cụm di sản).
> **Tài liệu chuẩn hóa**:
> - Thư viện mã hoa văn: [MOTIF_LIBRARY_HOA_VAN.md](MOTIF_LIBRARY_HOA_VAN.md) (`HV-A01` → `HV-J07`)
> - Danh sách component gốc: [MASTER_300_COMPONENTS_DETAIL_LIST.md](MASTER_300_COMPONENTS_DETAIL_LIST.md) (`MB-001` → `MB-100`)
>
> **Quy ước bổ sung cho Nhóm I & J** (nhất quán với ngân sách tam giác mục 0.3 của Thư viện): `HV-I01` (hoành phi kèm khung `G-EXT` chạm viền) = `120 tri/tấm`; `HV-I02` (câu đối kèm khung cong/phẳng `G-EXT`) = `60 tri/tấm` (`120 tri/cặp`); `HV-I03` (bia khắc chìm `T-NRM`) = `0 tri`; `HV-I04` (biển hiệu `T-ATLAS`) = `0 tri` (hoặc `40 tri` nếu có khung/chữ nổi kim loại `G-EXT`); `HV-J04`/`HV-J05`/`HV-J07` (vật liệu/atlas) = `0 tri`. Với ngói `HV-D15`, L0 dựng hình học thật cho **hàng ngói câu đầu / trích thủy viền diềm mái** (`SL` = số viên mặt tiền/diềm lộ thiên), phần mái dốc bên trong dùng `T-NRM` để giữ ngân sách vùng `< 1,000,000 tri`.

---

## Bảng Tóm Tắt Theo Cụm Di Sản — Miền Bắc

| STT | Cụm di sản | Phạm vi mã | Số component | Số mã HV riêng biệt | Tổng tri L0 ước tính |
|---:|---|---|---:|---:|---:|
| 1.1 | Văn Miếu — Quốc Tử Giám | `MB-001` → `MB-012` | 12 | 33 | 142 128 |
| 1.2 | Chùa Một Cột & Hồ Hoàn Kiếm — Đền Ngọc Sơn | `MB-013` → `MB-022` | 10 | 30 | 58 306 |
| 1.3 | Hoàng Thành Thăng Long & Thành Cổ Hà Nội | `MB-023` → `MB-036` | 14 | 27 | 89 980 |
| 1.4 | Fansipan — Sa Pa & Lũng Cú — Hà Giang | `MB-037` → `MB-048` | 12 | 28 | 66 146 |
| 1.5 | Vịnh Hạ Long & Thủy Chiến Bạch Đằng | `MB-049` → `MB-060` | 12 | 18 | 48 640 |
| 1.6 | Mù Cang Chải & Chùa Hương | `MB-061` → `MB-072` | 12 | 27 | 47 936 |
| 1.7 | Khu Di Tích Đền Hùng — Phú Thọ | `MB-073` → `MB-080` | 8 | 26 | 53 178 |
| 1.8 | Tràng An & Tam Cốc — Bích Động | `MB-081` → `MB-090` | 10 | 22 | 75 432 |
| 1.9 | Làng Cổ Đường Lâm & Điện Biên Phủ | `MB-091` → `MB-100` | 10 | 27 | 41 408 |
| — | **TỔNG KHU VỰC MIỀN BẮC** | **`MB-001` → `MB-100`** | **100** | **67** *(55 thư viện + 12 đề xuất)* | **623 154** |

---

## 1.1. Văn Miếu — Quốc Tử Giám (`01`, `47`, `49`, `71`, `110`)

#### `MB-001` — Văn Miếu Môn (Tứ Trụ Nghi Môn) (ảnh ref: `01`, `49`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đỉnh 2 trụ biểu giữa | `HV-NEW-MB-01` | 2 cụm tứ phượng giao đầu đắp vữa cổ, mỗi cụm 4 chim phượng đứng 4 mặt hướng vào trục trụ, cánh xòe 3 lớp, độ nổi 5 cm | `G-EXT` + `G-TUBE` | `0.85×0.85×0.9m` | 2 | 1 360 | `plasterParts` |
| Đỉnh 2 trụ biểu ngoài | `HV-B04` | 2 tượng Nghê đá xanh ngồi chầu quay mặt về trục Thần Đạo, bờm xoáy ốc 3 lọn, mõm rộng nhe nanh, chạm nổi sâu 6 cm | `G-*` tổ hợp | Cao `0.85m` | 2 | 2 200 | `stoneParts` |
| Trán vòm cổng chính tầng 2 | `HV-I01` | Bức đại tự đắp nổi 3 chữ Hán `"文廟門"` (Văn Miếu Môn) đọc từ phải sang trái trong khung chữ nhật viền gờ nổi 3 cm | `T-ATLAS` + `G-EXT` | `2.2×0.8m` | 1 | 120 | `plasterParts` |
| Thân 4 trụ biểu (ô lồng đèn & câu đối) | `HV-I02` | 4 mặt câu đối Hán văn ca ngợi đạo Nho đắp vữa khung giật cấp, nét chữ nổi 1.5 cm trên nền vôi vàng cổ | `T-ATLAS` + `G-EXT` | `0.32×2.6m` | 4 | 240 | `plasterParts` |
| Mái cổng 2 tầng & diềm mái | `HV-D15` | 48 viên ngói mũi hài và ngói câu đầu chạm hoa thị viền diềm tầng trên — dưới, nhô giọt nước sâu 2.5 cm | `G-INST` | `0.12×0.4m` | 48 | 1 920 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-01, HV-B04, HV-I01, HV-I02, HV-D15` | — | — | — | **5 840** | — |

**LOD/ghi chú QC:** L0 giữ nguyên cụm tứ phượng, 2 Nghê đá và hàng ngói câu đầu; L1 gộp câu đối/đại tự sang `T-NRM` và giản lược Nghê còn 40% tri. QC kiểm tra đúng 3 chữ `"文廟門"`, 2 Nghê 2 trụ ngoài + 2 tứ phượng 2 trụ trong, độ nổi ≥ 1.5 cm.

#### `MB-002` — Cổng Đại Trung Môn (ảnh ref: `01`, `71`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc giữa mái tầng trên | `HV-A04` | Đôi rồng đắp vữa cổ chầu quả cầu mặt nguyệt hướng tâm, phong cách Lê Trung Hưng–Nguyễn (không khảm sứ Huế), sâu 6 cm | `G-TUBE` + `G-LATHE` | Dài `2.4m`/rồng | 1 | 2 800 | `roofParts` |
| 4 góc mái tầng trên & dưới | `HV-A06` | 8 đầu đao mái uốn cong vút 35°, đắp vữa hình đầu rồng hóa mây lửa hướng ra 4 góc, độ nổi 4 cm | `G-TUBE` + `G-EXT` | `0.9m`/đao | 8 | 5 200 | `roofParts` |
| Trán cổng gian giữa | `HV-I01` | Biển hoành phi 3 chữ Hán `"大中門"` (Đại Trung Môn) nền đỏ son chữ vàng khung chạm gờ triện sâu 2 cm | `T-ATLAS` + `G-EXT` | `1.8×0.65m` | 1 | 120 | `goldParts` |
| Diềm mái 3 gian trước — sau | `HV-D15` | 56 viên ngói mũi hài cánh vảy mặt tiền và mặt hậu, xếp đều mép tàu mái, vát cạnh nổi 2 cm | `G-INST` | `0.12×0.38m` | 56 | 2 240 | `roofParts` |
| Bệ đá thanh & bậc tam cấp | `HV-D01` | Băng hồi văn chữ "Công" liên hoàn chạy dọc thành bậc đá xanh rêu phong, khắc chìm 1.5 cm | `G-EXT` | Dài `8m`, cao `10cm` | 8 | 480 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A04, HV-A06, HV-I01, HV-D15, HV-D01` | — | — | — | **10 840** | — |

**LOD/ghi chú QC:** L0 giữ bờ nóc lưỡng long, 8 đầu đao và hoành phi; L1 chuyển băng hồi văn bệ đá và ngói mũi hài sang `T-NRM`. QC bắt buộc chữ `"大中門"` rõ nét, 8 đầu đao cân đối 2 tầng mái.

#### `MB-003` — Đế gạch & 4 trụ tầng 1 Khuê Văn Các (ảnh ref: `01`, `49`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 16 mặt ô hộc thân 4 trụ gạch | `HV-D02` | 16 ô chữ Thọ tròn (團壽) đối xứng đắp nổi trong khung vuông giật cấp trên 4 mặt của 4 trụ gạch (`85×85cm`), nổi 2.5 cm | `G-EXT` | Ø `0.36m` | 16 | 2 240 | `plasterParts` |
| Viền cổ trụ & gờ giật cấp | `HV-D01` | 16 m băng hồi văn chữ "Công" chạy quanh cổ 4 trụ gạch phía dưới dầm đỡ tầng 2, khắc sâu 1.5 cm | `G-EXT` | Băng cao `8cm` | 16 | 960 | `plasterParts` |
| Chân đế 4 trụ bó đá xanh | `HV-D06` | 12 m băng sóng nước thủy ba 2 lớp chạm quanh bệ đá xanh chân 4 trụ (mỗi trụ 3 m chu vi), chạm sâu 2 cm | `G-EXT` | Băng cao `12cm` | 12 | 1 080 | `stoneParts` |
| Mặt nền sân quanh đế | `HV-NEW-MB-03` | Gạch Bát Tràng đỏ trầm lát thẳng kẽ rêu phong quanh nền vuông `6.8×6.8m` cao 3 bậc đá thanh | `T-NRM` + `S-SHD` | Viên `0.3×0.3m` | 1 | 0 | `brickParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D02, HV-D01, HV-D06, HV-NEW-MB-03` | — | — | — | **4 280** | — |

**LOD/ghi chú QC:** L0 giữ 16 ô chữ Thọ tròn nổi `2.5 cm` và gờ đá xanh chân trụ; L1 hạ hồi văn và sóng nước xuống `T-NRM`. QC xác nhận đủ 4 trụ × 4 mặt = 16 ô chữ Thọ, tỷ lệ trụ `85×85cm` bám đúng ảnh `01`, `49`.

#### `MB-004` — 4 Cửa sổ Mặt Trời Khuê Văn Các (ảnh ref: `01`, `49`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 cửa sổ tròn 4 mặt gác | `HV-D11` | 4 khung tròn gỗ lim sơn son 2 vòng đồng tâm, mỗi cửa 8 thanh gỗ tiện tỏa tia nắng ra ngoài (biểu tượng sao Khuê), sâu 8 cm | `G-TUBE` + `G-INST` | Ø `1.25m` | 4 | 1 280 | `crimsonParts` |
| Lan can gỗ chạy quanh 4 mặt gác | `HV-D10` | 64 con tiện gỗ tiện tròn 3 bầu 2 eo sơn son xếp đều 4 cạnh hành lang tầng 2 (16 con/mặt), đứng kín giữa tay vịn | `G-LATHE` + `G-INST` | Cao `0.55m` | 64 | 3 584 | `crimsonParts` |
| 4 góc khung vuông bao cửa sổ | `HV-D05` | 16 cụm mây xoắn 3 vòng sơn son thếp vàng gắn tại 4 góc vuông quanh mỗi khung tròn mặt trời, độ nổi 2.5 cm | `G-EXT` | `0.22×0.22m` | 16 | 1 920 | `goldParts` |
| Biển tên & bề mặt gỗ tầng 2 | `HV-I01` | Hoành phi 3 chữ Hán `"奎文閣"` (Khuê Văn Các) thếp vàng gắn trên mặt Nam phía trên cửa sổ mặt trời, viền nổi 2 cm | `T-ATLAS` + `G-EXT` | `1.3×0.5m` | 1 | 120 | `goldParts` |
| Toàn bộ kết cấu gỗ sơn son | `HV-J04` | Vật liệu sơn son thếp vàng cổ (đỏ son trầm, gờ viền vàng lá) phủ khung cửa, vách gỗ và con tiện | Material | Toàn tầng 2 | 1 | 0 | `crimsonParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D11, HV-D10, HV-D05, HV-I01, HV-J04` | — | — | — | **6 904** | — |

**LOD/ghi chú QC:** L0 giữ đủ 4 cửa sổ 8 tia và 64 con tiện gỗ thật; L1 thay hàng con tiện bằng alpha-card + `T-NRM`, giữ khung tròn `HV-D11`. QC kiểm tra đúng 8 tia/cửa sổ (sai số 0), mặt Nam có chữ `"奎文閣"`.

#### `MB-005` — Hệ mái chồng diêm 8 mái Khuê Văn Các (ảnh ref: `01`, `49`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc đỉnh tầng mái trên | `HV-A04` | Đôi rồng đắp vữa cổ phong cách đầu Nguyễn (1805) chầu mặt nhật bốc lửa ở giữa, thân uốn 5 khúc ngắn, nổi 6 cm | `G-TUBE` + `G-LATHE` | Dài `2.0m`/rồng | 1 | 2 800 | `roofParts` |
| 8 góc mái (4 tầng trên + 4 tầng dưới) | `HV-A06` | 8 đầu đao rồng cuốn vút cong 40° sơn/đắp vữa màu xám-đỏ cổ, bờm lửa uốn cuộn, chạm sâu 4 cm | `G-TUBE` + `G-EXT` | Dài `0.95m` | 8 | 5 200 | `roofParts` |
| Bờ chảy 4 góc tầng mái | `HV-D05` | 8 dải mây xoắn đắp vữa nối từ bờ nóc xuống đầu đao theo sống mái chồng diêm, nổi 3 cm | `G-EXT` | `0.6×0.18m` | 8 | 960 | `roofParts` |
| Diềm mái 8 cạnh trên — dưới | `HV-D15` | 80 viên ngói ống trích thủy đầu câu đầu chạm hoa thị chạy viền 4 cạnh mái trên (32 viên) và 4 cạnh mái dưới (48 viên) | `G-INST` | `0.12×0.36m` | 80 | 3 200 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A04, HV-A06, HV-D05, HV-D15` | — | — | — | **12 160** | — |

**LOD/ghi chú QC:** L0 giữ bờ nóc lưỡng long, 8 đầu đao và 80 viên câu đầu; L1 tắt ngói câu đầu chuyển sang `T-NRM` diềm mái. QC kiểm tra đủ 2 tầng 8 mái chồng diêm, đầu đao không cắt xuyên khung gỗ `MB-004`.

#### `MB-006` — Nội thất Gác 2 Khuê Văn Các (ảnh ref: `49`, `110`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Chuông đồng treo giữa trần gác | `HV-E06` | Đại Hồng Chung đồng cổ đúc thời Gia Long (1805), quai 2 rồng bồ lao chung lưng, thân 4 ô khắc chữ Hán, 4 núm hoa sen nổi 2.5 cm | `G-LATHE` + `G-TUBE` | Cao `1.2m`, Ø `0.7m` | 1 | 1 400 | `bronzeParts` |
| Giá gỗ treo chuông & đầu xà | `HV-A07` | 2 đầu xà giá gỗ lim chạm đầu rồng ngậm ngọc hướng ra hai bên, chạm sâu 4 cm sơn son thếp vàng | `G-EXT` | `0.55×0.25m` | 2 | 760 | `goldParts` |
| 4 câu đối treo 4 cột gỗ trong gác | `HV-I02` | 2 đôi (4 tấm) câu đối gỗ phẳng nền son chữ Hán thếp vàng ca ngợi sao Khuê và văn hiến Thăng Long, viền nổi 1.5 cm | `T-ATLAS` + `G-EXT` | `0.26×1.9m` | 4 | 240 | `goldParts` |
| Mặt trống cái & đai thân trống | `HV-D05` | 4 cụm mây xoắn vẽ vàng/chạm nổi quanh tang trống gỗ sơn đỏ đặt trên giá gỗ lim cạnh góc Bắc | `G-EXT` | `0.25×0.15m` | 4 | 480 | `crimsonParts` |
| **Tổng** | — | `requiredMotifs`: `HV-E06, HV-A07, HV-I02, HV-D05` | — | — | — | **2 880** | — |

**LOD/ghi chú QC:** L0 giữ hình học chuông đồng và 2 đầu rồng giá treo; L1 chuyển câu đối và mây tang trống sang `T-NRM` và ẩn toàn bộ nội thất khi camera `> 40m`. QC kiểm tra độ sâu chạm chuông ≥ 2 cm.

#### `MB-007` — Hồ vuông Giếng Thiên Quang (`26×26m`) (ảnh ref: `71`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tường lan can gạch bao 4 cạnh hồ | `HV-C13` | 104 ô gạch gốm thông gió hoa chanh 4 cánh tròn đối xứng (26 ô/cạnh × 4 cạnh), đục thủng sâu 12 cm dày tường | `G-EXT` + `G-INST` | Ô `0.24×0.24m` | 104 | 3 744 | `plasterParts` |
| Đỉnh 4 trụ góc lan can hồ | `HV-C03` | 4 búp sen vữa cổ 3 lớp cánh khép đặt trên 4 trụ vuông góc tường bao hồ, nổi 3 cm | `G-LATHE` | Cao `0.42m` | 4 | 720 | `plasterParts` |
| Gờ đá xanh bó bờ hồ | `HV-D01` | 16 m băng hồi văn đơn giản khắc viền đá xanh 4 đoạn góc lối xuống mặt hồ, sâu 1.2 cm | `G-EXT` | Băng cao `10cm` | 16 | 960 | `stoneParts` |
| Đường dạo lát gạch quanh hồ | `HV-NEW-MB-03` | Gạch Bát Tràng đỏ trầm lát mạch chữ Công quanh hành lang rộng 3 m viền Giếng Thiên Quang | `T-NRM` + `S-SHD` | Viên `0.3×0.3m` | 1 | 0 | `brickParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C13, HV-C03, HV-D01, HV-NEW-MB-03` | — | — | — | **5 424** | — |

**LOD/ghi chú QC:** L0 giữ 104 ô hoa chanh đục thủng nhìn xuyên xuống mặt hồ phản chiếu; L1 thay mảng ô hoa chanh bằng alpha-cutout + `T-NRM`. QC xác nhận kích thước hồ `26×26m`, ô hoa chanh xuyên sáng đúng ảnh `71`.

#### `MB-008` — 2 Nhà Bia Tiến Sĩ mở rộng (ảnh ref: `47`, `71`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 32 Rùa đá đội bia (2 nhà × 16 bia) | `HV-B05` | 32 tượng Rùa đá xanh (16 bia/nhà bia Đông — Tây), mai lục giác phân 13 múi chính + viền, đầu vươn hướng ra sân giữa, 4 chân móng bấm đế, chạm sâu 5 cm | `G-DISP` + `G-INST` | Dài `1.45m` | 32 | 41 600 | `stoneParts` |
| Trán 32 bia đá (phong cách Lê Sơ–Lê Trung Hưng) | `HV-A05` | 32 phù điêu đôi rồng chầu mặt trời hóa mây (mỗi trán 1 cụm nổi 3.5 cm) theo phong cách bia khoa cử thế kỷ XV–XVIII | `G-EXT` + `G-INST` | `0.85×0.45m` | 32 | 13 440 | `stoneParts` |
| Diềm khung 32 thân bia | `HV-C07` | Băng hoa cúc dây 8 cánh xen lá chạy viền 2 bên mặt bia (1.2 m/bia × 32 bia, dùng module instance lặp) | `G-INST` (`G-TUBE`) | Băng rộng `10cm` | 38 | 5 320 | `stoneParts` |
| Mặt khắc chữ Hán 32 thân bia | `HV-I03` | Văn bia Tiến sĩ khắc chìm 4 mm (trích bia 1484: `"賢才國家之元氣"`), nhiều biến thể UV từ atlas bia Hán-Nôm | `T-NRM` | `0.95×1.45m` | 32 | 0 | `stoneParts` |
| Mái 2 Nhà Bia (8 góc đao) | `HV-A06` | 8 đầu đao rồng cuốn đắp vữa 4 góc × 2 nhà bia bảo vệ, uốn cong 35° | `G-TUBE` + `G-EXT` | Dài `0.85m` | 8 | 5 200 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-B05, HV-A05, HV-C07, HV-I03, HV-A06` | — | — | — | **65 560** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 32 Rùa đá, 32 trán bia và diềm cúc dây (chỉ 3 draw call); L1 giảm lưới mai rùa còn 45% và chuyển trán bia + diềm cúc sang `T-NRM`. QC bắt buộc đủ 32 bia đối xứng 2 nhà Đông–Tây, mai rùa phân múi lục giác rõ (ảnh `47`).

#### `MB-009` — Cổng Đại Thành Môn (ảnh ref: `71`, `110`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 bộ cửa bức bàn 3 gian (6 cánh) | `HV-D13` | 6 cánh cửa bức bàn gỗ lim sơn son mở rộng 90° vào Sân Bái Đường: ô trên chấn song tiện, ô giữa chạm Tứ Quý, ô dưới pano kín, sâu 2 cm | `G-EXT` + `T-NRM` | Cánh `0.85×2.3m` | 6 | 1 320 | `crimsonParts` |
| Chân 12 cột lim đỏ (2 hàng × 6 cột) | `HV-C02` | 12 chân tảng đá xanh tròn chạm 16 cánh sen úp nổi 2 cm, đế vuông vát cạnh cổ truyền Bắc Bộ | `G-LATHE` + `G-INST` | Ø `0.62m` | 12 | 3 840 | `stoneParts` |
| Hoành phi gian giữa mặt ngoài | `HV-I01` | Bảng ngang nền son chữ Hán thếp vàng `"大成門"` (Đại Thành Môn), khung gỗ chạm hồi văn sâu 2 cm | `T-ATLAS` + `G-EXT` | `2.0×0.72m` | 1 | 120 | `goldParts` |
| 4 đầu kẻ hiên gian giữa & 2 gian bên | `HV-C11` | 4 đầu kẻ gỗ lim chạm lá lật cuộn ngược mép răng cưa, sâu 3 cm sơn son | `G-EXT` | `0.45×0.22m` | 4 | 440 | `crimsonParts` |
| Diềm mái 3 gian trước — sau | `HV-D15` | 48 viên ngói mũi hài đầu tròn viền diềm mái cổ | `G-INST` | `0.12×0.38m` | 48 | 1 920 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D13, HV-C02, HV-I01, HV-C11, HV-D15` | — | — | — | **7 640** | — |

**LOD/ghi chú QC:** L0 giữ 12 chân tảng hoa sen 16 cánh và 6 cánh cửa bức bàn mở thông; L1 hạ chạm ô giữa cửa bức bàn và chân tảng sang `T-NRM`. QC xác nhận cửa mở thông lộ lối đi vào Điện Đại Thành, đúng chữ `"大成門"`.

#### `MB-010` — Nội thất Điện Đại Thành (ảnh ref: `110`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bức đại tự trung tâm gian chính | `HV-I01` | Hoành phi đại tự `"萬世師表"` (Vạn Thế Sư Biểu) nền son chữ Hán thếp vàng lớn nhất điện, khung viền chạm mây rồng nổi 3.5 cm | `T-ATLAS` + `G-EXT` | `3.6×1.1m` | 1 | 120 | `goldParts` |
| Cửa võng gian chính & 2 gian cạnh | `HV-D12` | 3 bộ cửa võng chạm lộng thủng nhiều lớp sơn son thếp vàng hình lưỡng long chầu mặt nguyệt xen hoa cúc, sâu 5 cm | `G-EXT` thủng | `3.2×1.0m` | 3 | 4 800 | `goldParts` |
| Khám thờ Khổng Tử & Chu Văn An | `HV-A05` | 4 trụ & mái khám thờ chạm lộng long hóa mây lá thếp vàng, độ sâu chạm lộng 4 cm | `G-EXT` | `0.85×0.35m` | 4 | 1 680 | `goldParts` |
| 6 đôi câu đối ôm 12 cột lim sơn son | `HV-I02` | 12 tấm câu đối lòng máng cong ôm sát 12 cột gỗ lim đỏ, chữ Hán thếp vàng tôn vinh đạo Nho, viền triện nổi 1.5 cm | `T-ATLAS` + `G-EXT` | `0.3×2.5m` | 12 | 720 | `goldParts` |
| Bề mặt 12 cột, khám thờ & hoành phi | `HV-J04` | Vật liệu sơn son thếp vàng cổ (độ bóng sơn ta 0.35, vàng lá metallic 0.85) phủ đồng bộ toàn gian thờ | Material | 12 cột + khám | 1 | 0 | `crimsonParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I01, HV-D12, HV-A05, HV-I02, HV-J04` | — | — | — | **7 320** | — |

**LOD/ghi chú QC:** L0 giữ 3 cửa võng chạm lộng thật và đại tự `"萬世師表"`; L1 chuyển cửa võng sang alpha-cutout + `T-NRM`, ẩn toàn bộ nội thất khi camera `> 45m`. QC kiểm tra đúng 4 chữ `"萬世師表"` ở trục giữa đúng ảnh `110`.

#### `MB-011` — 4 Bàn thờ Tứ Phối & Bộ Bát Bửu (ảnh ref: `110`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đôi hạc đồng chầu quy trước hương án | `HV-B06` | 2 tượng hạc đồng hun cổ đứng trên lưng rùa mai lục giác, cổ cong chữ S, mỏ ngậm cành sen quay vào trung tâm | `G-TUBE` + `G-LATHE` | Cao `1.85m` | 2 | 1 800 | `bronzeParts` |
| Bộ đỉnh đồng tam sự trên 4 hương án | `HV-E07` | 2 đỉnh đồng 3 chân thú 2 quai rồng, nắp đúc núm kỳ lân vờn cầu (1 lớn gian chính + 1 phụ), chạm nổi 2 cm | `G-LATHE` + `G-TUBE` | Cao `0.95m` | 2 | 1 800 | `bronzeParts` |
| Yếm hương án 4 bàn thờ Tứ Phối | `HV-C08` | 8 ô hộc chạm nổi Tứ Quý (Mai 5 cánh — Lan — Cúc — Trúc) trên mặt tiền 4 bàn thờ Nhan Hồi, Tăng Tử, Tử Tư, Mạnh Tử, sâu 2.5 cm | `G-DISP` | Ô `0.42×0.55m` | 8 | 2 080 | `goldParts` |
| Mâm ngũ quả & bình hoa cúc bàn thờ | `HV-C12` | 12 quả Đào — Lựu — Phật thủ sơn son thếp vàng bày trên 4 đĩa gỗ chạm, chi tiết cuống lá nổi 1.5 cm | `G-LATHE` | `8–12cm` | 12 | 720 | `goldParts` |
| Khung bài vị Tứ Phối & giá Bát Bửu | `HV-D07` | 4 khung ô triện góc lõm vuông sơn son thếp vàng bao bài vị Hán văn trên 4 hương án, nổi 1.5 cm | `G-EXT` | `0.35×0.75m` | 4 | 160 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-B06, HV-E07, HV-C08, HV-C12, HV-D07` | — | — | — | **6 560** | — |

**LOD/ghi chú QC:** L0 giữ đôi hạc đồng, đỉnh tam sự và 8 ô Tứ Quý; L1 chuyển ô Tứ Quý và đĩa tam đa sang `T-NRM`, ẩn ở L2. QC kiểm tra đôi hạc đồng đứng đối xứng hai bên hương án đúng ảnh `110`.

#### `MB-012` — Thái Học Viện & Lầu Chuông — Lầu Trống (ảnh ref: `01`, `110`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Lầu Chuông (phía Tây sân Thái Học) | `HV-E06` | Đại Hồng Chung đồng lớn treo giữa lầu 2 tầng mái, quai bồ lao đôi, 4 núm hoa sen gõ chuông và 4 mặt chữ Hán nổi 2 cm | `G-LATHE` + `G-TUBE` | Cao `2.1m` | 1 | 1 400 | `bronzeParts` |
| 8 góc mái Lầu Chuông & Lầu Trống | `HV-A06` | 8 đầu đao mái gỗ/vữa cong vút chạm đầu rồng cuốn mây (4 góc Lầu Chuông + 4 góc Lầu Trống) | `G-TUBE` + `G-EXT` | Dài `0.9m` | 8 | 5 200 | `roofParts` |
| Hoành phi Tiền Đường Thái Học | `HV-I01` | Bảng ngang chữ Hán thếp vàng `"國子監"` (Quốc Tử Giám) treo mặt tiền Tiền Đường, khung triện nổi 2.5 cm | `T-ATLAS` + `G-EXT` | `2.4×0.8m` | 1 | 120 | `goldParts` |
| Sân lát gạch Thái Học Viện | `HV-NEW-MB-03` | Sân rộng lát gạch Bát Tràng đỏ trầm kiểu xương cá xen rãnh thoát nước đá xanh | `T-NRM` + `S-SHD` | Viên `0.3×0.3m` | 1 | 0 | `brickParts` |
| Bảng giới thiệu di sản & chậu bonsai | `HV-I04` | Biển đồng/đá chữ Quốc ngữ + Anh `"VĂN MIẾU - QUỐC TỬ GIÁM (1070)"` đặt góc sân trước Tiền Đường | `T-ATLAS` | `1.2×0.8m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-E06, HV-A06, HV-I01, HV-NEW-MB-03, HV-I04` | — | — | — | **6 720** | — |

**LOD/ghi chú QC:** L0 giữ chuông đồng và 8 đầu đao mái; L1 giản lược đầu đao còn 40% tri. QC kiểm tra sân gạch lát đúng kiểu xương cá, Lầu Chuông — Lầu Trống đối xứng hai bên sân Thái Học.

---

## 1.2. Chùa Một Cột & Hồ Hoàn Kiếm — Đền Ngọc Sơn (`02`, `03`, `45`, `50`, `70`)

#### `MB-013` — Trụ đá 2 khối Chùa Một Cột (ảnh ref: `02`, `50`, `45`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Chân trụ đá ghép 2 khối (đáy hồ Linh Chiểu) | `HV-C02` | Vành đá xanh chạm 16 cánh sen úp phong cách thời Lý (1049) ôm quanh chân trụ `Ø1.2m` sát mực nước rêu xanh, sâu 2.5 cm | `G-LATHE` + `G-DISP` | Ø `1.45m` | 1 | 320 | `stoneParts` |
| Mạch ghép giữa 2 khối trụ đá | `HV-D06` | Vành sóng nước thủy ba nông 2 lớp chạm nhẹ quanh đai ghép 2 khối đá xanh, sâu 1.5 cm | `G-EXT` | Chu vi `3.8m` | 4 | 360 | `stoneParts` |
| Mặt hồ Linh Chiểu quanh trụ đá | `HV-C04` | 4 đóa hoa sen hồng 28 cánh nở nhiều lớp, nhị vàng gương sen nổi quanh chân trụ đá | `G-INST` + `G-LATHE` | Ø `0.32m` | 4 | 4 800 | `pinkParts` |
| Thảm lá sen nổi quanh chân trụ | `HV-C05` | 28 lá sen tròn peltate khum lòng chảo mép gợn sóng, gân lá tỏa tâm phủ đều mặt hồ Linh Chiểu | `G-DISP` + `G-INST` | Ø `0.55m` | 28 | 1 792 | `leafParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C02, HV-D06, HV-C04, HV-C05` | — | — | — | **7 272** | — |

**LOD/ghi chú QC:** L0 giữ rõ mạch ghép 2 khối trụ đá, vành sen chân nước và 4 bông sen 3D; L1 giữ lá sen instance và hạ hoa sen sang billboard 2 lớp. QC xác nhận trụ đá `Ø1.2m` đúng 2 khối ghép, hồ Linh Chiểu có hoa và lá sen thật (ảnh `02`, `45`).

#### `MB-014` — Hệ đấu củng & bệ sen gỗ Chùa Một Cột (ảnh ref: `02`, `50`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 12 thanh gỗ đấu củng vươn 4 phía | `HV-NEW-MB-05` | 12 thanh xà gỗ lim sơn nâu đỏ đầu vát cong xếp chéo chồng rường vươn từ đỉnh trụ đá nâng sàn vuông Liên Hoa Đài, sâu chạm 3 cm | `G-EXT` + `G-INST` | Dài `1.8m` | 12 | 1 920 | `woodParts` |
| Vành cánh sen gỗ ốp cổ đài | `HV-C01` | 24 cánh sen nhọn đầu có gân giữa xếp 2 tầng so le quanh cổ trụ đỡ đài, mép cánh cuộn nhẹ ra ngoài, sâu 2.5 cm | `G-INST` | Cánh `0.24×0.14m` | 24 | 1 152 | `woodParts` |
| Đầu 8 thanh kẻ góc | `HV-C11` | 8 đầu thanh kẻ gỗ chạm lá lật cuộn ngược kiểu Lý–Lê vươn đỡ 4 góc dầm sàn, nổi 2.5 cm | `G-EXT` | `0.32×0.16m` | 8 | 880 | `woodParts` |
| Viền diềm gỗ dưới sàn đài | `HV-D01` | 12 m băng hồi văn vuông chạy liên tục quanh 4 cạnh dầm bao đáy Liên Hoa Đài, khắc chìm 1.5 cm | `G-EXT` | Băng cao `8cm` | 12 | 720 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-05, HV-C01, HV-C11, HV-D01` | — | — | — | **4 672** | — |

**LOD/ghi chú QC:** L0 giữ nguyên 12 thanh đấu củng và 24 cánh sen gỗ; L1 gộp cánh sen và hồi văn thành `T-NRM` trên khối côn ngược. QC góc nhìn thấp (low-hero) phải thấy rõ hệ đấu củng 12 thanh nâng đài đúng ảnh `50`.

#### `MB-015` — Nội thất Liên Hoa Đài (ảnh ref: `02`, `50`, `121`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tòa sen dưới tượng Quan Âm | `HV-C01` | 32 cánh sen nhọn đầu sơn son thếp vàng xếp 2 tầng (16 cánh ngửa + 16 cánh úp) có gân nổi 1.8 cm | `G-INST` | Cánh `0.14×0.09m` | 32 | 1 536 | `goldParts` |
| Hào quang sau lưng tượng Quan Âm | `HV-C09` | Khung lá đề nhọn đuôi cao thếp vàng chạm gân tia lửa tỏa đều sau tượng Quan Âm nghìn mắt nghìn tay, sâu 2 cm | `G-EXT` | `0.95×1.45m` | 1 | 90 | `goldParts` |
| Cửa võng mặt tiền gian thờ | `HV-D12` | 1 bộ cửa võng chạm lộng thếp vàng hình rồng mây xen hoa sen treo trước khám thờ, sâu 4 cm | `G-EXT` thủng | `2.1×0.75m` | 1 | 1 600 | `goldParts` |
| Hoành phi trên mái hiên & bờ nóc đài | `HV-I01` | Biển gỗ sơn son thếp vàng 3 chữ Hán `"蓮花臺"` (Liên Hoa Đài) treo chính diện mặt Đông, viền chạm nổi 2 cm | `T-ATLAS` + `G-EXT` | `1.2×0.45m` | 1 | 120 | `goldParts` |
| 4 đầu đao mái cong Liên Hoa Đài | `HV-A06` | 4 đầu đao mái vút cong đắp vữa hình đầu rồng thời Lý–Nguyễn chầu ra 4 góc, kết hợp đôi rồng bờ nóc | `G-TUBE` + `G-EXT` | Dài `0.85m` | 4 | 2 600 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C01, HV-C09, HV-D12, HV-I01, HV-A06` | — | — | — | **5 946** | — |

**LOD/ghi chú QC:** L0 giữ 32 cánh sen, cửa võng chạm lộng và 4 đầu đao mái; L1 ẩn nội thất tượng/cửa võng khi `> 35m`, giữ 4 đầu đao và hoành phi `"蓮花臺"`. QC kiểm tra đủ 32 cánh tòa sen và chữ `"蓮花臺"`.

#### `MB-016` — Bậc thang gạch cổ 13 bậc & tường hoa (ảnh ref: `02`, `50`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 tường lan can gạch chạy dọc 13 bậc | `HV-D04` | 16 ô gạch thông gió chữ Vạn `卍` liên hoàn (8 ô mỗi bên tường hoa dọc cầu thang), đục thủng sâu 12 cm | `G-EXT` + `G-INST` | Ô `0.24×0.24m` | 16 | 640 | `plasterParts` |
| Đỉnh 2 trụ chân cầu thang bờ Đông | `HV-C03` | 2 búp sen vữa cổ 3 lớp cánh khép đặt trên 2 trụ vuông hai bên lối lên 13 bậc | `G-LATHE` | Cao `0.45m` | 2 | 360 | `plasterParts` |
| Đỉnh đồng đặt chân cầu thang bờ Đông | `HV-E07` | 1 đỉnh đồng lớn 3 chân thú 2 quai rồng chạm nổi, nắp núm kỳ lân phát khói hương hành hương | `G-LATHE` + `G-TUBE` | Cao `1.35m` | 1 | 900 | `bronzeParts` |
| Mặt 13 bậc gạch cổ & sân chân thang | `HV-NEW-MB-03` | Gạch Bát Tràng đỏ sẫm rêu phong xếp vỉa trên 13 bậc thang thẳng dẫn từ bờ Đông lên đài | `T-NRM` + `S-SHD` | Viên `0.3×0.3m` | 1 | 0 | `brickParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D04, HV-C03, HV-E07, HV-NEW-MB-03` | — | — | — | **1 900** | — |

**LOD/ghi chú QC:** L0 giữ đủ 16 ô chữ Vạn đục thủng và đỉnh đồng; L1 hạ chữ Vạn sang alpha-card + `T-NRM`. QC đếm đúng 13 bậc thang nối trực tiếp bờ Đông lên sàn Liên Hoa Đài.

#### `MB-017` — Cây Bồ Đề 1958 & Cổng Tam Quan Chùa Diên Hựu (ảnh ref: `02`, `50`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Trán cổng Tam Quan Chùa Diên Hựu | `HV-I01` | Hoành phi đắp nổi 3 chữ Hán `"延祐寺"` (Diên Hựu Tự) trên vòm lối giữa, khung gờ giật cấp sâu 2.5 cm | `T-ATLAS` + `G-EXT` | `1.9×0.65m` | 1 | 120 | `plasterParts` |
| 4 góc mái Tam Quan 2 tầng | `HV-A06` | 4 đầu đao rồng cuốn đắp vữa cổ cong 35° hướng ra 4 phía mái tầng trên | `G-TUBE` + `G-EXT` | Dài `0.8m` | 4 | 2 600 | `roofParts` |
| Viền bồn đá gốc Cây Bồ Đề 1958 | `HV-C01` | 16 cánh sen đá xanh ốp quanh thành bát giác bồn cây Bồ Đề Ấn Độ (tặng năm 1958), chạm nổi 2 cm | `G-INST` | Cánh `0.32×0.18m` | 16 | 768 | `stoneParts` |
| Diềm mái Tam Quan & bia kỷ niệm cây | `HV-D15` | 36 viên ngói mũi hài cánh vảy viền diềm mái mặt tiền Tam Quan | `G-INST` | `0.12×0.36m` | 36 | 1 440 | `roofParts` |
| Biển đá ghi sự tích Cây Bồ Đề 1958 | `HV-I04` | Bia đá granit chữ Quốc ngữ khắc trắng sự tích Tổng thống Ấn Độ tặng cành Bồ Đề năm 1958 | `T-ATLAS` | `0.8×0.55m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I01, HV-A06, HV-C01, HV-D15, HV-I04` | — | — | — | **4 928** | — |

**LOD/ghi chú QC:** L0 giữ 4 đầu đao, 16 cánh sen bồn cây và ngói viền; L1 chuyển cánh sen và ngói sang `T-NRM`. QC kiểm tra chữ `"延祐寺"` đúng Hán tự, rễ khí sinh Cây Bồ Đề buông chạm đất không lơ lửng.

#### `MB-018` — Tháp Rùa 3 tầng vòm nhọn Gothic (ảnh ref: `03`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 10 cửa vòm nhọn tầng 1 & tầng 2 | `HV-H02` | 10 khung cửa vòm cuốn nhọn Gothic mở thông xuyên sáng (mặt dài 3 cửa + mặt ngang 2 cửa × 2 tầng), vữa cổ rêu mốc, gờ sâu 6 cm | `G-EXT` | `0.9×2.2m` | 10 | 2 600 | `plasterParts` |
| Gờ phào phân 3 tầng & đỉnh mái | `HV-H04` | 32 m phào chỉ lồi lõm kiểu Pháp cổ (1886) chạy quanh diềm mái tầng 1, tầng 2, tầng 3 và cổ chóp đỉnh, nhô 8 cm | `G-EXT` quét | Cao `0.18m` | 32 | 1 280 | `plasterParts` |
| Ô cửa tròn tầng 3 (mặt Đông) | `HV-C14` | 1 ô thông gió tròn chạm hoa thị 8 cánh trên vách tầng 3 mặt hướng Đông (nơi đặt biển xưa), đục thủng 10 cm | `G-EXT` | Ø `0.48m` | 1 | 48 | `plasterParts` |
| 4 đầu đao tầng mái chóp (giao thoa Việt–Pháp) | `HV-D05` | 4 gờ mây xoắn cong nhẹ vút lên ở 4 góc mái tầng 3 và đỉnh bệ tròn đỡ chóp, nổi 3 cm | `G-EXT` | `0.45×0.2m` | 4 | 480 | `plasterParts` |
| Chân đế kè gạch cổ quanh đảo | `HV-D01` | 14 m gờ hồi văn nông & mạch gạch vồ rêu phong quanh chân tường tầng 1 | `G-EXT` | Cao `10cm` | 14 | 840 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H02, HV-H04, HV-C14, HV-D05, HV-D01` | — | — | — | **5 248** | — |

**LOD/ghi chú QC:** L0 giữ toàn bộ 10 vòm nhọn Gothic xuyên sáng (nhìn thông được mặt hồ phía sau) và phào phân tầng; L1 giản lược phào và hồi văn sang `T-NRM`. QC bắt buộc kiến trúc giao thoa Việt–Pháp 1886 đúng ảnh `03` (tuyệt đối không gắn rồng Huế hay ngói lưu ly).

#### `MB-019` — Cầu Thê Húc sơn son 15 nhịp (ảnh ref: `70`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 dãy lan can gỗ dọc 15 nhịp cầu | `HV-D10` | 90 con tiện gỗ tròn 3 bầu 2 eo sơn đỏ son xếp đều hai bên cầu cong hình con tôm (3 con/nhịp × 15 nhịp × 2 bên) | `G-LATHE` + `G-INST` | Cao `0.65m` | 90 | 5 040 | `crimsonParts` |
| Đầu 32 cột trụ lan can cầu | `HV-C03` | 32 đầu trụ tiện hình búp sen tròn sơn son nhô trên tay vịn cầu (16 đôi trụ), nổi 3 cm | `G-LATHE` + `G-INST` | Cao `0.18m` | 32 | 5 760 | `crimsonParts` |
| Biển tên đầu cầu phía bờ | `HV-I01` | Bảng gỗ nền son chữ Hán thếp vàng `"棲旭"` (Thê Húc) gắn chính giữa cổng đầu cầu phía Đông, khung nổi 2 cm | `T-ATLAS` + `G-EXT` | `1.1×0.48m` | 1 | 120 | `goldParts` |
| Toàn bộ thân cầu gỗ sơn son | `HV-J04` | Vật liệu gỗ sơn đỏ son tươi đặc trưng cầu Thê Húc, phản chiếu ấm lên mặt nước Hồ Hoàn Kiếm | Material | Dài `46m` | 1 | 0 | `crimsonParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D10, HV-C03, HV-I01, HV-J04` | — | — | — | **10 920** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 90 con tiện và 32 đầu trụ búp sen; L1 giảm segment con tiện từ 12 xuống 6 cạnh; L2 giữ dải cong đỏ son silhouette. QC xác nhận đúng 15 nhịp cong, 32 chân trụ gỗ, chữ `"棲旭"` đúng ảnh `70`.

#### `MB-020` — Tháp Bút 5 tầng đá xanh (ảnh ref: `03`, `70`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt trước thân tầng 3 Tháp Bút | `HV-I03` | 3 chữ Hán lớn khắc dọc chìm 3 cm từ trên xuống `"寫青天"` (Tả Thanh Thiên — Viết lên trời xanh) của Nguyễn Siêu (1865) | `T-NRM` | `0.7×3.4m` | 1 | 0 | `stoneParts` |
| Ngọn bút lông đá đỉnh tầng 5 | `HV-C03` | Chóp đá xanh hình ngòi bút lông vút thẳng lên trời (tạo hình từ biến thể búp sen khép nhọn có rãnh lông bút khắc dọc sâu 1.5 cm) | `G-LATHE` | Cao `2.2m` | 1 | 180 | `stoneParts` |
| 4 gờ phân cấp giữa 5 tầng tháp | `HV-D01` | 20 m băng hồi văn vuông khắc quanh 4 gờ đá xanh phân 5 tầng tháp vuông thu dần lên đỉnh, sâu 1.5 cm | `G-EXT` | Băng cao `12cm` | 20 | 1 200 | `stoneParts` |
| Chân bệ đá trên núi Độc Tôn | `HV-D05` | 4 cụm mây xoắn đá xanh chạm ở 4 góc bệ đá đặt trên gò đá xếp núi Độc Tôn, nổi 3 cm | `G-EXT` | `0.5×0.3m` | 4 | 480 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I03, HV-C03, HV-D01, HV-D05` | — | — | — | **1 860** | — |

**LOD/ghi chú QC:** L0 giữ 5 tầng giật cấp, đỉnh ngòi bút lông và hồi văn phân tầng; L1 chuyển hồi văn và mây góc sang `T-NRM`. QC bắt buộc chữ dọc `"寫青天"` đọc rõ từ góc cận cảnh mặt Tây–Nam, tổng 5 tầng đá xanh.

#### `MB-021` — Đài Nghiên & 3 con cóc đá đội nghiên mực (ảnh ref: `03`, `70`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 con cóc đá trên nóc cổng Nghi Môn | `HV-B07` | 3 tượng cóc đá xanh ngồi 4 chân chia góc 120° đội đáy nghiên mực, lưng nổi u sần, mắt lồi, chạm sâu 3 cm | `G-LATHE` + `G-DISP` | Cao `0.38m` | 3 | 780 | `stoneParts` |
| Thân nghiên mực đá hình nửa quả đào | `HV-I03` | Bài minh 64 chữ Hán của Thần Siêu khắc chìm 4 mm quanh thân nghiên đá xanh bổ đôi theo chiều dọc | `T-NRM` | `0.97×0.8m` | 1 | 0 | `stoneParts` |
| Viền miệng nghiên mực & bệ cổng | `HV-C07` | 3 m dây hoa cúc 8 cánh xen lá chạm vòng quanh viền đá đỡ 3 con cóc, sâu 1.5 cm | `G-TUBE` + `G-INST` | Băng cao `10cm` | 3 | 420 | `stoneParts` |
| 2 trụ cổng Nghi Môn (cổng vào Cầu Thê Húc) | `HV-I02` | 2 tấm câu đối chữ Hán đắp nổi 2 mặt trụ gạch cổ cổng Đài Nghiên (đối của Nguyễn Siêu), viền nổi 1.5 cm | `T-ATLAS` + `G-EXT` | `0.32×2.4m` | 2 | 120 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-B07, HV-I03, HV-C07, HV-I02` | — | — | — | **1 320** | — |

**LOD/ghi chú QC:** L0 giữ rõ 3 con cóc đá xanh đội nghiên mực nửa quả đào; L1 chuyển cúc dây và câu đối sang `T-NRM`. QC kiểm tra đúng 3 con cóc bố trí tam giác đều trên nóc cổng dẫn vào Cầu Thê Húc.

#### `MB-022` — Đền Ngọc Sơn & Trấn Ba Đình (ảnh ref: `70`, `110`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc Trấn Ba Đình (đình 2 tầng 8 mái) | `HV-A04` | Đôi rồng đắp vữa cổ thời Nguyễn (1865) chầu mặt trời trên nóc Trấn Ba Đình, nổi 5 cm | `G-TUBE` + `G-LATHE` | Dài `2.2m`/rồng | 1 | 2 800 | `roofParts` |
| 8 góc mái Trấn Ba Đình & 4 góc Đền Chính | `HV-A06` | 12 đầu đao rồng cuốn cong vút 38° (8 đầu đao Trấn Ba Đình + 4 đầu đao mặt tiền Đền Ngọc Sơn) | `G-TUBE` + `G-EXT` | Dài `0.9m` | 12 | 7 800 | `roofParts` |
| Hoành phi Trấn Ba Đình & Đền Ngọc Sơn | `HV-I01` | 2 bức đại tự thếp vàng: `"鎮波亭"` (Trấn Ba Đình) và `"玉山祠"` (Ngọc Sơn Từ), khung chạm nổi 2.5 cm | `T-ATLAS` + `G-EXT` | `1.8×0.65m` | 2 | 240 | `goldParts` |
| Nội thất thờ Hưng Đạo Đại Vương | `HV-D12` | 1 bộ cửa võng chạm lộng thếp vàng rồng mây kết hợp đôi hạc đồng chầu quy trong chính điện | `G-EXT` thủng | `2.8×0.9m` | 1 | 1 600 | `goldParts` |
| Đôi hạc đồng trong chính điện | `HV-B06` | 2 tượng hạc đồng đứng trên lưng rùa chầu bàn thờ Trần Hưng Đạo, cổ chữ S ngậm sen | `G-TUBE` + `G-LATHE` | Cao `1.7m` | 2 | 1 800 | `bronzeParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A04, HV-A06, HV-I01, HV-D12, HV-B06` | — | — | — | **14 240** | — |

**LOD/ghi chú QC:** L0 giữ Trấn Ba Đình 8 đầu đao, bờ nóc lưỡng long và nội thất chính điện; L1 ẩn cửa võng + hạc đồng khi `> 40m`, giữ 8 mái Trấn Ba Đình soi bóng hồ. QC kiểm tra đúng 2 chữ `"鎮波亭"` và `"玉山祠"`, mái chồng diêm 2 tầng đúng ảnh `70`.

---

## 1.3. Hoàng Thành Thăng Long & Thành Cổ Hà Nội (`04`, `39`, `72`, `73`, `74`, `108`, `109`, `123`)

#### `MB-023` — 5 Cổng vòm cuốn Đoan Môn (ảnh ref: `06`, `108`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 5 cửa vòm cuốn bán nguyệt mặt tiền | `HV-H03` | 5 bộ vòm cuốn gạch vồ 3 lớp giật cấp lùi dần (cửa giữa cao 4.0m, 4 cửa bên nhỏ dần) xếp gạch nan quạt kết đá khóa vòm xanh, sâu 15 cm | `G-TUBE` | Ø `2.4–3.6m` | 5 | 1 500 | `stoneParts` |
| 5 bộ cửa gỗ lim (10 cánh) gắn đinh đồng | `HV-D14` | 180 đinh bán cầu đồng (36 đinh/cổng × 5 cổng xếp lưới 6×3 mỗi cánh gỗ sơn nâu đỏ) gài ngang dọc cổ truyền cổng thành Lê–Nguyễn | `G-INST` | Ø `7cm` | 180 | 4 320 | `bronzeParts` |
| Chân tường thành & khóa góc đá xanh | `HV-H11` | 24 khối đá xanh giật bậc (quoin) xếp xen kẽ dài–ngắn gia cố 2 góc thành và chân trụ 5 cửa vòm, nổi 4 cm | `G-INST` + `T-NRM` | Khối `0.5×0.35m` | 24 | 576 | `stoneParts` |
| Mảng tường gạch vồ cổ mặt Nam Đoan Môn | `HV-NEW-MB-03` | Bề mặt gạch vồ thời Lê–Nguyễn màu nâu xám rêu phong phủ vữa vôi gián mạch | `T-NRM` + `S-SHD` | Viên `0.38×0.18m` | 1 | 0 | `brickParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H03, HV-D14, HV-H11, HV-NEW-MB-03` | — | — | — | **6 396** | — |

**LOD/ghi chú QC:** L0 giữ 5 vòm cuốn đá giật cấp thật và 180 đinh đồng `InstancedMesh`; L1 chuyển đinh đồng và quoin đá sang `T-NRM`. QC kiểm tra đúng 5 cửa vòm mở thông (cửa giữa lớn nhất), đá khóa vòm rõ nét đúng ảnh `06`, `108`.

#### `MB-024` — Lòng 5 hầm vòm Đoan Môn (ảnh ref: `108`, `109`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 5 gân vòm trần gạch bên trong hầm | `HV-H03` | 5 vòng gân vòm gạch vồ cuốn liên hoàn chạy dọc chiều sâu hầm 10m kèm đá khóa vòm trung tâm nhô 6 cm | `G-TUBE` | Ø `2.4–3.6m` | 5 | 1 500 | `stoneParts` |
| Nền đá thanh & vệt bánh xe ngựa cổ | `HV-D01` | 10 m gờ đá thanh khắc rãnh thẳng + đường viền hồi văn hai bên lối xe vua qua cổng giữa, khắc sâu 2 cm | `G-EXT` | Rộng `0.25m` | 10 | 600 | `stoneParts` |
| Đèn lồng gỗ treo vòm giữa & giá binh khí | `HV-D02` | 4 khung đèn lồng lục giác gỗ son chạm chữ Thọ tròn đục thủng 4 mặt treo trục giữa hầm cổng chính, nổi 2 cm | `G-EXT` | Ø `0.38m` | 4 | 560 | `goldParts` |
| Mặt vòm gạch cổ & mạch vữa vôi | `HV-NEW-MB-03` | Lớp gạch vồ uốn cong rêu mốc bên trong 5 lòng hầm vòm | `T-NRM` + `S-SHD` | Toàn lòng vòm | 1 | 0 | `brickParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H03, HV-D01, HV-D02, HV-NEW-MB-03` | — | — | — | **2 660** | — |

**LOD/ghi chú QC:** L0 giữ 5 gân vòm và 4 đèn lồng chữ Thọ trong lòng hầm; L1 ẩn đèn lồng và chuyển rãnh đá sang `T-NRM` khi `> 35m`. QC kiểm tra ánh sáng xuyên thông suốt 5 hầm nhìn thẳng ra Sân Long Trì đúng ảnh `108`, `109`.

#### `MB-025` — Lầu Vọng Lâu trên nóc Đoan Môn (ảnh ref: `06`, `108`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bức đại tự đá mặt tiền tầng thành | `HV-I01` | Tấm đá xanh khắc chìm/nổi 2 đại tự `"端門"` (Đoan Môn) cỡ lớn đặt ngay trên vòm cổng giữa, khung viền nổi 3 cm | `T-ATLAS` + `G-EXT` | `2.4×0.95m` | 1 | 120 | `stoneParts` |
| Lan can tường thành quanh sân Vọng Lâu | `HV-C13` | 64 ô gạch gốm hoa chanh 4 cánh thông gió chạy dọc lan can 4 mặt mặt bằng nóc Đoan Môn, đục thủng sâu 12 cm | `G-EXT` + `G-INST` | Ô `0.25×0.25m` | 64 | 2 304 | `plasterParts` |
| 8 góc mái Lầu Vọng Lâu 2 tầng | `HV-A06` | 8 đầu đao mái vút cong 35° đắp vữa hình đầu rồng hóa mây kiểu Lê–Nguyễn (4 góc mái trên + 4 góc mái dưới) | `G-TUBE` + `G-EXT` | Dài `0.9m` | 8 | 5 200 | `roofParts` |
| Diềm mái 2 tầng ngói mũi hài | `HV-D15` | 64 viên ngói mũi hài cánh vảy xếp đều mặt Nam & mặt Bắc Vọng Lâu | `G-INST` | `0.12×0.38m` | 64 | 2 560 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I01, HV-C13, HV-A06, HV-D15` | — | — | — | **10 184** | — |

**LOD/ghi chú QC:** L0 giữ đại tự `"端門"`, 64 ô hoa chanh đục thủng và 8 đầu đao mái; L1 hạ lan can hoa chanh sang alpha-cutout + `T-NRM`. QC bắt buộc chữ `"端門"` đặt đúng tâm vòm cổng giữa mặt Nam đúng ảnh `06`.

#### `MB-026` — Nền Điện Kính Thiên (`46m`) & Bậc thềm 4 Rồng đá Lê Sơ (ảnh ref: `39`, `72`, `109`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 thành bậc Rồng đá mặt Nam (1467 — Lê Thánh Tông) | `HV-A02` | 4 tượng Rồng đá xanh nguyên khối thời **Lê Sơ** chia 3 lối lên thềm (2 rồng giữa lớn 6.8m, 2 rồng ngoài 5.8m): thân mập uốn **9 khúc**, vảy cá chép nổi rõ, bờm mây cụm 3 lớp (*đao mây*), mũi sư tử, râu xoắn, chân **5 móng** bám chặt bậc đá, chạm sâu 8 cm | `G-TUBE` + `G-DISP` | Dài `5.8–6.8m` | 4 | 12 800 | `stoneParts` |
| Mặt ngoài thân bậc thềm (đám mây & hoa sen dưới bụng rồng) | `HV-D05` | 16 cụm mây đao lửa thời Lê Sơ chạm nổi sâu 3 cm nâng đỡ các khúc uốn thân rồng dọc 4 thành bậc | `G-EXT` | `0.55×0.35m` | 16 | 1 920 | `stoneParts` |
| Chân bệ thềm & mặt bên thành bậc đá | `HV-D06` | 18 m băng sóng nước thủy ba cuộn lớp thời Lê Sơ chạy dọc chân nền Điện Kính Thiên `46m`, chạm sâu 2.5 cm | `G-EXT` | Băng cao `16cm` | 18 | 1 620 | `stoneParts` |
| Đôi Rồng đá thềm sau (Hậu điện — Lê Trung Hưng) | `HV-A05` | 2 thành bậc rồng hóa mây mềm mại thế kỷ XVII–XVIII ở lối lên phía Bắc nền điện, đầu rồng ngẩng, thân hóa lá lật, nổi 5 cm | `G-EXT` | Dài `3.2m` | 2 | 840 | `stoneParts` |
| Viền hộc đá mặt bên bậc thềm | `HV-C07` | 8 m băng cúc dây 8 cánh xen lá chạm nông 2 cm trên ô hộc mặt bên 2 thành bậc ngoài | `G-TUBE` + `G-INST` | Băng cao `14cm` | 8 | 1 120 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A02, HV-D05, HV-D06, HV-A05, HV-C07` | — | — | — | **18 300** | — |

**LOD/ghi chú QC:** **Hero asset P0 của toàn Miền Bắc!** L0 giữ nguyên hình học 4 rồng đá Lê Sơ (9 khúc, 5 móng, bờm mây 3 lớp) không cắt giảm; L1 giảm lưới rồng còn 45% + bake `T-NRM` vảy rồng, chuyển mây/sóng/cúc dây sang `T-NRM`. QC bắt buộc đúng phong cách **Lê Sơ 1467** (không nhầm rồng Lý 12 khúc hay rồng Nguyễn sừng nai) đúng ảnh `39`, `72`.

#### `MB-027` — Hố Khảo Cổ 18 Hoàng Diệu (ảnh ref: `06`, `39`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 chân tảng đá xanh thời Lý–Trần trong hố lộ thiên | `HV-C02` | 6 chân tảng đá vuông đáy tròn mặt chạm **16 cánh sen kép thời Lý** (mỗi cánh chạm hoa văn xoắn ốc bên trong), sâu 2.5 cm | `G-LATHE` + `G-DISP` | Ø `0.85m` | 6 | 1 920 | `stoneParts` |
| Ngói đầu rồng & đầu phượng đất nung Lý–Trần lộ trên tầng văn hóa | `HV-NEW-MB-04` | 4 hiện vật đất nung đỏ cam (2 đầu rồng mào lửa chữ S + 2 đầu phượng mỏ cong) đặt trên bục trưng bày trong hố khảo cổ, nổi 4 cm | `G-EXT` + `G-DISP` | `0.48×0.36m` | 4 | 2 160 | `roofParts` |
| Gạch lá đề chạm rồng thời Lý (hiện vật mái cung điện) | `HV-C09` | 4 viên ngói lá đề đất nung nhọn đuôi chạm rồng thời Lý uốn lượn đối xứng trong lòng lá, sâu 2 cm | `G-EXT` | `0.35×0.42m` | 4 | 360 | `roofParts` |
| Tầng nền gạch cổ & giếng nước thời Lý–Trần | `HV-NEW-MB-03` | Nền gạch vuông in chữ Hán niên hiệu Lý–Trần xen lớp đất khảo cổ phân tầng rõ màu | `T-NRM` + `S-SHD` | Hố `18×12m` | 1 | 0 | `brickParts` |
| Bảng thuyết minh tầng văn hóa khảo cổ | `HV-I04` | 2 biển kính khắc Quốc ngữ & tiếng Anh `"KHU KHẢO CỔ HỌC 18 HOÀNG DIỆU — TẦNG LÝ - TRẦN - LÊ"` | `T-ATLAS` | `1.1×0.65m` | 2 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C02, HV-NEW-MB-04, HV-C09, HV-NEW-MB-03, HV-I04` | — | — | — | **4 440** | — |

**LOD/ghi chú QC:** L0 giữ 6 chân tảng sen Lý và 4 đầu rồng/phượng đất nung dưới mái kính bảo vệ; L1 chuyển gạch lá đề sang `T-NRM`. QC nghiêm ngặt niên đại **Lý–Trần** (chân tảng cánh sen béo tròn, đầu rồng đất nung mào lửa chữ S, không đặt hiện vật Nguyễn vào tầng Lý).

#### `MB-028` — Nhà Con Rồng — Phòng Giao Ban Cục Tác Chiến D67 (ảnh ref: `109`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Hàng cửa chớp lá sách xanh mặt tiền nhà 1967 | `HV-H05` | 8 bộ cửa chớp gỗ lá sách màu xanh rêu (20 lá nghiêng 30°/cánh) mở hé thông gió vào phòng giao ban tầng trệt | `G-INST` | `0.75×1.9m` | 8 | 960 | `woodParts` |
| Gờ phào diềm mái & ô văng bê tông hiện đại 1967 | `HV-H04` | 24 m phào bê tông phẳng chạy ngang ô văng chống nắng đặc trưng kiến trúc công vụ miền Bắc 1960s, nhô 12 cm | `G-EXT` quét | Cao `0.15m` | 24 | 960 | `plasterParts` |
| 2 lan can rồng đá nhỏ mặt thềm cũ trước cửa | `HV-A05` | 2 gờ tay vịn bậc thềm có dáng rồng cách điệu (nguồn gốc tên gọi "Nhà Con Rồng" thời thuộc địa–1967), nổi 3 cm | `G-EXT` | Dài `1.8m` | 2 | 840 | `stoneParts` |
| Biển di tích & bản đồ tác chiến trên tường phòng | `HV-I04` | Biển đỏ chữ vàng `"NHÀ VÀ HẦM D67 (1967–1975)"` ở hiên và bản đồ chiến dịch Hồ Chí Minh treo tường phòng giao ban | `T-ATLAS` | `1.4×0.7m` | 2 | 0 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H05, HV-H04, HV-A05, HV-I04` | — | — | — | **2 760** | — |

**LOD/ghi chú QC:** L0 giữ 8 bộ cửa chớp lá sách và 2 tay vịn rồng thềm cửa; L1 thay lá sách bằng `T-NRM` + ẩn nội thất bàn sa bàn/10 ghế khi `> 30m`. QC đảm bảo phong cách tối giản 1967 (không gắn hoa văn phong kiến vào nội thất D67).

#### `MB-029` — Nội thất Hầm D67 & Cửa thép chống bom (ảnh ref: `109`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 cánh cửa thép bọc dày chống bom & vô-lăng khóa | `HV-NEW-MB-09` | 2 cánh cửa thép sơn ghi xám đúc gân gia cường chữ X, hàng đinh tán viền và tay quay vô-lăng khóa kín khí nổi 8 cm | `G-DISP` + `G-INST` | `1.1×2.0m` | 4 | 360 | `ironParts` |
| Hệ thống ống thông gió & gờ bê tông âm 9m | `HV-H04` | 16 m gờ dầm bê tông chịu lực chạy ngang trần hầm ngầm chống bom B-52, nhô 15 cm | `G-EXT` quét | Cao `0.22m` | 16 | 640 | `stoneParts` |
| Hàng song sắt bảo vệ lối cầu thang xuống hầm | `HV-H09` | 12 thanh song thép đứng sơn xám bảo vệ ô giếng thang xuống hầm ngầm | `G-INST` | Cao `1.0m` | 12 | 720 | `ironParts` |
| Bản đồ chiến dịch 1972–1975 & biển chỉ dẫn hầm | `HV-I04` | 3 tấm bản đồ tác chiến, bảng phiên hiệu quân sự và biển `"HẦM CỤC TÁC CHIẾN D67"` treo vách hầm | `T-ATLAS` | `1.5×1.0m` | 3 | 0 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-09, HV-H04, HV-H09, HV-I04` | — | — | — | **1 720** | — |

**LOD/ghi chú QC:** Nội thất ngầm chỉ render khi camera vào phạm vi `< 30m` (L0); L1/L2 cull hoàn toàn. QC kiểm tra cửa thép có gân nổi & vô-lăng rõ, không lẫn họa tiết cổ điển.

#### `MB-030` — Hậu Lâu (Tĩnh Bắc Lâu) 3 tầng mái cong (ảnh ref: `109`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 12 góc mái 3 tầng chồng diêm (giao thoa Việt–Pháp) | `HV-A06` | 12 đầu đao mái cong 35° đắp vữa cổ sơn xám-đỏ hướng ra 4 góc mỗi tầng (tầng 1, 2, 3), nổi 4 cm | `G-TUBE` + `G-EXT` | Dài `0.8m` | 12 | 7 800 | `roofParts` |
| Hệ cửa vòm bán nguyệt tầng 1 & tầng 2 | `HV-H03` | 6 vòm cuốn gạch bán nguyệt kiểu Pháp cuối thế kỷ XIX bao hành lang tầng trệt và tầng 2, gờ vòm sâu 10 cm | `G-TUBE` | Ø `2.2m` | 6 | 1 800 | `plasterParts` |
| 12 bộ cửa chớp lá sách sơn xanh rêu | `HV-H05` | 12 bộ cửa chớp gỗ lá sách kiểu thuộc địa (20 lá/cánh) lắp trong khung vòm tường vàng Hậu Lâu | `G-INST` | `0.7×2.1m` | 12 | 1 440 | `woodParts` |
| Gờ phào chỉ & con sơn tường vàng 3 tầng | `HV-H04` | 28 m gờ phào phân tầng sơn trắng kem nổi 8 cm trên nền tường vàng cổ điển | `G-EXT` quét | Cao `0.18m` | 28 | 1 120 | `plasterParts` |
| Diềm mái tầng 1 & tầng 2 | `HV-D15` | 48 viên ngói mũi hài cánh vảy viền diềm mái mặt tiền phía Nam | `G-INST` | `0.12×0.36m` | 48 | 1 920 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A06, HV-H03, HV-H05, HV-H04, HV-D15` | — | — | — | **14 080** | — |

**LOD/ghi chú QC:** L0 giữ 12 đầu đao cong, 6 vòm Pháp và 12 cửa chớp lá sách; L1 chuyển cửa chớp, phào chỉ và ngói viền sang `T-NRM`. QC xác nhận kiến trúc giao thoa Việt–Pháp (mái đao Việt + tường vàng cửa chớp xanh Pháp).

#### `MB-031` — Chính Bắc Môn (Thành Cổ Hà Nội) (ảnh ref: `123`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 góc tường thành kiểu Vauban (1805) | `HV-H11` | 40 khối đá xanh giật bậc (quoin) xen kẽ dài–ngắn ốp 4 cạnh góc thành hình thang giật cấp, nổi 5 cm | `G-INST` + `T-NRM` | Khối `0.55×0.4m` | 40 | 960 | `stoneParts` |
| Cổng vòm cuốn gạch đá chính giữa | `HV-H03` | 1 bộ vòm cuốn bán nguyệt 4 lớp gạch vồ lùi dần kèm viên đá khóa vòm trung tâm và bệ chân đá xanh, sâu 18 cm | `G-TUBE` | Ø `3.4m` | 1 | 300 | `stoneParts` |
| Bức đại tự đá trên vòm cổng + 2 vết đạn đại bác 1882 | `HV-I01` | Tấm đá xanh khắc 3 đại tự `"正北門"` (Chính Bắc Môn) viền gờ nổi 3 cm; ngay phía trên bên trái & phải khắc lõm 2 hố đạn đại bác Pháp bắn ngày 25/4/1882 (sâu 12 cm) | `T-ATLAS` + `G-EXT` | `2.0×0.75m` | 1 | 120 | `stoneParts` |
| Vọng lâu trên nóc thành (8 góc mái) | `HV-A06` | 8 đầu đao mái ngói cong vút kiểu Nguyễn Bắc Bộ của lầu thờ Hoàng Diệu — Nguyễn Tri Phương trên nóc thành | `G-TUBE` + `G-EXT` | Dài `0.85m` | 8 | 5 200 | `roofParts` |
| Diềm mái vọng lâu & tường gạch vồ | `HV-D15` | 40 viên ngói mũi hài viền mặt Bắc vọng lâu | `G-INST` | `0.12×0.36m` | 40 | 1 600 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H11, HV-H03, HV-I01, HV-A06, HV-D15` | — | — | — | **8 180** | — |

**LOD/ghi chú QC:** L0 giữ 40 khối quoin đá Vauban, vòm cuốn, 2 hố đạn đại bác 1882 lõm thật và 8 đầu đao vọng lâu; L1 chuyển quoin và ngói sang `T-NRM`. QC bắt buộc chữ `"正北門"` và 2 vết đại bác 1882 rõ đúng ảnh `123`.

#### `MB-032` — Cột Cờ Hà Nội 3 tầng đế gạch (ảnh ref: `73`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 cổng vòm cuốn tầng 2 (Đông — Tây — Nam) | `HV-H03` | 3 vòm cổng bán nguyệt xây gạch vồ giật cấp 3 lớp trên thân tầng 2 hình chóp cụt (1812), sâu 14 cm | `G-TUBE` | Ø `2.6m` | 3 | 900 | `brickParts` |
| 3 bức đại tự Hán văn trên 3 cửa tầng 2 | `HV-I01` | 3 biển chữ Hán đắp nổi chính xác lịch sử: cửa Đông `"迎旭"` (Nghênh Húc), cửa Tây `"回光"` (Hồi Quang), cửa Nam `"向明"` (Hướng Minh), viền gờ nổi 3 cm | `T-ATLAS` + `G-EXT` | `1.5×0.65m` | 3 | 360 | `plasterParts` |
| Gờ phào phân cấp 3 tầng thành & lỗ châu mai | `HV-H04` | 48 m gờ phào gạch vồ đua ra viền quanh đỉnh tầng 1 (`42.5m`), tầng 2 (`27m`) và tầng 3 (`12.8m`), nhô 12 cm | `G-EXT` quét | Cao `0.22m` | 48 | 1 920 | `plasterParts` |
| Lan can tường hoa tầng 2 & tầng 3 | `HV-C13` | 48 ô hoa chanh 4 cánh đục thủng xen kẽ lỗ châu mai trên lan can bảo vệ quanh mặt tầng 2 và tầng 3 | `G-EXT` + `G-INST` | Ô `0.24×0.24m` | 48 | 1 728 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H03, HV-I01, HV-H04, HV-C13` | — | — | — | **4 908** | — |

**LOD/ghi chú QC:** L0 giữ 3 cổng vòm, 3 chữ Hán chuẩn 3 hướng (Đông–Tây–Nam, Bắc không cửa) và 48 ô hoa chanh; L1 chuyển ô hoa chanh và phào sang `T-NRM`. QC đối chiếu nghiêm ngặt ảnh `73` về tỷ lệ 3 cấp chóp cụt.

#### `MB-033` — Thân tháp bát giác Cột Cờ Hà Nội (ảnh ref: `73`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 36 ô thông gió hình hoa thị trên 8 mặt thân tháp | `HV-C14` | 36 ô cửa thông gió đục thủng hình hoa thị 6 cánh (hoa văn hình quạt/cánh hoa đặc trưng Cột Cờ 1812) xếp đều theo vòng cầu thang xoắn ốc 54 bậc bên trong, sâu 15 cm | `G-EXT` + `G-INST` | Ø `0.42m` | 36 | 1 728 | `brickParts` |
| 8 cửa vòm bán nguyệt trên Lầu Bát Giác đỉnh tháp | `HV-H03` | 8 cửa vòm bán nguyệt nhỏ (4 cửa chính + 4 cửa xen) mở đều 8 cạnh lầu bát giác cao 3.3m trên đỉnh thân tháp, sâu 10 cm | `G-TUBE` | Ø `1.1m` | 8 | 2 400 | `plasterParts` |
| Gờ phào cổ tháp & vành mũ bát giác | `HV-H04` | 24 m phào gạch giật cấp chạy quanh cổ tiếp giáp thân bát giác và mái lầu đỉnh, nhô 10 cm | `G-EXT` quét | Cao `0.2m` | 24 | 960 | `plasterParts` |
| Gạch vồ cổ 8 mặt thân tháp | `HV-NEW-MB-03` | Bề mặt gạch vồ đỏ nâu cổ điển phủ vôi xám theo chiều cao 18.2m thân tháp bát giác | `T-NRM` + `S-SHD` | Cao `18.2m` | 1 | 0 | `brickParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C14, HV-H03, HV-H04, HV-NEW-MB-03` | — | — | — | **5 088** | — |

**LOD/ghi chú QC:** L0 giữ đủ 36 ô hoa thị đục thủng và 8 cửa vòm lầu đỉnh; L1 chuyển 36 ô hoa thị sang `T-NRM` + alpha tối sâu. QC đếm đúng 36 ô thông gió và hình khối bát giác thu nhẹ lên đỉnh đúng ảnh `73`.

#### `MB-034` — Đường Thần Đạo lát gạch Bát Tràng (ảnh ref: `06`, `109`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt lát trục Thần Đạo nối Cột Cờ — Đoan Môn — Kính Thiên | `HV-NEW-MB-03` | Gạch Bát Tràng đỏ trầm lát mạch chữ Công kết hợp dải gạch vuông lớn trục giữa (rộng 6m), rêu xanh viền kẽ mạch | `T-NRM` + `S-SHD` | Rộng `6m`, dài `95m` | 1 | 0 | `brickParts` |
| 2 hàng bó vỉa đá xanh dọc Đường Thần Đạo | `HV-D01` | 24 m băng hồi văn chữ "Công" khắc nông 1.2 cm trên 2 dãy đá xanh bó vỉa đoạn quảng trường trước thềm Rồng | `G-EXT` | Băng cao `12cm` | 24 | 1 440 | `stoneParts` |
| 6 trụ đèn đá cổ hai bên lối lên Điện Kính Thiên | `HV-NEW-MB-12` | 6 cột đèn đá xanh 4 mặt lồng đèn chạm mây xoắn và chữ Thọ đặt đối xứng hai bên Đường Thần Đạo | `G-LATHE` + `G-EXT` | Cao `1.8m` | 6 | 2 160 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-03, HV-D01, HV-NEW-MB-12` | — | — | — | **3 600** | — |

**LOD/ghi chú QC:** L0 giữ 6 đèn đá cổ và đoạn bó vỉa hồi văn gần thềm Rồng; L1 giảm đèn đá còn 40% tri và chuyển hồi văn sang `T-NRM`. QC xác nhận trục Thần Đạo thẳng tắp nối đúng Cột Cờ — Đoan Môn — Điện Kính Thiên (ảnh `109`).

#### `MB-035` — Nhà Trưng Bày Hiện Vật Hoàng Thành (ảnh ref: `39`, `109`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đầu phượng & đầu rồng đất nung thời Lý–Trần trong tủ kính | `HV-NEW-MB-04` | 4 bảo vật đất nung (2 đầu phượng hoàng ngậm ngọc bờm lửa thời Lý + 2 đầu rồng đất nung thời Trần) đặt trên đôn nhung đỏ, nổi 5 cm | `G-EXT` + `G-DISP` | `0.5×0.4m` | 4 | 2 160 | `roofParts` |
| Tượng rồng đá thu nhỏ thời Lý (12 khúc) trưng bày | `HV-A01` | 1 mẫu rồng đá thời Lý nguyên bản (thân tròn trơn uốn 12 khúc sin đều, không sừng, mào lửa liên tục, chân 3 móng) trưng bày trên bệ kính | `G-TUBE` | Dài `1.4m` | 1 | 1 800 | `stoneParts` |
| Chân tảng đá hoa sen thời Lý trưng bày | `HV-C02` | 2 chân tảng hoa sen 16 cánh đá xanh chạm sắc nét đặt bệ thấp đầu phòng trưng bày | `G-LATHE` + `G-DISP` | Ø `0.75m` | 2 | 640 | `stoneParts` |
| Gạch in chữ Hán `"大越國軍城磚"` & chú thích hiện vật | `HV-I03` | 4 viên gạch thời Đinh–Tiền Lê–Lý khắc chữ Hán `"Đại Việt Quốc Quân Thành Chuyên"` kèm biển bảo tàng `HV-I04` | `T-NRM` | `0.38×0.2m` | 4 | 0 | `brickParts` |
| Biển tên phòng trưng bày & chú thích bảo vật | `HV-I04` | Biển Quốc ngữ–Anh `"NHÀ TRƯNG BÀY BẢO VẬT HOÀNG THÀNH THĂNG LONG"` và nhãn hiện vật trong tủ | `T-ATLAS` | `1.5×0.5m` | 2 | 0 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-04, HV-A01, HV-C02, HV-I03, HV-I04` | — | — | — | **4 600** | — |

**LOD/ghi chú QC:** Nội thất nhà trưng bày kích hoạt L0 khi `< 25m`; L1 ẩn toàn bộ hiện vật tủ kính. QC kiểm tra rồng Lý `HV-A01` có đủ 12 khúc sin và 3 móng (phân biệt rõ với rồng Lê Sơ 9 khúc 5 móng tại `MB-026`).

#### `MB-036` — Hệ thống tường thành & hào nước bao quanh (ảnh ref: `06`, `123`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Các góc khía thành kiểu Vauban & trụ cổng phụ | `HV-H11` | 36 khối đá xanh giật bậc (quoin) gia cố 6 góc thành và 2 cổng phụ bao quanh quần thể Hoàng Thành, nổi 5 cm | `G-INST` + `T-NRM` | Khối `0.5×0.35m` | 36 | 864 | `stoneParts` |
| 2 cổng phụ vòm cuốn gạch vồ | `HV-H03` | 2 vòm cuốn bán nguyệt gạch cổ 3 lớp dẫn qua hào nước vào khu nội thành, sâu 14 cm | `G-TUBE` | Ø `2.4m` | 2 | 600 | `brickParts` |
| Gờ mũ tường thành chạy dọc hào nước | `HV-H04` | 40 m phào mũ tường thành gạch vồ nhô 10 cm chống thấm nước mưa dọc mặt ngoài tường thành | `G-EXT` quét | Cao `0.18m` | 40 | 1 600 | `brickParts` |
| Mặt tường gạch cổ rêu mốc ven hào | `HV-NEW-MB-03` | Shader gạch vồ rêu xanh phân tầng ẩm chân nước dọc toàn tuyến tường thành | `T-NRM` + `S-SHD` | Dài `240m` | 1 | 0 | `brickParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H11, HV-H03, HV-H04, HV-NEW-MB-03` | — | — | — | **3 064** | — |

**LOD/ghi chú QC:** L0 giữ quoin góc thành và 2 vòm cổng phụ; L1 chuyển quoin và phào mũ sang `T-NRM`. QC xác nhận không có kẽ hở giữa chân tường thành và mực nước hào bao quanh.

---

## 1.4. Fansipan — Sa Pa & Lũng Cú — Hà Giang (`05`, `06`, `75`, `76`, `77`, `78`, `121`)

#### `MB-037` — Chóp Inox Tam Giác Fansipan `3.143m` (ảnh ref: `08`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 mặt chóp inox tam giác đỉnh 3.143m | `HV-I04` | Chữ khắc ăn mòn sắc nét trên 3 mặt chóp thép không gỉ `"FANSIPAN 3.143m"` kèm khung vát cạnh nổi 1 cm | `T-ATLAS` + `G-EXT` | `0.6×0.85m` | 3 | 120 | `ironParts` |
| Mặt sàn tròn đá granit quanh cột cờ đỉnh | `HV-E01` | Họa tiết ngôi sao 14 cánh tâm Trống Đồng Đông Sơn khắc chìm ghép đá granit xám–vàng đường kính 6m quanh bệ cột cờ, sâu 1.5 cm | `G-DISP` | Ø `6.0m` | 1 | 800 | `stoneParts` |
| Lan can đá xanh bao sàn ngắm mây | `HV-D01` | 16 m băng hồi văn vuông khắc viền thành lan can đá granit quanh bậc thang đỉnh, sâu 1.5 cm | `G-EXT` | Băng cao `12cm` | 16 | 960 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I04, HV-E01, HV-D01` | — | — | — | **1 880** | — |

**LOD/ghi chú QC:** L0 giữ 3 mặt chữ `"FANSIPAN 3.143m"` và hoa văn mặt trời sàn granit; L1 chuyển hồi văn và hoa văn sàn sang `T-NRM`. QC xác nhận tỷ lệ chóp inox trên bệ đá 3 cấp bám sát ảnh `08`.

#### `MB-038` — Đại Tượng Phật A Di Đà (`21.5m`) (ảnh ref: `08b`, `75`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đài sen đồng 2 tầng nâng tượng (`Ø9m`) | `HV-C01` | 64 cánh sen đồng đỏ đúc nổi xếp 2 tầng so le (32 cánh ngửa trên + 32 cánh úp dưới), gân sen nổi 5 cm, mép cánh uốn cong | `G-INST` | Cánh `1.2×0.65m` | 64 | 3 072 | `bronzeParts` |
| Chữ Vạn trước ngực Đại Tượng Phật | `HV-D04` | 1 chữ Vạn `卍` đúc nổi sâu 4 cm đặt chính giữa ngực tượng đồng đỏ 21.5m | `G-EXT` | `0.75×0.75m` | 1 | 40 | `bronzeParts` |
| Diềm cổ áo & nếp cà sa xếp lớp | `HV-C07` | 14 m băng hoa cúc dây & sen cách điệu thời Trần chạy viền cổ áo và vạt áo cà sa đồng, chạm nổi 2 cm | `G-TUBE` + `G-INST` | Băng cao `15cm` | 14 | 1 960 | `bronzeParts` |
| Cổ bệ đá xanh 3 tầng dưới đài sen | `HV-D05` | 12 cụm mây xoắn thời Trần chạm nổi 4 cm trên các ô hộc vách đá xanh chân bệ đại tượng | `G-EXT` | `0.85×0.45m` | 12 | 1 440 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C01, HV-D04, HV-C07, HV-D05` | — | — | — | **6 512** | — |

**LOD/ghi chú QC:** L0 giữ đủ 64 cánh sen 2 tầng (32×2) và viền áo cà sa cúc dây; L1 chuyển cúc dây và mây bệ đá sang `T-NRM`, giảm cánh sen còn 50% tri. QC kiểm tra tượng đồng đỏ cao `21.5m`, tay kết ấn thiền định đúng ảnh `08b`, `75`.

#### `MB-039` — Bảo Tháp 11 tầng đá sa thạch (ảnh ref: `74`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đỉnh Bảo Tháp (chóp hoa sen đồng) | `HV-C03` | Đỉnh búp sen đồng đúc 3 lớp cánh vươn thẳng giữa biển mây trên tầng 11 tháp đá sa thạch | `G-LATHE` | Cao `1.4m` | 1 | 180 | `bronzeParts` |
| Bệ chân tháp vuông 2 tầng (phong cách Tháp Phổ Minh — Trần) | `HV-C01` | 32 cánh sen đá sa thạch chạm kép 2 hàng (mỗi mặt 8 cánh) kiểu hoa sen béo thời Trần bao chân tháp, nổi 3 cm | `G-INST` | Cánh `0.32×0.18m` | 32 | 1 536 | `stoneParts` |
| Cửa vòm 4 mặt tầng 1 & tầng 2 | `HV-C09` | 8 vòm lá đề nhọn đuôi chạm chìm/nổi phong cách Trần (4 mặt × 2 tầng dưới) trên thân đá sa thạch, sâu 3 cm | `G-EXT` | `0.65×1.1m` | 8 | 720 | `stoneParts` |
| Dải viền ngăn tầng tháp (tầng 1–5 cận cảnh) | `HV-D06` | 16 m băng sóng nước thủy ba kết hợp hoa cúc thời Trần chạm quanh gờ đá giữa các tầng tháp, sâu 2 cm | `G-EXT` | Băng cao `12cm` | 16 | 1 440 | `stoneParts` |
| 11 tầng mái tháp giật cấp (44 góc mái nhỏ) | `HV-D05` | 16 cụm mây đao thời Trần tại 4 góc mái 4 tầng dưới (tầng 5–11 dùng silhouette vát cong đơn giản) | `G-EXT` | `0.25×0.12m` | 16 | 1 920 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C03, HV-C01, HV-C09, HV-D06, HV-D05` | — | — | — | **5 796** | — |

**LOD/ghi chú QC:** L0 giữ 32 cánh sen Trần chân tháp, 8 vòm lá đề và đỉnh sen đồng; L1 chuyển sóng nước và lá đề sang `T-NRM`. QC xác nhận đủ **11 tầng** giật cấp chất liệu đá sa thạch xám vàng, đúng hoa văn thời Trần (ảnh `74`).

#### `MB-040` — Chùa Kim Sơn Bảo Thắng — Thượng Điện Tam Bảo (ảnh ref: `74`, `121`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tòa Cửu Long gian chính Thượng Điện | `HV-A05` | 9 con rồng chạm lộng sơn son thếp vàng phong cách chùa Bắc Bộ uốn quấn quanh vòm hào quang phun nước tắm Phật sơ sinh, sâu 4 cm | `G-EXT` | `0.45×0.25m` | 9 | 3 780 | `goldParts` |
| Vòm hào quang sau Tòa Cửu Long | `HV-C09` | Khung lá đề lớn thếp vàng chạm tia lửa và mây cuộn phía sau tượng Thích Ca sơ sinh, nổi 3 cm | `G-EXT` | `1.2×1.8m` | 1 | 90 | `goldParts` |
| Cửa võng chính điện & 2 gian cạnh | `HV-D12` | 2 bộ cửa võng chạm lộng thủng nhiều lớp thếp vàng hình rồng chầu — hoa sen, sâu 4.5 cm | `G-EXT` thủng | `2.8×0.9m` | 2 | 3 200 | `goldParts` |
| 3 bộ cửa bức bàn mặt tiền chùa | `HV-D13` | 6 cánh cửa bức bàn gỗ lim 3 ô (trên chấn song, giữa chạm tứ quý, dưới pano) kiểu chùa thế kỷ XV–XVI, sâu 2 cm | `G-EXT` + `T-NRM` | Cánh `0.8×2.2m` | 6 | 1 320 | `woodParts` |
| Hoành phi chính điện & sơn son thếp vàng | `HV-I01` | Hoành phi `"金山寶勝寺"` (Kim Sơn Bảo Thắng Tự) chữ Hán thếp vàng trên nền son `HV-J04` | `T-ATLAS` + `G-EXT` | `2.2×0.75m` | 1 | 120 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A05, HV-C09, HV-D12, HV-D13, HV-I01` | — | — | — | **8 510** | — |

**LOD/ghi chú QC:** L0 giữ Tòa Cửu Long 9 rồng, 2 cửa võng chạm lộng và 6 cánh cửa bức bàn; L1 ẩn nội thất điện khi `> 35m`, giữ mặt tiền gỗ lim và hoành phi `"金山寶勝寺"`. QC đối chiếu nội thất Tam Bảo Bắc Bộ ảnh `121`.

#### `MB-041` — Đường La Hán & 18 Tượng Đồng La Hán (ảnh ref: `08b`, `74`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 18 bệ sen đá xanh đỡ 18 tượng đồng La Hán | `HV-C02` | 18 bệ đá tròn chạm 16 cánh sen úp dọc lối bậc đá uốn lượn bên sườn núi Fansipan, chạm sâu 2 cm | `G-LATHE` + `G-INST` | Ø `0.78m` | 18 | 5 760 | `stoneParts` |
| Viền áo cà sa 18 tượng đồng La Hán | `HV-C07` | 9 m module hoa cúc dây chạm nổi tinh tế (instance chia sẻ cho viền áo 18 vị La Hán), sâu 1.2 cm | `G-INST` (`G-TUBE`) | Băng cao `8cm` | 9 | 1 260 | `bronzeParts` |
| 6 cây đèn đá cổ dọc tuyến hành hương | `HV-NEW-MB-12` | 6 đèn đá xanh rêu cổ lồng đèn chạm chữ Thọ & mây đặt xen giữa các gốc Đỗ Quyên cổ thụ | `G-LATHE` + `G-EXT` | Cao `1.6m` | 6 | 2 160 | `stoneParts` |
| Lan can đá dọc vách núi Đường La Hán | `HV-D01` | 18 m băng hồi văn vuông khắc viền tay vịn đá xanh dọc đoạn chiếu nghỉ ngắm biển mây | `G-EXT` | Băng cao `10cm` | 18 | 1 080 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C02, HV-C07, HV-NEW-MB-12, HV-D01` | — | — | — | **10 260** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 18 bệ sen và 6 đèn đá; L1 chuyển viền áo cúc dây và hồi văn sang `T-NRM`. QC đếm đủ 18 tượng La Hán đặt hai bên lối đá, xen hoa Đỗ Quyên đỏ không bay lơ lửng.

#### `MB-042` — Ga Cáp Treo Fansipan Legend & Cabin 3 dây (ảnh ref: `08`, `08b`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 cửa vòm đá kiểu lâu đài châu Âu mặt tiền ga | `HV-H03` | 6 vòm cuốn đá granit bán nguyệt nhiều lớp giật cấp kiểu kiến trúc tân cổ điển Pháp–Thụy Sĩ, sâu 16 cm | `G-TUBE` | Ø `3.2m` | 6 | 1 800 | `stoneParts` |
| 12 khung cửa sổ vòm & chớp gỗ mặt đứng | `HV-H05` | 12 bộ cửa chớp gỗ sơn nâu trầm lắp dọc 2 tầng mặt tiền nhà ga cáp treo | `G-INST` | `0.85×2.1m` | 12 | 1 440 | `woodParts` |
| Gờ phào mái đá & con sơn đỡ ban công | `HV-H04` | 30 m gờ phào đá và con sơn cuộn kiểu châu Âu chạy quanh mái dốc ngói đá xám, nhô 14 cm | `G-EXT` quét | Cao `0.25m` | 30 | 1 200 | `stoneParts` |
| Đồng hồ mặt tiền tháp ga & biển hiệu | `HV-H08` | 1 mặt đồng hồ La Mã cổ điển gắn trên đầu hồi tam giác tháp ga + biển `"GA FANSIPAN"` (`HV-I04`) | `G-EXT` + `T-ATLAS` | Ø `1.6m` | 1 | 280 | `goldParts` |
| Biển tên nhà ga & thông số cáp treo 3 dây | `HV-I04` | Biển chữ kim loại `"FANSIPAN LEGEND — GA ĐẾN 3.000m"` gắn trên vòm sảnh đón | `T-ATLAS` | `3.2×0.5m` | 1 | 0 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H03, HV-H05, HV-H04, HV-H08, HV-I04` | — | — | — | **4 720** | — |

**LOD/ghi chú QC:** L0 giữ 6 vòm đá, đồng hồ La Mã và cửa chớp; L1 chuyển cửa chớp và phào sang `T-NRM`. QC đảm bảo kiến trúc châu Âu mái đá xám đặc trưng ga Fansipan Legend (không gắn hoa văn đình chùa lên ga cáp treo).

#### `MB-043` — Cột Cờ Lũng Cú bát giác (`33.15m`) (ảnh ref: `07`, `62`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 8 mặt phù điêu Trống Đồng Đông Sơn ốp chân tháp bát giác (tâm mặt trời) | `HV-E01` | 8 mặt trống đồng đúc nổi ốp 8 cạnh thân bát giác: tâm ngôi sao **14 cánh** nhọn xen họa tiết lông công, nổi 3.5 cm | `G-DISP` + `G-INST` | Ø `1.35m` | 8 | 6 400 | `bronzeParts` |
| Vành chim Lạc bay trên 8 mặt trống đồng | `HV-E02` | 18 chim Lạc mỏ dài cánh xòe bay ngược chiều kim đồng hồ (dựng 1 module vành 18 chim chia sẻ `InstancedMesh` × 8 mặt = 144 chim; 18×40 tri base instance) | `G-DISP` + `G-INST` | Chim `12cm` | 18 | 720 | `bronzeParts` |
| Vành người hóa trang lông chim & vòng tròn tiếp tuyến trên mặt trống | `HV-E04` | 8 vành vòng tròn đồng tâm tiếp tuyến & răng cưa bao ngoài vành chim Lạc trên 8 mặt trống đồng chân cột cờ, sâu 2 cm | `G-DISP` + `G-INST` | Băng `10cm` | 8 | 2 400 | `bronzeParts` |
| 8 tấm phù điêu lịch sử đá xanh chân đế bát giác | `HV-NEW-MB-10` | 8 mảng phù điêu đá xanh khắc lịch sử các thời kỳ dựng nước và phong tục dân tộc Hà Giang đặt dưới 8 mặt trống đồng, nổi 5 cm | `G-DISP` | `1.8×1.1m` | 8 | 4 960 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-E01, HV-E02, HV-E04, HV-NEW-MB-10` | — | — | — | **14 480** | — |

**LOD/ghi chú QC:** **Hero asset P0 cực Bắc!** Dùng `InstancedMesh` cho 8 mặt trống đồng Đông Sơn (ngôi sao 14 cánh + vành chim Lạc + vòng tiếp tuyến); L1 bake toàn bộ mặt trống đồng và 8 phù điêu đá xanh sang `T-NRM`. QC kiểm tra đúng 8 cạnh bát giác ốp đá xanh + 8 trống đồng nổi đúng ảnh `07`, `62`.

#### `MB-044` — Lá đại kỳ `54m²` & Đài quan sát đỉnh Lũng Cú (ảnh ref: `07`, `62`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 8 đoạn lan can đá xanh quanh đài quan sát đỉnh tháp | `HV-D01` | 16 m băng hồi văn vuông khắc viền 8 cạnh lan can đá xanh bao quanh sân quan sát bát giác, sâu 1.5 cm | `G-EXT` | Băng cao `12cm` | 16 | 960 | `stoneParts` |
| 8 góc trụ lan can đài quan sát | `HV-C03` | 8 đầu trụ đá xanh vát đỉnh hình búp sen khép đơn giản (tạo hình hiện đại kết hợp truyền thống) đặt 8 góc đài | `G-LATHE` + `G-INST` | Cao `0.28m` | 8 | 1 440 | `stoneParts` |
| Gờ phào vươn đỡ sàn đài bát giác | `HV-H04` | 18 m gờ phào đá giật cấp đỡ vành sàn đài quan sát ở độ cao `20.2m` thân tháp, nhô 15 cm | `G-EXT` quét | Cao `0.22m` | 18 | 720 | `stoneParts` |
| Biển tọa độ cực Bắc & chú thích `54m²` | `HV-I04` | Biển đồng chữ nổi `"CỘT CỜ QUỐC GIA LŨNG CÚ — LÁ CỜ 54m² (54 DÂN TỘC)"` gắn cạnh ống nhòm đài quan sát | `T-ATLAS` | `1.0×0.5m` | 1 | 0 | `bronzeParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D01, HV-C03, HV-H04, HV-I04` | — | — | — | **3 120** | — |

**LOD/ghi chú QC:** L0 giữ lan can đá 8 cạnh, 8 đầu trụ và biển tọa độ; L1 chuyển hồi văn và phào đỡ sang `T-NRM`, giữ đại kỳ `54m²` (tỷ lệ `9×6m`) shader gió bay. QC kiểm tra cờ sao vàng 5 cánh đúng tỷ lệ chuẩn quốc kỳ.

#### `MB-045` — 839 bậc thang đá leo đỉnh Núi Rồng (ảnh ref: `07`, `62`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Lan can đá dọc 3 đoạn chiếu nghỉ chính | `HV-D01` | 24 m băng hồi văn chữ "Công" chạy dọc thành lan can đá xanh ở 3 chiếu nghỉ quan trọng dẫn lên chân Cột Cờ, sâu 1.5 cm | `G-EXT` | Băng cao `12cm` | 24 | 1 440 | `stoneParts` |
| 8 trụ đá đầu chiếu nghỉ chạm mây | `HV-D05` | 8 cụm mây xoắn đá xanh chạm nổi 2.5 cm ở thân các trụ mốc đá dọc tuyến bậc leo Núi Rồng | `G-EXT` | `0.32×0.22m` | 8 | 960 | `stoneParts` |
| 4 đèn đá cổ tại cổng lên & chiếu nghỉ trên cùng | `HV-NEW-MB-12` | 4 cột đèn đá xanh lồng đèn 4 mặt đặt ở chân bậc và sân thượng chân Cột Cờ | `G-LATHE` + `G-EXT` | Cao `1.7m` | 4 | 1 440 | `stoneParts` |
| Bia mốc đá cực Bắc Việt Nam | `HV-I04` | Bia đá granit đen khắc chữ vàng `"ĐIỂM CỰC BẮC TỔ QUỐC — LŨNG CÚ, ĐỒNG VĂN, HÀ GIANG"` kèm khung nổi 2 cm | `T-ATLAS` + `G-EXT` | `1.2×1.8m` | 1 | 40 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D01, HV-D05, HV-NEW-MB-12, HV-I04` | — | — | — | **3 880** | — |

**LOD/ghi chú QC:** L0 giữ 4 đèn đá, bia mốc cực Bắc và đoạn lan can hồi văn ở chiếu nghỉ; L1 chuyển toàn bộ hồi văn và mây trụ sang `T-NRM`. QC xác nhận tuyến bậc bám sát địa hình sườn Núi Rồng không lơ lửng.

#### `MB-046` — Hồ Mắt Rồng đôi dưới chân núi Lũng Cú (ảnh ref: `07`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Kè đá vôi bờ 2 hồ nước tự nhiên | `HV-D06` | 10 m gờ sóng đá vôi khắc nông tại bậc bến nước đá xếp tay của người Lô Lô bên bờ hồ, sâu 1.5 cm | `G-EXT` | Băng cao `12cm` | 10 | 900 | `stoneParts` |
| Cụm lá súng tự nhiên ven bờ nông 2 hồ | `HV-C06` | 24 lá súng tròn khuyết chữ V nổi sát mép nước xanh ngọc hai hồ mắt rồng | `G-EXT` + `G-INST` | Ø `0.28m` | 24 | 768 | `leafParts` |
| Biển chỉ dẫn địa danh Hồ Mắt Rồng | `HV-I04` | Biển gỗ/đá khắc chữ Quốc ngữ `"HỒ MẮT RỒNG — LŨNG CÚ"` đặt cạnh lối xuống bản | `T-ATLAS` | `0.9×0.5m` | 1 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D06, HV-C06, HV-I04` | — | — | — | **1 668** | — |

**LOD/ghi chú QC:** Cảnh quan thiên nhiên giữ hình học tối giản; L1 tắt lá súng và chuyển viền bến đá sang `T-NRM`. QC kiểm tra đúng 2 hồ song song hình "mắt rồng" màu xanh ngọc nằm dưới chân Núi Rồng.

#### `MB-047` — Bản Lô Lô Chải & Nhà trình tường đất vàng (ảnh ref: `07`, `77`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mái ngói âm dương 4 ngôi nhà trình tường tiêu biểu | `HV-D15` | 64 viên ngói ống câu đầu âm dương đất nung đen xám viền mặt tiền 4 mái nhà trình tường (16 viên/nhà), nổi 2 cm | `G-INST` | `0.12×0.36m` | 64 | 2 560 | `roofParts` |
| Rèm vải & trang phục phơi hiên nhà Lô Lô | `HV-NEW-MB-07` | Hoa văn thổ cẩm Lô Lô Chải (tam giác ghép vải ngũ sắc đỏ–vàng–xanh–đen và mặt trời cách điệu) trên vải phơi và cờ cổng bản | `T-ATLAS` + `T-NRM` | Dải `0.3×1.4m` | 6 | 0 | `fabricParts` |
| Trống đồng nhỏ & cổng gỗ bản Lô Lô | `HV-E01` | 1 họa tiết mặt trời 14 cánh trống đồng Lô Lô khắc gỗ nổi 2 cm treo giữa cổng gỗ vào bản Lô Lô Chải | `G-DISP` | Ø `0.65m` | 1 | 800 | `woodParts` |
| Phên nứa gác bếp & cổng rào tre | `HV-G03` | Nan nứa đan lóng mốt chữ nhân làm cửa cổng tre và sạp phơi ngô trên hiên nhà trình tường | `T-NRM` + `S-SHD` | Toàn tấm phên | 4 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D15, HV-NEW-MB-07, HV-E01, HV-G03` | — | — | — | **3 360** | — |

**LOD/ghi chú QC:** L0 giữ 64 viên ngói âm dương viền hiên và biểu trưng trống đồng gỗ Lô Lô; L1 chuyển ngói sang `T-NRM`. QC xác nhận tường đất vàng nện thô, hàng rào đá xếp tay khô không vữa đúng đặc trưng Cao nguyên đá Đồng Văn.

#### `MB-048` — Cánh đồng hoa Tam Giác Mạch & Đá tai mèo Hà Giang (ảnh ref: `07`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Dãy mỏm đá tai mèo sắc cạnh đan xen thảm hoa | `HV-NEW-MB-08` | 14 cụm chóp đá vôi karst tai mèo xám đen có rãnh xói mòn dọc sắc cạnh nhô khỏi thảm hoa hồng-tím | `G-DISP` + `G-INST` | Cao `0.8–2.4m` | 14 | 1 960 | `stoneParts` |
| Hàng rào tre nứa & chòi chụp ảnh gỗ mộc | `HV-G03` | Vách phên nứa đan lóng mốt trên 2 chòi dừng chân nhỏ ven thung lũng hoa Tam Giác Mạch | `T-NRM` + `S-SHD` | `2.0×1.4m` | 2 | 0 | `woodParts` |
| Cờ dây trang trí thổ cẩm mùa lễ hội hoa | `HV-NEW-MB-07` | Dải vải thổ cẩm H'Mông xoắn ốc sáp ong chàm–trắng căng dọc cổng lối vào đồi hoa | `T-ATLAS` + `T-NRM` | Dài `8m` | 2 | 0 | `fabricParts` |
| Biển gỗ địa danh mùa hoa Hà Giang | `HV-I04` | Biển gỗ khắc chữ trắng `"CÁNH ĐỒNG HOA TAM GIÁC MẠCH — HÀ GIANG"` | `T-ATLAS` | `1.2×0.5m` | 1 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-08, HV-G03, HV-NEW-MB-07, HV-I04` | — | — | — | **1 960** | — |

**LOD/ghi chú QC:** Cảnh quan thiên nhiên ưu tiên shader hoa & instance đá tai mèo; L1 giảm mật độ đá tai mèo còn 50%. QC kiểm tra màu hoa Tam Giác Mạch chuyển sắc trắng–hồng–tím tự nhiên xen đá xám sắc cạnh.

---

## 1.5. Vịnh Hạ Long & Thủy Chiến Bạch Đằng (`07`, `15`, `68`)

#### `MB-049` — Hòn Trống Mái (Hòn Gà Chọi) (ảnh ref: `04`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 khối đá vôi thắt eo sóng vỗ (Trống & Mái) | `HV-NEW-MB-08` | 8 cụm vách đá karst phân tầng rãnh xâm thực dọc — ngấn sóng ăn mòn ngang chân đá cao 12m nghiêng mỏ chầu nhau | `G-DISP` + `G-INST` | Cao `12m` | 8 | 1 120 | `stoneParts` |
| Ngấn sóng thủy triều chân bệ đá vôi | `HV-D06` | 12 m gờ sóng đá ăn mòn lượn quanh chân thắt eo nơi tiếp giáp mặt nước xanh lục bảo vịnh, sâu 4 cm | `G-EXT` | Băng cao `25cm` | 12 | 1 080 | `stoneParts` |
| Phao giới hạn & biển di sản trên mặt nước | `HV-I04` | Biển nổi chữ trắng nền xanh `"HÒN TRỐNG MÁI — DI SẢN THIÊN NHIÊN THẾ GIỚI VỊNH HẠ LONG"` | `T-ATLAS` | `1.4×0.6m` | 1 | 0 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-08, HV-D06, HV-I04` | — | — | — | **2 200** | — |

**LOD/ghi chú QC:** L0 giữ rõ hình khối 2 con gà nghiêng mỏ đối diện trên chân thắt eo hẹp và vết xâm thực chân nước; L1 chuyển rãnh xâm thực sang `T-NRM`. QC kiểm tra silhouette đặc trưng Hòn Trống Mái từ góc ngang đúng ảnh `04`.

#### `MB-050` — Hòn Đỉnh Hương (ảnh ref: `04`, `51`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Thân khối karst dáng lư hương khổng lồ | `HV-NEW-MB-08` | 8 cụm rãnh xâm thực đá vôi dọc thân và khối thắt eo chân nhỏ đứng trên bệ đá rộng (hình ảnh tờ tiền 200.000đ) | `G-DISP` + `G-INST` | Cao `14m` | 8 | 1 120 | `stoneParts` |
| Ngấn nước mài mòn chân đế khi triều rút | `HV-D06` | 10 m vành rãnh sóng vỗ ăn sâu 5 cm quanh 2 chân trụ đá thon ở mực triều xuống | `G-EXT` | Băng cao `22cm` | 10 | 900 | `stoneParts` |
| Biển giới thiệu danh thắng tờ 200.000đ | `HV-I04` | Biển chú thích nhỏ trên phao tuyến tham quan `"HÒN ĐỈNH HƯƠNG — VỊNH HẠ LONG"` | `T-ATLAS` | `1.2×0.5m` | 1 | 0 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-08, HV-D06, HV-I04` | — | — | — | **2 020** | — |

**LOD/ghi chú QC:** L0 giữ nguyên silhouette lư hương chân thon đế rộng và bụi cây bám chỏm đỉnh; L1 chuyển ngấn nước sang `T-NRM`. QC đối chiếu tỷ lệ thắt eo chân đá đúng ảnh `51`.

#### `MB-051` — Hang Luồn xuyên thủy (ảnh ref: `04`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Trần vòm hang đá vôi xuyên thủy dài 60m | `HV-NEW-MB-08` | 24 cụm nhũ đá canxit ẩm bóng rủ từ trần vòm hang dài `0.8–3.2m`, rãnh nước nhỏ giọt rõ khối | `G-LATHE` + `G-INST` | Dài `0.8–3.2m` | 24 | 3 360 | `stoneParts` |
| Mép vách đá ngấn sóng cửa hang | `HV-D06` | 14 m gờ xâm thực sóng thủy triều hai bên chân vòm cửa Hang Luồn, sâu 5 cm | `G-EXT` | Băng cao `25cm` | 14 | 1 260 | `stoneParts` |
| Biển cảnh báo độ cao vòm hang cho thuyền kayak | `HV-I04` | Biển xanh chữ trắng `"HANG LUỒN — LỐI CHÈO KAYAK"` gắn vách cửa Đông | `T-ATLAS` | `1.0×0.45m` | 1 | 0 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-08, HV-D06, HV-I04` | — | — | — | **4 620** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 24 cụm nhũ đá rủ trần vòm; L1 ẩn 60% nhũ đá sâu trong hang khi `> 45m`. QC đảm bảo thuyền kayak đi lọt thông suốt vào hồ kín vách đứng bên trong.

#### `MB-052` — Làng Chài Nổi Cửa Vạn (ảnh ref: `04`, `68`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cửa chớp gỗ 12 nhà bè nổi & trường học nổi | `HV-H05` | 18 bộ cửa sổ chớp gỗ sơn xanh lam–vàng đất trên vách 12 nhà bè gỗ dân chài vùng vịnh | `G-INST` | `0.65×1.1m` | 18 | 2 160 | `woodParts` |
| Lan can con tiện gỗ quanh cầu nổi & hiên nhà bè | `HV-D10` | 36 con tiện gỗ mộc sơn xanh/nâu gắn dọc cầu gỗ nổi nối cụm nhà bè và lồng nuôi cá | `G-LATHE` + `G-INST` | Cao `0.6m` | 36 | 2 016 | `woodParts` |
| Phên nứa & lưới đan che nắng lồng cá | `HV-G03` | Phên tre nứa đan lóng mốt làm mái che tạm và sạp phơi lưới trên sàn bè gỗ | `T-NRM` + `S-SHD` | Toàn tấm phên | 8 | 0 | `woodParts` |
| Biển tên Trung tâm Văn hóa Nổi Cửa Vạn | `HV-I04` | Biển gỗ sơn xanh chữ trắng `"LÀNG CHÀI CỬA VẠN — TRƯỜNG HỌC NỔI"` treo đầu nhà trung tâm | `T-ATLAS` | `2.0×0.5m` | 2 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H05, HV-D10, HV-G03, HV-I04` | — | — | — | **4 176** | — |

**LOD/ghi chú QC:** L0 giữ 18 cửa sổ gỗ và 36 con tiện cầu nổi; L1 thay cửa chớp và lan can bằng `T-NRM`. QC xác nhận đủ 12 nhà bè mái tôn xanh/đỏ nổi ổn định trên phao, liên kết bằng cầu gỗ nổi.

#### `MB-053` — Đội Thuyền Buồm Cánh Dơi Hạ Long (ảnh ref: `68`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cánh buồm nâu sồng hình cánh dơi 7 nan tre (3 thuyền × 2 buồm) | `HV-NEW-MB-11` | 6 cánh buồm cánh dơi truyền thống Hạ Long chia 7 nan tre uốn cong 3D theo gió, dây lèo buộc nút cổ truyền, nổi gân nan 4 cm | `G-EXT` + `G-TUBE` | `4.2×6.5m` | 6 | 1 680 | `fabricParts` |
| Khoang thuyền gỗ có cửa sổ chớp lá sách | `HV-H05` | 12 bộ cửa chớp lá sách gỗ sơn nâu gụ dọc mạn khoang 3 chiếc thuyền buồm (4 cửa/thuyền) | `G-INST` | `0.6×0.9m` | 12 | 1 440 | `woodParts` |
| Đường chỉ mạn & hoa văn sóng nước mũi thuyền | `HV-D06` | 12 m băng sóng nước sơn vàng/chạm nông dọc mũi vểnh 3 thân thuyền gỗ cánh dơi, sâu 1.5 cm | `G-EXT` | Băng cao `12cm` | 12 | 1 080 | `woodParts` |
| Lan can con tiện boong sau quanh bánh lái | `HV-D10` | 18 con tiện gỗ ngắn (6 con/thuyền) bao quanh khu vực bánh lái gỗ cổ truyền | `G-LATHE` + `G-INST` | Cao `0.5m` | 18 | 1 008 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-11, HV-H05, HV-D06, HV-D10` | — | — | — | **5 208** | — |

**LOD/ghi chú QC:** L0 giữ đủ 7 nan tre cong 3D mỗi buồm và 12 cửa chớp khoang; L1 chuyển cửa chớp, sóng mũi và con tiện sang `T-NRM`, giữ silhouette buồm cánh dơi nâu sồng rõ nét đúng ảnh `68`.

#### `MB-054` — Du thuyền ngủ đêm 3 tầng Vịnh Hạ Long (ảnh ref: `68`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Hệ cửa chớp gỗ & khung cửa sổ nhà hàng tầng 2 | `HV-H05` | 16 khung cửa sổ gỗ phong cách Đông Dương–Vịnh Hạ Long dọc 2 mạn tầng 1 và tầng 2 du thuyền trắng–nâu gỗ | `G-INST` | `0.85×1.3m` | 16 | 1 920 | `woodParts` |
| Lan can gỗ con tiện boong tắm nắng tầng 3 | `HV-D10` | 40 con tiện gỗ sơn trắng/nâu viền boong thượng nơi xếp ghế nằm tắm nắng và đèn vàng ấm | `G-LATHE` + `G-INST` | Cao `0.75m` | 40 | 2 240 | `woodParts` |
| Gờ phào viền 3 tầng boong & mũi tàu | `HV-H04` | 36 m phào gỗ nâu chỉ vàng chạy vòng quanh 3 tầng boong du thuyền, nhô 6 cm | `G-EXT` quét | Cao `0.14m` | 36 | 1 440 | `woodParts` |
| Biển tên du thuyền & số đăng ký mạn tàu | `HV-I04` | Chữ nổi kim loại vàng `"HA LONG HERITAGE CRUISE"` gắn 2 mạn mũi tàu | `T-ATLAS` + `G-EXT` | `2.4×0.35m` | 2 | 80 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H05, HV-D10, HV-H04, HV-I04` | — | — | — | **5 680** | — |

**LOD/ghi chú QC:** L0 giữ cửa sổ tầng 2, 40 con tiện boong thượng và 3 đường phào phân tầng; L1 chuyển cửa chớp và con tiện sang `T-NRM`. QC xác nhận tỷ lệ du thuyền 3 tầng hiện đại kết hợp gỗ cổ điển không lạc tông.

#### `MB-055` — Bãi tắm Đảo Ti Tốp & Lầu Vọng Cảnh đỉnh núi (ảnh ref: `04`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 góc mái chòi lục giác Lầu Vọng Cảnh đỉnh đảo | `HV-A06` | 6 đầu đao mái vút cong 35° (2 tầng mái lục giác chòi đỉnh Ti Tốp) đắp vữa màu đỏ nâu hướng ra toàn vịnh | `G-TUBE` + `G-EXT` | Dài `0.75m` | 6 | 3 900 | `roofParts` |
| Lan can con tiện bao sàn ngắm cảnh đỉnh núi | `HV-D10` | 24 con tiện xi măng/gỗ xếp quanh 6 cạnh Lầu Vọng Cảnh đỉnh Ti Tốp | `G-LATHE` + `G-INST` | Cao `0.65m` | 24 | 1 344 | `plasterParts` |
| Diềm mái chòi lục giác | `HV-D15` | 36 viên ngói ống câu đầu viền 6 cạnh mái dưới chòi vọng cảnh | `G-INST` | `0.12×0.36m` | 36 | 1 440 | `roofParts` |
| Bệ tượng anh hùng phi hành gia Gherman Titov chân bãi | `HV-I04` | Bảng đồng khắc tiểu sử `"ĐẢO TI TỐP — CHỦ TỊCH HỒ CHÍ MINH ĐẶT TÊN NĂM 1962"` gắn trên bệ đá tượng | `T-ATLAS` | `0.9×0.6m` | 1 | 0 | `bronzeParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A06, HV-D10, HV-D15, HV-I04` | — | — | — | **6 684** | — |

**LOD/ghi chú QC:** L0 giữ 6 đầu đao chòi lục giác đỉnh đảo và 24 con tiện; L1 chuyển ngói và con tiện sang `T-NRM`. QC kiểm tra bãi cát trắng hình vầng trăng khuyết ôm chân đảo, bậc đá nối thẳng lên Lầu Vọng Cảnh.

#### `MB-056` — Bãi Cọc Gỗ Lim Bạch Đằng bịt sắt nhọn (ảnh ref: `15`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 12 cọc gỗ lim bịt đầu sắt nhọn cận cảnh trên bờ & mép triều | `HV-NEW-MB-09` | 12 mũi sắt rèn vát 4 cạnh có đai đinh tán bọc đầu cọc gỗ lim cổ đóng xiên 60° hướng ra cửa biển (kèm cọc trưng bày di tích), nổi 3 cm | `G-DISP` + `G-INST` | Đầu cọc `0.25×0.65m` | 12 | 1 080 | `ironParts` |
| Bệ đá xanh trưng bày cọc gỗ lim di tích trên bờ | `HV-D06` | 12 m băng sóng nước thời Trần chạm quanh bệ đá bảo tồn các cọc Bạch Đằng năm 1288, sâu 2 cm | `G-EXT` | Băng cao `14cm` | 12 | 1 080 | `stoneParts` |
| Bia đá ghi chiến công Bạch Đằng 938 — 981 — 1288 | `HV-I03` | Văn bia Hán-Nôm & Quốc ngữ trích *Bạch Đằng Giang Phú* của Trương Hán Siêu khắc chìm 4 mm trên bia đá xanh | `T-NRM` | `1.1×1.7m` | 1 | 0 | `stoneParts` |
| Biển di tích lịch sử quốc gia đặc biệt | `HV-I04` | Biển đá chữ vàng `"DI TÍCH LỊCH SỬ BÃI CỌC BẠCH ĐẰNG (938 – 1288)"` | `T-ATLAS` | `1.4×0.7m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-09, HV-D06, HV-I03, HV-I04` | — | — | — | **2 160** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho bãi cọc gỗ lim đóng xiên dưới mặt nước (tổng 120 cọc thân trụ đơn giản, 12 cọc cận cảnh có mũi sắt bọc chi tiết); L1 chuyển bệ sóng nước sang `T-NRM`. QC xác nhận góc đóng xiên đón đầu thủy triều rút đúng ảnh `15`.

#### `MB-057` — Đội Chiến Thuyền Cổ Đại Việt (ảnh ref: `15`, `68`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 đầu rồng gỗ chạm trên mũi 2 chiến thuyền chỉ huy thời Trần (1288) | `HV-A01` | 2 đầu & cổ rồng gỗ phong cách **Lý–Trần** (không sừng nai, mào lửa cong hình chữ S, bờm gọn, 3 móng ẩn) vươn chếch 30° ở mũi thuyền, chạm sâu 5 cm | `G-TUBE` | Dài `1.6m` | 2 | 3 600 | `woodParts` |
| 6 cánh buồm nan tre chiến thuyền Đại Việt (3 thuyền × 2 cột buồm) | `HV-NEW-MB-11` | 6 cánh buồm cánh dơi 9 nan tre căng gió màu nâu sồng sơn cờ hiệu đỏ-vàng thời Trần | `G-EXT` + `G-TUBE` | `3.8×5.8m` | 6 | 1 680 | `fabricParts` |
| 24 khiên gỗ tròn gắn dọc mạn 3 chiến thuyền | `HV-C14` | 24 tấm khiên gỗ tròn sơn đỏ-đen chạm nổi họa tiết hoa thị 8 cánh / mặt trời Đông Sơn ở tâm khiên xếp dọc 2 mạn thuyền | `G-EXT` + `G-INST` | Ø `0.62m` | 24 | 1 152 | `crimsonParts` |
| Mạn thuyền gỗ & đai sóng nước | `HV-D06` | 14 m băng sóng nước chạm nông và sơn son viền mạn trên của thuyền chỉ huy Đại Việt, sâu 1.5 cm | `G-EXT` | Băng cao `12cm` | 14 | 1 260 | `crimsonParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A01, HV-NEW-MB-11, HV-C14, HV-D06` | — | — | — | **7 692** | — |

**LOD/ghi chú QC:** L0 giữ 2 đầu rồng mũi thuyền kiểu Lý–Trần (`HV-A01`, chuẩn niên đại 1288, KHÔNG dùng rồng Nguyễn `HV-A03`), 6 buồm nan tre và 24 khiên mạn; L1 chuyển khiên và sóng mạn sang `T-NRM`. QC kiểm tra đủ hàng chèo mạn đều nhau.

#### `MB-058` — Chiến thuyền giặc mắc cạn & bốc cháy trên bãi cọc (ảnh ref: `15`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 cánh buồm rách cháy xém trên cột buồm nghiêng gãy | `HV-NEW-MB-11` | 2 cánh buồm thuyền chiến Nguyên–Mông (dạng cánh buồm nan ngang lớn màu xám nâu) xé rách mép, cháy đen loang lổ | `G-EXT` + `G-TUBE` | `4.5×6.0m` | 2 | 560 | `fabricParts` |
| Thân tàu gỗ thủng đáy mắc kẹt cọc sắt & đai sắt gia cố mạn | `HV-NEW-MB-09` | 6 thanh nẹp đai sắt rèn có đinh tán bọc quanh mũi và sống đáy tàu bị cọc gỗ lim đâm xuyên thủng 30 cm | `G-DISP` + `G-INST` | `1.2×0.3m` | 6 | 540 | `ironParts` |
| Ván mạn gãy vỡ & vết sóng nước quanh thân tàu nghiêng 22° | `HV-D06` | 8 m gờ ván vỡ xen họa tiết sóng cuộn trắng quanh mũi tàu chìm một phần trên bãi cọc | `G-EXT` | Băng cao `16cm` | 8 | 720 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-11, HV-NEW-MB-09, HV-D06` | — | — | — | **1 820** | — |

**LOD/ghi chú QC:** L0 giữ rõ góc nghiêng 22° thân tàu thủng gác lên cọc lim và buồm rách; L1 chuyển đai sắt sang `T-NRM`. QC đảm bảo tàu giặc khác kiểu nhận diện (buồm xám–đen, không gắn đầu rồng Đại Việt).

#### `MB-059` — 4 Bè Lửa Hỏa Công thả trôi sông Bạch Đằng (ảnh ref: `15`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 sạp phên tre đan chất củi khô & rơm tẩm nhựa thông | `HV-G03` | 4 mặt sàn bè tre nứa đan lóng mốt buộc lạt mây, rải bó rơm củi tẩm dầu cháy rực trên mặt sông | `T-NRM` + `S-SHD` | `3.2×1.8m` | 4 | 0 | `woodParts` |
| 4 cụm mũi bè bọc móc sắt móc vào mạn thuyền địch | `HV-NEW-MB-09` | 8 móc sắt rèn hình neo câu gắn đầu mũi 4 bè hỏa công (2 móc/bè) để bám chặt vào tàu giặc khi trôi tới, nổi 4 cm | `G-DISP` + `G-INST` | `0.45×0.25m` | 8 | 720 | `ironParts` |
| Dải hoa văn mây lửa & ngọn lửa động bốc sáng mặt nước | `HV-D05` | 4 cụm khung đỡ bó đuốc tạo hình sóng lửa cuộn đặt tâm bè làm nguồn phát hạt lửa/khói | `G-EXT` | `0.8×0.5m` | 4 | 480 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-G03, HV-NEW-MB-09, HV-D05` | — | — | — | **1 200** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 4 bè lửa; L1 ẩn móc sắt và chỉ giữ thân bè + hiệu ứng ánh lửa hắt mặt sông. QC kiểm tra vị trí 4 bè trôi xuôi dòng hướng sát mạn chiến thuyền giặc `MB-058`.

#### `MB-060` — Đền Thờ Ngô Quyền — Trần Hưng Đạo & Vách đá phục binh Tràng Kênh (ảnh ref: `15`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 góc mái đền thờ Tràng Kênh | `HV-A06` | 4 đầu đao mái đắp vữa cong vút hình đầu rồng cuốn mây hướng ra sông Bạch Đằng | `G-TUBE` + `G-EXT` | Dài `0.85m` | 4 | 2 600 | `roofParts` |
| Hoành phi đền thờ & nhà bia di tích | `HV-I01` | 2 bức hoành phi chữ Hán thếp vàng: `"白藤江"` (Bạch Đằng Giang) và `"陳興道祠"` (Trần Hưng Đạo Từ), khung chạm nổi 2.5 cm | `T-ATLAS` + `G-EXT` | `2.0×0.7m` | 2 | 240 | `goldParts` |
| Đỉnh đồng lớn đặt trước bệ tượng Trần Hưng Đạo chỉ tay ra sông | `HV-E07` | 1 đỉnh đồng 3 chân thú 2 quai rồng đặt trục giữa sân đền nhìn xuống sông Bạch Đằng | `G-LATHE` + `G-TUBE` | Cao `1.4m` | 1 | 900 | `bronzeParts` |
| 4 đèn đá cổ & bia đá chiến công trên vách Tràng Kênh | `HV-NEW-MB-12` | 4 cột đèn đá xanh 4 mặt lồng đèn đặt dọc bậc đá từ bến sông lên đền thờ Tràng Kênh | `G-LATHE` + `G-EXT` | Cao `1.7m` | 4 | 1 440 | `stoneParts` |
| Văn bia di tích 3 trận đại thắng Bạch Đằng | `HV-I03` | Mặt bia đá xanh khắc chìm Hán-Nôm ca ngợi chiến công 938 (Ngô Quyền), 981 (Lê Hoàn), 1288 (Trần Hưng Đạo) | `T-NRM` | `1.2×1.9m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A06, HV-I01, HV-E07, HV-NEW-MB-12, HV-I03` | — | — | — | **5 180** | — |

**LOD/ghi chú QC:** L0 giữ 4 đầu đao, đỉnh đồng và 4 đèn đá; L1 chuyển đèn đá và bia sang `T-NRM`/low-poly. QC kiểm tra tượng đồng Trần Hưng Đạo trên vách đá Tràng Kênh hướng tay chỉ thẳng xuống bãi cọc `MB-056`.

---

## 1.6. Mù Cang Chải & Chùa Hương (`08`, `08b`, `09`, `107`, `121`)

#### `MB-061` — Đồi Mâm Xôi La Pán Tẩn (ảnh ref: `05`, `76`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 18 vòng bờ đất đồng tâm đắp bậc thang (hình khối mâm xôi) | `HV-D06` | 18 m module bờ đất cong uốn sóng tự nhiên có cỏ mọc viền mép nước từng bậc lúa chín vàng (tổ hợp lặp đồng tâm) | `G-EXT` + `G-INST` | Bờ cao `0.45m` | 18 | 1 620 | `stoneParts` |
| Rải đá kè bậc ở 4 đoạn dẫn nước tưới ruộng | `HV-NEW-MB-08` | 4 cụm đá suối xếp tay gia cố máng xả nước từ tầng trên xuống tầng dưới Đồi Mâm Xôi | `G-DISP` + `G-INST` | `1.2×0.6m` | 4 | 560 | `stoneParts` |
| Cờ & dải thổ cẩm H'Mông tại lối ngắm cảnh chân đồi | `HV-NEW-MB-07` | Băng vải thổ cẩm H'Mông La Pán Tẩn (hoa văn xoắn ốc sáp ong chàm–trắng–đỏ) buộc cọc tre lối vào đồi | `T-ATLAS` + `T-NRM` | `0.25×2.0m` | 4 | 0 | `fabricParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D06, HV-NEW-MB-08, HV-NEW-MB-07` | — | — | — | **2 180** | — |

**LOD/ghi chú QC:** Trọng tâm thị giác là 18 tầng ruộng đồng tâm uốn cong + shader lúa chín vàng gió lay; L1 giản lược kè đá. QC đối chiếu vòng tròn đồng tâm đỉnh đồi và chòi trung tâm đúng ảnh `05`, `76`.

#### `MB-062` — Chòi canh lúa trên đỉnh Đồi Mâm Xôi (ảnh ref: `05`, `76`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vách liếp & sàn chòi canh lúa | `HV-G03` | Phên nứa đan lóng mốt chữ nhân bọc 3 mặt vách chòi sàn gỗ mộc trên đỉnh Đồi Mâm Xôi | `T-NRM` + `S-SHD` | `2.6×1.6m` | 3 | 0 | `woodParts` |
| Đỉnh 2 đầu hồi mái lá cọ chòi canh | `HV-NEW-MB-06` | 1 cặp thanh gỗ nhỏ bắt chéo đơn sơ kiểu Tây Bắc giữ sống mái lá cọ chống gió núi | `G-EXT` + `G-TUBE` | `0.7×0.5m` | 1 | 240 | `woodParts` |
| Tấm vải thổ cẩm & gùi tre treo hiên chòi | `HV-NEW-MB-07` | Tấm vải H'Mông hoa văn xoắn ốc sáp ong chàm–trắng phơi trên thanh sào tre trước chòi | `T-ATLAS` + `T-NRM` | `0.6×1.2m` | 2 | 0 | `fabricParts` |
| Lan can tre mộc trên sàn chòi | `HV-D10` | 10 thanh cọc tre tròn đứng đều làm tay vịn sàn gỗ đầu cầu thang tre 5 bậc | `G-LATHE` + `G-INST` | Cao `0.6m` | 10 | 560 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-G03, HV-NEW-MB-06, HV-NEW-MB-07, HV-D10` | — | — | — | **800** | — |

**LOD/ghi chú QC:** L0 giữ khung chòi, cặp thanh chéo đầu hồi và lan can tre; L1 ẩn chi tiết lan can khi `> 40m`, giữ silhouette mái lá cọ trên đỉnh Đồi Mâm Xôi đúng ảnh `76`.

#### `MB-063` — Bản Nhà Sàn người Thái — Mông (Khau Cút) (ảnh ref: `77`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cặp sừng gỗ *Khau Cút* đầu hồi mái (4 nhà sàn × 2 đầu hồi) | `HV-NEW-MB-06` | 8 cặp *Khau Cút* gỗ bắt chéo chữ X vươn cao trên 2 đầu hồi mái nhà sàn Thái Đen, đầu sừng chạm ngọn hoa sen/lá dương xỉ cách điệu, sâu 3 cm | `G-EXT` + `G-TUBE` | Cao `1.15m` | 8 | 1 920 | `woodParts` |
| Vách phên nứa & cửa sổ nhà sàn | `HV-G03` | Phên nứa đan mắt cáo và lóng mốt chữ nhân bọc vách 4 ngôi nhà sàn gỗ cao 2m | `T-NRM` + `S-SHD` | Toàn vách nhà | 4 | 0 | `woodParts` |
| Khăn Piêu & dải thổ cẩm Thái – Mông phơi ban công | `HV-NEW-MB-07` | Hoa văn thổ cẩm Thái (hoa ban 8 cánh, hình thoi đỏ–đen–trắng) và sáp ong H'Mông phơi dọc lan can gỗ | `T-ATLAS` + `T-NRM` | `0.45×1.8m` | 6 | 0 | `fabricParts` |
| Lan can gỗ hiên đón khách (*Quản*) 4 nhà sàn | `HV-D10` | 32 con tiện gỗ mộc tiện thô (8 con/nhà) xếp dọc hành lang gỗ trước cửa vào sàn | `G-LATHE` + `G-INST` | Cao `0.65m` | 32 | 1 792 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-06, HV-G03, HV-NEW-MB-07, HV-D10` | — | — | — | **3 712** | — |

**LOD/ghi chú QC:** L0 giữ nguyên 8 cặp Khau Cút chữ X trên đầu hồi mái (điểm nhận diện đặc trưng nhất của nhà sàn Thái Tây Bắc, tuyệt đối không gắn sừng trâu Tây Nguyên `HV-G05` lên nhà Thái!); L1 chuyển con tiện sang `T-NRM`. QC đối chiếu ảnh `77`.

#### `MB-064` — Hệ thống Cọn Nước (Guồng nước tre) quay bên suối (ảnh ref: `76`, `77`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 bánh xe tre guồng nước `Ø6m` (cánh quạt phên nứa) | `HV-G03` | 24 tấm phên nứa đan lóng mốt buộc nan tre dọc vành ngoài 2 bánh xe guồng nước để đón dòng chảy suối Nậm Kim | `T-NRM` + `S-SHD` | `0.5×0.35m` | 24 | 0 | `woodParts` |
| 24 ống nứa múc nước buộc nghiêng quanh vành bánh xe | `HV-D10` | 24 ống tre vát miệng dài 0.55m buộc nghiêng 45° dọc vành guồng (12 ống/bánh xe) dùng hình trụ tiện `G-LATHE` | `G-LATHE` + `G-INST` | Dài `0.55m` | 24 | 1 344 | `woodParts` |
| Họa tiết nan chéo & vòng đồng tâm trục guồng | `HV-C14` | 2 cụm nan tre đan tỏa tâm 8 cánh (hình hoa thị) gia cố trục gỗ trung tâm của 2 bánh xe guồng nước `Ø6m` | `G-EXT` | Ø `1.6m` | 2 | 96 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-G03, HV-D10, HV-C14` | — | — | — | **1 440** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 24 ống nứa múc nước; L1 giảm segment ống nứa còn 6 cạnh và giữ chuyển động quay quanh trục X/Z. QC kiểm tra máng tre hứng nước khớp đúng đỉnh quỹ đạo ống nứa đổ xuống.

#### `MB-065` — Đèo Khau Phạ & Bãi cất cánh Dù Lượn (ảnh ref: `05`, `76`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cờ gió & dải hoa văn trang trí lễ hội Dù Lượn trên đồi | `HV-NEW-MB-07` | Họa tiết thổ cẩm Tây Bắc in trên băng rôn sân xuất phát và túi gió đo hướng gió đỉnh đèo Khau Phạ | `T-ATLAS` + `T-NRM` | `0.8×3.0m` | 3 | 0 | `fabricParts` |
| Cột mốc & biển chỉ đường đèo Tứ Đại Đỉnh Đèo | `HV-I04` | Biển giao thông xanh trắng `"ĐÈO KHAU PHẠ — ĐỘ CAO 1.200m — BÃI CẤT CÁNH DÙ LƯỢN"` + mốc KM đá | `T-ATLAS` + `G-EXT` | `1.5×0.9m` | 2 | 80 | `ironParts` |
| Lan can gỗ quan sát thung lũng Cao Phạ | `HV-D10` | 16 trụ gỗ mộc tròn đặt dọc mép sườn đồi bãi cất cánh ngắm ruộng bậc thang Lìm Mông bên dưới | `G-LATHE` + `G-INST` | Cao `0.85m` | 16 | 896 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-07, HV-I04, HV-D10` | — | — | — | **976** | — |

**LOD/ghi chú QC:** L0 giữ biển đèo Khau Phạ và 16 cọc lan can bãi xuất phát; L1 chuyển trụ gỗ sang hộp tối giản. QC xác nhận 4–6 cánh dù lượn đa sắc bay phía trên thung lũng Cao Phạ ở cao độ hợp lý.

#### `MB-066` — Cầu treo dây cáp bắc qua suối Nậm Kim (ảnh ref: `76`, `77`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 trụ tháp bê tông đầu cầu treo chữ A | `HV-H04` | 12 m gờ phào ngang sơn trắng–đỏ và mũ trụ bê tông cốt thép 2 đầu cầu treo dây võng qua suối Nậm Kim, nhô 8 cm | `G-EXT` quét | Cao `0.2m` | 12 | 480 | `plasterParts` |
| Hàng thanh treo đứng & lưới thép lan can cầu | `HV-H09` | 28 thanh cáp/song thép đứng (14 thanh mỗi bên dọc cầu dài 28m) đỡ mặt ván gỗ và lưới bảo vệ | `G-INST` | Cao `1.2m` | 28 | 1 680 | `ironParts` |
| Biển tải trọng cầu treo vùng cao | `HV-I04` | Biển báo vàng–đen `"CẦU TREO NẬM KIM — CẤM QUÁ TẢI"` gắn ngang xà trên trụ đầu cầu | `T-ATLAS` | `1.2×0.4m` | 2 | 0 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H04, HV-H09, HV-I04` | — | — | — | **2 160** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 28 thanh treo đứng; L1 thay lưới lan can bằng alpha-card và ẩn thanh treo khi `> 60m`. QC kiểm tra dây cáp chính uốn theo đường dây xích (catenary) nối kín 2 đỉnh trụ.

#### `MB-067` — Suối Yến uốn lượn & Cầu Hội (ảnh ref: `09`, `107`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Thảm lá súng khuyết V dọc 2 bờ Suối Yến | `HV-C06` | 60 lá súng tròn phẳng có khe chữ V đặc trưng (`Ø0.25–0.45m`, lá xanh riêng không lẫn màu nền) nổi sát mặt nước dọc 2 bờ suối | `G-EXT` + `G-INST` | Ø `0.35m` | 60 | 1 920 | `leafParts` |
| Cụm hoa súng hồng–tím & hoa sen nở trên Suối Yến | `HV-C04` | 3 cụm hoa súng/sen hồng tím nhiều cánh nhọn nở nổi xen giữa thảm lá khuyết V | `G-INST` + `G-LATHE` | Ø `0.28m` | 3 | 3 600 | `pinkParts` |
| Lan can Cầu Hội bắc qua Suối Yến | `HV-C13` | 24 ô gạch thông gió hoa chanh 4 cánh (12 ô mỗi bên thành cầu cong) sơn vàng đất đặc trưng Cầu Hội | `G-EXT` + `G-INST` | Ô `0.24×0.24m` | 24 | 864 | `plasterParts` |
| 4 đầu trụ cầu & gờ đá bờ suối | `HV-C03` | 4 búp sen vữa cổ 3 lớp cánh khép đặt trên 4 trụ đầu Cầu Hội | `G-LATHE` | Cao `0.42m` | 4 | 720 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C06, HV-C04, HV-C13, HV-C03` | — | — | — | **7 104** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 60 lá súng khuyết V (kiểm tra sửa bug B5: lá súng có khe chữ V rõ, vật liệu xanh lục riêng biệt, không nổi lơ lửng trên mặt nước); L1 hạ hoa súng sang billboard và ô hoa chanh Cầu Hội sang `T-NRM`. QC đối chiếu ảnh `107`.

#### `MB-068` — Đội Đò Nan Chùa Hương (ảnh ref: `107`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 chiếc đò nan chèo tay trên Suối Yến (thân đò cong hai đầu) | `HV-NEW-MB-11` | 6 bộ thanh giằng tre uốn cong và ván/tôn mũi đò vểnh hai đầu (mỗi đò 1 module chi tiết mũi & lái), nổi gân 2 cm | `G-EXT` + `G-INST` | Dài `5.2m` | 6 | 1 680 | `ironParts` |
| Sạp tre lót sàn 6 chiếc đò nan | `HV-G03` | Nan tre đan lóng mốt làm sạp ngồi và tấm lót đáy đò chống ướt cho khách hành hương | `T-NRM` + `S-SHD` | `3.2×0.9m` | 6 | 0 | `woodParts` |
| Số hiệu đò & chữ trên mạn đò Suối Yến | `HV-I04` | Số hiệu sơn trắng `"ĐÒ DU LỊCH CHÙA HƯƠNG — SỐ 01..06"` trên mạn tôn xanh/xám của 6 chiếc đò | `T-ATLAS` | `0.8×0.2m` | 6 | 0 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-11, HV-G03, HV-I04` | — | — | — | **1 680** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho đội 6 đò nan, kèm người chèo đội nón lá và áo phao cam; L1 giữ vỏ đò tối giản. QC đối chiếu hình dáng đò dài hẹp vểnh mũi đúng ảnh `107`.

#### `MB-069` — Bến Trò & Cổng Tam Quan Chùa Thiên Trù (ảnh ref: `09`, `78`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 8 góc mái Tam Quan 3 lối chồng diêm | `HV-A06` | 8 đầu đao mái vút cong 38° đắp vữa hình đầu rồng cuốn mây (4 góc tầng trên + 4 góc tầng dưới) | `G-TUBE` + `G-EXT` | Dài `0.9m` | 8 | 5 200 | `roofParts` |
| Đỉnh 4 trụ biểu hai bên Tam Quan | `HV-C03` | 4 búp sen vữa cổ 3 lớp cánh khép đặt trên 4 cột trụ đồng trụ đầu cầu thang hành hương từ Bến Trò lên | `G-LATHE` | Cao `0.5m` | 4 | 720 | `plasterParts` |
| Trán cổng giữa & 2 cổng phụ Tam Quan | `HV-I01` | Hoành phi đắp nổi 3 chữ Hán `"天廚寺"` (Thiên Trù Tự — Chùa Bếp Trời) chính giữa, 2 bên đề `"福"` (Phúc) — `"壽"` (Thọ), khung nổi 2.5 cm | `T-ATLAS` + `G-EXT` | `2.1×0.7m` | 3 | 360 | `plasterParts` |
| Diềm mái 3 lối Tam Quan | `HV-D15` | 48 viên ngói mũi hài cánh vảy viền diềm mái mặt tiền Tam Quan hướng xuống Bến Trò | `G-INST` | `0.12×0.36m` | 48 | 1 920 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A06, HV-C03, HV-I01, HV-D15` | — | — | — | **8 200** | — |

**LOD/ghi chú QC:** L0 giữ 8 đầu đao cong, 4 búp sen trụ biểu và đại tự `"天廚寺"`; L1 chuyển ngói diềm sang `T-NRM`. QC xác nhận đúng 3 lối đi vòm cuốn và bậc đá hành hương nối từ Bến Trò đúng ảnh `09`, `78`.

#### `MB-070` — Chùa Thiên Trù — Điện Tam Bảo & Tháp Viên Công (ảnh ref: `09`, `78`, `121`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tòa Cửu Long gian giữa Điện Tam Bảo | `HV-A05` | 9 con rồng chạm lộng sơn son thếp vàng phong cách Lê Trung Hưng–Nguyễn quấn quanh vòm hào quang phun nước tắm Phật sơ sinh, sâu 4 cm | `G-EXT` | `0.42×0.24m` | 9 | 3 780 | `goldParts` |
| Cửa võng chính điện Tam Bảo | `HV-D12` | 2 bộ cửa võng chạm lộng thủng thếp vàng hình rồng phượng xen hoa sen treo trước Tam Thế Phật, sâu 5 cm | `G-EXT` thủng | `3.0×0.95m` | 2 | 3 200 | `goldParts` |
| Tháp Viên Công (tháp gạch nung đỏ 3 tầng thế kỷ XVII) | `HV-C01` | 24 cánh sen đất nung chạm nổi 2.5 cm ốp quanh cổ bệ và 3 tầng mái Tháp Viên Công đặt trước sân chùa (biểu tượng mỹ thuật Lê Trung Hưng) | `G-INST` | Cánh `0.22×0.14m` | 24 | 1 152 | `brickParts` |
| 4 cửa vòm lá đề 4 mặt Tháp Viên Công | `HV-C09` | 4 vòm lá đề đất nung nhọn đuôi chạm mây đao trên 4 mặt thân tháp tầng 1, sâu 2.5 cm | `G-EXT` | `0.55×0.9m` | 4 | 360 | `brickParts` |
| Bề mặt nội thất Tam Bảo sơn son thếp vàng | `HV-J04` | Vật liệu sơn son thếp vàng phủ hệ cột, hương án và Tòa Cửu Long trong Điện Tam Bảo | Material | Toàn gian thờ | 1 | 0 | `crimsonParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A05, HV-D12, HV-C01, HV-C09, HV-J04` | — | — | — | **8 492** | — |

**LOD/ghi chú QC:** L0 giữ nguyên Tháp Viên Công gạch đỏ chạm sen (kiệt tác đất nung thế kỷ XVII) ở sân ngoài, và Tòa Cửu Long + 2 cửa võng trong điện; L1 ẩn nội thất điện khi `> 40m`, giữ Tháp Viên Công. QC đối chiếu ảnh `78`, `121`.

#### `MB-071` — Cửa Động Hương Tích *"Nam Thiên Đệ Nhất Động"* (ảnh ref: `52`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 5 chữ Hán khắc trên vách đá đỉnh cửa động (1770) | `HV-I03` | 5 đại tự `"南天第一洞"` (Nam Thiên Đệ Nhất Động — Tĩnh Đô Vương Trịnh Sâm đề năm Canh Dần 1770) khắc chìm 4 cm tô đỏ/vàng trực tiếp trên vách đá vôi mái vòm | `T-NRM` | `3.2×0.85m` | 1 | 0 | `stoneParts` |
| Khung viền đá vôi tự nhiên & hàm rồng cửa động | `HV-NEW-MB-08` | 12 cụm nhũ đá rủ quanh miệng hang hình hàm rồng khổng lồ há rộng đón khách hành hương xuống bậc đá | `G-LATHE` + `G-INST` | Dài `1.0–3.8m` | 12 | 1 680 | `stoneParts` |
| Lan can đá & 4 đèn đá dọc 120 bậc đá xuống cửa động | `HV-NEW-MB-12` | 4 cây đèn đá xanh cổ lồng đèn chạm mây đặt dọc hai bên bậc đá rêu phong xuống miệng động | `G-LATHE` + `G-EXT` | Cao `1.5m` | 4 | 1 440 | `stoneParts` |
| Viền bậc đá khắc chữ Hán & hoa văn mây | `HV-D05` | 6 cụm mây xoắn đá xanh chạm ở 2 trụ đầu bậc trước cửa động, sâu 2 cm | `G-EXT` | `0.38×0.24m` | 6 | 720 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I03, HV-NEW-MB-08, HV-NEW-MB-12, HV-D05` | — | — | — | **3 840** | — |

**LOD/ghi chú QC:** L0 giữ rõ 5 chữ `"南天第一洞"` khắc trên vách đá vòm hang (không dựng bảng gỗ rời!) và 12 cụm nhũ hàm rồng; L1 chuyển mây trụ và đèn đá sang low-poly. QC đối chiếu đúng góc nhìn cửa động ảnh `52`.

#### `MB-072` — Lòng Động Hương Tích (`28m`) (ảnh ref: `52`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tòa sen dưới tượng Quan Âm đá xanh (1793 — Tây Sơn) | `HV-C01` | 24 cánh sen đá xanh chạm 2 tầng so le đỡ tượng Phật Bà Quan Âm đá xanh cổ niên đại 1793 ở bệ chính giữa động, sâu 2.5 cm | `G-INST` | Cánh `0.18×0.11m` | 24 | 1 152 | `stoneParts` |
| Nhũ đá Đụn Gạo — Cây Vàng — Cây Bạc — Núi Cô — Núi Cậu | `HV-NEW-MB-08` | 20 cụm măng đá & nhũ đá karst lớn rủ từ trần cao `28m` và mọc giữa nền động (nổi bật khối Đụn Gạo khổng lồ ở chính giữa), rãnh canxit ướt bóng | `G-LATHE` + `G-INST` | Cao `1.5–7.5m` | 20 | 2 800 | `stoneParts` |
| Đỉnh đồng cổ & hương án chính trong động | `HV-E07` | 2 đỉnh đồng 3 chân 2 quai rồng đặt trước ban thờ Tam Bảo — Quan Âm tỏa khói hương nghi ngút | `G-LATHE` + `G-TUBE` | Cao `1.2m` | 2 | 1 800 | `bronzeParts` |
| Cửa võng thếp vàng & hoành phi ban thờ trong động | `HV-D12` | 1 bộ cửa võng chạm lộng thếp vàng rồng mây treo trước khám thờ Quan Âm trong lòng hang ẩm, sâu 4 cm | `G-EXT` thủng | `2.6×0.85m` | 1 | 1 600 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C01, HV-NEW-MB-08, HV-E07, HV-D12` | — | — | — | **7 352** | — |

**LOD/ghi chú QC:** Nội thất lòng động chỉ render L0 khi camera vào cửa hang (`< 35m`); L1 cull toàn bộ tượng/ban thờ, giữ vỏ đá ngoài. QC kiểm tra khối nhũ Đụn Gạo đứng chính giữa lòng động và ánh sáng đèn thờ hắt lên trần nhũ đúng ảnh `52`.

---

## 1.7. Khu Di Tích Đền Hùng — Phú Thọ (`10`, `65`, `79`)

#### `MB-073` — Cổng Đền Hùng *"Cao Sơn Cảnh Hành"* (ảnh ref: `65`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Trán vòm cổng chính tầng 2 (1917 — Khải Định) | `HV-I01` | 4 đại tự chữ Hán đắp nổi `"高山景行"` (Cao Sơn Cảnh Hành — Lên núi cao ngắm đường lớn) trên nền vôi vàng cổ, khung viền nổi 3 cm | `T-ATLAS` + `G-EXT` | `2.4×0.75m` | 1 | 120 | `plasterParts` |
| 8 góc mái 2 tầng cổng vòm cuốn | `HV-A06` | 8 đầu đao mái cong 35° đắp vữa cổ hình đầu rồng cuốn mây hướng ra 4 góc tầng trên và tầng dưới | `G-TUBE` + `G-EXT` | Dài `0.9m` | 8 | 5 200 | `roofParts` |
| Đôi Nghê đá chầu hai bên cổng | `HV-B04` | 2 tượng Nghê đá xanh ngồi bệ vuông chầu quay mặt ra lối vào, bờm xoáy 3 lọn, mõm rộng nhe nanh, chạm sâu 5 cm | `G-*` tổ hợp | Cao `0.95m` | 2 | 2 200 | `stoneParts` |
| 2 bức phù điêu chiến sĩ (công — võ hộ vệ) hai bên vòm cổng | `HV-NEW-MB-10` | 2 phù điêu đắp nổi hình chiến sĩ cổ đại cầm giáo mác/trống đồng trong 2 ô khung vòm hai bên cổng chính, nổi 5 cm | `G-DISP` | `1.1×1.8m` | 2 | 1 240 | `plasterParts` |
| Diềm mái 2 tầng & vòm cuốn cổng | `HV-D15` | 48 viên ngói mũi hài cánh vảy viền diềm mái mặt tiền Cổng Đền Hùng | `G-INST` | `0.12×0.36m` | 48 | 1 920 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I01, HV-A06, HV-B04, HV-NEW-MB-10, HV-D15` | — | — | — | **10 680** | — |

**LOD/ghi chú QC:** L0 giữ 8 đầu đao, đôi Nghê đá, 2 phù điêu chiến sĩ và đại tự `"高山景行"`; L1 chuyển phù điêu và ngói sang `T-NRM`. QC bắt buộc chữ `"高山景行"` đúng Hán tự, 2 tầng 8 mái chuẩn ảnh `65`.

#### `MB-074` — Đền Hạ & Chùa Thiên Quang (ảnh ref: `65`, `79`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Gác chuông 2 tầng Chùa Thiên Quang (Đại Hồng Chung) | `HV-E06` | 1 Đại Hồng Chung đồng cổ treo tầng 2 gác chuông 8 mái, quai rồng bồ lao đôi, 4 núm hoa sen nổi 2 cm | `G-LATHE` + `G-TUBE` | Cao `1.6m` | 1 | 1 400 | `bronzeParts` |
| 8 góc mái gác chuông & 4 góc Đền Hạ | `HV-A06` | 12 đầu đao mái đắp vữa cong vút hình đầu rồng hóa mây kiểu Bắc Bộ | `G-TUBE` + `G-EXT` | Dài `0.85m` | 12 | 7 800 | `roofParts` |
| Hoành phi Đền Hạ & Chùa Thiên Quang | `HV-I01` | 2 bức hoành phi chữ Hán thếp vàng: `"天光寺"` (Thiên Quang Tự) và `"下祠"` (Hạ Từ — nơi Âu Cơ sinh bọc trăm trứng), viền nổi 2.5 cm | `T-ATLAS` + `G-EXT` | `1.9×0.65m` | 2 | 240 | `goldParts` |
| Viền bồn đá gốc Cây Vạn Tuế 700 tuổi | `HV-C01` | 16 cánh sen đá xanh ốp quanh bồn bát giác bao gốc cây Vạn Tuế 3 nhánh cổ thụ, sâu 2 cm | `G-INST` | Cánh `0.28×0.16m` | 16 | 768 | `stoneParts` |
| Sân lát gạch đỏ giữa Đền Hạ — Chùa Thiên Quang | `HV-NEW-MB-03` | Sân gạch Bát Tràng đỏ trầm lát thẳng rêu phong kẽ mạch rộng trước thềm Đền Hạ | `T-NRM` + `S-SHD` | Sân `22×16m` | 1 | 0 | `brickParts` |
| **Tổng** | — | `requiredMotifs`: `HV-E06, HV-A06, HV-I01, HV-C01, HV-NEW-MB-03` | — | — | — | **10 208** | — |

**LOD/ghi chú QC:** L0 giữ 12 đầu đao, chuông đồng gác chuông và bồn sen cây Vạn Tuế; L1 chuyển cánh sen bồn cây sang `T-NRM`. QC xác nhận cây Vạn Tuế 700 tuổi đứng đúng góc sân trước Chùa Thiên Quang.

#### `MB-075` — Đền Trung trên sườn núi Nghĩa Lĩnh (ảnh ref: `79`, `38`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Trống Đồng Đông Sơn trưng bày tiền tế (mặt trời tâm) | `HV-E01` | 1 Trống Đồng đồng đen đặt trên giá gỗ tiền tế Đền Trung: tâm ngôi sao **14 cánh** nổi 1.5 cm xen họa tiết lông công | `G-DISP` | Ø `0.85m` | 1 | 800 | `bronzeParts` |
| Vành chim Lạc & 4 tượng cóc trên mặt Trống Đồng | `HV-E02` | 18 chim Lạc bay ngược chiều kim đồng hồ khắc nổi quanh mặt trống kết hợp vòng tiếp tuyến răng cưa | `G-DISP` | Chim `6cm` | 18 | 720 | `bronzeParts` |
| 4 con cóc đúc trên vành mặt Trống Đồng | `HV-B07` | 4 tượng cóc đồng ngồi 4 góc mặt trống quay ngược chiều kim đồng hồ (đặc trưng trống Đông Sơn nhóm A), nổi 4 cm | `G-LATHE` + `G-DISP` | Cao `0.12m` | 4 | 1 040 | `bronzeParts` |
| Kiệu rước Vua Hùng sơn son thếp vàng tại tiền tế | `HV-A05` | 4 đầu rồng chạm lộng long hóa mây trên 4 góc mui kiệu và 2 đầu đòn khiêng sơn son thếp vàng (`HV-J04`), sâu 4 cm | `G-EXT` | `0.45×0.22m` | 4 | 1 680 | `goldParts` |
| Hoành phi Đền Trung (Hùng Vương Tổ Miếu) | `HV-I01` | Đại tự nền son chữ Hán thếp vàng `"雄王祖廟"` (Hùng Vương Tổ Miếu), khung chạm hồi văn nổi 2.5 cm | `T-ATLAS` + `G-EXT` | `2.2×0.72m` | 1 | 120 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-E01, HV-E02, HV-B07, HV-A05, HV-I01` | — | — | — | **4 360** | — |

**LOD/ghi chú QC:** L0 giữ nguyên Trống Đồng Đông Sơn đầy đủ ngôi sao 14 cánh + 18 chim Lạc + 4 cóc đồng (ảnh `38`) và kiệu rước thếp vàng; L1 chuyển họa tiết mặt trống sang `T-NRM` và ẩn kiệu khi `> 35m`. QC kiểm tra sân `18×14m` đúng tỷ lệ.

#### `MB-076` — Đền Thượng (Kính Thiên Lĩnh Điện) (ảnh ref: `79`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc gian chính Đền Thượng đỉnh núi Nghĩa Lĩnh | `HV-A04` | Đôi rồng đắp vữa cổ Bắc Bộ chầu mặt trời bốc lửa ở tâm bờ nóc, thân uốn 7 khúc, vảy nổi rõ 5 cm | `G-TUBE` + `G-LATHE` | Dài `2.6m`/rồng | 1 | 2 800 | `roofParts` |
| Trán 2 đầu hồi mái | `HV-B02` | 2 tượng Phượng ngậm cuộn thư đắp vữa đứng giữa trán đầu hồi Đông — Tây hướng vào trục chính điện, nổi 4 cm | `G-EXT` | `0.75×0.55m` | 2 | 1 040 | `roofParts` |
| Cổ diêm mặt tiền 4 gian Đền Thượng | `HV-D02` | 8 ô chữ Thọ tròn (團壽) đắp nổi trong khung ô hộc cổ diêm sơn vàng–đỏ xen kẽ băng hồi văn, nổi 2.5 cm | `G-EXT` | Ø `0.34m` | 8 | 1 120 | `plasterParts` |
| 4 bộ cửa bức bàn 3 ô mặt tiền (8 cánh) | `HV-D13` | 8 cánh cửa bức bàn gỗ lim sơn nâu đỏ (ô trên chấn song, ô giữa chạm Tứ Quý, ô dưới pano kín), sâu 2 cm | `G-EXT` + `T-NRM` | Cánh `0.78×2.2m` | 8 | 1 760 | `woodParts` |
| Đại tự mặt tiền Kính Thiên Lĩnh Điện | `HV-I01` | Bức đại tự chữ Hán thếp vàng `"敬天嶺殿"` (Kính Thiên Lĩnh Điện) & biển `"南越肇祖"` (Nam Việt Triệu Tổ) trong chính điện | `T-ATLAS` + `G-EXT` | `2.2×0.75m` | 2 | 240 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A04, HV-B02, HV-D02, HV-D13, HV-I01` | — | — | — | **6 960** | — |

**LOD/ghi chú QC:** L0 giữ bờ nóc lưỡng long, 2 phượng ngậm thư đầu hồi, 8 chữ Thọ cổ diêm và 8 cánh cửa bức bàn; L1 chuyển cổ diêm và cửa bức bàn sang `T-NRM`. QC đối chiếu nghiêm ngặt mái và cổ diêm ảnh `79`.

#### `MB-077` — Cột Đá Thề Thục Phán (ảnh ref: `10`, `79`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 mặt bệ vuông đá xanh đỡ Cột Đá Thề | `HV-D01` | 8 m băng hồi văn vuông khắc viền cổ bệ đá vuông 2 cấp (mỗi mặt 2m), sâu 1.5 cm | `G-EXT` | Băng cao `12cm` | 8 | 480 | `stoneParts` |
| Đế cổ trụ vát chóp nhọn (truyền thuyết An Dương Vương) | `HV-C01` | 12 cánh sen đá xanh cổ điển chạm nổi 2 cm quanh cổ tiếp giáp giữa thân trụ đá vát 4 cạnh và bệ vuông | `G-INST` | Cánh `0.2×0.14m` | 12 | 576 | `stoneParts` |
| Lan can đá thấp bao quanh Cột Đá Thề | `HV-C03` | 4 búp sen đá nhỏ khép cánh đặt trên 4 trụ góc hàng rào đá xanh bao quanh cột | `G-LATHE` | Cao `0.26m` | 4 | 720 | `stoneParts` |
| Bia chú thích lịch sử Cột Đá Thề (258 TCN) | `HV-I04` | Bia đá nhỏ khắc Quốc ngữ lời thề Thục Phán — An Dương Vương đời đời bảo vệ giang sơn Vua Hùng | `T-ATLAS` | `0.8×0.55m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D01, HV-C01, HV-C03, HV-I04` | — | — | — | **1 776** | — |

**LOD/ghi chú QC:** L0 giữ thân trụ đá vát chóp nhọn nguyên khối trên bệ vuông và lan can 4 trụ búp sen; L1 chuyển cánh sen và hồi văn sang `T-NRM`. QC xác nhận đặt đúng vị trí cạnh bên trái Đền Thượng.

#### `MB-078` — Lăng Vua Hùng thứ 6 (ảnh ref: `10`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 8 góc mái lăng hình vuông chồng diêm (1922) | `HV-A06` | 8 đầu đao vữa cổ cong vút 35° (4 góc mái tầng trên + 4 góc mái tầng dưới) màu xám vàng rêu phong, nổi 4 cm | `G-TUBE` + `G-EXT` | Dài `0.85m` | 8 | 5 200 | `roofParts` |
| Bộ đỉnh đồng & đôi hạc đồng đặt giữa lăng mộ | `HV-E07` | 1 đỉnh đồng 3 chân 2 quai rồng đặt trước mộ đá hình vuông trong lăng 4 cột đá | `G-LATHE` + `G-TUBE` | Cao `1.15m` | 1 | 900 | `bronzeParts` |
| Đôi hạc đồng chầu quy hai bên đỉnh đồng | `HV-B06` | 2 hạc đồng cổ đứng trên lưng rùa đặt đối xứng hai bên đỉnh hương trước mộ Vua Hùng thứ 6 | `G-TUBE` + `G-LATHE` | Cao `1.5m` | 2 | 1 800 | `bronzeParts` |
| Hoành phi & 4 cột đá khắc câu đối quanh lăng | `HV-I01` | Bức đại tự đắp nổi `"雄王陵"` (Hùng Vương Lăng) mặt Nam kèm 4 câu đối đá (`HV-I02` × 4 cột) ca ngợi công đức mở cõi | `T-ATLAS` + `G-EXT` | `1.8×0.6m` | 1 | 120 | `plasterParts` |
| Câu đối khắc trên 4 cột đá góc lăng | `HV-I02` | 4 mặt câu đối chữ Hán khắc dọc trên 4 trụ đá vuông mặt ngoài Lăng Vua Hùng, viền nổi 1.5 cm | `T-ATLAS` + `G-EXT` | `0.28×2.2m` | 4 | 240 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A06, HV-E07, HV-B06, HV-I01, HV-I02` | — | — | — | **8 260** | — |

**LOD/ghi chú QC:** L0 giữ nguyên kiến trúc vuông 4 cột đá, 8 đầu đao mái chồng diêm, đỉnh đồng và đôi hạc; L1 chuyển câu đối và giảm đỉnh/hạc còn 40% tri. QC đối chiếu chính xác ảnh `10` (mái chồng diêm vuông màu vàng rêu, không biến thành tháp tròn).

#### `MB-079` — Đền Giếng & Giếng Ngọc chân núi (ảnh ref: `65`, `79`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 góc mái cong Đền Giếng soi bóng xuống Giếng Ngọc | `HV-A06` | 4 đầu đao rồng cuốn đắp vữa cổ cong vút vươn ra mặt giếng thờ Công chúa Tiên Dung — Ngọc Hoa | `G-TUBE` + `G-EXT` | Dài `0.85m` | 4 | 2 600 | `roofParts` |
| Thành đá tròn Giếng Ngọc (`Ø2.2m`) | `HV-D06` | 7 m băng sóng nước thủy ba 2 lớp chạm quanh thành đá xanh tròn rêu phong của Giếng Ngọc trong vắt, sâu 2 cm | `G-EXT` | Băng cao `14cm` | 7 | 630 | `stoneParts` |
| Lan can tường hoa bao quanh sân Giếng Ngọc | `HV-C13` | 24 ô gạch thông gió hoa chanh 4 cánh tròn sơn vàng cổ bao quanh sân hành hương quanh giếng, đục thủng 10 cm | `G-EXT` + `G-INST` | Ô `0.24×0.24m` | 24 | 864 | `plasterParts` |
| Hoành phi gian thờ Đền Giếng | `HV-I01` | Hoành phi chữ Hán thếp vàng `"玉井祠"` (Ngọc Tỉnh Từ — Đền Giếng Ngọc), khung viền nổi 2 cm | `T-ATLAS` + `G-EXT` | `1.7×0.6m` | 1 | 120 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A06, HV-D06, HV-C13, HV-I01` | — | — | — | **4 214** | — |

**LOD/ghi chú QC:** L0 giữ 4 đầu đao, thành giếng chạm sóng nước và 24 ô hoa chanh đục thủng; L1 chuyển hoa chanh và sóng nước sang `T-NRM`. QC kiểm tra mặt nước Giếng Ngọc trong xanh thấy đáy rêu và bóng mái đao phản chiếu.

#### `MB-080` — Tuyến 500 bậc đá hành hương rừng già Nghĩa Lĩnh (ảnh ref: `65`, `79`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 8 đèn đá cổ dọc tuyến 500 bậc đá giữa rừng già | `HV-NEW-MB-12` | 8 cây đèn đá xanh rêu phong lồng đèn 4 mặt đục chữ Thọ & hoa thị đặt tại các đoạn chiếu nghỉ từ Cổng Đền lên Đền Thượng | `G-LATHE` + `G-EXT` | Cao `1.75m` | 8 | 2 880 | `stoneParts` |
| Lan can đá chạm rồng mây đoạn bậc trước Đền Thượng | `HV-A05` | 4 đoạn thành bậc đá chạm nổi rồng hóa mây mềm mại (2 cặp đối xứng hai bên bậc cuối lên sân Đền Thượng), sâu 3.5 cm | `G-EXT` | Dài `2.4m` | 4 | 1 680 | `stoneParts` |
| Cụm mây xoắn trên các trụ đầu đoạn bậc đá | `HV-D05` | 8 cụm mây xoắn 3 vòng chạm nổi 2 cm trên thân 8 trụ đá mốc dọc tuyến hành hương | `G-EXT` | `0.3×0.2m` | 8 | 960 | `stoneParts` |
| Băng hồi văn thành bậc đoạn Đền Hạ — Đền Trung | `HV-D01` | 20 m băng hồi văn chữ "Công" khắc nông 1.5 cm dọc tay vịn đá xanh cổ rêu phủ | `G-EXT` | Băng cao `12cm` | 20 | 1 200 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-12, HV-A05, HV-D05, HV-D01` | — | — | — | **6 720** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 8 đèn đá; L1 chuyển hồi văn và mây trụ sang `T-NRM`. QC xác nhận tuyến bậc đá uốn lượn liên tục dưới tán cây rừng cổ thụ nối đủ Cổng — Đền Hạ — Đền Trung — Đền Thượng (ảnh `65`).

---

## 1.8. Tràng An & Tam Cốc — Bích Động (`11`, `12`, `63`, `63b`, `80`)

#### `MB-081` — Đền Trình & Thủy Đình Tràng An (ảnh ref: `11`, `80`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 16 góc mái 2 tầng lầu bát giác Thủy Đình giữa sông Sào Khê | `HV-A06` | 16 đầu đao mái vút cong 38° đắp vữa cổ (8 góc mái tầng trên + 8 góc mái tầng dưới) tạo hình lầu bát giác nổi bật giữa mặt sông | `G-TUBE` + `G-EXT` | Dài `0.75m` | 16 | 10 400 | `roofParts` |
| Lan can con tiện gỗ bao 8 cạnh sàn Thủy Đình | `HV-D10` | 48 con tiện gỗ lim (6 con/cạnh × 8 cạnh) sơn nâu đỏ bao sàn lầu bát giác trên cọc đá giữa mặt nước | `G-LATHE` + `G-INST` | Cao `0.62m` | 48 | 2 688 | `woodParts` |
| Diềm mái tầng dưới lầu bát giác | `HV-D15` | 48 viên ngói mũi hài cánh vảy viền 8 cạnh mái dưới Thủy Đình | `G-INST` | `0.12×0.36m` | 48 | 1 920 | `roofParts` |
| Hoành phi Đền Trình (thờ Tứ Trụ triều Đinh) | `HV-I01` | Hoành phi chữ Hán thếp vàng `"呈祠"` (Trình Từ — Đền Trình) treo mặt chính diện hướng ra bến sông, khung nổi 2 cm | `T-ATLAS` + `G-EXT` | `1.8×0.65m` | 1 | 120 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A06, HV-D10, HV-D15, HV-I01` | — | — | — | **15 128** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 16 đầu đao và 48 con tiện gỗ; L1 giảm đầu đao còn 40% tri, chuyển con tiện và ngói sang `T-NRM`. QC xác nhận hình khối bát giác 2 tầng 16 mái đứng giữa nước sông Sào Khê đúng ảnh `11`, `80`.

#### `MB-082` — Hệ thống Hang Xuyên Thủy Tràng An (`55m`) (ảnh ref: `11`, `80`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Trần vòm hang đá vôi hữu cơ dài 55m | `HV-NEW-MB-08` | 28 cụm nhũ đá canxit ẩm bóng màu vàng hổ phách rủ từ trần vòm hang thấp (cao 2.5–5m trên mặt nước), rãnh nhỏ giọt rõ | `G-LATHE` + `G-INST` | Dài `0.6–2.8m` | 28 | 3 920 | `stoneParts` |
| Chân vách đá ngấn nước dọc 2 bên lòng hang | `HV-D06` | 16 m gờ xâm thực dòng chảy sông ngầm chạm tự nhiên hai bên chân vách đá ngang mực nước thuyền đi qua | `G-EXT` | Băng cao `22cm` | 16 | 1 440 | `stoneParts` |
| Biển tên hang đá (Hang Tối — Hang Sáng — Hang Nấu Rượu) | `HV-I04` | Biển gỗ mộc khắc chữ vàng `"HANG SÁNG — DI SẢN THẾ GIỚI TRÀNG AN"` treo vách cửa hang | `T-ATLAS` | `1.1×0.45m` | 2 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-08, HV-D06, HV-I04` | — | — | — | **5 360** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 28 cụm nhũ đá; L1 ẩn 65% nhũ sâu trong lòng hang khi camera ngoài cửa hang `> 40m`. QC đảm bảo ánh đèn hắt vàng ấm chiếu lên trần nhũ đá và ánh sáng xuyên cuối đường hầm 55m (ảnh `80`).

#### `MB-083` — Hành Cung Vũ Lâm (ảnh ref: `11`, `80`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Chân 8 cột gỗ chính điện thờ các Vua Trần (thế kỷ XIII) | `HV-C02` | 8 chân tảng đá xanh chạm **16 cánh sen béo thời Trần** nổi 2.5 cm dưới hệ cột gỗ lim Hành Cung Vũ Lâm | `G-LATHE` + `G-INST` | Ø `0.68m` | 8 | 2 560 | `stoneParts` |
| Đầu rồng & đầu phượng đất nung mái cung thời Trần | `HV-NEW-MB-04` | 4 hiện vật kiến trúc mái đất nung đỏ trầm phong cách **nhà Trần** (2 đầu rồng bờ nóc + 2 đầu phượng góc mái), sâu 4 cm | `G-EXT` + `G-DISP` | `0.48×0.36m` | 4 | 2 160 | `roofParts` |
| Hồ sen trước cầu gỗ dẫn vào Hành Cung | `HV-C04` | 3 đóa hoa sen hồng 28 cánh nở 3D xen cùng 24 lá sen khum lòng chảo (`HV-C05`) dưới chân cầu gỗ | `G-INST` + `G-LATHE` | Ø `0.32m` | 3 | 3 600 | `pinkParts` |
| Thảm lá sen mặt hồ trước cổng đá cổ | `HV-C05` | 24 lá sen tròn peltate mép gợn sóng phủ mặt hồ hai bên cầu gỗ bắc qua vào Hành Cung | `G-DISP` + `G-INST` | Ø `0.55m` | 24 | 1 536 | `leafParts` |
| Hoành phi cổng thành đá cổ Hành Cung Vũ Lâm | `HV-I01` | Đại tự chữ Hán thếp vàng `"羽林行宮"` (Vũ Lâm Hành Cung) gắn chính giữa cổng đá vôi thời Trần, khung nổi 2.5 cm | `T-ATLAS` + `G-EXT` | `2.0×0.7m` | 1 | 120 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C02, HV-NEW-MB-04, HV-C04, HV-C05, HV-I01` | — | — | — | **9 976** | — |

**LOD/ghi chú QC:** Niên đại bắt buộc **thời Trần** (chân tảng sen béo, đầu rồng đất nung Trần, KHÔNG dùng khảm sứ Nguyễn); L1 hạ hoa sen xuống billboard và chân tảng sang `T-NRM`. QC kiểm tra đủ chữ `"羽林行宮"` và cầu gỗ bắc qua hồ sen.

#### `MB-084` — Bến Đò Tam Cốc — Văn Lâm (ảnh ref: `12`, `80`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 góc mái nhà chờ cổ truyền Bến Đò Văn Lâm | `HV-A06` | 4 đầu đao mái ngói cong nhẹ kiểu kiến trúc du lịch truyền thống đồng bằng Bắc Bộ | `G-TUBE` + `G-EXT` | Dài `0.7m` | 4 | 2 600 | `roofParts` |
| Lan can đá & 4 trụ đèn dọc cầu đá bậc thang xuống sông Ngô Đồng | `HV-NEW-MB-12` | 4 cây đèn đá xanh Ninh Bình chạm hoa sen — mây đặt 2 bên cầu bậc thang xuống bến đò | `G-LATHE` + `G-EXT` | Cao `1.5m` | 4 | 1 440 | `stoneParts` |
| Băng hồi văn gờ kè đá bến đò | `HV-D01` | 14 m băng hồi văn đơn giản khắc viền tường kè đá xanh Ninh Bình mặt sông Ngô Đồng, sâu 1.5 cm | `G-EXT` | Băng cao `12cm` | 14 | 840 | `stoneParts` |
| Biển tên bến thuyền du lịch Tam Cốc | `HV-I04` | Biển gỗ chữ vàng `"BẾN THUYỀN TAM CỐC — BÍCH ĐỘNG"` treo mặt tiền nhà điều hành | `T-ATLAS` | `2.4×0.55m` | 1 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A06, HV-NEW-MB-12, HV-D01, HV-I04` | — | — | — | **4 880** | — |

**LOD/ghi chú QC:** L0 giữ 4 đầu đao nhà chờ và 4 đèn đá bến sông; L1 chuyển hồi văn kè đá sang `T-NRM`. QC xác nhận bậc đá xuống sát mực nước sông Ngô Đồng kết nối hàng đò xếp đều (ảnh `12`).

#### `MB-085` — Đò Tam Cốc chèo bằng chân (ảnh ref: `80`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 chiếc đò sắt/gỗ Tam Cốc mũi vểnh có mái dù che nắng | `HV-NEW-MB-11` | 6 module mạn đò cong, cặp mái chèo gỗ gắn cọc chèo chân đặc trưng Ninh Bình và khung dù vải chống nắng | `G-EXT` + `G-INST` | Dài `5.0m` | 6 | 1 680 | `ironParts` |
| Sạp tre & chiếu cói ngồi khách trong lòng 6 đò | `HV-G03` | Phên tre đan lóng mốt và chiếu cói Kim Sơn lót sàn 6 đò chở khách áo phao cam | `T-NRM` + `S-SHD` | `3.0×0.95m` | 6 | 0 | `woodParts` |
| Số hiệu đò & hoa văn nhận diện bến Văn Lâm | `HV-I04` | Số đăng ký sơn trắng `"TAM CỐC — 01..06"` hai bên mũi 6 chiếc đò | `T-ATLAS` | `0.75×0.2m` | 6 | 0 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-11, HV-G03, HV-I04` | — | — | — | **1 680** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 6 đò Tam Cốc; tư thế người lái đò ngồi sau chèo bằng hai chân là điểm nhận diện đặc trưng nhất của Ninh Bình (ảnh `80`). L1 giữ silhouette đò + dù che nắng.

#### `MB-086` — Hang Cả — Hang Hai — Hang Ba sông Ngô Đồng (ảnh ref: `12`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Trần 3 vòm hang xuyên núi liên tiếp (Hang Cả 127m, Hang Hai 60m, Hang Ba 50m) | `HV-NEW-MB-08` | 24 cụm nhũ đá rủ trần tại 6 cửa vào–ra của 3 vòm hang xuyên núi đá vôi sông Ngô Đồng (4 cụm/cửa) | `G-LATHE` + `G-INST` | Dài `0.8–3.2m` | 24 | 3 360 | `stoneParts` |
| Chân vách đá ngấn nước 3 cửa hang | `HV-D06` | 18 m gờ xâm thực sóng sông dọc chân vách đá 3 cửa hang tiếp giáp ruộng lúa chín vàng hai bờ | `G-EXT` | Băng cao `22cm` | 18 | 1 620 | `stoneParts` |
| Biển đánh dấu tên 3 hang trên vách cửa vào | `HV-I04` | 3 biển gỗ nhỏ `"HANG CẢ"`, `"HANG HAI"`, `"HANG BA"` gắn cửa vào từng vòm núi | `T-ATLAS` | `0.9×0.35m` | 3 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-08, HV-D06, HV-I04` | — | — | — | **4 980** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 24 cụm nhũ cửa hang; L1 ẩn 50% nhũ khi `> 60m`. QC đối chiếu cảnh quan 3 vòm hang xuyên núi đá vôi kẹp giữa 2 bờ lúa chín vàng sông Ngô Đồng đúng ảnh `12`.

#### `MB-087` — Cầu Đá 3 nhịp qua hồ sen Chùa Bích Động (ảnh ref: `63`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 thành lan can cầu đá vôi rêu phong 3 nhịp | `HV-D01` | 16 m băng hồi văn vuông khắc nông 1.5 cm dọc 2 thành cầu đá xanh cổ phủ rêu xanh dẫn thẳng vào Tam Quan | `G-EXT` | Băng cao `12cm` | 16 | 960 | `stoneParts` |
| 8 trụ đá trên thành cầu 3 nhịp | `HV-C03` | 8 đầu trụ búp sen đá xanh rêu cổ (4 trụ mỗi bên thành cầu) khép 3 lớp cánh đơn giản | `G-LATHE` + `G-INST` | Cao `0.32m` | 8 | 1 440 | `stoneParts` |
| Hồ sen bao quanh Cầu Đá Bích Động | `HV-C04` | 4 đóa hoa sen hồng 28 cánh nở 3D nổi giữa đầm sen hai bên cầu dẫn vào Cổng Tam Quan | `G-INST` + `G-LATHE` | Ø `0.32m` | 4 | 4 800 | `pinkParts` |
| Thảm lá sen phủ mặt hồ hai bên cầu | `HV-C05` | 32 lá sen peltate mép gợn sóng xanh thẫm phủ quanh 3 nhịp cầu đá rêu phong | `G-DISP` + `G-INST` | Ø `0.55m` | 32 | 2 048 | `leafParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D01, HV-C03, HV-C04, HV-C05` | — | — | — | **9 248** | — |

**LOD/ghi chú QC:** L0 giữ 8 trụ búp sen đá, 4 hoa sen 3D và 32 lá sen; L1 hạ hoa sen sang billboard và chuyển hồi văn thành cầu sang `T-NRM`. QC bắt buộc cầu đá 3 nhịp cong nhẹ dẫn thẳng trục vào Cổng Tam Quan chân núi đúng ảnh `63`.

#### `MB-088` — Chùa Hạ Bích Động (ảnh ref: `63`, `63b`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc mái trên Chùa Hạ (kiến trúc thời Lê Trung Hưng — 1705) | `HV-A04` | Đôi rồng đắp vữa cổ Bắc Bộ chầu mặt nguyệt bốc lửa trên bờ nóc tầng trên chùa 5 gian, chạm sâu 5 cm | `G-TUBE` + `G-LATHE` | Dài `2.4m`/rồng | 1 | 2 800 | `roofParts` |
| 8 góc mái 2 tầng 8 mái đao cong vút | `HV-A06` | 8 đầu đao mái vút cong 42° đắp vữa hình đầu rồng cuốn mây lửa cực đặc trưng Chùa Bích Động, nổi 4.5 cm | `G-TUBE` + `G-EXT` | Dài `1.05m` | 8 | 5 200 | `roofParts` |
| Diềm mái 5 gian ngói mũi hài cổ | `HV-D15` | 60 viên ngói mũi hài cánh vảy rêu mốc viền mặt tiền 2 tầng mái Chùa Hạ | `G-INST` | `0.12×0.38m` | 60 | 2 400 | `roofParts` |
| 3 bộ cửa bức bàn 3 gian giữa (6 cánh) | `HV-D13` | 6 cánh cửa bức bàn gỗ lim cổ 3 ô (chấn song trên, chạm Tứ Quý giữa, pano dưới), sâu 2 cm | `G-EXT` + `T-NRM` | Cánh `0.8×2.1m` | 6 | 1 320 | `woodParts` |
| Hoành phi chính diện Chùa Hạ | `HV-I01` | Bức đại tự chữ Hán thếp vàng `"碧洞寺"` (Bích Động Tự) treo dưới hiên tầng mái dưới, khung nổi 2.5 cm | `T-ATLAS` + `G-EXT` | `1.9×0.68m` | 1 | 120 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A04, HV-A06, HV-D15, HV-D13, HV-I01` | — | — | — | **11 840** | — |

**LOD/ghi chú QC:** L0 giữ nguyên 8 đầu đao cong vút (silhouette mang tính biểu tượng của ảnh `63b`), bờ nóc lưỡng long và 60 viên ngói mũi hài; L1 chuyển ngói và cửa bức bàn sang `T-NRM`. QC đối chiếu tỷ lệ 2 tầng 8 mái ảnh `63`, `63b`.

#### `MB-089` — Chùa Trung Bích Động nép trong hang đá (ảnh ref: `63`, `63b`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 góc mái nửa lộ thiên nép sát vách đá vôi | `HV-A06` | 4 đầu đao mái cong vút vươn ra phía trước mặt vách núi, nửa mái sau ăn chìm thẳng vào lòng hang đá | `G-TUBE` + `G-EXT` | Dài `0.85m` | 4 | 2 600 | `roofParts` |
| 2 chữ Hán khắc trên vách đá mái hang (`"碧洞"`) | `HV-I03` | 2 đại tự `"碧洞"` (Bích Động — chúa Trịnh Sâm ban tặng năm 1773, mệnh danh *"Nam Thiên Đệ Nhị Động"*) khắc chìm 3 cm trên vách đá phía trên mái chùa | `T-NRM` | `1.6×0.7m` | 1 | 0 | `stoneParts` |
| Vòm đá & nhũ đá ôm sát nửa sau Chùa Trung | `HV-NEW-MB-08` | 10 cụm nhũ đá karst rủ từ vòm trần hang ngay phía trên ban thờ Tam Bảo bên trong lòng hang | `G-LATHE` + `G-INST` | Dài `0.8–2.5m` | 10 | 1 400 | `stoneParts` |
| Cửa võng thếp vàng & đỉnh đồng trong hang Chùa Trung | `HV-D12` | 1 bộ cửa võng chạm lộng thếp vàng treo trước 3 pho tượng Tam Thế trong nửa động tối, sâu 4 cm | `G-EXT` thủng | `2.5×0.85m` | 1 | 1 600 | `goldParts` |
| Đỉnh đồng cổ trước ban thờ Tam Bảo trong hang | `HV-E07` | 1 đỉnh đồng 3 chân 2 quai rồng đặt trước hương án trong hang Chùa Trung | `G-LATHE` + `G-TUBE` | Cao `1.1m` | 1 | 900 | `bronzeParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A06, HV-I03, HV-NEW-MB-08, HV-D12, HV-E07` | — | — | — | **6 500** | — |

**LOD/ghi chú QC:** L0 giữ giao cắt tự nhiên giữa mái chùa cong phía ngoài và vách hang đá + nhũ phía trong; L1 ẩn cửa võng và đỉnh đồng trong hang khi `> 30m`. QC kiểm tra đúng chữ `"碧洞"` khắc trên đá.

#### `MB-090` — Chùa Thượng Bích Động & Động Tối trên đỉnh núi (ảnh ref: `63`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Chuông đồng cổ đúc thời Lê treo tại Chùa Thượng | `HV-E06` | 1 Đại Hồng Chung đồng cổ quai rồng bồ lao đôi, thân chia 4 ô khắc minh văn, 4 núm gõ hoa sen nổi 2 cm | `G-LATHE` + `G-TUBE` | Cao `1.35m` | 1 | 1 400 | `bronzeParts` |
| 4 góc mái Chùa Thượng trên đỉnh núi Ngũ Nhạc | `HV-A06` | 4 đầu đao mái cong vút vữa cổ đặt ở tầng cao nhất cụm Tam Cấp chùa Bích Động | `G-TUBE` + `G-EXT` | Dài `0.75m` | 4 | 2 600 | `roofParts` |
| Cửa Động Tối & nhũ đá dọc bậc leo đỉnh | `HV-NEW-MB-08` | 8 cụm nhũ đá karst hình tiên ông — voi phục quanh miệng Động Tối nối giữa Chùa Trung và Chùa Thượng | `G-LATHE` + `G-INST` | Dài `0.9–2.4m` | 8 | 1 120 | `stoneParts` |
| 2 đèn đá cổ trên sân ngắm toàn cảnh Tam Cốc | `HV-NEW-MB-12` | 2 cột đèn đá xanh lồng đèn 4 mặt đặt hai bên bậc lên Chùa Thượng nhìn xuống đồng lúa Tam Cốc | `G-LATHE` + `G-EXT` | Cao `1.5m` | 2 | 720 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-E06, HV-A06, HV-NEW-MB-08, HV-NEW-MB-12` | — | — | — | **5 840** | — |

**LOD/ghi chú QC:** L0 giữ 4 đầu đao đỉnh núi, chuông đồng và 2 đèn đá; L1 ẩn chuông đồng và giảm nhũ đá Động Tối còn 40%. QC đảm bảo bố cục 3 cấp rõ rệt: Chùa Hạ (chân núi) — Chùa Trung (lưng chừng hang) — Chùa Thượng (đỉnh núi).

---

## 1.9. Làng Cổ Đường Lâm & Điện Biên Phủ (`13`, `14`, `69`, `81`, `116`, `117`)

#### `MB-091` — Cổng Làng Mông Phụ & Cây Đa Cổ Thụ (ảnh ref: `13`, `69`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Thân cổng vòm xây đá ong xứ Đoài (1833 — Minh Mạng) | `HV-NEW-MB-02` | Tường đá ong lỗ rỗ nâu đỏ đặc trưng Sơn Tây–Đường Lâm xếp mạch vữa vôi mật dày 1.2m hai bên vòm cổng làng | `T-NRM` + `S-SHD` | Viên `0.4×0.2m` | 1 | 0 | `stoneParts` |
| Vòm cuốn cổng làng 2 lớp gạch cổ | `HV-H03` | 1 vòm cuốn bán nguyệt gạch chỉ cổ giật cấp 2 lớp, gờ vòm vữa vôi vàng rêu phong sâu 12 cm | `G-TUBE` | Ø `2.6m` | 1 | 300 | `brickParts` |
| Bức đại tự đắp nổi trên vòm cổng làng | `HV-I01` | 4 chữ Hán cổ `"世有興儀"` (Thế Hữu Hưng Nghi — Đời nào cũng có nghi lễ hưng thịnh) đắp vữa nổi trên trán cổng làng Mông Phụ, viền nổi 2.5 cm | `T-ATLAS` + `G-EXT` | `1.8×0.6m` | 1 | 120 | `plasterParts` |
| Bờ nóc thượng gia hạ trì (chồng diêm 2 lớp mái ngói ri) | `HV-D05` | 2 cụm mây xoắn kìm nóc đơn sơ đắp vữa cổ hai đầu bờ nóc mái cổng làng (làng Việt không dùng rồng cung đình!), nổi 3 cm | `G-EXT` | `0.45×0.25m` | 2 | 240 | `roofParts` |
| Diềm mái 2 lớp ngói ri / ngói mũi hài cổ | `HV-D15` | 40 viên ngói mũi hài đất nung rêu mốc viền mặt trước & sau cổng làng Mông Phụ | `G-INST` | `0.12×0.35m` | 40 | 1 600 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-02, HV-H03, HV-I01, HV-D05, HV-D15` | — | — | — | **2 260** | — |

**LOD/ghi chú QC:** L0 giữ chất liệu đá ong lỗ rỗ `HV-NEW-MB-02`, đại tự `"世有興儀"` và 2 lớp mái ngói cổ (tuyệt đối KHÔNG gắn rồng 5 móng lên cổng làng dân gian!); L1 chuyển ngói diềm sang `T-NRM`. QC đối chiếu ảnh `13` (cổng làng + cây đa cổ thụ + ao bán nguyệt).

#### `MB-092` — Nghi Môn Đình Mông Phụ (ảnh ref: `69`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đỉnh 2 trụ biểu trong (gần lối vào sân đình) | `HV-B04` | 2 tượng Nghê vữa cổ ngồi chầu quay mặt về trục sân đình, bờm xoáy 3 lọn, mõm rộng nhe nanh, phủ rêu xám, nổi 5 cm | `G-*` tổ hợp | Cao `0.78m` | 2 | 2 200 | `plasterParts` |
| Đỉnh 2 trụ biểu ngoài | `HV-C03` | 2 búp sen vữa cổ 3 lớp cánh khép đặt trên đỉnh ô lồng đèn 2 trụ ngoài | `G-LATHE` | Cao `0.55m` | 2 | 360 | `plasterParts` |
| Ô lồng đèn rỗng 4 mặt trên thân 2 trụ ngoài | `HV-C13` | 8 ô đục thủng hoa chanh 4 cánh (4 mặt × 2 trụ ngoài) thông sáng xuyên qua đỉnh trụ biểu, sâu 10 cm | `G-EXT` + `G-INST` | Ô `0.26×0.26m` | 8 | 288 | `plasterParts` |
| Thân 4 trụ biểu vữa cổ (ô câu đối & chữ Thọ) | `HV-I02` | 4 mặt câu đối chữ Hán đắp nổi nền vôi vàng cũ ca ngợi Thánh Tản Viên và đất Đường Lâm, viền nổi 1.5 cm | `T-ATLAS` + `G-EXT` | `0.3×2.3m` | 4 | 240 | `plasterParts` |
| Chân đế 4 trụ biểu bằng đá ong & vữa cổ | `HV-D02` | 4 ô chữ Thọ tròn đắp nổi trên mặt tiền bệ vuông 4 trụ Nghi Môn, nổi 2 cm | `G-EXT` | Ø `0.3m` | 4 | 560 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-B04, HV-C03, HV-C13, HV-I02, HV-D02` | — | — | — | **3 648** | — |

**LOD/ghi chú QC:** L0 giữ đúng cặp **2 Nghê trụ trong + 2 búp sen & ô lồng đèn rỗng trụ ngoài** chuẩn ảnh `69`; L1 chuyển câu đối và ô chữ Thọ sang `T-NRM`. QC xác nhận 2 cây tùng tháp đứng đối xứng cạnh Nghi Môn.

#### `MB-093` — Đình Mông Phụ (1684) — Kết cấu vì kèo & nội thất (ảnh ref: `69`, `116`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 đầu dư nhô khỏi hàng cột cái (Lê Trung Hưng — 1684) | `HV-A07` | 6 đầu dư gỗ lim chạm lộng đầu rồng ngậm ngọc hướng vào lòng gian giữa, râu mây bay ngược, chạm sâu 6 cm (đỉnh cao điêu khắc gỗ thế kỷ XVII) | `G-EXT` profile | `0.75×0.32m` | 6 | 2 280 | `woodParts` |
| Hệ vì kèo *câu đầu — trụ trốn — kẻ truyền* 5 gian | `HV-NEW-MB-05` | 16 thanh kẻ truyền và bẩy hiên gỗ lim uốn cong chạm vân mây đao mác nâng bộ mái đình nặng bề thế, sâu chạm 3.5 cm | `G-EXT` + `G-INST` | Dài `2.2m` | 16 | 2 560 | `woodParts` |
| 12 đầu kẻ & đầu bẩy hiên chạm lá lật | `HV-C11` | 12 cụm lá lật cuộn ngược mép răng cưa chạm kênh bong ở đầu kẻ hiên và cốn nách gỗ lim mộc, nổi 3.5 cm | `G-EXT` | `0.42×0.2m` | 12 | 1 320 | `woodParts` |
| Cửa võng gian chính thờ Tản Viên Sơn Thánh & Kiệu Bát Cống | `HV-D12` | 1 bộ cửa võng chạm lộng thếp vàng hình rồng mây — phượng múa treo trước hậu cung đình (kèm sơn son thếp vàng `HV-J04` trên Kiệu Bát Cống) | `G-EXT` thủng | `3.2×1.0m` | 1 | 1 600 | `goldParts` |
| Hoành phi gian giữa & 4 đầu đao mái đình | `HV-A06` | 4 đầu đao mái đắp vữa cổ cong rộng bề thế đặc trưng đình cổ Bắc Bộ (kèm đại tự `"蒙阜亭"` trong lòng đình `HV-I01`) | `G-TUBE` + `G-EXT` | Dài `1.4m` | 4 | 2 600 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A07, HV-NEW-MB-05, HV-C11, HV-D12, HV-A06` | — | — | — | **10 360** | — |

**LOD/ghi chú QC:** **Hero asset P0 kiến trúc gỗ dân gian Bắc Bộ (1684)!** L0 giữ đủ 6 đầu dư chạm rồng, 16 thanh kẻ truyền, 12 đầu kẻ lá lật và cửa võng; L1 ẩn nội thất vì kèo khi `> 40m`, giữ mái cong bề thế và 4 đầu đao lớn. QC đối chiếu kết cấu vì kèo ảnh `116` và mặt ngoài ảnh `69`.

#### `MB-094` — 8 Nhà Cổ Đá Ong Đường Lâm (ảnh ref: `13`, `69`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tường bao & 2 đầu hồi bít đốc 8 nhà cổ xứ Đoài | `HV-NEW-MB-02` | Tường xây khối đá ong lỗ rỗ nâu đỏ mộc mạc (không trát vữa) kết hợp rêu xanh chân tường 8 ngôi nhà cổ niên đại 200–300 năm | `T-NRM` + `S-SHD` | 8 nhà (`10×6m`) | 8 | 0 | `stoneParts` |
| Cửa bức bàn 3 gian mở rộng của 3 nhà cổ cận cảnh | `HV-D13` | 12 cánh cửa bức bàn gỗ xoan/lim 3 ô mở lộ sập gụ và bàn thờ gia tiên bên trong (4 cánh/nhà × 3 nhà mặt đường chính), sâu 2 cm | `G-EXT` + `T-NRM` | Cánh `0.72×2.0m` | 12 | 2 640 | `woodParts` |
| Hoành phi & câu đối khảm xà cừ trong gian giữa nhà cổ | `HV-I01` | 3 bức hoành phi gia tiên chữ Hán `"德流光"` (Đức Lưu Quang) & `"福滿堂"` (Phúc Mãn Đường) kết hợp bề mặt khảm xà cừ `HV-J07` | `T-ATLAS` + `G-EXT` | `1.5×0.55m` | 3 | 360 | `woodParts` |
| Bề mặt sập gụ, tủ chè & câu đối khảm xà cừ | `HV-J07` | Họa tiết khảm xà cừ óng ánh trên nền gỗ gụ đen (Tứ Quý, chim hoa) trên sập gụ và đôi câu đối gian thờ 3 nhà cổ mở cửa | `T-ATLAS` + roughness thấp | `2.0×1.6m` | 3 | 0 | `woodParts` |
| Sân gạch cổ phơi thóc & diềm mái ngói ri 3 nhà mặt tiền | `HV-D15` | 48 viên ngói mũi hài cổ viền diềm mái hiên 3 nhà cổ mặt đường (16 viên/nhà) | `G-INST` | `0.11×0.34m` | 48 | 1 920 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-02, HV-D13, HV-I01, HV-J07, HV-D15` | — | — | — | **4 920** | — |

**LOD/ghi chú QC:** L0 mở cửa bức bàn 3 nhà cổ mặt tiền (lộ bàn thờ & sập gụ khảm xà cừ), 5 nhà còn lại dùng tường đá ong + mái bít đốc tiết kiệm tri; L1 ẩn nội thất nhà cổ và chuyển ngói sang `T-NRM`. QC xác nhận tường đá ong lỗ rỗ đúng chất liệu Đường Lâm (ảnh `69`).

#### `MB-095` — Giếng Cổ Đá Ong & Dãy Chum Tương Nếp (ảnh ref: `13`, `69`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Thành giếng cổ xây đá ong nguyên khối khoét rỗng | `HV-NEW-MB-02` | Thành giếng tròn xây đá ong nâu đỏ lỗ rỗ phủ rêu xanh ẩm, lòng giếng rỗng sâu thấy mặt nước trong | `T-NRM` + `S-SHD` | Ø `1.4m`, cao `0.75m` | 1 | 0 | `stoneParts` |
| Sân gạch cổ quanh giếng đặt 24 chum tương nếp | `HV-NEW-MB-03` | Nền sân gạch Bát Tràng đỏ cũ ẩm nước xếp vòng quanh giếng đá ong và dãy chum tương | `T-NRM` + `S-SHD` | Sân `8×6m` | 1 | 0 | `brickParts` |
| Đai vai 24 chum tương sành Hương Canh / Bát Tràng | `HV-D06` | 12 m họa tiết đai sóng nước chải lược dập nổi quanh vai chum sành nâu bóng (1 module instance 0.5m × 24 chum) | `G-INST` (`G-EXT`) | Đai cao `8cm` | 12 | 1 080 | `roofParts` |
| 24 nắp nứa đan đậy miệng chum tương phơi nắng | `HV-G03` | Nắp tre nứa đan lóng mốt hình nón dẹt úp trên miệng 24 chum tương nếp Đường Lâm | `T-NRM` + `S-SHD` | Ø `0.42m` | 24 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-02, HV-NEW-MB-03, HV-D06, HV-G03` | — | — | — | **1 080** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho 24 chum tương nếp và nắp nứa; L1 chuyển đai sóng trên vai chum sang `T-NRM`. QC kiểm tra lòng giếng đá ong rỗng thấy mặt nước phản chiếu và có cột ròng rọc gàu múc nước.

#### `MB-096` — Hầm Chỉ Huy Tướng De Castries (`20m`) (ảnh ref: `81`, `117`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vòm mái tôn thép lượn sóng 22 gân sắt (dài `20m`, rộng `8m`) | `HV-NEW-MB-09` | 22 gân sóng thép cuốn hình bán trụ (Nissen hut) sơn rỉ sét màu xám–nâu cổ kèm 18 module tường bao cát xếp so le bọc 2 sườn hầm, gân sâu 8 cm | `G-DISP` + `G-INST` | Dài `20m` (40 module) | 40 | 3 600 | `ironParts` |
| 2 cổng vòm đầu hầm kè gỗ & đinh tán sắt | `HV-H03` | 2 khung vòm bán nguyệt gia cố thanh dầm thép chữ I và cọc gỗ kè đất 2 đầu vào–ra hầm De Castries, sâu 15 cm | `G-TUBE` | Ø `3.8m` | 2 | 600 | `ironParts` |
| Lá cờ đỏ sao vàng `"QUYẾT CHIẾN QUYẾT THẮNG"` trên nóc hầm & biển di tích | `HV-I04` | Chữ vàng trên lá cờ chiến thắng 7/5/1954 phất phới nóc hầm + biển đá `"HẦM CHỈ HUY TƯỚNG ĐỜ CÁT (1954)"` trước cửa hầm | `T-ATLAS` | `1.5×1.0m` | 2 | 0 | `crimsonParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-09, HV-H03, HV-I04` | — | — | — | **4 200** | — |

**LOD/ghi chú QC:** L0 giữ đủ **22 gân sóng thép** trên mái vòm dài 20m và dãy bao cát hai bên sườn; L1 chuyển gân sóng nhỏ và đường khâu bao cát sang `T-NRM`. QC đối chiếu nghiêm ngặt ảnh `81` (cờ chiến thắng cắm trên nóc vòm thép, tuyệt đối không gắn hoa văn cổ truyền).

#### `MB-097` — Nội thất 4 khoang Hầm De Castries (ảnh ref: `117`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vách trong vòm thép lượn sóng & 3 vách ngăn thông cửa | `HV-NEW-MB-09` | 16 module vòm thép gân trong sơn ghi xám và khung cửa sắt đinh tán chia 4 khoang đi bộ thông suốt dài 20m, gân sâu 6 cm | `G-DISP` + `G-INST` | 4 khoang (`5m`/khoang) | 16 | 1 440 | `ironParts` |
| Khung tủ điện đài & lưới sắt bảo vệ bóng đèn hầm | `HV-H09` | 8 khung lưới song sắt bảo vệ tủ máy thông tin vô tuyến SCR-300 và đèn dây tóc treo trần hầm | `G-INST` | `0.4×0.6m` | 8 | 480 | `ironParts` |
| Bản đồ lòng chảo Mường Thanh 1954 & bảng tác chiến | `HV-I04` | 3 tấm bản đồ địa hình Điện Biên Phủ (A1, C1, Him Lam, Độc Lập) trải bàn gỗ trung tâm và treo 2 vách khoang chỉ huy | `T-ATLAS` | `1.8×1.1m` | 3 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-09, HV-H09, HV-I04` | — | — | — | **1 920** | — |

**LOD/ghi chú QC:** Nội thất hầm chỉ hiển thị ở L0 khi camera vào cửa hầm (`< 25m`); L1/L2 cull hoàn toàn. QC xác nhận đi bộ thông suốt 4 khoang, có bàn bản đồ Mường Thanh, 6 ghế sắt và tủ điện đài đúng ảnh `117`.

#### `MB-098` — Tường Phù Điêu Chiến Thắng & Mạng hào giao thông zích-zắc (ảnh ref: `14`, `81`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bức tường phù điêu lớn khắc họa 56 ngày đêm Điện Biên Phủ | `HV-NEW-MB-10` | 6 mảng phù điêu đá xanh nối tiếp khắc nổi 8 cm cảnh kéo pháo, xung phong Đồi A1, đào hào lấn dũi và bắt sống bộ chỉ huy Pháp | `G-DISP` | `3.2×2.2m`/mảng | 6 | 3 720 | `stoneParts` |
| Hệ thống hào giao thông kè gỗ dài `160m` & lô cốt Đồi A1 | `HV-NEW-MB-09` | 24 module vách kè gỗ tròn, bao cát và lỗ châu mai thép đúc của lô cốt gỗ Đồi A1 nằm giữa mạng hào zích-zắc | `G-DISP` + `G-INST` | Module `2.0×1.4m` | 24 | 2 160 | `woodParts` |
| Hàng rào cọc sắt chữ X & kẽm gai xoắn bùng nhùng | `HV-H09` | 20 cụm cọc sắt chữ X (chevaux-de-frise) kết nối cuộn dây thép gai chạy dọc tuyến phòng ngự ngoài hào | `G-INST` | Cao `1.1m` | 20 | 1 200 | `ironParts` |
| Biển giải thích chiến thuật "vây, lấn, tấn, phá, triệt, diệt" | `HV-I04` | 2 biển di tích chữ Quốc ngữ đặt bên miệng hào giao thông zích-zắc và lô cốt A1 | `T-ATLAS` | `1.1×0.65m` | 2 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-10, HV-NEW-MB-09, HV-H09, HV-I04` | — | — | — | **7 080** | — |

**LOD/ghi chú QC:** L0 giữ 6 mảng phù điêu nổi 8 cm và 24 module kè hào/lô cốt; L1 chuyển phù điêu sang `T-NRM` và hàng rào kẽm gai sang alpha-card. QC xác nhận mạng hào bẻ góc zích-zắc chuẩn quân sự 1954.

#### `MB-099` — Hố Bộc Phá 960kg Đồi A1 (`Ø34m`) & Cây Đa Cụt (ảnh ref: `14`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Thành bậc thang & gờ bảo vệ quanh miệng hố bộc phá `Ø34m` | `HV-NEW-MB-09` | 12 module thanh kè gỗ/đá chống sạt lở xung quanh thành hố đất cháy sâu 7m do khối thuốc nổ 960kg tối 6/5/1954 tạo ra | `G-DISP` + `G-INST` | Module `2.2×0.8m` | 12 | 1 080 | `stoneParts` |
| Bệ đá bảo vệ gốc Cây Đa Cụt lịch sử Đồi A1 | `HV-D01` | 10 m băng hồi văn tối giản khắc viền bệ đá xanh bao quanh gốc Cây Đa Cụt bị pháo bắn cụt ngọn năm 1954, sâu 1.2 cm | `G-EXT` | Băng cao `12cm` | 10 | 600 | `stoneParts` |
| Bia đá khắc sự tích khối bộc phá 960kg Đồi A1 | `HV-I04` | Bia đá granit đen khắc chữ vàng `"HỐ BỘC PHÁ 960KG — 20H30 NGÀY 06/05/1954 — HIỆU LỆNH TỔNG CÔNG KÍCH"` kèm khung đá nổi 2 cm | `T-ATLAS` + `G-EXT` | `1.3×0.9m` | 2 | 80 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-09, HV-D01, HV-I04` | — | — | — | **1 760** | — |

**LOD/ghi chú QC:** L0 giữ hố lõm địa hình thực `Ø34m` có bậc thang đi xuống và gốc Cây Đa Cụt; L1 chuyển hồi văn bệ đá sang `T-NRM`. QC xác nhận đường kính hố không bị lấp phẳng bởi terrain mesh.

#### `MB-100` — Tượng Đài Chiến Thắng Điện Biên Phủ & Xe tăng M24 Chaffee (ảnh ref: `14`, `81`)
| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 mảng phù điêu ốp 3 mặt bệ tượng đài cao 3.6m (đồi D1) | `HV-NEW-MB-10` | 3 tấm phù điêu đúc đồng lớn khắc họa quân dân Tây Bắc, dân công xe đạp thồ và bộ đội cắm cờ trên bệ Tượng đài cao `16.2m` (3 chiến sĩ đứng lưng vào nhau bế em bé Thái giương cờ Quyết Chiến), nổi 8 cm | `G-DISP` | `3.5×2.4m` | 3 | 1 860 | `bronzeParts` |
| Hoa văn thổ cẩm Thái trên dải áo em bé & chân bệ tượng | `HV-NEW-MB-07` | Họa tiết hoa ban 8 cánh & dải thổ cẩm Tây Bắc khắc nhẹ trên dải khăn em bé dân tộc Thái được chiến sĩ bế trên đỉnh tượng đài | `T-ATLAS` + `T-NRM` | `0.8×0.5m` | 1 | 0 | `bronzeParts` |
| Chi tiết giáp đinh tán, mắt xích xe tăng M24 Chaffee `"Bazeille"` & pháo 37mm | `HV-NEW-MB-09` | 16 module giáp thép đinh tán, tấm chắn bùn, mâm bánh xích xe tăng Pháp M24 Chaffee bị bắn cháy trên Đồi A1 và lá chắn thép pháo cao xạ 37mm | `G-DISP` + `G-INST` | Module `0.8×0.5m` | 16 | 1 440 | `ironParts` |
| Băng hồi văn & biểu tượng Trống Đồng trên sân quảng trường Đồi D1 | `HV-E01` | 1 mặt trời 14 cánh Đông Sơn ghép đá granit đỏ–xám đường kính 12m trước chân bậc thang lên Tượng Đài Chiến Thắng | `G-DISP` | Ø `12.0m` | 1 | 800 | `stoneParts` |
| Dòng chữ đồng trên bệ tượng & số hiệu xe tăng `"BAZEILLE"` | `HV-I04` | Chữ nổi đồng `"CHIẾN THẮNG ĐIỆN BIÊN PHỦ (07/05/1954)"` mặt trước bệ tượng và chữ sơn trắng `"BAZEILLE"` trên sườn tháp pháo M24 Chaffee | `T-ATLAS` + `G-EXT` | `3.0×0.5m` | 2 | 80 | `bronzeParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MB-10, HV-NEW-MB-07, HV-NEW-MB-09, HV-E01, HV-I04` | — | — | — | **4 180** | — |

**LOD/ghi chú QC:** **Hero asset P0 lịch sử hiện đại Miền Bắc!** L0 giữ trọn bố cục 3 chiến sĩ bế em bé giương cờ cao `16.2m`, 3 phù điêu bệ tượng và xe tăng M24 Chaffee `"BAZEILLE"`; L1 chuyển 3 phù điêu bệ và hoa văn sân sang `T-NRM`. QC đối chiếu chính xác dáng tượng đài trên đồi D1 ảnh `14`.

---

## Phần Tổng Kết & Kế Hoạch Triển Khai — Khu Vực Miền Bắc

### (a) Bảng Tổng Ngân Sách Tri L0 Theo Cụm & Khuyến Nghị Quản Lý Ngân Sách

| STT | Cụm di sản | Số component | Tri L0 (hoa văn) | Tỷ trọng (%) | Component nặng tri nhất | Trạng thái ngân sách |
|---:|---|---:|---:|---:|---|---|
| 1.1 | Văn Miếu — Quốc Tử Giám | 12 | 142 128 | 22.8% | `MB-008` (65 560 tri — 32 bia Rùa) | Đạt *(dùng `G-INST`)* |
| 1.2 | Chùa Một Cột & Hồ Hoàn Kiếm — Đền Ngọc Sơn | 10 | 58 306 | 9.4% | `MB-022` (14 240 tri), `MB-019` (10 920 tri) | Đạt |
| 1.3 | Hoàng Thành Thăng Long & Thành Cổ Hà Nội | 14 | 89 980 | 14.4% | `MB-026` (18 300 tri — 4 Rồng Lê Sơ) | Đạt |
| 1.4 | Fansipan — Sa Pa & Lũng Cú — Hà Giang | 12 | 66 146 | 10.6% | `MB-043` (14 480 tri — 8 Trống Đồng) | Đạt |
| 1.5 | Vịnh Hạ Long & Thủy Chiến Bạch Đằng | 12 | 48 640 | 7.8% | `MB-057` (7 692 tri), `MB-055` (6 684 tri) | Đạt |
| 1.6 | Mù Cang Chải & Chùa Hương | 12 | 47 936 | 7.7% | `MB-070` (8 492 tri), `MB-069` (8 200 tri) | Đạt |
| 1.7 | Khu Di Tích Đền Hùng — Phú Thọ | 8 | 53 178 | 8.5% | `MB-073` (10 680 tri), `MB-074` (10 208 tri) | Đạt |
| 1.8 | Tràng An & Tam Cốc — Bích Động | 10 | 75 432 | 12.1% | `MB-081` (15 128 tri — 16 đầu đao) | Đạt |
| 1.9 | Làng Cổ Đường Lâm & Điện Biên Phủ | 10 | 41 408 | 6.6% | `MB-093` (10 360 tri — Đình 1684) | Đạt |
| — | **TỔNG CỘNG (100 COMPONENT)** | **100** | **623 154** | **100.0%** | **Ngưỡng vùng: `< 1,000,000 tri`** | **ĐẠT (62.3% trần)** |

> **Đánh giá & khuyến nghị tối ưu:**
> - Tổng ngân sách hoa văn L0 toàn Khu vực Miền Bắc là **623 154 tri** (dưới trần `1 000 000 tri` tới **376 846 tri**, an toàn cho tổng bản đồ `< 3.46M tri` và ngân sách shadow-caster `<= 900k`).
> - Tuy không vượt trần, cần tuân thủ 4 nguyên tắc kiểm soát draw call & shadow-caster để giữ hiệu năng mượt ở `60 FPS`:
>   1. **Gộp `InstancedMesh` bắt buộc** cho 5 nhóm lặp nhiều nhất: 32 Rùa đá + 32 trán bia (`MB-008`: 65.5k tri → 3 draw call), hàng đầu đao `HV-A06` toàn vùng, hàng con tiện `HV-D10` (`MB-004`, `MB-019`, `MB-081`), hàng ngói câu đầu `HV-D15` và 8 mặt trống đồng Lũng Cú (`MB-043`).
>   2. **Tắt `castShadow`** cho các hoa văn nhỏ (`HV-D14` đinh đồng, `HV-C06` lá súng, `HV-C07` cúc dây, `HV-D01` hồi văn, `HV-D15` ngói diềm, nội thất trong hang/điện kín) — tiết kiệm ~240 000 tri khỏi shadow-caster budget.
>   3. **Cull nội thất theo khoảng cách (`> 35–45m`)** cho 12 component nội thất (`MB-006`, `MB-010`, `MB-011`, `MB-015`, `MB-024`, `MB-028`, `MB-029`, `MB-035`, `MB-040`, `MB-072`, `MB-093`, `MB-097`) — giảm ~78 000 tri hoạt động ở góc nhìn trung cảnh.
>   4. **Phương án cắt giảm dự phòng** (nếu khi ghép hình khối kiến trúc gốc + địa hình khiến tổng vùng vượt `1 000 000 tri`): chuyển `HV-D15` ngói diềm sang `T-NRM` (giảm ~32 000 tri), giảm `MB-008` từ 32 xuống 24 bia hoặc bake trán bia sang `T-NRM` (giảm ~24 000 tri), và chuyển các băng `HV-D01`/`HV-D06` dưới 2 cm sang `T-NRM` (giảm ~28 000 tri) — tổng tiết kiệm nhanh **~84 000 tri** mà không ảnh hưởng silhouette chính.

---

### (b) Hoa Văn Đề Xuất Bổ Sung Vào Thư Viện (`HV-NEW-MB-01` → `HV-NEW-MB-12`)

12 mã hoa văn đặc thù Miền Bắc chưa có trong [MOTIF_LIBRARY_HOA_VAN.md](MOTIF_LIBRARY_HOA_VAN.md), đề xuất chuẩn hóa bổ sung vào thư viện chung:

| Mã đề xuất | Tên hoa văn | Hình thái thực tế & phân biệt niên đại/vùng miền | KT | Kích thước | Tri L0 | Bucket / Helper đề xuất | Ảnh ref | Component dùng |
|---|---|---|---|---|---:|---|---|---|
| `HV-NEW-MB-01` | **Tứ phượng chầu đỉnh trụ biểu (Tứ phượng giao đầu)** | 4 chim phượng đắp vữa cổ đứng 4 mặt đỉnh trụ biểu Bắc Bộ, đuôi uốn vút lên nối cụm chầu tâm, cánh xòe 3 lớp | `G-EXT` + `G-TUBE` | `0.85×0.85×0.9m` | 680 | `plasterParts` · `createQuadPhoenixFinialParts` | `01`, `69` | `MB-001` |
| `HV-NEW-MB-02` | **Bề mặt Đá Ong lỗ rỗ xứ Đoài (Laterite)** | Đá ong nâu đỏ–vàng sẫm đặc trưng Sơn Tây–Đường Lâm, hốc rỗ tổ ong sâu `0.5–2cm`, mạch vữa vôi mật | `T-NRM` + `S-SHD` | Viên `0.4×0.2m` | 0 | `stoneParts` · `createLateriteStoneMaterial` | `13`, `69` | `MB-091`, `MB-094`, `MB-095` |
| `HV-NEW-MB-03` | **Gạch Bát Tràng lát xương cá / gạch vồ cổ** | Gạch đất nung đỏ trầm phủ rêu kẽ mạch, lát xương cá/chữ Công cho sân Văn Miếu, Thần Đạo, Đền Hùng và tường thành Thăng Long | `T-NRM` + `S-SHD` | Viên `0.3×0.3m` | 0 | `brickParts` · `createBatTrangTileMaterial` | `01`, `06`, `71`, `123` | `MB-003`, `MB-007`, `MB-012`, `MB-016`, `MB-023`, `MB-024`, `MB-027`, `MB-033`, `MB-034`, `MB-036`, `MB-074`, `MB-095` |
| `HV-NEW-MB-04` | **Đầu rồng / đầu phượng đất nung Lý–Trần** | Hiện vật kiến trúc mái cung điện đất nung đỏ cam Hoàng Thành Thăng Long & Vũ Lâm: rồng mào lửa chữ S, phượng mỏ cong bờm ngọn lửa | `G-EXT` + `G-DISP` | `0.35–0.65m` | 540 | `roofParts` · `createLyTranTerracottaFinialParts` | `06`, `39` | `MB-027`, `MB-035`, `MB-083` |
| `HV-NEW-MB-05` | **Hệ đấu củng chồng rường & kẻ truyền Bắc Bộ** | Thanh xà gỗ lim đầu vát cong chạm cánh sen úp/vân mây nâng Liên Hoa Đài Chùa Một Cột và vì kèo đình cổ Lê Trung Hưng (1684) | `G-EXT` + `G-INST` | Dài `0.8–2.2m` | 160 | `woodParts` · `createNorthernTimberBracketParts` | `02`, `50`, `116` | `MB-014`, `MB-093` |
| `HV-NEW-MB-06` | **Khau Cút (sừng gỗ đầu hồi nhà sàn Thái)** | Cặp thanh gỗ bắt chéo chữ X trên đỉnh đầu hồi mái nhà sàn Thái Đen Tây Bắc, chạm hoa sen/dương xỉ cách điệu (khác sừng trâu Tây Nguyên `HV-G05`) | `G-EXT` + `G-TUBE` | Cao `0.9–1.4m` | 240 | `woodParts` · `createKhauCutGableParts` | `77` | `MB-062`, `MB-063` |
| `HV-NEW-MB-07` | **Thổ cẩm Tây Bắc (H'Mông — Thái — Lô Lô)** | Xoắn ốc sáp ong chàm–trắng (H'Mông), hoa ban 8 cánh (Thái), tam giác ghép vải ngũ sắc mặt trời (Lô Lô) — phân biệt rõ với thổ cẩm Tây Nguyên `HV-G01` | `T-ATLAS` + `T-NRM` | Dải `10–40cm` | 0 | `fabricParts` · `createNorthwestBrocadeAtlas` | `05`, `77` | `MB-047`, `MB-048`, `MB-061`, `MB-062`, `MB-063`, `MB-065`, `MB-100` |
| `HV-NEW-MB-08` | **Nhũ đá, măng đá & đá tai mèo Karst** | Cụm nhũ đá canxit ẩm bóng rủ trần hang, măng đá mọc nền và chóp đá tai mèo xói mòn dọc vùng Hạ Long, Hà Giang, Hương Tích, Tràng An | `G-LATHE` + `G-DISP` + `G-INST` | Dài `0.8–7.5m` | 140 | `stoneParts` · `createKarstStalactiteClusterParts` | `04`, `11`, `52`, `80` | `MB-048`, `MB-049`, `MB-050`, `MB-051`, `MB-061`, `MB-071`, `MB-072`, `MB-082`, `MB-086`, `MB-089`, `MB-090` |
| `HV-NEW-MB-09` | **Tôn thép lượn sóng, đinh tán & kết cấu quân sự** | Gân sóng vòm thép Nissen hut (Hầm De Castries), cửa thép chống bom D67, giáp đinh tán M24 Chaffee, cọc sắt Bạch Đằng và tường bao cát kè gỗ | `G-DISP` + `G-INST` | Module `0.5–2.2m` | 90 | `ironParts` · `createMilitaryFortificationParts` | `14`, `15`, `81`, `117` | `MB-029`, `MB-056`, `MB-058`, `MB-059`, `MB-096`, `MB-097`, `MB-098`, `MB-099`, `MB-100` |
| `HV-NEW-MB-10` | **Phù điêu lịch sử đúc đồng / đá xanh hiện đại** | Phù điêu đúc nổi phong cách hiện thực Việt Nam (bệ Lũng Cú, chiến sĩ cổng Đền Hùng, tường phù điêu & bệ Tượng Đài Điện Biên Phủ), nổi `4–10cm` | `G-DISP` | Mảng `1.5–4.0m` | 620 | `bronzeParts` / `stoneParts` · `createHistoricalReliefPanelParts` | `14`, `65`, `81` | `MB-043`, `MB-073`, `MB-098`, `MB-100` |
| `HV-NEW-MB-11` | **Buồm cánh dơi nan tre & thân thuyền cổ Bắc Bộ** | Cánh buồm nâu sồng 7–9 nan tre uốn cong 3D, dây lèo nút cổ truyền, mạn đò vểnh hai đầu (Hạ Long, Bạch Đằng, Suối Yến, Tam Cốc) | `G-EXT` + `G-TUBE` | `3.0–6.5m` | 280 | `fabricParts` / `woodParts` · `createBatWingSailBoatParts` | `15`, `68`, `80`, `107` | `MB-053`, `MB-057`, `MB-058`, `MB-068`, `MB-085` |
| `HV-NEW-MB-12` | **Đèn đá sân vườn cổ (lồng đèn 4 mặt chạm mây)** | Cột đèn đá xanh rêu cổ chân sen, thân trụ, lồng đèn 4 mặt đục chữ Thọ/hoa thị, mái 4 đao cong đặt dọc bậc đền chùa Bắc Bộ | `G-LATHE` + `G-EXT` | Cao `1.5–2.0m` | 360 | `stoneParts` · `createAncientStoneLanternParts` | `10`, `63`, `79` | `MB-034`, `MB-041`, `MB-045`, `MB-060`, `MB-071`, `MB-080`, `MB-084`, `MB-090` |

---

### (c) Thứ Tự Triển Khai 3 Đợt (`P0` / `P1` / `P2`) Theo Component

#### Đợt 1 — `P0` (32 Component Hero Biểu Tượng & Xây Dựng Hệ Helper Lõi)
Ưu tiên hoàn thiện trước toàn bộ biểu tượng nhận diện hàng đầu của Miền Bắc và các helper dùng chung (`createMotifBandParts`, `createLotusPetalRingParts`, `createShouCharacterParts`, `createCarvedDragonBalustradeParts`, `createSunWindowParts`, `createNorthernTimberBracketParts`):
- **Văn Miếu (7):** `MB-001`, `MB-003`, `MB-004`, `MB-005`, `MB-007`, `MB-008`, `MB-010`
- **Chùa Một Cột & Hồ Hoàn Kiếm (6):** `MB-013`, `MB-014`, `MB-015`, `MB-018`, `MB-019`, `MB-022`
- **Hoàng Thành Thăng Long & Thành Cổ (6):** `MB-023`, `MB-025`, `MB-026`, `MB-031`, `MB-032`, `MB-033`
- **Fansipan & Lũng Cú (3):** `MB-037`, `MB-038`, `MB-043`
- **Hạ Long & Bạch Đằng (3):** `MB-049`, `MB-053`, `MB-057`
- **Đền Hùng (2):** `MB-073`, `MB-076`
- **Tràng An — Bích Động (2):** `MB-081`, `MB-088`
- **Đường Lâm & Điện Biên Phủ (3):** `MB-093`, `MB-096`, `MB-100`

#### Đợt 2 — `P1` (40 Component Kiến Trúc Vệ Tinh, Nội Thất Trọng Điểm & Di Tích Lịch Sử)
Mở rộng độ sâu trải nghiệm đi bộ, nội thất chùa/đền/khảo cổ và các cụm di sản kiến trúc phụ trợ quanh hero `P0`:
- **Văn Miếu (5):** `MB-002`, `MB-006`, `MB-009`, `MB-011`, `MB-012`
- **Chùa Một Cột & Hồ Hoàn Kiếm (4):** `MB-016`, `MB-017`, `MB-020`, `MB-021`
- **Hoàng Thành Thăng Long (5):** `MB-024`, `MB-027`, `MB-030`, `MB-034`, `MB-035`
- **Fansipan & Lũng Cú (5):** `MB-039`, `MB-040`, `MB-041`, `MB-044`, `MB-047`
- **Hạ Long & Bạch Đằng (4):** `MB-050`, `MB-051`, `MB-056`, `MB-060`
- **Mù Cang Chải & Chùa Hương (7):** `MB-061`, `MB-063`, `MB-067`, `MB-069`, `MB-070`, `MB-071`, `MB-072`
- **Đền Hùng (3):** `MB-074`, `MB-075`, `MB-078`
- **Tràng An — Bích Động (3):** `MB-083`, `MB-087`, `MB-089`
- **Đường Lâm & Điện Biên Phủ (4):** `MB-091`, `MB-092`, `MB-094`, `MB-098`

#### Đợt 3 — `P2` (28 Component Cảnh Quan Bổ Trợ, Phương Tiện, Hạ Tầng Phụ & Nội Thất Sâu)
Hoàn tất toàn bộ 100/100 component, kết hợp bake `T-NRM` atlas (đá ong, gạch Bát Tràng, thổ cẩm Tây Bắc, văn bia Hán-Nôm) và chạy `MultiAngleQcAgent` 10 góc kiểm tra `motifCoverage` & `requiredMotifs`:
- **Hoàng Thành Thăng Long (3):** `MB-028`, `MB-029`, `MB-036`
- **Fansipan & Lũng Cú (4):** `MB-042`, `MB-045`, `MB-046`, `MB-048`
- **Hạ Long & Bạch Đằng (5):** `MB-052`, `MB-054`, `MB-055`, `MB-058`, `MB-059`
- **Mù Cang Chải & Chùa Hương (5):** `MB-062`, `MB-064`, `MB-065`, `MB-066`, `MB-068`
- **Đền Hùng (3):** `MB-077`, `MB-079`, `MB-080`
- **Tràng An — Bích Động (5):** `MB-082`, `MB-084`, `MB-085`, `MB-086`, `MB-090`
- **Đường Lâm & Điện Biên Phủ (3):** `MB-095`, `MB-097`, `MB-099`
