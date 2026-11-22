# Kế Hoạch Phân Rã Hoa Văn — Khu Vực 3: Miền Nam & Hải Đảo (`MN-001` → `MN-100`)

> **Phạm vi**: Phân rã chi tiết hoa văn 3D (hình thái lịch sử, kỹ thuật dựng, kích thước, số lượng, ngân sách tam giác L0, material bucket, LOD và tiêu chí QC) cho toàn bộ **100 component** thuộc Khu vực 3 — Miền Nam & Hải Đảo, trải dài từ kiến trúc hiện đại nhiệt đới thập niên 1960 (Dinh Độc Lập), thuộc địa Pháp — Tân Romanesque/Gothic (Chợ Bến Thành, Nhà Thờ Đức Bà, Dinh Chúa Đảo Côn Đảo), đền tháp Chăm Pa Kauthara (Tháp Bà Ponagar), tín ngưỡng đình miếu & sông nước Nam Bộ (Đền Bến Dược, Chợ Nổi Cái Răng, Rừng Tràm Trà Sư, Mũi Cà Mau, Dinh Cậu Phú Quốc) đến di tích kháng chiến — hải đảo (Địa Đạo Củ Chi, Hàng Dương, Cầu Tàu 914).  
> **Tài liệu gốc bắt buộc đối chiếu**:
> - Thư viện mã hoa văn chuẩn (`HV-A01`..`HV-J07`): [MOTIF_LIBRARY_HOA_VAN.md](MOTIF_LIBRARY_HOA_VAN.md)
> - Danh sách 300 component chi tiết (`MN-001`..`MN-100`): [MASTER_300_COMPONENTS_DETAIL_LIST.md](MASTER_300_COMPONENTS_DETAIL_LIST.md)

---

## Bảng Tóm Tắt Hoa Văn & Ngân Sách Tri L0 Theo Cụm Di Sản

| STT | Cụm Di Sản (Khu Vực 3) | Phạm vi Component | Số Component | Số Mã HV Riêng Biệt | Tổng Tri L0 Ước Tính |
|---|---|---|---:|---:|---:|
| 3.1 | Dinh Độc Lập — Sài Gòn | `MN-001` → `MN-016` | 16 | 24 | 92 760 |
| 3.2 | Chợ Bến Thành — Sài Gòn | `MN-017` → `MN-028` | 12 | 25 | 58 916 |
| 3.3 | Nhà Thờ Đức Bà Sài Gòn | `MN-029` → `MN-042` | 14 | 17 | 114 448 |
| 3.4 | Địa Đạo Củ Chi & Đền Bến Dược | `MN-043` → `MN-052` | 10 | 15 | 48 440 |
| 3.5 | Tháp Bà Ponagar — Nha Trang | `MN-053` → `MN-062` | 10 | 24 | 55 780 |
| 3.6 | Chợ Nổi Cái Răng — Cần Thơ | `MN-063` → `MN-074` | 12 | 16 | 37 780 |
| 3.7 | Rừng Tràm Trà Sư — An Giang | `MN-075` → `MN-082` | 8 | 13 | 26 452 |
| 3.8 | Đất Mũi Cà Mau | `MN-083` → `MN-090` | 8 | 18 | 32 436 |
| 3.9 | Đảo Ngọc Phú Quốc & Côn Đảo | `MN-091` → `MN-100` | 10 | 27 | 43 580 |
| **Tổng** | **Toàn Khu Vực 3 — Miền Nam & Hải Đảo** | **`MN-001` → `MN-100`** | **100** | **73** *(61 chuẩn + 12 mới)* | **510 592** |

---

## 3.1. Dinh Độc Lập — Sài Gòn (`MN-001` → `MN-016`)

> **Bối cảnh mỹ thuật**: Thiết kế bởi KTS Ngô Viết Thụ (1962–1966), kết hợp chủ nghĩa Hiện đại nhiệt đới (Mid-century Tropical Modernism) với triết lý chữ Hán phương Đông (*Cát* 吉 — *Trung* 忠 — *Khẩu* 口 — *Hưng* 興), tuyệt đối **không** dùng rồng/phượng triều Nguyễn hay hoa văn pháp lam Huế trên kết cấu ngoại thất; nội thất dùng sơn mài truyền thống Nam – Bắc, gạch bông hình học Nam Bộ và đèn chùm hình học thập niên 1960.

#### `MN-001` — Hệ Rèm Hoa Đá Đốt Trúc (*Brise-Soleil*) (ảnh ref: `60`, `28`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt tiền tầng 2–3 (hàng thanh đốt trúc đứng) | `HV-C15` | 96 thanh bê tông trắng đúc thắt eo theo 5 đốt trúc thật, khớp mấu nổi vòng quanh sâu `3cm`, xếp dọc 2 băng ngang tạo nhịp bóng đổ hình chữ *Cát* (吉) | `G-LATHE` + `G-INST` | Cao `3.1m`, Ø `11–15cm` | 96 | 9 216 | `whiteParts` |
| Dầm mái & ô trần hiên đỡ rèm đá | `HV-NEW-MN-09` | Hệ 36 ô cờ bê tông giật cấp vuông `1.2×1.2m` lõm sâu `18cm`, tích hợp khe thông gió hình chữ *Khẩu* (口) cách điệu | `G-EXT` + `G-INST` | Ô `1.2×1.2m` | 36 | 2 304 | `whiteParts` |
| Diềm phào ngang phân tầng mặt đứng | `HV-H04` | Băng phào bê tông vát cạnh 2 cấp chạy suốt `64m` mặt tiền Đông–Nam, nhô khỏi mặt kính `12cm` chắn nước mưa | `G-EXT` | Dài `64m`, cao `0.28m` | 64 | 2 560 | `whiteParts` |
| Băng chân tường đá rửa & mạch kẻ chỉ | `HV-D01` | Đường chỉ lõm gấp khúc kiểu hồi văn tối giản hiện đại dọc bệ đỡ rèm tầng 2, độ sâu rãnh `1.5cm` | `G-EXT` | Băng cao `12cm`, dài `28m` | 28 | 1 680 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C15, HV-NEW-MN-09, HV-H04, HV-D01` | — | — | — | **15 760** | — |

**LOD/ghi chú QC:** L0 giữ nguyên 5 đốt thắt eo của `HV-C15` (cạnh vát ≥ `2cm`) và ô cờ `HV-NEW-MN-09`; L1 giảm phân đoạn Lathe của đốt trúc 50% và chuyển chỉ `HV-D01` sang `T-NRM`. QC bắt buộc kiểm tra `motifDepthCheck >= 2cm` trên đốt trúc ở góc chéo 45° so với ảnh `60`.

#### `MN-002` — Cổng Sắt Chính Dinh Độc Lập & Cột Đá (ảnh ref: `28`, `94`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 cánh cổng chính & 2 cánh phụ | `HV-H09` | 84 song sắt hộp sơn xanh đậm (`#243d34`) xếp dọc đều bước `14cm`, đầu vát mũi giáo cao `12cm`, kẹp giữa 2 dải vòng tròn đồng tâm hàn nổi `2cm` | `G-INST` | Cao `2.8m`, rộng `0.03m` | 84 | 5 040 | `ironParts` |
| 4 trụ cổng đá granit ốp mảng giật cấp | `HV-H11` | Khối đá mài xám xếp xen kẽ góc giật bậc kiểu hiện đại hóa quoin, 8 hàng/trụ, khe ron sâu `1.5cm` | `G-INST` + `T-NRM` | Khối `0.5×0.4m` | 32 | 768 | `stoneParts` |
| Mũ trụ cổng & phào chân đế | `HV-H04` | Mũ trụ bê tông vát 3 bậc nhô `8cm` và chân đế giật cấp chạy quanh 4 trụ cổng | `G-EXT` | Chu vi `3.2m`/trụ | 16 | 640 | `stoneParts` |
| Đèn trụ cổng cầu thủy tinh & khung đồng | `HV-H10` | 4 chụp đèn hình khối lăng trụ thập niên 1960, 8 thanh gờ đồng dọc sâu `1.5cm` trên đỉnh 4 trụ cổng | `G-INST` | Cao `0.75m`, Ø `0.45m` | 4 | 2 400 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H09, HV-H11, HV-H04, HV-H10` | — | — | — | **8 848** | — |

**LOD/ghi chú QC:** L0 giữ nguyên toàn bộ song sắt + vòng tròn `HV-H09` và đèn trụ `HV-H10`; L1 gộp khung cổng thành bản lưới alpha + `T-NRM`, hạ quoin `HV-H11` sang `T-NRM`. QC kiểm tra đúng màu xanh lịch sử 30/4/1975 và tỷ lệ khoảng hở song sắt theo ảnh `28`.

#### `MN-003` — Xe Tăng T-54B số hiệu `843` & Type-59 số hiệu `390` (ảnh ref: `95`, `28`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 bên tháp pháo đúc tròn | `HV-NEW-MN-12` | Ngôi sao vàng 5 cánh nền cờ giải phóng (nửa đỏ trên, nửa xanh dương dưới) & số hiệu sơn trắng nét quân sự `"843"` (T-54B), `"390"` (Type-59) gắn 2 má tháp pháo, sao nổi `1.5cm` | `G-EXT` + `T-ATLAS` | Ø sao `0.38m`, số cao `0.32m` | 4 | 480 | `goldParts` |
| Biển thông tin hiện vật gốc bằng đồng/đá | `HV-I04` | 2 bệ biển nghiêng 30° khắc chữ Quốc ngữ phông serif `"XE TĂNG 843"` và `"XE TĂNG 390 — 30/4/1975"`, chữ nổi/chìm rõ nét | `T-ATLAS` | `0.8×0.5m` | 2 | 0 | `bronzeParts` |
| Mặt bệ trưng bày & viền đá bao | `HV-D01` | Đường rãnh hồi văn hiện đại chạy viền 2 bệ đá granit đỡ xe tăng, sâu `1.5cm` | `G-EXT` | Dài `18m`/bệ | 36 | 2 160 | `stoneParts` |
| Hàng rào dây xích & cọc đồng bảo vệ | `HV-H09` | 24 cọc sắt đầu tròn nối xích thấp bao quanh 2 xe tăng giữ khoảng cách tham quan | `G-INST` | Cao `0.85m` | 24 | 1 440 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-12, HV-I04, HV-D01, HV-H09` | — | — | — | **4 080** | — |

**LOD/ghi chú QC:** L0 giữ khối sao 5 cánh `HV-NEW-MN-12` và hàng cọc `HV-H09`; L1 bake số hiệu `"843"`/`"390"` và rãnh bệ `HV-D01` thành `T-ATLAS`/`T-NRM`. QC xác nhận số hiệu đúng từng xe (`843` có cửa trưởng xe và pháo 100mm không ống hút khói đầu nòng kiểu T-54B; `390` Type-59) theo ảnh `95`.

#### `MN-004` — Trực Thăng UH-1 Iroquois trên Sân Đậu Nóc Dinh (ảnh ref: `96`, `28`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 vòng tròn đỏ đánh dấu vị trí ném bom 8/4/1975 | `HV-NEW-MN-12` | 2 vòng tròn sơn đỏ trên nền bê tông sân thượng đánh dấu 2 quả bom của phi công Nguyễn Thành Trung, kèm bia chữ mô tả sự kiện nổi gờ `1cm` | `G-EXT` + `T-ATLAS` | Ø `1.6m` | 2 | 240 | `crimsonParts` |
| Biển ký hiệu sân đáp `"H"` & chú thích hiện vật | `HV-I04` | Vòng tròn vàng chữ `"H"` sân đỗ trực thăng và bảng chữ `"TRỰC THĂNG UH-1 — NGÀY 8/4/1975"` | `T-ATLAS` | Ø `6.0m` / bảng `0.9×0.5m` | 2 | 0 | `goldParts` |
| Lan can sân thượng quanh bãi đáp | `HV-NEW-MN-09` | 32 ô bông gió bê tông chữ nhật đứng giật cấp chạy viền lan can tầng mái, sâu `12cm` | `G-EXT` + `G-INST` | Ô `0.8×0.9m` | 32 | 2 048 | `whiteParts` |
| Gờ phào viền sân thượng tầng 4 | `HV-H04` | Phào mái bê tông vát 2 lớp bao quanh sân đậu trực thăng, nhô `10cm` | `G-EXT` | Dài `48m` | 48 | 1 920 | `whiteParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-12, HV-I04, HV-NEW-MN-09, HV-H04` | — | — | — | **4 208** | — |

**LOD/ghi chú QC:** L0 giữ lan can bông gió `HV-NEW-MN-09` và gờ vòng bom `HV-NEW-MN-12`; L1 giữ decal chữ `"H"` và 2 vòng đỏ trên `T-ATLAS`, hạ phào `HV-H04` còn 1 vát. QC chụp góc top-down đối chiếu vị trí 2 vòng đỏ cạnh trực thăng theo ảnh `96`.

#### `MN-005` — Đài Phun Nước Bán Nguyệt & Thảm Cỏ Hình Bầu Dục (ảnh ref: `28`, `94`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bồn vòi phun trung tâm hình đài sen cách điệu | `HV-C01` | 16 cánh sen bê tông mài vươn nghiêng 35° xếp 1 tầng quanh trụ phun nước trung tâm, gân giữa nổi `2.5cm` | `G-INST` | Cánh `0.45×0.28m` | 16 | 768 | `whiteParts` |
| Thành bể phun nước bán nguyệt | `HV-H04` | Gờ đá rửa bo tròn 2 cấp chạy dọc cung bán nguyệt `24m`, rãnh chỉ nước sâu `2cm` | `G-EXT` | Dài `24m`, cao `0.45m` | 24 | 960 | `stoneParts` |
| Băng lát gạch men xanh ngọc đáy bể | `HV-H07` | Hoa văn gạch bông ô vuông ngôi sao 4 cánh xanh dương – trắng dưới mặt nước trong | `T-ATLAS` | Viên `0.2×0.2m` | 1 | 0 | `marbleParts` |
| Viền đá bó vỉa thảm cỏ bầu dục | `HV-D06` | Rãnh gợn sóng nhẹ khắc liên tục trên bó vỉa đá granit dài `40m` ôm theo cung đường xe | `G-EXT` | Cao `10cm`, dài `40m` | 40 | 3 600 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C01, HV-H04, HV-H07, HV-D06` | — | — | — | **5 328** | — |

**LOD/ghi chú QC:** L0 giữ 16 cánh sen bê tông `HV-C01` và thành bể `HV-H04`; L1 chuyển viền sóng `HV-D06` sang `T-NRM`. QC xác nhận trục đối xứng thẳng hàng từ Cổng Chính (`MN-002`) qua Đài Phun Nước đến Đại Sảnh (`MN-006`).

#### `MN-006` — Đại Sảnh Khánh Tiết Trung Tâm (ảnh ref: `28`, `118`, `119`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tường chính sau lễ tân (tranh sơn mài khổ lớn) | `HV-J05` | Bức tranh sơn mài phong cảnh sơn thủy & chùa Một Cột — vịnh Hạ Long nền đỏ son–vàng lá, bóng sâu, lồng trong khung gỗ thếp vàng vát `6cm` | `T-ATLAS` + `G-EXT` | `5.4×2.6m` | 1 | 280 | `goldParts` |
| Trần đại sảnh ô cờ giật cấp | `HV-NEW-MN-09` | 48 ô trần bê tông sơn trắng lồng đèn hắt vàng ấm, gờ nổi `16cm` tạo mạng lưới kỷ hà | `G-EXT` + `G-INST` | Ô `1.2×1.2m` | 48 | 3 072 | `whiteParts` |
| 2 cụm đèn chùm pha lê – đồng trung tâm | `HV-H10` | Khung đồng hình khối vuông 3 tầng giật cấp, treo 48 ống thủy tinh mờ thập niên 1960 | `G-INST` | `2.2×2.2×1.4m` | 2 | 1 200 | `goldParts` |
| Sàn đại sảnh lát đá & gạch bông viền | `HV-H07` | Băng viền gạch bông hình học Nam Bộ màu kem – nâu đất chạy dọc biên thảm đỏ khánh tiết | `T-ATLAS` | Viên `0.2×0.2m` | 1 | 0 | `marbleParts` |
| **Tổng** | — | `requiredMotifs`: `HV-J05, HV-NEW-MN-09, HV-H10, HV-H07` | — | — | — | **4 552** | — |

**LOD/ghi chú QC:** L0 giữ khung tranh `HV-J05`, trần ô cờ `HV-NEW-MN-09` và đèn chùm `HV-H10`; L1 tắt ống thủy tinh đèn chùm giữ khung đồng, hạ trần ô cờ sang `T-NRM`. QC kiểm tra phản xạ sơn mài roughness thấp (`0.18–0.25`) dưới ánh sáng nội thất.

#### `MN-007` — Phòng Đại Yến — Cánh Đông (ảnh ref: `118`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tường ốp gỗ & pano dọc 2 vách phòng tiệc | `HV-D07` | 24 ô triện chữ nhật góc lõm vuông kiểu hiện đại hóa chạy dọc vách gỗ gõ đỏ, viền chỉ nổi `1.8cm` | `G-EXT` | Ô `0.9×2.2m` | 24 | 960 | `woodParts` |
| Diềm bàn đại tiệc `12.8m` & lưng 22 ghế nệm | `HV-D01` | Băng hồi văn chữ "Công" liên hoàn khắc nổi nhẹ `1.2cm` chạy viền yếm bàn gỗ gõ đỏ `28m` chu vi | `G-EXT` | Băng cao `6cm`, dài `28m` | 28 | 1 680 | `woodParts` |
| Tấm thảm len vàng ô-liu & viền gạch bông hành lang | `HV-H07` | Hoa văn hình thoi – hoa 4 cánh lặp đều ở viền thảm và mảng sàn gạch bông lối ra cánh Đông | `T-ATLAS` | Viên `0.2×0.2m` | 1 | 0 | `plasterParts` |
| Tranh sơn mài phong cảnh đầu phòng tiệc | `HV-J05` | Bức sơn mài *Vịnh Hạ Long* nền đen – bạc – vàng trứng đặt đối xứng đầu Tây phòng Đại Yến | `T-ATLAS` | `3.6×1.8m` | 1 | 0 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D07, HV-D01, HV-H07, HV-J05` | — | — | — | **2 640** | — |

**LOD/ghi chú QC:** L0 giữ ô pano `HV-D07` và hồi văn yếm bàn `HV-D01`; L1 bake cả hai thành `T-NRM` trên vật liệu gỗ gõ đỏ. QC đối chiếu màu thảm vàng ô-liu và độ dài bàn 22 chỗ với ảnh `118`.

#### `MN-008` — Rèm Nhung Vàng & 2 Đèn Chùm Hình Học Phòng Đại Yến (ảnh ref: `118`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 đèn chùm hình học trung tâm | `HV-H10` | Khung đồng mạ vàng vuông 3 tầng lồng nhau, 64 ống thủy tinh trụ đứng phát sáng dịu theo chuẩn nội thất 1966 | `G-INST` | `2.6×2.6×1.3m` | 2 | 1 200 | `goldParts` |
| Trần ô cờ phía trên 2 đèn chùm | `HV-NEW-MN-09` | 36 ô trần bê tông sơn trắng lõm sâu `15cm`, tạo nhịp ánh sáng hắt xuống bàn đại tiệc | `G-EXT` + `G-INST` | Ô `1.2×1.2m` | 36 | 2 304 | `whiteParts` |
| 2 bình gốm trang trí đặt trên đôn góc | `HV-C07` | Dây hoa cúc 10 cánh men lam – vàng vẽ quanh thân bình gốm dáng bầu cổ loe, gờ men nổi `0.8cm` | `G-TUBE` + `T-NRM` | Bình cao `0.95m`, băng `2.4m` | 4 | 560 | `plasterParts` |
| Diềm hộp rèm nhung vàng sát trần | `HV-H04` | Hộp phào gỗ sơn trắng-vàng 2 cấp che thanh rèm dài `22m` dọc cửa kính phòng Đại Yến | `G-EXT` | Dài `22m`, cao `0.25m` | 22 | 880 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H10, HV-NEW-MN-09, HV-C07, HV-H04` | — | — | — | **4 944** | — |

**LOD/ghi chú QC:** L0 giữ 2 đèn chùm `HV-H10` và trần ô cờ `HV-NEW-MN-09`; L1 gộp ống thủy tinh đèn chùm thành khối phát sáng đơn giản và chuyển `HV-C07` sang `T-NRM`. QC kiểm tra tỷ lệ đèn chùm cân đối trên 2 cụm bàn tiệc ảnh `118`.

#### `MN-009` — Phòng Trình Quốc Thư — Cánh Tây (ảnh ref: `119`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bức tranh sơn mài *Bình Ngô Đại Cáo* 40 tấm ghép | `HV-J05` | Tác phẩm của họa sĩ Nguyễn Văn Minh (1966): 40 tấm sơn mài ghép phẳng (4 hàng × 10 tấm) nền vàng thếp rực rỡ, miêu tả cảnh thái bình thời Lê Sơ (chèo đò, cày ruộng, múa lân), mạch ghép chìm `0.5cm` | `T-ATLAS` + `G-EXT` | `8.0×3.2m` | 1 | 320 | `goldParts` |
| 2 trụ vách hai bên tranh gắn phù điêu hoa sen | `HV-C04` | Đôi cụm hoa sen cách điệu 24 cánh nhiều lớp, nhị tròn nổi sâu `3.5cm`, sơn vàng ánh kim trên nền đỏ sẫm | `G-INST` + `G-LATHE` | Ø `0.9m` | 2 | 2 400 | `goldParts` |
| Trần ô cờ ánh sáng phòng Khánh tiết Tây | `HV-NEW-MN-09` | 30 ô trần vuông giật cấp `1.2×1.2m`, lõm sâu `15cm` phủ sơn trắng kem | `G-EXT` + `G-INST` | Ô `1.2×1.2m` | 30 | 1 920 | `whiteParts` |
| Viền chân tường & khung viền tranh sơn mài | `HV-J04` | Khung nẹp sơn son thếp vàng bản `12cm` bo 4 cạnh bức tranh 40 tấm, độ nổi `4cm` | `G-EXT` | Chu vi `22.4m` | 1 | 260 | `crimsonParts` |
| **Tổng** | — | `requiredMotifs`: `HV-J05, HV-C04, HV-NEW-MN-09, HV-J04` | — | — | — | **4 900** | — |

**LOD/ghi chú QC:** L0 giữ 2 cụm hoa sen nổi `HV-C04` và trần `HV-NEW-MN-09`; L1 giảm số cánh sen `HV-C04` còn 12 cánh + `T-NRM`. QC bắt buộc kiểm tra chia lưới 4×10 tấm của *Bình Ngô Đại Cáo* đúng sắc vàng rực ảnh `119`.

#### `MN-010` — Bàn Trình Quốc Thư, 4 Bình Đồng Loe & Sofa Ngoại Giao (ảnh ref: `119`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 bình đồng miệng loe trên đôn gỗ | `HV-E07` | 4 bình/đỉnh đồng miệng loe dáng cung đình cách điệu, thân phình chạm băng mây, 2 quai tai nhỏ đối xứng, cao `1.1m` | `G-LATHE` + `G-TUBE` | Cao `1.1m`, Ø `0.42m` | 4 | 3 600 | `bronzeParts` |
| Mặt & yếm bàn Trình Quốc Thư sơn mài vàng | `HV-J05` | Bàn sơn mài nền vàng nhũ vẽ họa tiết mây trời – cành trúc tinh tế, bóng gương | `T-ATLAS` | `2.6×1.2×0.76m` | 1 | 0 | `goldParts` |
| Viền lưng ghế chủ tọa & bàn ngoại giao | `HV-D02` | 6 huy hiệu chữ Thọ tròn cách điệu (團壽) đường kính `14cm` chạm nổi `1.2cm` trên đỉnh lưng ghế gỗ sơn vàng | `G-EXT` | Ø `0.14m` | 6 | 840 | `goldParts` |
| Băng chân đôn đặt bình đồng | `HV-D01` | Hồi văn chữ "Công" chạy quanh cổ 4 đôn gỗ đen, khắc sâu `1cm` | `G-EXT` | Chu vi `1.8m`/đôn | 8 | 480 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-E07, HV-J05, HV-D02, HV-D01` | — | — | — | **4 920** | — |

**LOD/ghi chú QC:** L0 giữ đầy đủ 4 bình đồng `HV-E07` và 6 chữ Thọ `HV-D02`; L1 hạ phân đoạn Lathe bình đồng 40% và chuyển `HV-D01`/`HV-D02` sang `T-NRM`. QC đối chiếu bộ 4 bình đồng loe đối xứng hai bên bàn sơn mài theo ảnh `119`.

#### `MN-011` — Phòng Họp Nội Các (Tầng 2) (ảnh ref: `28`, `118`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vách ốp gỗ tếch tiêu âm quanh phòng | `HV-D07` | 20 pano gỗ tếch bản rộng lồng khung triện phẳng tối giản, khe tiêu âm dọc sâu `1.5cm` | `G-EXT` | Ô `1.1×2.6m` | 20 | 800 | `woodParts` |
| Trần âm học ô cờ hình tròn – vuông | `HV-NEW-MN-09` | 24 ô trần giật cấp tích hợp đèn tròn đồng tâm chiếu xuống bàn họp phủ da xanh | `G-EXT` + `G-INST` | Ô `1.2×1.2m` | 24 | 1 536 | `whiteParts` |
| Đèn chùm vòng đồng trên bàn họp nội các | `HV-H10` | Đèn chùm hình học vòng bát giác khung đồng 2 tầng, 24 trụ thủy tinh mờ | `G-INST` | Ø `2.4m`, cao `0.9m` | 1 | 600 | `goldParts` |
| Băng chân bàn họp & ốp cửa vào | `HV-H04` | Phào gỗ tếch vát 2 bậc chạy quanh chu vi bàn tròn `16m` và khung cửa chính | `G-EXT` | Dài `22m` | 22 | 880 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D07, HV-NEW-MN-09, HV-H10, HV-H04` | — | — | — | **3 816** | — |

**LOD/ghi chú QC:** L0 giữ đèn chùm `HV-H10` và ô trần `HV-NEW-MN-09`; L1 chuyển khe pano `HV-D07` và phào `HV-H04` sang `T-NRM`. QC xác nhận mặt bàn họp phủ da xanh rêu đặc trưng tầng 2 Dinh Độc Lập.

#### `MN-012` — Cửa Thép & Nội Thất Hầm Chỉ Huy Ngầm Dinh Độc Lập (ảnh ref: `28`, `94`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 cánh cửa thép chống bom bọc đinh tán | `HV-D14` | 64 đinh tán bán cầu thép xếp theo lưới viền cánh cửa thép dày `12cm`, nổi `1.5cm` kết hợp tay quay vô-lăng khóa kín | `G-INST` | Ø đinh `4cm`, cửa `1.1×2.1m` | 64 | 1 536 | `ironParts` |
| Tường bản đồ tác chiến & bảng ký hiệu phòng hầm | `HV-I04` | Biển kim loại sơn xanh chữ trắng `"PHÒNG TRỰC TÁC CHIẾN"`, `"TRUNG TÂM THÔNG TIN"` và bản đồ hành chính – quân sự 1966 | `T-ATLAS` | `2.4×1.4m` / biển `0.5×0.15m` | 4 | 0 | `ironParts` |
| Khung giằng trần bê tông chống sập | `HV-NEW-MN-09` | 16 ô dầm bê tông chịu lực đúc nguyên khối lõm sâu `25cm` dọc hành lang hầm ngầm | `G-EXT` + `G-INST` | Ô `1.5×1.5m` | 16 | 1 024 | `stoneParts` |
| Ký hiệu chỉ dẫn cửa thoát hiểm & đồng hồ tường | `HV-NEW-MN-12` | Mũi tên định hướng, số hiệu phòng hầm đắp sơn khuôn kỹ thuật trên tường sơn xanh xám | `T-ATLAS` | `0.3×0.3m` | 6 | 0 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D14, HV-I04, HV-NEW-MN-09, HV-NEW-MN-12` | — | — | — | **2 560** | — |

**LOD/ghi chú QC:** L0 giữ 64 đinh tán `HV-D14` và dầm ô `HV-NEW-MN-09`; L1 bake toàn bộ đinh tán cửa thép sang `T-NRM`. QC kiểm tra cửa hầm có chiều dày thép thực `≥ 10cm` và bảng chữ `"PHÒNG TRỰC TÁC CHIẾN"` đọc rõ ở khoảng cách 5m.

#### `MN-013` — Hành Lang Mặt Tiền & Cầu Thang Đá Cẩm Thạch (ảnh ref: `60`, `118`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Lan can cầu thang kính – đồng thập niên 1960 | `HV-H09` | 48 trụ đứng thanh đồng mạ vuông mảnh kết hợp tay vịn gỗ tếch và kẹp kính nổi `2cm` | `G-INST` | Cao `0.95m` | 48 | 2 880 | `goldParts` |
| Sàn hành lang gạch bông Nam Bộ | `HV-H07` | Gạch bông ô vuông `20×20cm` hoa văn hình học ngôi sao 4 cánh xám – kem – vàng đất lát toàn bộ hành lang tầng 1–2 | `T-ATLAS` | Viên `0.2×0.2m` | 1 | 0 | `marbleParts` |
| Trần hành lang ô cờ hắt sáng | `HV-NEW-MN-09` | 32 ô trần giật cấp `1.2×1.2m` chạy dọc hành lang đón ánh nắng xuyên qua rèm đốt trúc | `G-EXT` + `G-INST` | Ô `1.2×1.2m` | 32 | 2 048 | `whiteParts` |
| Gờ phào chân tường đá cẩm thạch | `HV-H04` | Phào đá mài vát mép 2 cấp ôm theo 2 chiếu nghỉ và dọc tường hành lang dài `42m` | `G-EXT` | Dài `42m`, cao `0.18m` | 42 | 1 680 | `marbleParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H09, HV-H07, HV-NEW-MN-09, HV-H04` | — | — | — | **6 608** | — |

**LOD/ghi chú QC:** L0 giữ 48 trụ đồng `HV-H09` và trần `HV-NEW-MN-09`; L1 gộp lan can thành dải kính mờ + tay vịn liền khối, giữ `HV-H07` trên `T-ATLAS`. QC kiểm tra độ tương phản thảm đỏ giữa bậc đá cẩm thạch trắng.

#### `MN-014` — Hồ Cá Chép Bán Nguyệt trước thềm Dinh (ảnh ref: `28`, `94`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt nước hồ (cụm lá sen khum) | `HV-C05` | 28 lá sen xanh thẫm khum lòng chảo, mép gợn sóng, gân tỏa từ cuống nổi `1.5cm` đặt 2 góc bán nguyệt | `G-DISP` | Ø `0.45–0.7m` | 28 | 1 792 | `woodParts` |
| 6 bông sen nở trên mặt hồ | `HV-C04` | 6 bông sen hồng 24 cánh nhiều lớp, nhị vàng, gương sen đúc hạt rõ khối | `G-INST` + `G-LATHE` | Ø `0.28m` | 6 | 7 200 | `crimsonParts` |
| Thành hồ bán nguyệt ốp đá rửa | `HV-H04` | Phào bo tròn mũ thành hồ cao `0.55m`, dài `34m`, khe giật cấp chống tràn sâu `2cm` | `G-EXT` | Dài `34m` | 34 | 1 360 | `stoneParts` |
| Đáy hồ lát gạch men xanh | `HV-H07` | Họa tiết gạch ô vuông xanh lam nhạt phản chiếu dưới làn nước trong có đàn cá koi | `T-ATLAS` | Viên `0.2×0.2m` | 1 | 0 | `marbleParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C05, HV-C04, HV-H04, HV-H07` | — | — | — | **10 352** | — |

**LOD/ghi chú QC:** L0 giữ 6 bông sen `HV-C04` và 28 lá sen `HV-C05`; L1 giản lược bông sen còn 8 cánh (giảm 60% tri) và phẳng hóa lá sen. QC xác nhận hồ bán nguyệt ôm sát mặt tiền bậc thềm đại sảnh, không đâm xuyên bậc đá.

#### `MN-015` — Tứ Phương Vô Sự Lâu (Sân Thượng Tầng 4) (ảnh ref: `28`, `60`, `96`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 mặt khung bông gió hiện đại hóa chữ *Hưng* (興) | `HV-NEW-MN-09` | 36 ô thoáng bê tông sơn trắng hình chữ nhật lồng cách điệu theo triết lý KTS Ngô Viết Thụ, sâu `14cm` | `G-EXT` + `G-INST` | Ô `0.6×0.8m` | 36 | 2 304 | `whiteParts` |
| Hệ lam che nắng 4 hướng lầu thượng | `HV-C15` | 24 thanh đứng đốt trúc thu nhỏ vươn quanh 4 góc Tứ Phương Vô Sự Lâu, khớp nổi `2cm` | `G-LATHE` + `G-INST` | Cao `2.6m`, Ø `10cm` | 24 | 2 304 | `whiteParts` |
| Lan can bao quanh ban công tầng 4 | `HV-D10` | 40 con tiện mảnh hình trụ vát hiện đại đỡ tay vịn gỗ sơn nâu đỏ | `G-LATHE` + `G-INST` | Cao `0.8m` | 40 | 2 240 | `woodParts` |
| Biển tên lầu gỗ sơn son chữ vàng | `HV-I01` | Hoành phi ngang nền son khung gỗ vát `3cm`, chữ Hán thếp vàng `"四方無事樓"` (*Tứ Phương Vô Sự Lâu*) | `T-ATLAS` + `G-EXT` | `1.8×0.55m` | 1 | 220 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-09, HV-C15, HV-D10, HV-I01` | — | — | — | **7 068** | — |

**LOD/ghi chú QC:** L0 giữ bông gió `HV-NEW-MN-09`, 24 thanh `HV-C15` và hoành phi `HV-I01`; L1 chuyển lan can `HV-D10` sang dạng hộp alpha + `T-NRM`. QC xác nhận lầu đặt chính tâm tầng mái, thẳng trục đường Lê Duẩn.

#### `MN-016` — Bốt Gác Bảo Vệ & Biển Di Tích Quốc Gia Đặc Biệt (ảnh ref: `28`, `94`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bia đá granit giới thiệu Di tích Quốc gia Đặc biệt | `HV-I04` | Bia đá đen đánh bóng khắc chữ Quốc ngữ vàng sắc nét `"DI TÍCH LỊCH SỬ DINH ĐỘC LẬP — DI TÍCH QUỐC GIA ĐẶC BIỆT"` (tiếng Việt & tiếng Anh) | `T-ATLAS` | `1.4×0.9m` | 1 | 0 | `stoneParts` |
| 2 bốt gác bảo vệ đối xứng (ô cửa chớp thông gió) | `HV-H05` | 8 cánh cửa chớp lá sách sơn xanh rêu, mỗi cánh 18 lá nghiêng 30°, sâu `3cm` | `G-INST` | `0.55×1.4m` | 8 | 960 | `ironParts` |
| Mái đua bê tông 2 bốt gác | `HV-H04` | Phào mái đua vát 2 tầng nhô `35cm` chạy quanh 2 chòi gác | `G-EXT` | Chu vi `8m`/bốt | 16 | 640 | `whiteParts` |
| Trán bia & bệ đá đặt biển di tích | `HV-C01` | 12 cánh sen khắc nổi nhẹ `2cm` xếp hàng ngang làm bệ đỡ chân bia di tích | `G-INST` | Cánh `0.15×0.12m` | 12 | 576 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I04, HV-H05, HV-H04, HV-C01` | — | — | — | **2 176** | — |

**LOD/ghi chú QC:** L0 giữ 8 cửa chớp `HV-H05` và 12 cánh sen bệ bia `HV-C01`; L1 chuyển lá sách và cánh sen sang `T-NRM`. QC đảm bảo chữ trên biển di tích sắc nét không vỡ pixel ở khoảng cách 3m.

---

## 3.2. Chợ Bến Thành — Sài Gòn (`MN-017` → `MN-028`)

> **Bối cảnh mỹ thuật**: Kiến trúc công cộng thuộc địa Pháp (1912–1914, nhà thầu Brossard et Maupin) pha Art Deco đầu thế kỷ XX kết hợp bộ **4 phù điêu gốm men Biên Hòa xanh đồng trổ** do điêu khắc gia Lê Văn Mậu thực hiện năm 1952. Tuyệt đối phân biệt kiến trúc thép-vữa Pháp bên ngoài với tín ngưỡng thờ Tổ nghiệp Nam Bộ giản dị bên trong giao lộ trung tâm.

#### `MN-017` — Tháp Đồng Hồ Cửa Nam (`28m`) (ảnh ref: `29`, `59`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 mặt đồng hồ tháp Cửa Nam (Nam, Đông, Tây) | `HV-H08` | 3 mặt đồng hồ tròn viền vữa nổi `8cm`, 12 số La Mã `I–XII` nổi khối `2.5cm` màu đen trên nền trắng phát sáng ban đêm, 2 kim sắt hoa văn đầu mũi giáo | `G-EXT` + `T-ATLAS` | Ø `2.4m` | 3 | 840 | `whiteParts` |
| Dải biển chữ mặt tiền Cửa Nam | `HV-I04` | Dòng chữ nổi kim loại sơn nâu sẫm `"CHỢ BẾN THÀNH"` kiểu serif cao `0.65m`, dày `5cm`, đặt chính tâm dưới đồng hồ Nam | `T-ATLAS` + `G-EXT` | Dài `7.8m`, cao `0.75m` | 1 | 240 | `plasterParts` |
| Khung vòm cổng Cửa Nam & gờ phào phân tầng tháp | `HV-H04` | Hệ phào cổ điển thuộc địa 3 lớp lồi-lõm cùng 12 con sơn cuộn nâng đỡ mái ngói tháp đồng hồ, nhô `18cm` | `G-EXT` | Dài `46m` | 46 | 1 840 | `plasterParts` |
| Khung vòm bán nguyệt dưới đồng hồ & cửa thông gió | `HV-H03` | Vòm cuốn 3 lớp giật cấp ôm trọn đầu cổng Cửa Nam, khóa vòm đá nổi chính đỉnh sâu `12cm` | `G-TUBE` | Ø `6.4m` | 3 | 900 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H08, HV-I04, HV-H04, HV-H03` | — | — | — | **3 820** | — |

**LOD/ghi chú QC:** L0 giữ nguyên 3 mặt đồng hồ `HV-H08`, chữ nổi `"CHỢ BẾN THÀNH"` `HV-I04` và 12 con sơn `HV-H04`; L1 chuyển số La Mã sang `T-ATLAS` phát sáng và hạ phào còn 1 bậc. QC đối chiếu đúng 3 mặt đồng hồ (mặt Bắc tiếp giáp mái chợ không có đồng hồ) theo ảnh `29`.

#### `MN-018` — 4 Bộ Phù Điêu Gốm Biên Hòa trên 4 Cửa Chợ (ảnh ref: `59`, `29`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 cụm phù điêu gốm men xanh đồng trổ (Nam–Bắc–Đông–Tây) | `HV-J06` | 12 bức phù điêu gốm Biên Hòa (Lê Văn Mậu, 1952) đắp nổi cao `6–10cm` men xanh lam-lục trổ đồng & vàng đất: Cửa Nam (chuối, măng cụt, cá), Cửa Bắc (bò, vịt, hoa sen), Cửa Đông (gà vịt, nải chuối), Cửa Tây (cá đuối, tôm cua, bò) | `G-DISP` + `S-SHD` | Ô `1.6×1.2m` | 12 | 5 400 | `roofParts` |
| Diềm lá & hoa thị đóng khung 4 bộ phù điêu | `HV-C14` | 16 hoa thị gốm 8 cánh men xanh lục đặt tại 4 góc các mảng phù điêu gốm, sâu `3cm` | `G-EXT` | Ø `0.28m` | 16 | 768 | `roofParts` |
| Khung vữa giật cấp ôm các tấm gốm | `HV-H04` | Gờ chỉ vữa kem 2 cấp chạy viền quanh 12 ô phù điêu bảo vệ mép gốm, nhô `8cm` | `G-EXT` | Chu vi `5.6m`/ô | 36 | 1 440 | `plasterParts` |
| Hoa văn sóng nước cách điệu chân bức cá đuối (Cửa Tây) | `HV-D06` | Dải sóng cuộn men xanh lam chạy chân bức phù điêu cá đuối & thủy sản Nam Bộ, nổi `3cm` | `G-EXT` | Dài `6m`, cao `0.22m` | 6 | 540 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-J06, HV-C14, HV-H04, HV-D06` | — | — | — | **8 148** | — |

**LOD/ghi chú QC:** L0 giữ toàn bộ độ nổi `G-DISP` (`6–10cm`) của 12 bức gốm `HV-J06` và shader men đồng trổ; L1 giữ shader `HV-J06` trên normal map `T-NRM`, tắt hoa thị `HV-C14`. QC bắt buộc so sánh sắc xanh đồng trổ — vàng đất đặc trưng gốm Biên Hòa ảnh `59`.

#### `MN-019` — 4 Cửa Vòm Thông Suốt Đông — Tây — Nam — Bắc (ảnh ref: `29`, `59`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 cổng vòm bán nguyệt chính | `HV-H03` | 4 vòm cuốn lớn 3 lớp giật cấp mở thông suốt 4 hướng đại lộ lòng chợ, đá khóa vòm nổi giữa đỉnh sâu `12cm` | `G-TUBE` | Ø `5.8m` | 12 | 3 600 | `plasterParts` |
| Cửa sổ chớp thông gió 2 cánh bên cổng | `HV-H05` | 16 cánh cửa chớp gỗ sơn xanh rêu cổ điển xếp 2 bên 4 đầu hồi cửa chợ, mỗi cánh 20 lá nghiêng 30° | `G-INST` | `0.8×2.2m` | 16 | 1 920 | `woodParts` |
| Trán cổng gắn biển tên 4 cửa | `HV-I04` | 4 bảng chữ serif nổi `"CỬA NAM"`, `"CỬA BẮC"`, `"CỬA ĐÔNG"`, `"CỬA TÂY"` sơn nâu trên nền vữa kem | `T-ATLAS` | `2.6×0.45m` | 4 | 0 | `plasterParts` |
| Góc trụ cửa ốp khối giật bậc | `HV-H11` | 32 khối vữa giả đá giật bậc (quoin) xếp xen kẽ dài–ngắn ở 8 má trụ của 4 cửa chợ, sâu `3.5cm` | `G-INST` + `T-NRM` | Khối `0.5×0.32m` | 32 | 768 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H03, HV-H05, HV-I04, HV-H11` | — | — | — | **6 288** | — |

**LOD/ghi chú QC:** L0 giữ 4 vòm 3 lớp `HV-H03` và 16 cửa chớp `HV-H05`; L1 chuyển cửa chớp và quoin `HV-H11` sang `T-NRM`. QC xác nhận 4 lối vòm mở rỗng xuyên suốt nhìn thẳng qua giao lộ trung tâm.

#### `MN-020` — Kết cấu Vì Kèo Thép Xanh & Cửa Thông Gió Mái (ảnh ref: `93`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Hệ 18 giàn vì kèo thép chữ A cổ điển Pháp | `HV-NEW-MN-10` | 18 bộ nút kèo thép sơn xanh xám (`#4f756b`) kết hợp thanh giằng chéo và bản mã gắn đinh tán bán cầu nổi `1.2cm` | `G-INST` + `G-LATHE` | Nhịp `16m`, nút `1.4m` | 18 | 5 760 | `ironParts` |
| Băng lam chớp thông gió dọc khe mái sáng | `HV-H05` | 24 dải cửa chớp lá sách cố định chạy dọc 2 sườn khe nóc lấy sáng tự nhiên, lá nghiêng 35° | `G-INST` | `1.6×0.9m` | 24 | 2 880 | `ironParts` |
| Khung thanh giằng hoa văn vòng tròn nách kèo | `HV-H09` | 36 thanh sắt uốn vòng tròn chèn góc giao kèo – đầu cột tăng cứng và trang trí công nghiệp 1914 | `G-INST` | Cao `1.2m` | 36 | 2 160 | `ironParts` |
| Đinh tán nối sống mái tôn sóng | `HV-D14` | 48 cụm đinh tán lớn trên các bản mã chính dọc trục giữa lòng chợ, nổi `1.2cm` | `G-INST` | Ø `3.5cm` | 48 | 1 152 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-10, HV-H05, HV-H09, HV-D14` | — | — | — | **11 952** | — |

**LOD/ghi chú QC:** L0 giữ 18 nút kèo `HV-NEW-MN-10` và 24 băng chớp `HV-H05`; L1 ẩn đinh tán `HV-D14` và vòng nách `HV-H09`, giữ thanh dàn chính. QC đối chiếu màu thép xanh xám và nhịp kèo sáng trần với ảnh `93`.

#### `MN-021` — Miếu Thờ Tổ Nghiệp Chợ Bến Thành (ảnh ref: `93`, `29`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Hoành phi trên khám thờ Tổ nghiệp | `HV-I01` | Bức hoành phi gỗ sơn son nền đỏ, viền chạm mây cuốn sâu `2.5cm`, chữ Hán thếp vàng `"福德正神"` (*Phúc Đức Chính Thần*) / `"BẾN THÀNH TỔ MIẾU"` | `T-ATLAS` + `G-EXT` | `1.8×0.6m` | 1 | 240 | `goldParts` |
| Đôi câu đối ôm 2 cột gỗ trước miếu | `HV-I02` | Cặp câu đối sơn son chữ vàng uốn cong nhẹ ôm cột gỗ, chúc mua may bán đắt cho tiểu thương chợ | `T-ATLAS` + `G-EXT` | `0.26×2.0m` | 2 | 160 | `crimsonParts` |
| Lư hương đồng 3 chân đặt trước bàn thờ | `HV-E07` | Đỉnh đồng Nam Bộ bụng tròn, 2 quai rồng nhỏ, 3 chân thú, nắp gắn tượng lân cầu cao `0.95m` | `G-LATHE` + `G-TUBE` | Cao `0.95m` | 1 | 900 | `bronzeParts` |
| Cửa võng nhỏ chạm hoa mai – cúc Nam Bộ | `HV-D12` | Khung bao lam chạm thủng hoa cúc dây, chim điểu sơn son thếp vàng sâu `3cm` đặc trưng miếu thị tứ Sài Gòn | `G-EXT` | `2.0×0.65m` | 1 | 1 600 | `goldParts` |
| Chụp đèn chùm nón lá đan tre treo trục giao lộ | `HV-G03` | 8 chụp đèn hình nón lá lớn đan lóng mốt nan tre chiếu sáng ấm xuống khu miếu trung tâm | `T-NRM` + `S-SHD` | Ø `1.1m` | 8 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I01, HV-I02, HV-E07, HV-D12, HV-G03` | — | — | — | **2 900** | — |

**LOD/ghi chú QC:** L0 giữ đỉnh đồng `HV-E07` và bao lam `HV-D12`; L1 hạ bao lam sang alpha cutout + `T-NRM`. QC xác nhận miếu đặt đúng giao lộ trung tâm dưới vòm tháp đồng hồ, hòa hợp không gian chợ nội thất.

#### `MN-022` — Khu Sạp Trái Cây Nhiệt Đới (ảnh ref: `93`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 8 bảng hiệu & bảng giá sạp trái cây | `HV-I04` | Biển hiệu tiểu thương chữ Quốc ngữ – Anh (`"TRÁI CÂY MIỀN TÂY — SẦU RIÊNG — MĂNG CỤT"`) treo ngang xà gian hàng | `T-ATLAS` | `1.8×0.35m` | 8 | 0 | `plasterParts` |
| Thúng rổ tre đựng trái cây xếp tầng | `HV-G03` | 24 thúng, mủng đan lóng mốt nan tre đựng xoài cát, thanh long, dừa xiêm | `T-NRM` + `S-SHD` | Ø `0.45–0.65m` | 24 | 0 | `woodParts` |
| Mái hiên sạp & thanh chắn gỗ đan chéo | `HV-NEW-MN-11` | 12 khung vách ngăn tre – gỗ đan mắt cáo giữa các quầy sạp trái cây, nổi `2cm` | `G-INST` + `T-NRM` | `1.2×0.9m` | 12 | 960 | `woodParts` |
| Sàn gạch bông cổ khu sạp | `HV-H07` | Gạch bông ô vuông `20×20cm` hoa 4 cánh màu xám – vàng nhạt lót lối đi giữa 8 sạp | `T-ATLAS` | Viên `0.2×0.2m` | 1 | 0 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I04, HV-G03, HV-NEW-MN-11, HV-H07` | — | — | — | **960** | — |

**LOD/ghi chú QC:** L0 giữ 12 khung vách mắt cáo `HV-NEW-MN-11`; L1 chuyển toàn bộ hoa văn đan sang `T-NRM`/`T-ATLAS`. QC kiểm tra độ tương phản màu sắc nhiệt đới của trái cây và biển hiệu rõ chữ.

#### `MN-023` — Khu Sạp Vải Vóc & Áo Dài Truyền Thống (ảnh ref: `93`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cuộn gấm lụa & tà áo dài trên manơcanh | `HV-C07` | Họa tiết hoa cúc dây, sen nhỏ dệt kim tuyến trên 16 cuộn vải lụa và 4 tà áo dài trưng bày (render bằng normal/albedo + viền cổ) | `T-NRM` + `T-ATLAS` | Cuộn `0.2×1.2m` | 16 | 0 | `crimsonParts` |
| Băng vải thổ cẩm & lụa dân tộc trưng bày | `HV-G01` | Dải vải dệt hoa văn hình thoi – răng cưa đỏ-vàng-đen treo mặt ngoài quầy vải lưu niệm | `T-NRM`/`T-ATLAS` | `0.6×1.4m` | 6 | 0 | `crimsonParts` |
| Nón lá Huế – Nam Bộ treo viền quầy | `HV-G03` | 18 chiếc nón lá chằm chỉ gân nan tre xếp thành chùm dọc thanh sắt gian hàng | `T-NRM` + `S-SHD` | Ø `0.42m` | 18 | 0 | `woodParts` |
| Biển số sạp & hiệu may áo dài lấy liền | `HV-I04` | 6 biển hiệu `"SẠP VẢI LỤA — MAY ÁO DÀI 24H"` cùng mã số quầy chuẩn Chợ Bến Thành | `T-ATLAS` | `1.5×0.35m` | 6 | 0 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C07, HV-G01, HV-G03, HV-I04` | — | — | — | **0** | — |

**LOD/ghi chú QC:** Toàn bộ hoa văn dệt vải (`HV-C07`, `HV-G01`, `HV-G03`) dùng `T-ATLAS`/`T-NRM` (0 tri phát sinh thêm ngoài mesh cuộn vải/áo dài cơ bản), giữ budget tối ưu cho lòng chợ đông đúc. QC kiểm tra bảng màu gấm lụa không bị bệt sáng.

#### `MN-024` — Khu Ẩm Thực Chợ Bến Thành (ảnh ref: `93`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Biển thực đơn quầy Phở — Bún Bò — Bánh Xèo — Chè | `HV-I04` | 8 bảng hiệu đèn hộp chữ Quốc ngữ – Anh (`"BÁNH XÈO NAM BỘ"`, `"CHÈ BA MÀU"`, `"BÚN RIÊU"`, `"PHỞ BÒ"`) gắn viền quầy | `T-ATLAS` | `1.6×0.45m` | 8 | 0 | `whiteParts` |
| Bệ quầy ốp gạch bông Nam Bộ chống bám bẩn | `HV-H07` | Gạch bông hoa văn sao 8 cánh xanh ngọc – vàng đất ốp mặt đứng 8 quầy ẩm thực | `T-ATLAS` | Viên `0.2×0.2m` | 1 | 0 | `plasterParts` |
| Mẹt tre lót bánh xèo & rổ rau sống | `HV-G03` | 16 mẹt tre đan mắt cáo bày trên mặt quầy gỗ – inox phục vụ thực khách | `T-NRM` + `S-SHD` | Ø `0.32m` | 16 | 0 | `woodParts` |
| Mũ chụp hút khói & thanh viền inox chạm lỗ hoa thị | `HV-C14` | 12 ô lưới thông gió hoa thị 6 cánh dập nổi trên chụp hút khói bếp nấu phở | `G-EXT` | Ø `0.2m` | 12 | 576 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I04, HV-H07, HV-G03, HV-C14` | — | — | — | **576** | — |

**LOD/ghi chú QC:** L0 giữ 12 ô hoa thị chụp khói `HV-C14`; L1 chuyển sang `T-NRM`. QC xác nhận bảng chữ thực đơn Nam Bộ rõ nét, đúng chính tả tiếng Việt có dấu.

#### `MN-025` — Khu Sạp Cà Phê — Hạt Điều — Đồ Thủ Công Mỹ Nghệ (ảnh ref: `93`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Dãy tranh sơn mài & hộp khảm xà cừ trưng bày | `HV-J05` | 8 bức tranh sơn mài phong cảnh Nam Bộ (cầu khỉ, áo dài, hoa sen) nền đen – vàng vỏ trứng bóng sâu | `T-ATLAS` | `0.6×0.4m` | 8 | 0 | `goldParts` |
| Hộp trà & khay gỗ khảm xà cừ mỹ nghệ | `HV-J07` | 6 khay gỗ mun khảm xà cừ óng ánh họa tiết mai – cúc – chim én đặt trên kệ gỗ | `T-ATLAS` | `0.4×0.3m` | 6 | 0 | `woodParts` |
| Giỏ mây tre đan & đèn lồng nan tre treo quầy | `HV-NEW-MN-11` | 10 cụm giỏ mây buộc viền nút lạt & đèn tre mắt cáo treo dọc viền gian hàng | `G-INST` + `T-NRM` | `0.45×0.45m` | 10 | 800 | `woodParts` |
| Biển hiệu quầy cà phê đặc sản Việt Nam | `HV-I04` | 4 bảng chữ `"CÀ PHÊ CHỒN — HẠT ĐIỀU BÌNH PHƯỚC — THỦ CÔNG MỸ NGHỆ"` | `T-ATLAS` | `1.8×0.38m` | 4 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-J05, HV-J07, HV-NEW-MN-11, HV-I04` | — | — | — | **800** | — |

**LOD/ghi chú QC:** L0 giữ 10 cụm giỏ mây `HV-NEW-MN-11`; L1 hạ còn khối trụ/cầu đơn giản + `T-NRM`, giữ bóng xà cừ `HV-J07` roughness `0.15`.

#### `MN-026` — Hàng Cột Gang Đúc & Đèn Công Nghiệp Lòng Chợ (ảnh ref: `93`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 24 cột gang đúc sơn xanh chống hệ mái chợ | `HV-NEW-MN-10` | 24 thân cột gang tròn đúc có 12 rãnh khía dọc (*fluted*), vòng cổ cột và đầu cột tán lá acanthus cách điệu Pháp 1914 | `G-INST` + `G-LATHE` | Cao `6.2m`, Ø `0.32m` | 24 | 7 680 | `ironParts` |
| Chân đế bát giác cột gang có hoa thị đúc nổi | `HV-C14` | 48 bông hoa thị 8 cánh đúc nổi `1.5cm` trên 4 mặt chính của bệ chân cột gang | `G-EXT` | Ø `0.16m` | 48 | 2 304 | `ironParts` |
| Băng phào vòng cổ cột nối kèo thép | `HV-H04` | 24 vòng phào gang đúc 2 tầng lồi `4cm` chuyển tiếp từ thân cột sang giàn kèo | `G-EXT` | Chu vi `1.2m`/cột | 24 | 960 | `ironParts` |
| Đèn chao sắt tráng men xanh kiểu công nghiệp 1914 | `HV-H10` | 12 chụp đèn chao tròn viền rãnh gợn kết hợp lồng sắt bảo vệ treo theo 2 trục đại lộ | `G-INST` | Ø `0.48m` | 12 | 7 200 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-10, HV-C14, HV-H04, HV-H10` | — | — | — | **18 144** | — |

**LOD/ghi chú QC:** L0 giữ 24 cột gang `HV-NEW-MN-10` và 12 đèn chao `HV-H10`; L1 tắt hoa thị chân cột `HV-C14` sang `T-NRM` và giảm phân đoạn chao đèn 50%. QC kiểm tra toàn bộ 24 cột gang dùng chung 1 `InstancedMesh` để đạt 1 draw call.

#### `MN-027` — Vỉa Hè & Phố Chợ Đêm Bến Thành (Cửa Đông — Tây) (ảnh ref: `29`, `93`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cổng chào & biển hiệu đèn neon Chợ Đêm | `HV-I04` | 2 cổng chào chữ phát sáng `"CHỢ ĐÊM BẾN THÀNH"` (đường Phan Bội Châu & Phan Chu Trinh) cùng 12 biển hiệu quầy đêm | `T-ATLAS` | `5.0×0.9m` | 14 | 0 | `goldParts` |
| Khung sắt lều bạt trắng & hoa văn viền diềm | `HV-H09` | 24 khung trụ sắt có vòng khuyên móc bạt và thanh chéo trang trí dọc 2 tuyến phố | `G-INST` | Cao `2.6m` | 24 | 1 440 | `ironParts` |
| Dây đèn lồng lụa & bóng dây trang trí chợ đêm | `HV-C14` | 16 họa tiết hoa 6 cánh in/dập nổi nhẹ trên chụp đèn lồng đỏ–vàng treo ngang phố | `G-EXT` | Ø `0.35m` | 16 | 768 | `crimsonParts` |
| Lát vỉa hè gạch terrazzo hoa văn cánh quạt | `HV-H07` | Hoa văn gạch vỉa hè lục giác / cánh quạt xám – đỏ đô đặc trưng trung tâm Quận 1 | `T-ATLAS` | Viên `0.3×0.3m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I04, HV-H09, HV-C14, HV-H07` | — | — | — | **2 208** | — |

**LOD/ghi chú QC:** L0 giữ 24 trụ sắt `HV-H09` và 16 đèn lồng `HV-C14`; L1 gộp khung lều đơn giản, giữ ánh sáng phát quang biển đêm `HV-I04`.

#### `MN-028` — Vòng Xoay Quách Thị Trang & Nhà Ga Metro Bến Thành (ảnh ref: `29`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Giếng trời hoa sen kính – thép Ga Metro Bến Thành | `HV-C04` | Biểu tượng giếng trời hình bông sen nở cách điệu 16 cánh thép trắng – kính xanh vươn cao tại quảng trường trước Cửa Nam, nổi khối sâu `1.2m` | `G-INST` + `G-LATHE` | Ø `12.0m`, cao `6.0m` | 1 | 1 200 | `whiteParts` |
| Biển chỉ dẫn tuyến Metro số 1 & tên quảng trường | `HV-I04` | Biển hiệu hiện đại `"GA BẾN THÀNH — METRO LINE 1"` màu xanh dương – trắng có biểu tượng tàu điện | `T-ATLAS` | `3.2×0.65m` | 4 | 0 | `whiteParts` |
| Lan can kính & trụ thép lối xuống ga ngầm | `HV-H09` | 32 trụ inox mảnh kẹp lan can kính cường lực bảo vệ cầu thang cuốn xuống tầng B1 | `G-INST` | Cao `1.1m` | 32 | 1 920 | `ironParts` |
| Hoa văn lát đá granit đồng tâm quảng trường | `HV-D06` | Các cung đường lát đá granit sáng – tối uốn lượn như sóng nước sông Sài Gòn dẫn hướng tới Cửa Nam | `T-ATLAS` + `T-NRM` | Bán kính `28m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C04, HV-I04, HV-H09, HV-D06` | — | — | — | **3 120** | — |

**LOD/ghi chú QC:** L0 giữ giếng trời sen `HV-C04` và 32 trụ lan can `HV-H09`; L1 giản lược cánh sen còn mặt kính phẳng có gân chính. QC kiểm tra tầm nhìn từ quảng trường vào Tháp Đồng Hồ Cửa Nam (`MN-017`) không bị che khuất.

---

## 3.3. Nhà Thờ Đức Bà Sài Gòn (`MN-029` → `MN-042`)

> **Bối cảnh mỹ thuật**: Khởi công 1877, hoàn thành 1880 (KTS Jules Bourard), 2 chóp nhọn thép cao `57.6m` bổ sung năm 1895 (KTS Gardes). Phong cách **Tân Romanesque kết hợp Gothic (Roman-Gothic)** với gạch trần Marseille đỏ hồng không tô trát, đá xanh Biên Hòa, kính màu Chartres (Pháp) và gạch bông lập phương 3D. Tuyệt đối **không** đưa hoa văn Á Đông (sen, rồng, hồi văn) vào kiến trúc giáo đường này.

#### `MN-029` — 2 Tháp Chuông Đôi cao `57.6m` & 2 Chóp Nhọn Thép (ảnh ref: `61`, `30`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 đỉnh chóp thép nhọn gắn Thánh giá đồng `3.5m` | `HV-NEW-MN-02` | 2 cây Thánh giá đồng đầu chẻ 3 lá (*fleury*) cao `3.5m`, dày `8cm`, kèm 16 hàng hoa móc (*crocket*) và diềm sắt rèn dọc 8 sống chóp xanh patina | `G-EXT` + `G-TUBE` | Cao `3.5m` (thánh giá) + chóp `21m` | 18 | 7 560 | `bronzeParts` |
| Cửa sổ chuông vòm nhọn lancet 4 mặt × 2 tháp | `HV-H02` | 16 ô cửa lancet cao hẹp chia 2 ô nhỏ có vòng tròn hoa 4 thùy (*quatrefoil*) trên đỉnh, lưới đá sâu `15cm` | `G-EXT` | `1.4×5.2m` | 16 | 4 160 | `stoneParts` |
| Hệ vòm gạch xếp nan quạt & tường gạch Marseille | `HV-NEW-MN-04` | Bề mặt gạch trần Marseille đỏ hồng không trát vữa (shader/normal toàn tháp) kết hợp 16 vòm *voussoir* gạch nổi sâu `6cm` trên các khung cửa tháp | `T-NRM` + `G-EXT` | Vòm `1.6m` | 16 | 2 560 | `brickParts` |
| Gờ phào phân 4 tầng tháp & hàng con sơn đá trắng | `HV-H04` | 4 tầng phào đá Biên Hòa trắng chạy quanh 2 tháp (tổng `144m`), bên dưới gắn hàng con sơn vòm nhỏ kiểu Lombard band nhô `14cm` | `G-EXT` | Chu vi `18m`/tầng | 72 | 2 880 | `stoneParts` |
| Góc tường gạch giật bậc đá sáng (*quoin*) | `HV-H11` | 64 khối đá trắng xếp so le tại 8 cạnh góc 2 tháp chuông từ chân lên tầng chuông, nổi `3cm` | `G-INST` + `T-NRM` | Khối `0.55×0.35m` | 64 | 1 536 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-02, HV-H02, HV-NEW-MN-04, HV-H04, HV-H11` | — | — | — | **18 696** | — |

**LOD/ghi chú QC:** L0 giữ 2 Thánh giá `HV-NEW-MN-02`, 16 cửa lancet `HV-H02` và vòm *voussoir* `HV-NEW-MN-04`; L1 chuyển quoin `HV-H11` và vòm gạch sang `T-NRM`, giữ silhouette chóp nhọn + Thánh giá ở cả L2. QC kiểm tra chiều cao chuẩn `57.6m` và sắc gạch Marseille đỏ hồng không sơn phủ ảnh `61`.

#### `MN-030` — Đồng Hồ Cơ Thụy Sĩ trên Mặt Tiền Giữa (ảnh ref: `30`, `61`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt đồng hồ cơ Thụy Sĩ (chế tạo 1887) | `HV-H08` | Mặt tròn Ø `2.2m` chính tâm mặt tiền giữa 2 tháp, 12 chữ số La Mã đen nổi `2cm` trên nền trắng, kim sắt đen chạm hoa văn Gothic | `G-EXT` + `T-ATLAS` | Ø `2.2m` | 1 | 280 | `whiteParts` |
| Cửa sổ hoa hồng (*Rose Window*) ngay trên/dưới trục đồng hồ | `HV-H01` | Cửa tròn chia 12 cánh nan đá vòm nhọn tỏa tâm, lưới chì kính màu phát sáng từ bên trong, sâu `22cm` | `G-EXT` + `S-SHD` | Ø `3.4m` | 1 | 900 | `stoneParts` |
| Vòm cung đá chạm lá nho & viền răng cưa bao mặt đồng hồ | `HV-H03` | 3 lớp vòm bán nguyệt đá trắng giật cấp ôm quanh đồng hồ, 2 cột nhỏ hai bên đầu cột chạm lá acanthus | `G-TUBE` | Ø `3.0m` | 3 | 900 | `stoneParts` |
| Trán tam giác (*gable*) đỉnh mái giữa & phào đá | `HV-H04` | Đường phào tam giác 2 sườn dốc gắn hàng răng cưa đá (*dentil*) dẫn lên cây thánh giá đỉnh hồi giữa | `G-EXT` | Dài `22m` | 22 | 880 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H08, HV-H01, HV-H03, HV-H04` | — | — | — | **2 960** | — |

**LOD/ghi chú QC:** L0 giữ mặt đồng hồ `HV-H08`, hoa hồng `HV-H01` và vòm 3 lớp `HV-H03`; L1 bake số La Mã và răng cưa phào sang `T-ATLAS`/`T-NRM`. QC đối chiếu trục thẳng đứng Cổng Chính → Cửa Hoa Hồng → Đồng Hồ → Trán Hồi theo ảnh `30`.

#### `MN-031` — Tượng Đức Mẹ Hòa Bình bằng đá cẩm thạch Ý (`4.6m`) (ảnh ref: `30`, `61`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tượng Đức Mẹ Hòa Bình trên quả địa cầu (G. Ciocchetti, 1959) | `HV-NEW-MN-03` | Tượng đá cẩm thạch Carrara trắng cao `4.6m`, nếp áo choàng rủ sâu `4–8cm`, tay nâng quả địa cầu có cây thánh giá nhỏ gắn trên đỉnh, chân đạp đầu rắn cách điệu | `G-DISP` + `G-EXT` | Cao `4.6m`, nặng 8.5 tấn | 4 | 1 520 | `marbleParts` |
| Bia khắc chữ Latinh 4 mặt bệ đài đá | `HV-I04` | Tấm biển đá khảm chữ đồng Latinh nguyên bản `"REGINA PACIS ORA PRO NOBIS — XVII.II.MCMLIX"` (*Nữ Vương Hòa Bình, cầu cho chúng con — 17/2/1959*) | `T-ATLAS` | `1.2×0.5m` | 4 | 0 | `marbleParts` |
| Đế bệ 3 tầng phào cổ điển & bậc tam cấp bát giác | `HV-H04` | Hệ phào đá trắng giật cấp 3 tầng ôm quanh đài tượng cao `3.2m`, cạnh vát sắc `6cm` | `G-EXT` | Chu vi `14m` | 28 | 1 120 | `marbleParts` |
| Hàng rào hoa sắt rèn thấp bao quanh vườn hoa tượng | `HV-H09` | 36 đoạn song sắt rèn đầu mũi giáo xen vòng khuyên cổ điển sơn đen bảo vệ thảm hoa | `G-INST` | Cao `0.75m` | 36 | 2 160 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-03, HV-I04, HV-H04, HV-H09` | — | — | — | **4 800** | — |

**LOD/ghi chú QC:** L0 giữ độ chi tiết nếp áo tượng `HV-NEW-MN-03` và hàng rào sắt `HV-H09`; L1 giảm phân đoạn tượng 45% và chuyển hàng rào sang alpha card. QC kiểm tra đúng chính tả chữ Latinh `"REGINA PACIS ORA PRO NOBIS"` và hướng tượng nhìn về đường Đồng Khởi ảnh `30`.

#### `MN-032` — Cổng Chính Romanesque 3 Vòm & Cửa Gỗ Sồi Chạm (ảnh ref: `30`, `61`, `120`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 bộ vòm cuốn Romanesque lùi bậc 4 lớp (cổng giữa + 2 cổng bên) | `HV-H03` | Mỗi cổng gồm 4 vòng cung bán nguyệt gạch-đá lùi sâu dần `0.85m`, tì lên 6 cột trụ tròn nhỏ mỗi bên có đầu cột chạm lá | `G-TUBE` | Ø `4.2m` (giữa), `2.6m` (bên) | 12 | 3 600 | `stoneParts` |
| Gạch vòm *voussoir* đỏ – trắng xen kẽ trên trán 3 cổng | `HV-NEW-MN-04` | Hàng gạch Marseille xếp tỏa nan quạt bao vòng ngoài 3 cổng chính, mạch vữa lõm rõ `0.5cm` | `T-NRM` + `G-EXT` | Dài cung `16m` | 16 | 2 560 | `brickParts` |
| 6 cánh cửa gỗ sồi nặng chạm ô pano & bản lề sắt rèn | `HV-D07` | 36 ô pano hình chữ nhật – vòm cung chạm sâu `3cm` trên 6 cánh cửa gỗ sồi nâu đậm, kèm đai sắt rèn đầu hoa bách hợp (*fleur-de-lis*) | `G-EXT` | Ô `0.55×0.75m` | 36 | 1 440 | `woodParts` |
| Đinh tán đồng & tay nắm vòng đồng cổ cánh cửa | `HV-D14` | 48 đinh tán đồng bán cầu lớn chạy dọc nẹp giữa cánh cửa sồi, nổi `2cm` | `G-INST` | Ø `6cm` | 48 | 1 152 | `bronzeParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H03, HV-NEW-MN-04, HV-D07, HV-D14` | — | — | — | **8 752** | — |

**LOD/ghi chú QC:** L0 giữ 3 bộ vòm 4 lớp `HV-H03`, gạch vòm `HV-NEW-MN-04` và pano gỗ `HV-D07`; L1 ẩn đinh tán `HV-D14` sang `T-NRM`. QC kiểm tra cửa chính mở hé/mở rộng tạo góc nhìn xuyên thẳng vào lòng giáo đường ảnh `120`.

#### `MN-033` — Lòng Giáo Đường 10 Nhịp Vòm (`50.0m`) (ảnh ref: `120`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 10 nhịp vòm trần cuốn chéo (*groin/rib vault*) & sống gân đá | `HV-H03` | 20 vòm ngang & chéo bằng vữa kem – gạch nâu đan nhau trên cao độ `21m`, gân vòm lồi `18cm`, chốt đá khóa vòm tròn giao điểm | `G-TUBE` | Nhịp `12m × 5m` | 20 | 6 000 | `plasterParts` |
| 2 hàng cột bó 20 trụ đá trắng ốp gạch nâu | `HV-H04` | 20 đầu cột (*capital*) chạm lá acanthus Romanesque cách điệu + 20 chân cột 3 bậc vát sâu `8cm` nâng đỡ các sống vòm | `G-EXT` | Chu vi `3.4m`/cột | 40 | 1 600 | `stoneParts` |
| 20 ô cửa sổ áp mái (*clerestory*) vòm nhọn lancet | `HV-H02` | Cửa lancet đôi có vòng tròn hoa 4 thùy đỉnh vòm mở dọc 2 vách cao lòng giáo đường | `G-EXT` | `1.3×3.2m` | 20 | 5 200 | `stoneParts` |
| Mảng vách gạch trần nội thất & vòm gạch *voussoir* | `HV-NEW-MN-04` | Vách gạch nâu đỏ lộ mạch vữa sáng chạy xen kẽ giữa các trụ cột đá trắng suốt chiều dài `50m` | `T-NRM` + `S-SHD` | Dài `50m`, cao `21m` | 1 | 0 | `brickParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H03, HV-H04, HV-H02, HV-NEW-MN-04` | — | — | — | **12 800** | — |

**LOD/ghi chú QC:** L0 giữ toàn bộ 20 vòm cuốn `HV-H03` và 20 cửa clerestory `HV-H02`; L1 hạ số phân đoạn gân vòm 40% và chuyển đầu cột `HV-H04` sang `T-NRM`. QC chụp góc hút sâu 1 điểm tụ từ cửa chính nhìn về Cung Thánh khớp ảnh `120`.

#### `MN-034` — Tầng Hành Lang Vòm *Triforium* 2 Bên (ảnh ref: `120`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 20 nhịp vòm cuốn đôi tầng *Triforium* (10 nhịp × 2 bên) | `HV-H03` | Mỗi nhịp chia 2 vòm bán nguyệt nhỏ lồng trong 1 vòm cái lớn, gờ đá trắng viền nổi `10cm` | `G-TUBE` | Rộng `4.5m`, cao `3.6m` | 20 | 6 000 | `stoneParts` |
| 40 cột trụ mảnh chia nhịp vòm đôi & lan can con tiện đá | `HV-D10` | 60 con tiện đá trắng hình bầu Romanesque xếp đều dưới 20 ô vòm tầng 2, tạo bóng đổ chiều sâu `12cm` | `G-LATHE` + `G-INST` | Cao `0.78m` | 60 | 3 360 | `stoneParts` |
| Phào ngang phân tầng ngăn cách tầng trệt & *Triforium* | `HV-H04` | 2 băng phào đá trắng chạy dọc `50m × 2` bên lòng giáo đường, nhô `14cm` | `G-EXT` | Dài `100m` | 50 | 2 000 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H03, HV-D10, HV-H04` | — | — | — | **11 360** | — |

**LOD/ghi chú QC:** L0 giữ 20 nhịp vòm đôi `HV-H03` và 60 con tiện `HV-D10`; L1 gộp con tiện thành dải lưới alpha + `T-NRM`. QC đối chiếu tỷ lệ cao tầng trệt : *Triforium* : *Clerestory* chuẩn 2 : 1 : 1.2 theo ảnh `120`.

#### `MN-035` — Thảm Gạch Hoa Hình Khối 3D Lối Đi Giữa (ảnh ref: `120`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Sàn lối đi chính dài `50m` lát gạch bông lập phương 3D | `HV-H06` | Gạch xi măng hoa nhập Pháp ghép 3 hình thoi trắng kem – xám đá – nâu đỏ đậm tạo ảo giác khối lập phương nổi 3D (*tumbling block*) chạy suốt trục giữa | `T-ATLAS` + `S-SHD` | Viên `0.2×0.2m` | 1 | 0 | `marbleParts` |
| Dải viền gạch bông hoa văn Nam Bộ – Pháp kẹp 2 mép thảm | `HV-H07` | Băng viền hoa 4 cánh & đường diềm hình học đen – kem rộng `0.4m` chạy 2 bên thảm lập phương | `T-ATLAS` | Viên `0.2×0.2m` | 1 | 0 | `marbleParts` |
| 6 nắp bia đá cẩm thạch tưởng niệm lát chìm dọc sàn | `HV-I04` | Bia đá trắng khắc chữ Latinh tưởng niệm các Giám mục Sài Gòn thế kỷ XIX chìm ngang mặt gạch | `T-ATLAS` | `1.0×1.8m` | 6 | 0 | `marbleParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H06, HV-H07, HV-I04` | — | — | — | **0** | — |

**LOD/ghi chú QC:** Toàn bộ hoa văn sàn sử dụng `T-ATLAS` + `S-SHD` (`0` tri phát sinh), sử dụng anisotropy ≥ 8 để không bị nhòe góc nhìn thấp dọc lối đi `50m`. QC bắt buộc xác nhận hiệu ứng lập phương 3D sắc nét khớp ảnh `120`.

#### `MN-036` — Cung Thánh & Bàn Thờ Đá Cẩm Thạch Nguyên Khối (ảnh ref: `120`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt trước bàn thờ đá cẩm thạch nguyên khối | `HV-NEW-MN-03` | 6 phù điêu thiên thần chạm nổi sâu `5cm` nâng đỡ mặt bàn thờ đá cẩm thạch trắng, chính giữa là vòng nguyệt quế khắc chữ `IHS` | `G-DISP` + `G-EXT` | `3.4×1.1m` | 6 | 2 280 | `marbleParts` |
| Thánh giá lớn & Nhà Tạm (*Tabernacle*) mạ vàng | `HV-NEW-MN-02` | Thánh giá đồng mạ vàng cao `2.4m` đầu chẻ 3 lá cùng Nhà Tạm 2 cánh chạm chén thánh & bông lúa nổi `2cm` | `G-EXT` + `G-TUBE` | Cao `2.4m` | 2 | 840 | `goldParts` |
| 6 chân nến đồng cổ điển trên bàn thờ | `HV-D10` | 6 chân nến đồng vàng tiện 3 bầu tròn trên chân kiềng 3 càng cổ điển Pháp, cao `0.85m` | `G-LATHE` + `G-INST` | Cao `0.85m` | 6 | 336 | `goldParts` |
| Vòm bán cầu hậu cung (*Apse*) & phào đá viền cung thánh | `HV-H03` | 5 vòm cuốn hẹp ôm vòng cung thánh hình bán nguyệt với gân đá trắng hội tụ tâm đỉnh | `G-TUBE` | Bán kính `6.5m` | 5 | 1 500 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-03, HV-NEW-MN-02, HV-D10, HV-H03` | — | — | — | **4 956** | — |

**LOD/ghi chú QC:** L0 giữ 6 thiên thần bàn thờ `HV-NEW-MN-03`, Thánh giá `HV-NEW-MN-02` và 6 chân nến `HV-D10`; L1 chuyển phù điêu bàn thờ sang `T-NRM`. QC kiểm tra ánh sáng vàng ấm nhấn trọng tâm vào Cung Thánh ảnh `120`.

#### `MN-037` — 16 Dãy Ghế Gỗ Sồi & Bục Giảng Chạm Khắc (ảnh ref: `120`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 32 đầu hồi 16 dãy ghế gỗ sồi (2 bên lối đi) | `HV-H02` | Đầu hồi gỗ sồi chạm lõm vòm nhọn lancet Gothic sâu `2cm`, viền chỉ bo cong tay vịn | `G-EXT` | `0.5×0.95m` | 32 | 8 320 | `woodParts` |
| Bục giảng gỗ sồi có mái che (*Ambo / Pulpit*) | `HV-D07` | 8 ô pano gỗ chạm viền triện vòm Gothic quanh lồng bục giảng lục giác, sâu `2.5cm` | `G-EXT` | Ô `0.45×0.85m` | 8 | 320 | `woodParts` |
| Đỉnh mái che bục giảng gắn Thánh giá nhỏ | `HV-NEW-MN-02` | Cây thánh giá gỗ chạm viền vàng cao `0.65m` cùng 6 chóp hoa nhỏ trên mái bát giác | `G-EXT` + `G-TUBE` | Cao `0.65m` | 1 | 420 | `goldParts` |
| Thanh lan can cầu thang lên bục giảng | `HV-D10` | 16 con tiện gỗ sồi tiện 2 bầu đặt dọc cầu thang xoắn bước lên bục giảng | `G-LATHE` + `G-INST` | Cao `0.65m` | 16 | 896 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H02, HV-D07, HV-NEW-MN-02, HV-D10` | — | — | — | **9 956** | — |

**LOD/ghi chú QC:** L0 giữ 32 đầu ghế `HV-H02` (instanced 1 mesh) và bục giảng; L1 chuyển chạm lõm đầu ghế sang `T-NRM`, giảm chi tiết con tiện `HV-D10`. QC đảm bảo 16 dãy ghế xếp ngay ngắn 2 bên thảm 3D `MN-035` không che mất lối đi giữa.

#### `MN-038` — Gác Đàn Đại Phong Cầm (*Pipe Organ*) Hành Lang Nam (ảnh ref: `120`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tủ đàn gỗ sồi chạm 3 vòm Gothic bọc 11 ống sáo đồng | `HV-H02` | 3 khung vòm nhọn lancet chạm lộng lưới hoa văn (*tracery*) ôm nhóm 11 ống sáo đồng đứng cao `2.2–4.2m`, sâu `8cm` | `G-EXT` | `3.8×4.5m` | 3 | 780 | `woodParts` |
| Lan can gỗ gác đàn cao `9.2m` | `HV-D10` | 28 con tiện gỗ sồi xếp dưới dãy vòm nhỏ dọc mặt trước ban công gác đàn | `G-LATHE` + `G-INST` | Cao `0.85m` | 28 | 1 568 | `woodParts` |
| 6 con sơn gỗ chạm cuộn nâng đỡ sàn gác đàn | `HV-H04` | 6 thanh con sơn chạm xoắn ốc Romanesque sâu `6cm` đỡ dầm gác đàn phía trên cửa chính | `G-EXT` | `0.3×1.1m` | 12 | 480 | `woodParts` |
| Đỉnh tủ đàn chạm hoa hồng gỗ & thánh giá nhỏ | `HV-NEW-MN-02` | Đỉnh chóp gỗ gắn thánh giá 3 lá và hoa móc nhọn vươn hướng vòm trần | `G-EXT` + `G-TUBE` | Cao `0.9m` | 1 | 420 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H02, HV-D10, HV-H04, HV-NEW-MN-02` | — | — | — | **3 248** | — |

**LOD/ghi chú QC:** L0 giữ 3 vòm tủ đàn `HV-H02` và 28 con tiện `HV-D10`; L1 giản lược tracery tủ đàn sang alpha cutout + `T-NRM`. QC xác nhận gác đàn đặt ở cao độ `9.2m` đúng hành lang Nam nhìn về Cung Thánh.

#### `MN-039` — 14 Chặng Đàng Thánh Giá & 4 Đèn Chầu Cung Thánh (ảnh ref: `120`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 14 khung phù điêu Chặng Đàng Thánh Giá (*Via Dolorosa*) | `HV-NEW-MN-03` | 14 tấm phù điêu đồng đúc chạm nổi sâu `3.5cm` miêu tả 14 chặng khổ nạn, khung vòm nhọn gắn số La Mã `I–XIV` treo đều trên 2 vách biên | `G-DISP` + `G-EXT` | `0.65×0.95m` | 14 | 5 320 | `bronzeParts` |
| 14 thánh giá nhỏ trên đỉnh mỗi khung chặng | `HV-NEW-MN-02` | 14 cây thánh giá đồng cao `18cm` gắn đỉnh vòm từng tấm phù điêu | `G-EXT` + `G-TUBE` | Cao `0.18m` | 14 | 5 880 | `goldParts` |
| 4 đèn chầu đồng vàng treo trục giữa giáo đường | `HV-H10` | 4 đèn chùm đồng kiểu Gothic hình vương miện 8 cạnh có xích treo dài `6m` và 8 chao đèn nến trắng | `G-INST` | Ø `1.3m`, cao `1.2m` | 4 | 2 400 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-03, HV-NEW-MN-02, HV-H10` | — | — | — | **13 600** | — |

**LOD/ghi chú QC:** L0 giữ 14 khung phù điêu `HV-NEW-MN-03` và 4 đèn chùm `HV-H10`; L1 bake mặt phù điêu 14 chặng sang `T-NRM` và thay 14 thánh giá nhỏ bằng card/đơn khối (tiết kiệm > 5k tri). QC kiểm tra thứ tự `I–VII` vách Tây và `VIII–XIV` vách Đông.

#### `MN-040` — 56 Ô Cửa Kính Màu Chartres (*Stained Glass*) (ảnh ref: `120`, `61`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 cửa sổ hoa hồng (*Rose Windows*) 4 đầu hồi | `HV-H01` | 4 vòng tròn đá chia 12–16 cánh hoa, lưới chì ghép kính màu Chartres (hãng Lorin) phát sáng đỏ ruby – xanh cobalt – vàng hổ phách | `G-EXT` + `S-SHD` | Ø `3.4–4.8m` | 4 | 3 600 | `stoneParts` |
| 52 ô cửa lancet kính màu dọc 2 cánh và hậu cung | `HV-H02` | 52 khung vòm nhọn hẹp chia nan đá + lưới chì ghép hình 40 vị Thánh & các hoa văn hoa bách hợp, sâu `14cm` | `G-EXT` | `1.1×4.4m` | 52 | 13 520 | `stoneParts` |
| Viền gạch *voussoir* bao ngoài 56 khung cửa | `HV-NEW-MN-04` | Gạch đỏ Marseille xếp tỏa đều quanh đỉnh vòm ngoài của toàn bộ hệ cửa kính màu | `T-NRM` + `S-SHD` | Chu vi `10m`/cửa | 1 | 0 | `brickParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H01, HV-H02, HV-NEW-MN-04` | — | — | — | **17 120** | — |

**LOD/ghi chú QC:** L0 giữ 4 cửa hoa hồng `HV-H01` và 52 khung `HV-H02` (instanced); L1 giảm lưới đá `HV-H02` thành viền ngoài + shader kính màu phát sáng `S-SHD` (giảm 65% tri). QC xác nhận ánh sáng màu hắt xuống mặt sàn và tường nội thất không bị cháy trắng.

#### `MN-041` — 2 Bàn Thờ Phụ & Giá Nến Cầu Nguyện (ảnh ref: `120`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 bàn thờ phụ kính Thánh Giuse & Đức Mẹ (2 cánh ngang) | `HV-NEW-MN-03` | 2 tượng đá trắng cao `1.8m` đặt trong hốc vòm tường, thân bệ chạm 3 ô thánh tích sâu `3.5cm` | `G-DISP` + `G-EXT` | `2.0×2.6m` | 4 | 1 520 | `marbleParts` |
| 2 vòm hốc tường bao tượng thánh | `HV-H03` | 2 vòm bán nguyệt đá trắng 2 lớp giật cấp ôm lấy 2 bàn thờ cánh ngang | `G-TUBE` | Ø `2.4m` | 4 | 1 200 | `stoneParts` |
| 2 giá nến sắt rèn 3 tầng cầu nguyện | `HV-H09` | Khung sắt rèn sơn đen uốn cuộn chữ C giữ 36 cốc nến thủy tinh lung linh | `G-INST` | `1.4×1.1m` | 16 | 960 | `ironParts` |
| 2 cây thánh giá nhỏ trên bàn thờ phụ | `HV-NEW-MN-02` | Thánh giá đồng mạ vàng cao `0.9m` đặt chính giữa 2 bàn thờ phụ | `G-EXT` + `G-TUBE` | Cao `0.9m` | 2 | 840 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-03, HV-H03, HV-H09, HV-NEW-MN-02` | — | — | — | **4 520** | — |

**LOD/ghi chú QC:** L0 giữ 2 bàn thờ `HV-NEW-MN-03` và khung sắt giá nến `HV-H09`; L1 gộp giá nến thành khung tối giản giữ điểm sáng emissive của ngọn nến.

#### `MN-042` — Đàn Bồ Câu Công Xã Paris & Hàng Cây Dầu Cổ Thụ (ảnh ref: `30`, `61`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Lối dạo quảng trường Công Xã Paris lát gạch hoa cổ điển | `HV-H07` | Gạch vỉa hè hoa văn cánh quạt & hình học xám – đỏ nung bao quanh bồn hoa tượng Đức Mẹ | `T-ATLAS` | Viên `0.25×0.25m` | 1 | 0 | `stoneParts` |
| Bồn cây dầu cổ thụ & ghế đá công viên viền phào Pháp | `HV-H04` | 8 bó bồn cây xây gạch đỏ có mũ đá trắng vát 2 tầng nhô `6cm` và 6 ghế băng sắt – gỗ cổ điển | `G-EXT` | Chu vi `6m`/bồn | 24 | 960 | `stoneParts` |
| 6 trụ đèn công viên kiểu Paris thế kỷ XIX | `HV-H09` | Cột đèn gang đúc sơn xanh đậm có tay đèn uốn xoắn ốc và chao thủy tinh lục giác | `G-INST` | Cao `3.8m` | 12 | 720 | `ironParts` |
| Biển tên quảng trường `"CÔNG XÃ PARIS"` & chỉ dẫn di tích | `HV-I04` | Bảng tên phố nền xanh viền trắng kiểu Sài Gòn cổ và bảng giới thiệu Nhà Thờ Đức Bà | `T-ATLAS` | `0.8×0.5m` | 2 | 0 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H07, HV-H04, HV-H09, HV-I04` | — | — | — | **1 680** | — |

**LOD/ghi chú QC:** L0 giữ 6 cột đèn gang `HV-H09` và bó bồn `HV-H04`; L1 chuyển bó bồn sang khối hộp vát đơn. QC kiểm tra quảng trường mở thoáng tôn trọn mặt tiền Nhà Thờ Đức Bà ảnh `30`.

---

## 3.4. Địa Đạo Củ Chi & Đền Bến Dược (`MN-043` → `MN-052`)

> **Bối cảnh mỹ thuật**: Gồm hai sắc thái rõ rệt: (1) **Đền Bến Dược** (1993–1995) theo kiến trúc đình miếu truyền thống Nam Bộ kết hợp đài tưởng niệm 9 tầng uy nghi (hoa sen, mây cuốn, rồng Nam Bộ, ngói ống mũi hài, câu đối Quốc ngữ/Hán-Nôm tưởng niệm); (2) **Khu Địa Đạo Củ Chi** (1948–1975) mang tính dân dã chiến khu đất thép (phên tre đan lóng mốt, gỗ rừng, kỹ hiệu quân sự, biển trưng bày lịch sử) — tuyệt đối không đưa hoa văn cung đình hoa mỹ vào hầm địa đạo.

#### `MN-043` — Tháp Tưởng Niệm 9 Tầng Đền Bến Dược (`39m`) (ảnh ref: `97`, `31`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 9 tầng mái cong bát giác & đầu đao góc mái | `HV-A06` | 36 đầu đao rồng hóa mây lửa vút cong 4 góc chính của 9 tầng mái (mỗi tầng 4 góc tiêu biểu), đắp nổi sâu `6cm` | `G-TUBE` + `G-EXT` | `0.8–1.4m` | 36 | 23 400 | `roofParts` |
| Viền ngói ống trích thủy 9 tầng mái tháp | `HV-D15` | 72 cụm đầu ngói câu đầu chạm hoa cúc & giọt trích thủy dọc 4 mái tầng 1–3 cận cảnh | `G-INST` | Ống `0.12×0.4m` | 72 | 2 880 | `roofParts` |
| 4 hướng lan can bậc tam cấp đá granit chạm mây | `HV-D05` | 16 cụm mây xoắn 3 vòng (vân cuốn) chạm nổi sâu `4cm` dọc 8 tay vịn tam cấp đá granit 4 hướng Đông–Tây–Nam–Bắc | `G-TUBE` / `G-EXT` | `0.7×0.4m` | 16 | 1 920 | `stoneParts` |
| Đỉnh tháp búp sen đồng & bệ sen tầng chân tháp | `HV-C03` | Búp sen đồng 3 lớp cánh khép cao `2.2m` trên chóp tầng 9 cùng 4 búp sen nhỏ 4 góc bệ đá | `G-LATHE` | Cao `2.2m` / `0.6m` | 5 | 900 | `goldParts` |
| Mặt bệ tháp khắc phù điêu hoa sen & dòng chữ tưởng niệm | `HV-C01` | 32 cánh sen đá granit xếp 2 tầng so le quanh cổ bệ bát giác tầng 1, gân giữa nổi `3cm` | `G-INST` | Cánh `0.35×0.25m` | 32 | 1 536 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A06, HV-D15, HV-D05, HV-C03, HV-C01` | — | — | — | **30 636** | — |

**LOD/ghi chú QC:** L0 giữ 36 đầu đao `HV-A06`, mây tam cấp `HV-D05` và 32 cánh sen `HV-C01`; L1 giảm phân đoạn đầu đao tầng 4–9 xuống 35% và chuyển ngói trích thủy `HV-D15` sang `T-NRM` (tiết kiệm ~14k tri). QC đối chiếu tỷ lệ thu gọn 9 tầng mái cao `39m` với ảnh `97`.

#### `MN-044` — Đền Chính Bến Dược & Cổng Tam Quan (ảnh ref: `97`, `31`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc Chính Điện & Tam Quan (Lưỡng long chầu nguyệt Nam Bộ) | `HV-A04` | 2 cặp lưỡng long chầu mặt trời rực lửa trên bờ nóc Đền Chính và Cổng Tam Quan, thân uốn 7 khúc kiểu Nam Bộ hiện đại, khảm gốm nổi `8cm` | `G-TUBE` + `G-LATHE` | Dài `4.5m`/rồng | 2 | 5 600 | `roofParts` |
| Trán Cổng Tam Quan & Hoành phi Chính Điện | `HV-I01` | Đại tự nền son chữ vàng `"ĐỀN TƯỞNG NIỆM LIỆT SĨ BẾN DƯỢC"` (Tam Quan) và `"CÔNG ĐỨC VẠN ĐẠI"` trên chính điện, khung chạm mây nổi `3cm` | `T-ATLAS` + `G-EXT` | `3.6×0.85m` | 2 | 480 | `goldParts` |
| 2 hàng bia đá hoa cương ghi danh > 45.639 anh hùng liệt sĩ | `HV-I03` | 16 tấm bia đá granit đen khắc chìm chữ vàng mạ tên 45.639 liệt sĩ Sài Gòn – Chợ Lớn – Gia Định, viền khắc dây hoa sen sâu `0.4cm` | `T-NRM` + `T-ATLAS` | `1.4×2.2m` | 16 | 0 | `stoneParts` |
| Cửa võng (bao lam) & hệ cột gỗ lim chạm Tứ quý | `HV-D12` | Bao lam chạm lộng hoa sen – tứ quý Mai–Lan–Cúc–Trúc sơn son thếp vàng sâu `4cm` trước bàn thờ Tổ quốc & Bác Hồ | `G-EXT` | `3.8×0.9m` | 2 | 3 200 | `goldParts` |
| Đỉnh đồng lớn & cặp hạc đồng chầu Quy sân điện | `HV-E07` | Đỉnh đồng 3 chân 2 quai rồng cao `1.8m` đặt giữa sân gạch đỏ Bến Dược | `G-LATHE` + `G-TUBE` | Cao `1.8m` | 1 | 900 | `bronzeParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A04, HV-I01, HV-I03, HV-D12, HV-E07` | — | — | — | **10 180** | — |

**LOD/ghi chú QC:** L0 giữ 2 cặp lưỡng long `HV-A04`, 2 bao lam `HV-D12` và đỉnh đồng `HV-E07`; L1 hạ bao lam sang alpha cutout + `T-NRM`, giữ rồng bờ nóc simplified silhouette. QC kiểm tra bia khắc tên 45.639 liệt sĩ không nhòe chữ ở cự ly 2m.

#### `MN-045` — Mặt Cắt Ngầm 3 Tầng Địa Đạo Củ Chi (ảnh ref: `31`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vách chống sạt & trần hầm hội họp, bệnh xá dã chiến | `HV-G03` | Phên nứa đan lóng mốt kẹp gỗ chống vách đất ong ở 3 buồng ngầm (hội họp, quân y, kho vũ khí), rãnh nan sâu `1cm` | `T-NRM` + `S-SHD` | Toàn vách 3 tầng | 1 | 0 | `woodParts` |
| Khung thanh gỗ kèo chống & nút buộc dây rừng | `HV-NEW-MN-11` | 18 khung cột kèo gỗ dầu đẽo thô buộc nút lạt mây chữ thập chống trần 3 tầng địa đạo, sâu `3cm` | `G-INST` + `T-NRM` | Khung `1.2×1.4m` | 18 | 1 440 | `woodParts` |
| Biển thuyết minh 3 tầng độ sâu (`-3m`, `-6m`, `-9m`) | `HV-I04` | 4 bảng chú thích mặt cắt địa đạo `"TẦNG 1 (-3m) — HẦM CHIẾN ĐẤU"`, `"TẦNG 2 (-6m) — BỆNH XÁ"`, `"TẦNG 3 (-9m) — HẦM TRÚ ẨN"` | `T-ATLAS` | `0.8×0.35m` | 4 | 0 | `woodParts` |
| Ngôi sao vàng & khẩu hiệu trên vách hầm hội họp | `HV-NEW-MN-12` | Ngôi sao 5 cánh cắt gỗ sơn vàng gắn giữa phông vải đỏ sau bàn họp chỉ huy dưới lòng đất | `G-EXT` + `T-ATLAS` | Ø `0.35m` | 1 | 120 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-G03, HV-NEW-MN-11, HV-I04, HV-NEW-MN-12` | — | — | — | **1 560** | — |

**LOD/ghi chú QC:** L0 giữ 18 khung chống gỗ buộc lạt `HV-NEW-MN-11` và sao vàng `HV-NEW-MN-12`; L1 hạ nút buộc lạt sang `T-NRM`. QC xác nhận mặt cắt nhìn rõ 3 tầng độ sâu không có hoa văn cung đình sai bối cảnh.

#### `MN-046` — Nắp Hầm Bí Mật Ngụy Trang Lá Khô (ảnh ref: `31`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Khung miệng hầm gỗ vát khớp `40×40cm` | `HV-NEW-MN-11` | Khung gỗ rừng ghép mộng thô có 2 chốt gài tre và quai móc dây mây giấu mặt đất, khe vát sâu `2cm` | `G-INST` + `T-NRM` | `0.45×0.45m` | 4 | 320 | `woodParts` |
| Lớp phên đan lót đáy nắp hầm giữ đất & lá khô | `HV-G03` | Phên tre đan mắt khít gắn mặt dưới nắp hầm `40×40cm` để giữ chặt lớp đất sét trộn lá khô ngụy trang | `T-NRM` + `S-SHD` | `0.4×0.4m` | 4 | 0 | `woodParts` |
| Biển chỉ dẫn vị trí nắp hầm bí mật cho khách tham quan | `HV-I04` | Bảng gỗ khắc chữ vàng `"HẦM BÍ MẬT — SECRET ENTRANCE"` cắm cạnh gốc tre | `T-ATLAS` | `0.55×0.35m` | 2 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-G03, HV-I04` | — | — | — | **320** | — |

**LOD/ghi chú QC:** L0 giữ khung nắp gập `HV-NEW-MN-11` kích thước thực `40×40cm`; L1 chuyển chi tiết mộng sang `T-NRM`. QC kiểm tra animation mở gập nắp hầm không xuyên cắt đất rừng xung quanh.

#### `MN-047` — Bếp Hoàng Cầm & Hệ Ống Tản Khói Ngầm (ảnh ref: `31`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mái che lán bếp & vách phên tre chắn ánh lửa | `HV-G03` | Phên nứa đan lóng mốt dựng 3 mặt lán bếp Hoàng Cầm chống lộ ánh lửa máy bay trinh sát | `T-NRM` + `S-SHD` | `4.0×2.2m` | 1 | 0 | `woodParts` |
| Khung rãnh đào đậy cành tre & lá rừng lọc khói | `HV-NEW-MN-11` | 10 vỉ tre buộc dây mây lát dọc mương tản khói ngầm dài `12m` dẫn khói bay là là sát cỏ | `G-INST` + `T-NRM` | `1.2×0.6m` | 10 | 800 | `woodParts` |
| Biển sơ đồ nguyên lý hoạt động Bếp Hoàng Cầm | `HV-I04` | Bảng thuyết minh `"BẾP HOÀNG CẦM — KHÔNG KHÓI"` vẽ sơ đồ luồng khói qua 3 hố ngưng tụ | `T-ATLAS` | `0.9×0.6m` | 1 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-G03, HV-NEW-MN-11, HV-I04` | — | — | — | **800** | — |

**LOD/ghi chú QC:** L0 giữ 10 vỉ tre lát rãnh `HV-NEW-MN-11` và sơ đồ nguyên lý `HV-I04`; L1 chuyển vỉ tre sang bề mặt normal map `T-NRM`.

#### `MN-048` — Xưởng Chế Tạo Vũ Khí & Bàn Đúc Mìn Thô Sơ (ảnh ref: `31`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Khung lán công binh tre buộc dây mây | `HV-NEW-MN-11` | 12 khớp nối kèo tre mái lá dừa nước & giá gỗ trưng bày vỏ bom cưa đôi lấy thuốc nổ | `G-INST` + `T-NRM` | `1.5×1.2m` | 12 | 960 | `woodParts` |
| Vách phên nứa & bồ đựng than rèn | `HV-G03` | Phên đan xương cá chắn gió lò rèn thủ công và 4 sọt tre đựng than củi | `T-NRM` + `S-SHD` | Toàn vách `6×2.4m` | 1 | 0 | `woodParts` |
| Ký hiệu quân sự sơn khuôn trên vỏ bom & hòm đạn | `HV-NEW-MN-12` | Dải chữ số lô đạn sơn khuôn trắng/vàng trên 2 vỏ bom cắt đôi và hòm đạn gỗ công binh | `T-ATLAS` | `0.4×0.2m` | 6 | 0 | `ironParts` |
| Biển chú thích khu xưởng công binh | `HV-I04` | Bảng gỗ `"XƯỞNG CHẾ TẠO VŨ KHÍ THÔ SƠ"` đặt cạnh bàn đúc mìn gạt | `T-ATLAS` | `0.85×0.45m` | 2 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-G03, HV-NEW-MN-12, HV-I04` | — | — | — | **960** | — |

**LOD/ghi chú QC:** L0 giữ 12 khớp buộc tre `HV-NEW-MN-11`; L1 hạ chi tiết nút buộc sang `T-NRM`. QC đảm bảo chất liệu vỏ bom kim loại rỉ sét rõ ràng, không bóng mới.

#### `MN-049` — Khu Trưng Bày Bẫy Chông Củ Chi (ảnh ref: `31`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Hàng rào tre bảo vệ & khung mái che hố trưng bày | `HV-NEW-MN-11` | 16 đoạn hàng rào tre đan hình quả trám buộc nút mây vây quanh 6 mô hình hố chông (kẹp nách, cánh cửa, xoay) | `G-INST` + `T-NRM` | `1.5×0.95m` | 16 | 1 280 | `woodParts` |
| Mái lán nứa đan che nắng mưa cho khu trưng bày | `HV-G03` | Tấm liếp đan lóng mốt dưới mái lá trung quân bảo vệ các cơ cấu chông sắt – tre | `T-NRM` + `S-SHD` | `8.0×3.5m` | 1 | 0 | `woodParts` |
| 6 biển giải thích tên & cơ chế từng loại chông | `HV-I04` | 6 bảng thuyết minh song ngữ `"CHÔNG KẸP NÁCH"`, `"CHÔNG CÁNH CỬA"`, `"CHÔNG XOAY"`, `"CHÔNG ĐÒN BẨY"`… | `T-ATLAS` | `0.45×0.3m` | 6 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-G03, HV-I04` | — | — | — | **1 280** | — |

**LOD/ghi chú QC:** L0 giữ 16 đoạn rào tre `HV-NEW-MN-11`; L1 chuyển hàng rào sang alpha cutout + `T-NRM`.

#### `MN-050` — Xác Xe Tăng M41 Walker Bulldog Mỹ (ảnh ref: `31`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Ký hiệu quân sự & ngôi sao trắng mờ trên thân/tháp pháo | `HV-NEW-MN-12` | Ngôi sao trắng 5 cánh tróc sơn, số hiệu đơn vị Mỹ sơn khuôn mờ và 3 vết đạn pháo lõm quanh tháp pháo M41 | `T-ATLAS` + `G-EXT` | Ø `0.45m` | 2 | 240 | `ironParts` |
| Hàng đinh tán / bu-lông giáp nghiêng & chắn bùn | `HV-D14` | 36 đầu bu-lông lục giác/bán cầu dọc mép giáp nghiêng thân xe tăng M41, nổi `1.5cm` | `G-INST` | Ø `3cm` | 36 | 864 | `ironParts` |
| Biển thuyết minh di tích hiện vật chiến tranh | `HV-I04` | Bia đá nghiêng khắc chữ `"XÁC XE TĂNG M41 BỊ DU KÍCH CỦ CHI BẮN CHÁY NĂM 1966"` | `T-ATLAS` | `0.85×0.5m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-12, HV-D14, HV-I04` | — | — | — | **1 104** | — |

**LOD/ghi chú QC:** L0 giữ 36 đầu bu-lông giáp `HV-D14` và dấu vết đạn `HV-NEW-MN-12`; L1 bake bu-lông sang `T-NRM`. QC xác nhận lớp rỉ sét và độ nghiêng tự nhiên của thân tăng M41 giữa bụi tre.

#### `MN-051` — Ụ Chiến Đấu & Lỗ Thông Hơi Gò Mối Giả (ảnh ref: `31`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cốt tre đan tạo hình gò mối giả & ống thông hơi ngầm | `HV-NEW-MN-11` | 6 khung cốt tre uốn vòm bọc đất sét làm lỗ thông hơi hình gò mối tự nhiên, miệng ống tre vát nghiêng thoát mưa | `G-INST` + `T-NRM` | Cao `0.8–1.2m` | 6 | 480 | `woodParts` |
| Lưới phên tre chắn cửa ụ chiến đấu & vách hầm bắn tỉa | `HV-G03` | Phên đan mắt cáo phủ cỏ khô ngụy trang lỗ châu mai ụ chiến đấu | `T-NRM` + `S-SHD` | `1.8×1.0m` | 2 | 0 | `woodParts` |
| Biển chỉ dẫn lỗ thông hơi gò mối | `HV-I04` | Bảng gỗ nhỏ `"LỖ THÔNG HƠI NGỤY TRANG GÒ MỐI"` cắm mép đường mòn | `T-ATLAS` | `0.5×0.3m` | 2 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-G03, HV-I04` | — | — | — | **480** | — |

**LOD/ghi chú QC:** L0 giữ 6 cốt tre miệng thông hơi `HV-NEW-MN-11`; L1 ẩn cốt tre bên trong, chỉ giữ vỏ đất gò mối + `T-NRM`.

#### `MN-052` — Lán Khách Tham Quan & Quầy Khoai Mì Muối Mè (ảnh ref: `31`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Hệ kèo tre buộc mây & lan can lán dừng chân | `HV-NEW-MN-11` | 14 module cột – xà – tay vịn tre buộc dây mây chữ thập dưới mái lá dừa nước rộng `10×6m` | `G-INST` + `T-NRM` | Module `1.5×1.2m` | 14 | 1 120 | `woodParts` |
| Vách liếp che nắng & mẹt tre bày khoai mì muối mè | `HV-G03` | Phên nứa đan lóng mốt 2 đầu hồi và 12 mẹt tre lót lá chuối đựng khoai mì luộc | `T-NRM` + `S-SHD` | Mẹt Ø `0.35m` | 12 | 0 | `woodParts` |
| Biển hiệu quầy ẩm thực chiến khu | `HV-I04` | Bảng gỗ khắc mộc `"KHOAI MÌ CỦ CHI — TRÀ NÓNG"` treo trước hiên lán | `T-ATLAS` | `1.6×0.4m` | 1 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-G03, HV-I04` | — | — | — | **1 120** | — |

**LOD/ghi chú QC:** L0 giữ 14 module kèo tre `HV-NEW-MN-11`; L1 chuyển nút buộc sang `T-NRM`.

---

## 3.5. Tháp Bà Ponagar — Nha Trang (`MN-053` → `MN-062`)

> **Bối cảnh mỹ thuật**: Di tích **Chăm Pa tiểu vương quốc Kauthara** (xây dựng & tu bổ TK VIII–XIII, đậm dấu ấn phong cách **Hòa Lai — Mỹ Sơn A1 — Bình Định sơ kỳ**), thờ Nữ thần Mẹ Xứ Sở *Yan Po Nagar* (*Bhagavati / Uma*). Vật liệu chủ đạo là **gạch Chăm mài chập** nâu đỏ không vữa nổi mạch, đá sa thạch xám–đen điêu khắc Ấn Độ giáo (*Kala, Makara, Durga, Shiva, Apsara, Linga-Yoni*), chữ Phạn *Sanskrit / Chăm cổ*, thổ cẩm Chăm & gốm Bàu Trúc. Tuyệt đối **không** gán rồng Đại Việt hay kiến trúc Pháp vào cụm tháp.

#### `MN-053` — Tháp Chính (Tháp Đông Bắc cao `23m`) (ảnh ref: `32`, `66`, `98`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 tầng tháp giật cấp & 16 tháp góc mô hình (*kudu*) | `HV-F10` | 12 tháp góc thu nhỏ ở 4 góc 3 tầng mái + 4 tượng ngỗng thần *Hamsa* / thú góc đá sa thạch nhô cao tại chân tầng mái, sâu `12cm` | `G-*` | Cao `0.9–1.5m` | 16 | 3 520 | `chamBrick` |
| Hệ cột áp tường khía rãnh 4 mặt thân tháp | `HV-F04` | 20 cột áp tường gạch Chăm mài chập chạy dọc 4 mặt (5 cột/mặt), mỗi cột khía 3 rãnh dọc sâu `4cm`, đầu cột thắt cổ bồng chạm cánh sen | `G-EXT` | Cao `6.5m`, rộng `0.65m` | 20 | 2 400 | `chamBrick` |
| 3 cửa giả 3 tầng giật cấp (mặt Bắc, Tây, Nam) | `HV-F05` | 3 cửa giả lồng 3 khung gạch lùi bậc sâu `45cm`, đỉnh vòm nhọn hình mũi giáo lá đề vươn lên tầng trên | `G-EXT` | `2.2×5.2m` | 3 | 1 260 | `chamBrick` |
| Vòm cửa chính hướng Đông (vòm lá đề 5 lớp + *Kala* + *Shiva*) | `HV-F03` | 4 lớp vòm cuốn lá đề chồng tầng ôm lấy tấm lá nhĩ đá sa thạch chạm thần *Shiva* 4 tay múa trên bò *Nandin* và mặt *Kala* đỉnh vòm, sâu `8cm` | `G-EXT` + `G-DISP` | Cao `3.8m`, rộng `2.4m` | 4 | 2 400 | `chamBrick` |
| Bề mặt tường gạch Chăm mài chập toàn tháp `23m` | `HV-F11` | Gạch nung cổ đỏ sẫm mài chập khít mạch không vữa, phủ mảng rêu xám-đen tự nhiên gió biển | `T-NRM` + `S-SHD` | Gạch `0.3×0.15m` | 1 | 0 | `chamBrick` |
| **Tổng** | — | `requiredMotifs`: `HV-F10, HV-F04, HV-F05, HV-F03, HV-F11` | — | — | — | **9 580** | — |

**LOD/ghi chú QC:** L0 giữ 16 tháp góc `HV-F10`, 20 cột áp tường `HV-F04`, 3 cửa giả `HV-F05` và vòm lá đề `HV-F03`; L1 giản lược tháp góc tầng 3 còn khối chóp và chuyển rãnh cột `HV-F04` sang `T-NRM`. QC bắt buộc đối chiếu tỷ lệ cao `23m` vươn dốc và vòm cửa Đông ảnh `32`, `98`.

#### `MN-054` — Nội Thất Tháp Chính — Tượng Nữ Thần Po Nagar (ảnh ref: `66`, `32`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tượng đá đen Nữ thần Po Nagar (Thiên Y A Na, TK XI) | `HV-NEW-MN-05` | Tượng đá đen nguyên khối cao `2.6m` (cả bệ), nữ thần 10 tay cầm khí giới/biểu tượng (tù và, đĩa, cung, mũi tên, hoa sen), đội mũ tháp *Mukuta* 3 tầng, ngồi xếp bằng kiểu *padmasana* | `G-DISP` + `G-LATHE` | Cao `2.6m`, rộng `1.4m` | 1 | 1 600 | `stoneParts` |
| Lá đề hậu quang lớn sau lưng tượng Po Nagar | `HV-C09` | Tấm đá hình lá đề đuôi nhọn cao `2.4m` ôm sau tượng, viền chạm ngọn lửa xoắn Chăm sâu `3.5cm` | `G-EXT` | Cao `2.4m`, rộng `1.5m` | 2 | 180 | `stoneParts` |
| Bệ Yoni vuông & đài sen 24 cánh nâng đỡ tượng | `HV-C01` | 24 cánh sen Chăm đầu hơi bầu xếp 2 tầng ngược–xuôi trên khối bệ đá Yoni có rãnh thoát nước thiêng hướng Bắc, sâu `3cm` | `G-INST` | Cánh `0.18×0.14m` | 24 | 1 152 | `stoneParts` |
| Dây lá cuốn Chăm viền bệ đá & hốc đèn tường gạch | `HV-C10` | Băng dây lá xoắn ốc kiểu acanthus Chăm chạy 4 mặt chân bệ đá sa thạch dài `5.6m`, chạm sâu `2.5cm` | `G-TUBE` / `T-NRM` | Băng cao `18cm`, dài `6m` | 6 | 1 080 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-05, HV-C09, HV-C01, HV-C10` | — | — | — | **4 012** | — |

**LOD/ghi chú QC:** L0 giữ nguyên khối tượng 10 tay `HV-NEW-MN-05`, lá đề `HV-C09` và 24 cánh sen `HV-C01`; L1 hạ dây lá `HV-C10` sang `T-NRM`. QC đối chiếu số lượng **10 tay** và chiếc mũ tháp *Mukuta* trên ảnh `66` (cấm nhầm thành tượng Phật ngồi).

#### `MN-055` — Tháp Nam, Tháp Tây Bắc (mái thuyền) & Tháp Trung Tâm (ảnh ref: `32`, `98`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 cụm cột áp tường gạch trên 3 tháp còn lại | `HV-F04` | 36 cột áp tường khía 3 rãnh dọc phân bổ trên Tháp Nam (`12m`), Tháp Trung Tâm (`7m`) và Tháp Tây Bắc mái hình thuyền (`9m`), sâu `3.5cm` | `G-EXT` | Cao `3.2–4.5m` | 36 | 4 320 | `chamBrick` |
| Hệ cửa giả 2–3 tầng giật cấp trên Tháp Nam & Trung Tâm | `HV-F05` | 6 bộ cửa giả gạch Chăm lùi 2–3 bậc có trán vòm lá đề nhọn hướng Bắc–Tây–Nam | `G-EXT` | `1.5×3.2m` | 6 | 2 520 | `chamBrick` |
| Vòm đầu hồi mái thuyền Tháp Tây Bắc & vòm cửa 3 tháp | `HV-F03` | 5 bộ vòm lá đề nhiều lớp nổi gờ sâu `10cm`, đặc biệt 2 đầu hồi cong vút kiểu mái thuyền *Kosa* ở Tháp Tây Bắc | `G-EXT` | Cao `1.8–2.6m` | 5 | 3 000 | `chamBrick` |
| Tháp góc *kudu* 2 tầng trên Tháp Nam | `HV-F10` | 8 tháp góc gạch thu nhỏ đặt 4 góc tầng 1 & 2 của Tháp Nam (thờ thần Shiva) | `G-*` | Cao `0.75m` | 8 | 1 760 | `chamBrick` |
| Tường gạch Chăm mài chập phủ rêu gió biển | `HV-F11` | Bề mặt gạch đỏ sẫm khít mạch trên cả 3 tháp vệ tinh | `T-NRM` + `S-SHD` | Toàn 3 tháp | 1 | 0 | `chamBrick` |
| **Tổng** | — | `requiredMotifs`: `HV-F04, HV-F05, HV-F03, HV-F10, HV-F11` | — | — | — | **11 600** | — |

**LOD/ghi chú QC:** L0 giữ toàn bộ 36 cột áp tường `HV-F04`, 6 cửa giả `HV-F05` và dáng mái thuyền độc đáo của Tháp Tây Bắc; L1 chuyển cột áp tường sang `T-NRM` và giữ khối mái thuyền làm điểm nhận diện chính.

#### `MN-056` — Khu Tiền Đình Mandapa — 22 Cột Gạch Bát Giác (ảnh ref: `98`, `32`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 10 cột gạch bát giác lớn giữa & 12 cột nhỏ viền ngoài | `HV-F04` | 22 trụ gạch Chăm xây tiết diện bát giác (10 cột trong cao `5.5m` Ø `1.1m`, 12 cột ngoài cao `3.6m` Ø `0.65m`), chân và đầu cột thắt bậc giật cấp sâu `5cm` | `G-EXT` | Cao `3.6–5.5m` | 22 | 2 640 | `chamBrick` |
| Băng gờ gạch giật cấp bao quanh nền cao Mandapa | `HV-C10` | Băng diềm dây lá cuốn Chăm chạm trên gạch nung chạy viền bậc nền dài `36m`, sâu `2.5cm` | `G-TUBE` / `T-NRM` | Băng cao `20cm`, dài `36m` | 20 | 3 600 | `chamBrick` |
| Lỗ mộng ngàm xà gỗ cổ trên thân 22 cột gạch | `HV-D07` | 44 ô hộc vuông khoét lõm sâu `8cm` ở phần trên các cột gạch bát giác (dấu tích kết cấu mái ngói xưa của Tiền Đình) | `G-EXT` | Ô `0.25×0.25m` | 44 | 1 760 | `chamBrick` |
| Gạch Chăm mài chập trên toàn bộ 22 trụ và sân nền | `HV-F11` | Mạch gạch đỏ nâu đều tăm tắp, mặt trên các trụ lộ vết phong hóa tự nhiên | `T-NRM` + `S-SHD` | Gạch `0.3×0.15m` | 1 | 0 | `chamBrick` |
| **Tổng** | — | `requiredMotifs`: `HV-F04, HV-C10, HV-D07, HV-F11` | — | — | — | **8 000** | — |

**LOD/ghi chú QC:** L0 giữ đúng sơ đồ **10 cột lớn (2 hàng × 5) + 12 cột nhỏ viền ngoài = 22 cột** `HV-F04` và lỗ mộng `HV-D07`; L1 chuyển băng `HV-C10` sang `T-NRM`. QC bắt buộc đếm đúng 22 cột bát giác đối chiếu ảnh `98`.

#### `MN-057` — Phù điêu Nữ thần *Durga Mahishasuramardini* (ảnh ref: `66`, `32`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bức phù điêu chính trên vòm lá nhĩ (*tympanum*) | `HV-F08` | Nữ thần *Durga Mahishasuramardini* 4 tay cầm đinh ba, kiếm, khiên, tù và, đứng múa dáng *tribhanga* trên đầu trâu quỷ *Mahisha*, chạm nổi sâu `8–12cm` bằng đá sa thạch xám | `G-DISP` | Cao `1.35m`, rộng `1.05m` | 1 | 1 200 | `stoneParts` |
| Mặt quái vật *Kala* trấn đỉnh vòm trên đầu nữ thần | `HV-F01` | Mặt nạ *Kala* mắt lồi to, nanh nhọn, không hàm dưới, 2 tay giữ chuỗi hạt và nhả 2 nhánh dây hoa đối xứng sang 2 bên, sâu `6cm` | `G-DISP` | `0.65×0.45m` | 1 | 700 | `stoneParts` |
| Đôi thủy quái *Makara* chầu 2 chân vòm lá nhĩ | `HV-F02` | 2 con *Makara* vòi voi cuộn ngược, há mõm nhả dây lá cuốn đối xứng ở 2 góc chân khung vòm, sâu `5cm` | `G-DISP` | `0.45×0.38m` | 2 | 960 | `stoneParts` |
| Đôi nhạc công trời *Gandharva* thổi sáo 2 bên | `HV-F07` | 2 nhạc công ngồi xếp chân bên sườn khung lá đề chơi sáo và trống, đầu đội mũ nhọn, sâu `3.5cm` | `G-DISP` | Cao `0.42m` | 2 | 1 000 | `stoneParts` |
| Khung lá đề viền ngọn lửa ôm toàn bộ phù điêu | `HV-C09` | Vòng lá đề đuôi nhọn 2 lớp chạm 18 cụm lưỡi lửa Chăm vươn tỏa đều quanh tấm lá nhĩ | `G-EXT` | Cao `1.8m`, rộng `1.4m` | 2 | 180 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-F08, HV-F01, HV-F02, HV-F07, HV-C09` | — | — | — | **4 040** | — |

**LOD/ghi chú QC:** L0 giữ đầy đủ chiều sâu chạm `G-DISP` (`3.5–12cm`) cho toàn bộ tổ hợp `HV-F08 + F01 + F02 + F07`; L1 bake toàn bộ mặt lá nhĩ sang height/normal `T-NRM` trên tấm lá đề `HV-C09`. QC bắt buộc chụp cận cảnh 1.5m đối chiếu với ảnh `66`.

#### `MN-058` — Bậc Thang Đá Lớn nối từ Mandapa lên Sân Tháp (ảnh ref: `98`, `32`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 tường chắn bậc thang xây gạch giật cấp & trụ góc | `HV-F04` | 12 trụ gạch áp tường vuông giật bậc theo độ dốc 42 bậc đá nối tầng Mandapa lên sân tháp chính, khe chỉ sâu `3cm` | `G-EXT` | Cao `1.6–2.4m` | 12 | 1 440 | `chamBrick` |
| Đôi đầu *Makara* đá ở chân bậc thang dẫn lối | `HV-F02` | 2 khối điêu khắc đầu *Makara* vòi cuộn đặt tại 2 đầu tay vịn bậc thang đón khách hành hương, sâu `6cm` | `G-DISP` | `0.55×0.45m` | 2 | 960 | `stoneParts` |
| Dải cánh sen đá viền bệ cột đèn đá 2 bên lối lên | `HV-C01` | 16 cánh sen Chăm chạm quanh chân 4 trụ đèn đá sa thạch dọc bậc thang, sâu `2cm` | `G-INST` | Cánh `0.14×0.12m` | 16 | 768 | `stoneParts` |
| Bề mặt tường chắn gạch Chăm cổ & bậc đá xanh | `HV-F11` | Gạch đỏ sẫm mài chập phối hợp bậc đá sa thạch phong hóa lấp ló rêu xanh | `T-NRM` + `S-SHD` | Dài `18m` | 1 | 0 | `chamBrick` |
| **Tổng** | — | `requiredMotifs`: `HV-F04, HV-F02, HV-C01, HV-F11` | — | — | — | **3 168** | — |

**LOD/ghi chú QC:** L0 giữ đôi đầu *Makara* `HV-F02` và 12 trụ bậc `HV-F04`; L1 chuyển cánh sen trụ đèn `HV-C01` sang `T-NRM`. QC xác nhận bậc thang nối thẳng trục Đông–Tây từ Mandapa (`MN-056`) lên cửa Tháp Chính (`MN-053`).

#### `MN-059` — Nhà Trưng Bày Gốm Chăm & Khung Dệt Thổ Cẩm (ảnh ref: `32`, `98`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Dải vải thổ cẩm Mỹ Nghiệp căng trên khung dệt Chăm | `HV-G01` | 6 tấm thổ cẩm Chăm dệt hoa văn hình thoi lồng (*bingu*), răng cưa (*chân chó*), màu đỏ–trắng–chàm–vàng rực rỡ | `T-NRM`/`T-ATLAS` | `0.6×1.8m` | 6 | 0 | `crimsonParts` |
| Bộ 14 bình, chum, ấm gốm Bàu Trúc trưng bày | `HV-NEW-MN-06` | 14 bình gốm nặn tay không bàn xoay, khắc vạch sóng nước – răng cưa – móng tay bằng vỏ sò quanh vai bình, vân nung lộ thiên đỏ-đen loang | `G-LATHE` + `T-NRM` + `S-SHD` | Cao `0.3–0.75m` | 14 | 2 520 | `chamBrick` |
| Dây lá cuốn Chăm khắc viền bệ gỗ trưng bày gốm | `HV-C10` | Băng hoa văn dây lá xoắn dài `8m` chạm nhẹ `1.5cm` dọc bệ tủ trưng bày | `G-TUBE` / `T-NRM` | Dài `8m`, cao `12cm` | 8 | 1 440 | `woodParts` |
| Biển giới thiệu làng nghề gốm Bàu Trúc & dệt Mỹ Nghiệp | `HV-I04` | 2 bảng thuyết minh song ngữ `"GỐM CHĂM BÀU TRÚC — DI SẢN VĂN HÓA PHI VẬT THỂ"` | `T-ATLAS` | `0.9×0.5m` | 2 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-G01, HV-NEW-MN-06, HV-C10, HV-I04` | — | — | — | **3 960** | — |

**LOD/ghi chú QC:** L0 giữ 14 thân bình gốm Bàu Trúc `HV-NEW-MN-06` (shader loang lửa); L1 giảm phân đoạn Lathe bình gốm 40% và chuyển `HV-C10` sang `T-NRM`.

#### `MN-060` — Sân Biểu Diễn Múa Apsara & Nhạc Cụ Chăm (ảnh ref: `32`, `98`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tấm phù điêu Vũ nữ *Apsara* trang trí hậu cảnh sân khấu | `HV-F06` | 3 phù điêu vũ nữ *Apsara* uốn hông chữ S, tay bắt ấn múa dẻo, đội mũ tháp 3 tầng, chạm nổi sâu `4cm` trên bệ đá sa thạch phía sau bục diễn | `G-DISP` | Cao `1.0m`, rộng `0.65m` | 3 | 1 800 | `stoneParts` |
| Bộ nhạc cụ lễ hội: 2 Trống Ginăng, 2 Trống Paranưng & Kèn Saranai | `HV-NEW-MN-08` | 2 cặp trống Ginăng dài `0.75m` buộc dây mây chữ V chéo kín thân, 2 trống vỗ Paranưng mặt da & 2 kèn Saranai gỗ tiện đai đồng đặt trên giá | `G-LATHE` + `G-TUBE` | Dài `0.45–0.75m` | 6 | 1 440 | `woodParts` |
| Viền bục sân khấu gạch đỏ gắn băng dây lá cuốn Chăm | `HV-C10` | Băng hoa văn dây lá xoắn Chăm ốp dọc 3 mặt bục sân khấu dài `14m`, sâu `2.5cm` | `G-TUBE` / `T-NRM` | Dài `14m`, cao `16cm` | 10 | 1 800 | `chamBrick` |
| Khăn thổ cẩm Chăm trải giá nhạc cụ & cột sân khấu | `HV-G01` | Dải vải thổ cẩm hoa văn thoi đỏ – vàng – đen phủ mặt giá đặt trống Ginăng | `T-NRM`/`T-ATLAS` | `2.4×0.8m` | 2 | 0 | `crimsonParts` |
| **Tổng** | — | `requiredMotifs`: `HV-F06, HV-NEW-MN-08, HV-C10, HV-G01` | — | — | — | **5 040** | — |

**LOD/ghi chú QC:** L0 giữ 3 phù điêu *Apsara* `HV-F06` và bộ 6 nhạc cụ Chăm `HV-NEW-MN-08`; L1 chuyển dây buộc trống sang `T-NRM` và hạ băng `HV-C10` sang `T-NRM`.

#### `MN-061` — Hàng Bia Ký Chữ Phạn & Linga-Yoni Sân Ngoài (ảnh ref: `66`, `98`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 bia ký đá sa thạch khắc chữ Phạn (*Sanskrit*) & Chăm cổ | `HV-NEW-MN-07` | 6 tấm bia đứng đỉnh uốn hình lá đề (từ thời vua Vikrantavarman, Harivarman TK VIII–XIII), khắc chìm 18–26 dòng chữ Phạn *Pallava* & Chăm cổ sâu `0.4cm` | `G-EXT` + `T-NRM` + `T-ATLAS` | `0.75×1.65m` | 6 | 1 320 | `stoneParts` |
| 3 bộ *Linga-Yoni* đá sa thạch trưng bày ngoài trời | `HV-F09` | 3 bệ vuông *Yoni* có máng chảy thiêng (*somasutra*) đỡ trụ *Linga* 3 phần (vuông *Brahma*, bát giác *Vishnu*, tròn *Shiva*), cao `0.95m` | `G-LATHE` + `G-EXT` | `0.95×0.95×1.0m` | 3 | 780 | `stoneParts` |
| 2 mảnh phù điêu *Kala* & *Makara* cổ đặt trên đôn đá | `HV-F01` | 2 hiện vật đầu *Kala* đá sa thạch cổ được khai quật bảo tồn dưới mái hiên gỗ | `G-DISP` | `0.55×0.45m` | 2 | 1 400 | `stoneParts` |
| Bảng chú thích niên đại bia ký Kauthara | `HV-I04` | 6 biển chú thích nhỏ bằng đồng/acrylic ghi niên đại TK VIII–XIII của từng tấm bia | `T-ATLAS` | `0.4×0.25m` | 6 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-07, HV-F09, HV-F01, HV-I04` | — | — | — | **3 500** | — |

**LOD/ghi chú QC:** L0 giữ 6 khối bia lá đề `HV-NEW-MN-07`, 3 bộ `HV-F09` và 2 hiện vật *Kala* `HV-F01`; L1 chuyển nét khắc chữ Phạn sang `T-NRM` giữ khối bia nguyên vẹn. QC kiểm tra đúng 3 phần hình học của *Linga* (vuông–bát giác–tròn).

#### `MN-062` — Cửa Sông Cái & Đội Thuyền Đánh Cá Dưới Chân Đồi (ảnh ref: `32`, `98`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 8 thuyền đánh cá gỗ Nha Trang gắn mắt thuyền biển | `HV-NEW-MN-01` | 16 mắt thuyền biển Nam Trung Bộ (8 cặp đối xứng mũi tàu) vẽ hình hạnh nhân viền trắng–đỏ, tròng đen hướng thẳng ra khơi, viền nổi `1.2cm` | `T-ATLAS` + `G-EXT` | `0.45×0.22m` | 16 | 1 440 | `crimsonParts` |
| Số đăng ký tàu cá & đường chỉ sơn sọc mạn thuyền | `HV-I04` | Mã hiệu tàu cá Khánh Hòa `"KH-90248-TS"`, `"KH-91420-TS"` sơn trắng rõ trên nền xanh dương – đỏ mũi thuyền | `T-ATLAS` | `1.1×0.28m` | 8 | 0 | `whiteParts` |
| 4 thuyền thúng đan nan tre đậu bãi cát chân cầu Xóm Bóng | `HV-G03` | Nan tre đan lóng mốt trét dầu rái đen chống thấm, cạp vành tre dày nổi khối | `T-NRM` + `S-SHD` | Ø `1.6m` | 4 | 0 | `woodParts` |
| Lan can bờ kè đá chân đồi Cù Lao chạm sóng biển | `HV-D06` | Băng phù điêu sóng nước đúc bê tông giả đá chạy dọc kè bờ sông Cái dài `24m` | `G-EXT` | Dài `24m`, cao `0.2m` | 16 | 1 440 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-01, HV-I04, HV-G03, HV-D06` | — | — | — | **2 880** | — |

**LOD/ghi chú QC:** L0 giữ 16 mắt thuyền `HV-NEW-MN-01` và băng sóng kè `HV-D06`; L1 chuyển mắt thuyền sang `T-ATLAS` phẳng trên mũi tàu. QC đảm bảo màu nước cửa sông Cái xanh ngọc chuyển dần sang xanh biển vịnh Nha Trang.

---

## 3.6. Chợ Nổi Cái Răng — Cần Thơ (`MN-063` → `MN-074`)

> **Bối cảnh mỹ thuật**: Văn hóa thương hồ sông nước miệt vườn Tây Nam Bộ (TK XIX–XXI). Họa tiết dân gian sống động gồm **mắt thuyền Nam Bộ** (trấn thủy thần, tròng nhìn xuống tìm luồng/cá), đường chỉ sơn xanh–đỏ–trắng trên mũi ghe bầu, kỹ nghệ đan tre nứa Nam Bộ (*cà tăng*, *cây bẹo*, *vỉ phơi hủ tiếu*), kết hợp kiến trúc bến cảng & cầu tàu hiện đại Cần Thơ.

#### `MN-063` — Đội 30 Ghe Bầu Gỗ Rỗng Lòng (ảnh ref: `64`, `33`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 30 bộ vòm khung mui ghe & thanh cong tre – gỗ | `HV-NEW-MN-11` | 30 khung mui cong uốn thanh tre buộc dây mây/sắt nâng mái tôn – bạt che khoang sinh hoạt gia đình thương hồ | `G-INST` + `T-NRM` | Khoang `3.2×2.0m` | 30 | 2 400 | `woodParts` |
| Chỉ viền sơn màu & đường nẹp mạn ghe bầu Nam Bộ | `HV-D06` | 30 cặp dải sơn chỉ trắng–xanh–đỏ uốn lượn nhẹ theo dáng sống mạn ghe bầu từ mũi về lái | `T-ATLAS` + `T-NRM` | Dài `9–12m` | 30 | 0 | `woodParts` |
| Phên cót che sườn khoang & nia tre lót nông sản | `HV-G03` | Phên cót ép nan tre đan lóng mốt chắn nắng hai bên mui ghe và lót sàn khoang chứa trái cây | `T-NRM` + `S-SHD` | `2.4×0.9m` | 30 | 0 | `woodParts` |
| Số đăng ký ghe thương hồ Cần Thơ (`CT-...`) | `HV-I04` | 30 mã số sơn trắng trên nền đỏ/xanh ở hai má mũi ghe (`"CT-04821"`, `"AG-11904"`, `"VL-08235"`…) | `T-ATLAS` | `0.8×0.22m` | 30 | 0 | `whiteParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-D06, HV-G03, HV-I04` | — | — | — | **2 400** | — |

**LOD/ghi chú QC:** L0 giữ 30 khung mui `HV-NEW-MN-11` qua 1 `InstancedMesh` duy nhất; L1 giản lược khung mui ghe ở cự ly > 40m. QC đối chiếu dáng bầu rỗng lòng và độ cong mũi vểnh chuẩn ghe thương hồ ảnh `64`.

#### `MN-064` — Mắt Thuyền Nam Bộ vẽ tròng trắng — đen — đỏ (ảnh ref: `64`, `33`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 30 cặp mắt thuyền Nam Bộ (60 mắt trên đội ghe chính) | `HV-NEW-MN-01` | 60 mắt thuyền hình bán nguyệt/hạnh nhân vẽ đối xứng 2 bên mũi ghe bầu: tròng đen nhìn hơi chếch xuống mặt sông (trấn thủy quái & dò luồng), lòng trắng sáng, viền mi đỏ son – vàng nổi nẹp `1.2cm` | `T-ATLAS` + `G-EXT` | `0.38×0.20m` | 60 | 5 400 | `crimsonParts` |
| Hoa văn mũi thuyền chạm chữ *Phúc* / *Lộc* hoặc vòng âm dương nhỏ | `HV-D02` | 10 tấm phù hiệu gỗ tròn nhỏ Ø `18cm` chạm chữ Thọ/Phúc sơn son thếp vàng gắn đỉnh sống mũi 10 chiếc ghe lớn nhất | `G-EXT` | Ø `0.18m` | 10 | 1 400 | `goldParts` |
| Băng sóng nước vẽ chân mũi ghe | `HV-D06` | Dải họa tiết sóng cuộn xanh – trắng sơn sát mớn nước mũi của 30 chiếc ghe | `T-ATLAS` | Dài `1.6m` | 30 | 0 | `whiteParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-01, HV-D02, HV-D06` | — | — | — | **6 800** | — |

**LOD/ghi chú QC:** L0 giữ 60 viền mắt nổi `HV-NEW-MN-01` và 10 phù hiệu mũi `HV-D02`; L1 chuyển toàn bộ 60 mắt sang `T-ATLAS` phẳng trên ván mũi (giảm 5.4k tri). QC kiểm tra độ tương phản 3 màu trắng–đen–đỏ sắc nét ở ảnh `64`.

#### `MN-065` — 30 Cây Bẹo Treo 6 Loại Nông Sản (ảnh ref: `99`, `64`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 30 khớp buộc lạt mây & dây treo nông sản trên sào tre | `HV-NEW-MN-11` | 30 đầu cây bẹo cao `3.5–4.8m` cắm nghiêng 15° mũi ghe, có nút buộc dây mây/lạt tre hình chữ thập treo dưa hấu, khóm, bí đỏ, bắp cải, dừa, chuối | `G-INST` + `T-NRM` | Cao `3.5–4.8m` | 30 | 2 400 | `woodParts` |
| Rọ tre nhỏ đan mắt thưa đựng khoai lang / củ sắn treo bẹo | `HV-G03` | 12 rọ tre đan mắt cáo treo xen kẽ dưới chùm khóm – dưa hấu trên các cây bẹo đại diện | `T-NRM` + `S-SHD` | Ø `0.28m` | 12 | 0 | `woodParts` |
| Thẻ gỗ/bìa ghi giá sỉ & tên mặt hàng gắn gốc cây bẹo | `HV-I04` | 10 bảng viết tay mộc mạc `"DƯA HẤU LONG AN"`, `"KHÓM CẦU ĐÚC"`, `"BÍ ĐỎ CẦN THƠ"` buộc chân cây bẹo | `T-ATLAS` | `0.45×0.25m` | 10 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-G03, HV-I04` | — | — | — | **2 400** | — |

**LOD/ghi chú QC:** L0 giữ 30 khớp buộc bẹo `HV-NEW-MN-11` và đủ 6 loại nông sản dễ nhận diện từ xa; L1 bỏ nút buộc giữ silhouette cây bẹo + trái treo. QC đối chiếu mật độ cây bẹo cao vút trên ảnh `99`.

#### `MN-066` — Xuồng Ba Lá Bán Hủ Tiếu & Cà Phê Sáng (ảnh ref: `33`, `64`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mũi 6 xuồng ba lá gắn mắt thuyền nhỏ | `HV-NEW-MN-01` | 12 mắt thuyền nhỏ vẽ đơn giản trắng–đen–đỏ đối xứng 2 bên mũi xuồng ba lá gỗ sao | `T-ATLAS` + `G-EXT` | `0.22×0.12m` | 12 | 1 080 | `crimsonParts` |
| Bảng menu viết tay gắn tủ kính hủ tiếu trên xuồng | `HV-I04` | 6 tấm decal chữ đỏ – vàng trên tủ kính nhỏ `"HỦ TIẾU NAM VANG — BÚN RIÊU — CÀ PHÊ SỮA ĐÁ"` | `T-ATLAS` | `0.65×0.45m` | 6 | 0 | `whiteParts` |
| Nón lá người bán, rổ rau giá & vỉ tre lót sàn xuồng | `HV-G03` | 12 vỉ tre lót lòng xuồng tránh nước và 6 nón lá chằm chỉ gân tre đặc trưng Nam Bộ | `T-NRM` + `S-SHD` | Vỉ `1.2×0.6m` | 12 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-01, HV-I04, HV-G03` | — | — | — | **1 080** | — |

**LOD/ghi chú QC:** L0 giữ 12 mắt xuồng `HV-NEW-MN-01` và tủ kính chữ rõ `HV-I04`; L1 chuyển mắt xuồng sang `T-ATLAS`. QC kiểm tra nồi nước lèo inox bốc hơi nổi bật ở giữa xuồng.

#### `MN-067` — Máy Đuôi Tôm Chân Vịt Inox (ảnh ref: `64`, `33`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cụm khớp giá xoay đuôi tôm & chụp bảo vệ dây cu-roa | `HV-D14` | 24 bu-lông/đinh tán giữ nắp máy và khung xoay gắn mạn lái trên 12 bộ máy đuôi tôm | `G-INST` | Ø `2cm` | 24 | 576 | `ironParts` |
| Cánh chân vịt inox 2–3 lá xoắn thủy động lực | `HV-C14` | 12 chân vịt đúc dáng cánh hoa xoay đối xứng (đường kính `22–28cm`) gắn cuối trục inox dài `2.4m` | `G-EXT` | Ø `0.26m` | 12 | 576 | `ironParts` |
| Tem hãng máy động cơ xăng & vạch cảnh báo an toàn | `HV-I04` | Nhãn kim loại trên bình xăng đỏ/trắng của động cơ máy đuôi tôm thương hồ | `T-ATLAS` | `0.25×0.1m` | 12 | 0 | `crimsonParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D14, HV-C14, HV-I04` | — | — | — | **1 152** | — |

**LOD/ghi chú QC:** L0 giữ 12 chân vịt `HV-C14` (instanced) và bu-lông `HV-D14`; L1 ẩn bu-lông, giữ ống trục inox + vệt bọt sóng sau lái.

#### `MN-068` — Nhà Sàn Gỗ Ven Sông Cần Thơ (ảnh ref: `33`, `99`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vách lá dừa nước & phên cót đan dọc bờ sông | `HV-G03` | Phên nứa đan xương cá ốp xen kẽ ván gỗ tạp trên 10 căn nhà sàn cọc tràm ven rạch Cái Răng | `T-NRM` + `S-SHD` | Toàn vách `6×2.6m`/căn | 10 | 0 | `woodParts` |
| Cửa sổ chớp gỗ Nam Bộ sơn xanh da trời / xanh lá phai màu | `HV-H05` | 20 cánh cửa chớp gỗ lá sách 18 lá nghiêng 30° mở hướng ra sông đón gió | `G-INST` | `0.55×1.2m` | 20 | 2 400 | `woodParts` |
| Lan can gỗ con tiện mộc ở sàn hiên sau nhà | `HV-D10` | 36 con tiện gỗ tiện đơn giản đỡ tay vịn ban công gỗ nhìn xuống bến nước | `G-LATHE` + `G-INST` | Cao `0.75m` | 36 | 2 016 | `woodParts` |
| Khung giàn kèo tre buộc mây chống mái hiên | `HV-NEW-MN-11` | 10 cụm thanh chống mái hiên buộc dây mây mộc mạc treo chậu hoa mười giờ | `G-INST` + `T-NRM` | `1.8×1.0m` | 10 | 800 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-G03, HV-H05, HV-D10, HV-NEW-MN-11` | — | — | — | **5 216** | — |

**LOD/ghi chú QC:** L0 giữ 20 cửa chớp `HV-H05` và 36 con tiện `HV-D10`; L1 chuyển cả cửa chớp và con tiện sang `T-NRM`/alpha card. QC kiểm tra cọc tràm đóng ngập nước phù sa có vệt ẩm đổi màu chân cọc.

#### `MN-069` — Bến Ninh Kiều & Cầu Tàu Đón Khách (ảnh ref: `33`, `64`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cổng chào cầu tàu gắn biển hiệu lớn | `HV-I04` | Biển chữ nổi sơn xanh – vàng `"BẾN NINH KIỀU — CHỢ NỔI CÁI RĂNG"` vắt ngang mái vòm cầu tàu đón khách | `T-ATLAS` + `G-EXT` | `5.2×0.85m` | 2 | 240 | `goldParts` |
| Lan can sắt cầu tàu uốn họa tiết sóng nước Sông Hậu | `HV-D06` | 18 nhịp lan can sắt sơn xanh rêu uốn băng sóng nước 2 lớp nối trụ bê tông dọc cầu tàu dài `28m`, nổi `2.5cm` | `G-EXT` | Nhịp `1.6×0.9m` | 18 | 1 620 | `ironParts` |
| Mái nhà chờ cầu tàu chạm hoa văn hoa thị đầu hồi | `HV-C14` | 4 mặt hoa thị 8 cánh cắt sắt trang trí 2 đầu hồi mái che bến tàu du lịch | `G-EXT` | Ø `0.55m` | 4 | 192 | `ironParts` |
| Nền bến lát gạch terrazzo hoa văn Nam Bộ | `HV-H07` | Gạch hoa văn sao 4 cánh xám – đỏ đô lát toàn bộ sân đón khách dọc bờ kè Ninh Kiều | `T-ATLAS` | Viên `0.3×0.3m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I04, HV-D06, HV-C14, HV-H07` | — | — | — | **2 052** | — |

**LOD/ghi chú QC:** L0 giữ 18 nhịp lan can sóng `HV-D06` và biển cổng `HV-I04`; L1 chuyển lan can sóng sang alpha cutout + `T-NRM`.

#### `MN-070` — Xưởng Hủ Tiếu Truyền Thống Ven Bờ (ảnh ref: `33`, `99`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 16 vỉ phên tre đan mắt cáo phơi bánh tráng hủ tiếu trắng | `HV-G03` | 16 tấm vỉ đan nan tre tinh xảo (`1.8×0.8m`) xếp nghiêng 25° phơi bánh hủ tiếu trắng muốt phơi nắng dọc bờ sông | `T-NRM` + `S-SHD` | `1.8×0.8m` | 16 | 0 | `woodParts` |
| Giàn khung tre buộc lạt mây đỡ dãy vỉ phơi bánh | `HV-NEW-MN-11` | 16 giá chữ X làm từ thân tre buộc nút lạt mây dọc sân phơi dài `22m` | `G-INST` + `T-NRM` | `1.6×1.0m` | 16 | 1 280 | `woodParts` |
| Biển gỗ truyền thống làng nghề hủ tiếu Cần Thơ | `HV-I04` | Biển hiệu vẽ tay mộc `"LÒ HỦ TIẾU TRUYỀN THỐNG SÁU HOÀI — CÁI RĂNG"` treo mái hiên lò tráng bánh | `T-ATLAS` | `2.4×0.55m` | 1 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-G03, HV-NEW-MN-11, HV-I04` | — | — | — | **1 280** | — |

**LOD/ghi chú QC:** L0 giữ 16 giá tre `HV-NEW-MN-11` và texture nan vỉ phơi `HV-G03`; L1 giảm nút buộc mây sang `T-NRM`.

#### `MN-071` — Cầu Cái Răng bắc ngang sông (ảnh ref: `33`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Lan can thép 2 bên thành cầu nhịp chính | `HV-H09` | 64 module song sắt đứng kết hợp tay vịn hộp thép sơn xanh xám dọc 2 thành cầu dài `96m` | `G-INST` | Cao `1.1m` | 64 | 3 840 | `ironParts` |
| Dầm biên & gờ phào bê tông trụ cầu trên sông | `HV-H04` | Gờ chỉ bê tông chạy suốt 2 dầm biên và mũ 4 trụ cầu bê tông cốt thép nhô `10cm` | `G-EXT` | Dài `64m` | 32 | 1 280 | `stoneParts` |
| Biển tên cầu & vạch báo tĩnh không thông thuyền dưới gầm cầu | `HV-I04` | Biển `"CẦU CÁI RĂNG"` đầu cầu và bảng tĩnh không đường thủy nội địa màu vàng-đen treo giữa gầm nhịp chính | `T-ATLAS` | `1.8×0.5m` | 4 | 0 | `whiteParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H09, HV-H04, HV-I04` | — | — | — | **5 120** | — |

**LOD/ghi chú QC:** L0 giữ 64 module lan can `HV-H09` (instanced); L1 thay lan can bằng alpha strip, giữ dầm cầu và bảng tĩnh không `HV-I04`.

#### `MN-072` — Thảm Lục Bình Trôi Sông & Rặng Dừa Nước (ảnh ref: `33`, `64`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 40 cụm lá lục bình bầu phồng & hoa tím nhạt trôi sông | `HV-C06` | Biến thể lá tròn mặt nước xanh bóng ghép thành cụm lục bình nổi trôi theo dòng phù sa nâu đỏ | `G-EXT` | Ø `0.25–0.45m` | 40 | 1 280 | `woodParts` |
| 16 cụm lá sen/súng ven rạch nhỏ đổ ra sông Cần Thơ | `HV-C05` | Lá tròn gợn mép mọc lẫn ven chân rặng dừa nước 2 bờ rạch | `G-DISP` | Ø `0.35–0.55m` | 16 | 1 024 | `woodParts` |
| Dải bóng sóng phù sa & vệt dòng chảy quanh cụm lục bình | `HV-D06` | Hiệu ứng gợn sóng quanh cụm lục bình trôi sông (tích hợp trên shader mặt nước phù sa) | `S-SHD` | Vùng mặt nước | 1 | 0 | `marbleParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C06, HV-C05, HV-D06` | — | — | — | **2 304** | — |

**LOD/ghi chú QC:** L0 giữ 40 cụm lục bình `HV-C06` và 16 lá ven bờ `HV-C05`; L1 chuyển cụm lục bình nhỏ thành instanced billboard cross-plane.

#### `MN-073` — Sà Lan Chở Lúa & Cát Miền Tây (ảnh ref: `33`, `64`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 cặp mắt thuyền vẽ lớn 2 bên mũi sà lan sắt | `HV-NEW-MN-01` | 4 mắt thuyền lớn sơn trắng–đen–đỏ nổi bật trên nền thân sắt xanh dương – đỏ gạch mũi sà lan dài `26m` | `T-ATLAS` + `G-EXT` | `0.65×0.32m` | 4 | 360 | `crimsonParts` |
| Đường đinh tán & mối hàn tôn thép dọc mạn sà lan | `HV-D14` | 32 đinh tán/chốt neo mạn thép nổi `1.5cm` dọc thành hầm chở lúa – cát | `G-INST` | Ø `3.5cm` | 32 | 768 | `ironParts` |
| Số đăng kiểm đường thủy nội địa & vạch mớn nước | `HV-I04` | Dãy chữ số trắng `"SG-6842"`, `"CT-09128"` và thước vạch mớn nước sơn mũi – lái sà lan | `T-ATLAS` | `1.4×0.35m` | 4 | 0 | `whiteParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-01, HV-D14, HV-I04` | — | — | — | **1 128** | — |

**LOD/ghi chú QC:** L0 giữ 4 mắt sà lan `HV-NEW-MN-01` và chốt mạn `HV-D14`; L1 bake đinh tán sang `T-NRM`.

#### `MN-074` — Đèn Dầu & Đèn Điện Ắc-Quy trên Ghe (ảnh ref: `33`, `64`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 16 chụp đèn bão dầu hỏa & chao đèn ắc-quy treo mui ghe | `HV-H10` | 8 cụm đôi đèn bão khung dây thép uốn và chao sắt tráng men treo trước mũi ghe thương hồ lúc rạng sáng 4h–5h | `G-INST` | Cao `0.32m`, Ø `0.18m` | 8 | 4 800 | `goldParts` |
| Quai tre uốn cong móc treo đèn trước mũi ghe | `HV-NEW-MN-11` | 16 cần tre ngắn buộc dây mây treo đèn dầu vươn trước mui ghe không chạm bạt | `G-INST` + `T-NRM` | Dài `0.85m` | 16 | 1 280 | `woodParts` |
| Nắp thông gió đỉnh đèn bão dập lỗ hoa thị | `HV-C14` | 16 chóp đèn dập 6 lỗ thoát nhiệt hình cánh hoa thị nhỏ | `G-EXT` | Ø `0.10m` | 16 | 768 | `ironParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H10, HV-NEW-MN-11, HV-C14` | — | — | — | **6 848** | — |

**LOD/ghi chú QC:** L0 giữ 8 cụm đèn bão `HV-H10` và 16 cần treo `HV-NEW-MN-11`; L1 hạ đèn xuống điểm sáng emissive + halo sprite ở chế độ bình minh/đêm.

---

## 3.7. Rừng Tràm Trà Sư — An Giang (`MN-075` → `MN-082`)

> **Bối cảnh mỹ thuật**: Sinh thái ngập nước đặc trưng vùng Tứ giác Long Xuyên (An Giang) kết hợp **kiến trúc tre dân gian Tây Nam Bộ** (Cầu Tre Vạn Bước dài nhất Việt Nam, chòi mái lá dừa nước, xuồng ba lá, hoa sen — hoa súng mùa nước nổi). Họa tiết hoàn toàn thuần mộc, thân thiện sinh thái (nan tre đan, nút buộc mây, lá sen/súng).

#### `MN-075` — Cầu Tre Vạn Bước Dài `92m` xuyên rừng tràm (ảnh ref: `100`, `34`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Hệ lan can tre uốn chéo hình quả trám & nút buộc mây dọc `92m` | `HV-NEW-MN-11` | 60 nhịp lan can tre mộc dài `1.5m`/nhịp, nan tre bắt chéo chữ X buộc chặt bằng dây mây chữ thập, uốn lượn mềm mại xuyên dưới tán tràm | `G-INST` + `T-NRM` | Nhịp `1.5×1.0m` | 60 | 4 800 | `woodParts` |
| 3 chòi nghỉ mái lá dừa nước & trần đan phên nứa | `HV-G03` | 3 chòi lục giác dọc cầu tre lợp lá dừa nước xẻ rãnh, trần ốp phên nứa đan lóng mốt chữ nhân | `T-NRM` + `S-SHD` | Ø `4.2m`/chòi | 3 | 0 | `woodParts` |
| Chóp nóc 3 chòi nghỉ gắn búp sen tre đan cách điệu | `HV-C03` | 3 chóp trang trí hình búp sen đan nan tre trên đỉnh mái lá 3 chòi dừng chân | `G-LATHE` | Cao `0.55m` | 3 | 540 | `woodParts` |
| Biển gỗ kỷ lục `"CẦU TRE VẠN BƯỚC — RỪNG TRÀM TRÀ SƯ"` | `HV-I04` | Bảng gỗ khắc chữ đốt lửa mộc mạc treo cổng đầu cầu tre | `T-ATLAS` | `2.4×0.55m` | 2 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-G03, HV-C03, HV-I04` | — | — | — | **5 340** | — |

**LOD/ghi chú QC:** L0 giữ 60 nhịp lan can tre quả trám `HV-NEW-MN-11` (dùng 1 `InstancedMesh`); L1 thay các thanh đan chéo bằng alpha plane + `T-NRM`, giữ sàn cầu và 3 chòi mái lá. QC đối chiếu nhịp uốn lượn cầu tre với ảnh `100`.

#### `MN-076` — Đài Quan Sát Chim Cao `23m` (ảnh ref: `34`, `100`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 tầng lan can khung thép – gỗ ốp thanh đứng | `HV-H09` | 48 module song lan can thép sơn xanh rêu bảo vệ 4 sàn quan sát và cầu thang xoắn lên đỉnh `23m` | `G-INST` | Cao `1.1m` | 48 | 2 880 | `ironParts` |
| Nút giằng chéo kết cấu tháp thép 4 tầng | `HV-NEW-MN-10` | 16 nút liên kết bản mã có bu-lông tại 4 góc của 4 tầng đài quan sát | `G-INST` + `G-LATHE` | Nút `0.6×0.6m` | 16 | 5 120 | `ironParts` |
| Mái chòi đỉnh đài & vách chắn gió ốp nan tre | `HV-G03` | Tấm phên tre chống nắng gắn dưới mái chóp tầng đỉnh nhìn toàn cảnh rừng tràm | `T-NRM` + `S-SHD` | Chu vi `16m` | 1 | 0 | `woodParts` |
| Biển thông tin các loài chim quý (`Giang Sen`, `Điêng Điểng`) | `HV-I04` | 4 bảng minh họa nhận diện các loài chim nước Trà Sư gắn quanh lan can tầng đỉnh | `T-ATLAS` | `0.85×0.45m` | 4 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H09, HV-NEW-MN-10, HV-G03, HV-I04` | — | — | — | **8 000** | — |

**LOD/ghi chú QC:** L0 giữ 48 lan can `HV-H09` và 16 nút giằng `HV-NEW-MN-10`; L1 giản lược nút bản mã và chuyển lan can sang alpha strip. QC xác nhận đài cao `23m` vươn hẳn trên tán rừng tràm `12–15m`.

#### `MN-077` — Thảm Bèo Tấm Xanh Mướt Phủ Kín Kênh Rạch (ảnh ref: `34`, `100`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cụm lá súng khuyết V nổi xen giữa thảm bèo cám | `HV-C06` | 36 lá súng xanh đậm có khe chữ V đặc trưng nằm rải rác hai mép kênh rạch phủ kín bèo tấm | `G-EXT` | Ø `0.22–0.40m` | 36 | 1 152 | `woodParts` |
| 12 lá sen khum lòng chảo tại các vũng nước thoáng | `HV-C05` | Lá sen tròn mép gợn sóng nhô cao `15–25cm` trên nền thảm bèo tấm xanh non | `G-DISP` | Ø `0.45–0.65m` | 12 | 768 | `woodParts` |
| Hiệu ứng rẽ sóng vệt nước đen trên mặt bèo tấm | `HV-D06` | Shader tách lớp thảm bèo xanh mướt để lộ đường rãnh nước phèn màu nâu đen phía sau mũi xuồng | `S-SHD` | Mặt kênh `120×14m` | 1 | 0 | `marbleParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C06, HV-C05, HV-D06` | — | — | — | **1 920** | — |

**LOD/ghi chú QC:** L0 giữ 36 lá súng `HV-C06` (lá xanh riêng, không trộn màu bèo) và 12 lá sen `HV-C05`; L1 chuyển lá súng thành decal trên shader mặt bèo. QC kiểm tra đúng màu xanh mướt đồng nhất của thảm bèo tấm ảnh `34`.

#### `MN-078` — Đội Xuồng Ba Lá Chèo Tay & Tắc Ráng (ảnh ref: `34`, `100`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 8 cặp mắt xuồng nhỏ trên đội xuồng ba lá & tắc ráng du lịch | `HV-NEW-MN-01` | 16 mắt thuyền nhỏ vẽ gọn sắc nét trắng–đen–đỏ ở 2 má mũi nhọn của xuồng ba lá gỗ sao & vỏ lãi tắc ráng | `T-ATLAS` + `G-EXT` | `0.22×0.11m` | 16 | 1 440 | `crimsonParts` |
| Vỉ tre lót sàn xuồng & nón lá cô lái đò áo bà ba | `HV-G03` | 16 tấm vỉ nan tre lót đáy xuồng và 8 nón lá chằm chỉ gân tre rõ nét | `T-NRM` + `S-SHD` | Vỉ `1.1×0.55m` | 16 | 0 | `woodParts` |
| Số hiệu quản lý xuồng du lịch sinh thái Trà Sư | `HV-I04` | Mã số `"TS-01"` .. `"TS-08"` sơn trắng trên băng gỗ mạn xuồng | `T-ATLAS` | `0.4×0.15m` | 8 | 0 | `whiteParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-01, HV-G03, HV-I04` | — | — | — | **1 440** | — |

**LOD/ghi chú QC:** L0 giữ 16 mắt xuồng `HV-NEW-MN-01`; L1 chuyển sang `T-ATLAS`. QC kiểm tra xuồng lướt sát mặt bèo không nổi hở khỏi nước.

#### `MN-079` — Rừng Tràm Cổ Thụ Thân Trắng (ảnh ref: `34`, `100`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cụm lá sen & lá súng bám quanh gốc tràm ngâm nước phèn | `HV-C06` | 32 lá súng khe chữ V mọc ôm quanh chân gốc tràm trắng ngâm nước tạo chuyển tiếp sinh thái tự nhiên | `G-EXT` | Ø `0.25–0.38m` | 32 | 1 024 | `woodParts` |
| Họa tiết vỏ tràm bong nhiều lớp trắng xốp | `HV-G03` | Kết cấu sớ vỏ bong dọc phân lớp (normal + roughness map cao) đặc trưng cây tràm *Melaleuca cajuputi* | `T-NRM` + `S-SHD` | Thân cao `10–15m` | 1 | 0 | `whiteParts` |
| 6 biển gỗ đánh dấu khu vực sinh thái rừng tràm lõi | `HV-I04` | Bảng gỗ nhỏ `"KHU BẢO TỒN SINH THÁI RỪNG TRÀM TRÀ SƯ"` gắn trên cọc gỗ bên kênh | `T-ATLAS` | `0.65×0.35m` | 6 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C06, HV-G03, HV-I04` | — | — | — | **1 024** | — |

**LOD/ghi chú QC:** L0 giữ 32 lá súng chân gốc `HV-C06` và normal map vỏ tràm bong trắng; L1 giản lược lá súng mặt nước.

#### `MN-080` — Đàn Cò Trắng, Diệc & Vạc đậu ngọn tràm (ảnh ref: `34`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 tổ chim cò – vạc đan cành tràm khô trên ngọn cây | `HV-NEW-MN-11` | 6 tổ chim đan nhánh cành khô dạng rổ trũng đặt trên chạc ba tán tràm cao `11–13m` | `G-INST` + `T-NRM` | Ø `0.65m` | 6 | 480 | `woodParts` |
| Hoa văn tán cánh lông chim dạng đối xứng trên đàn cò lượn | `HV-B01` | Biến thể cấu trúc lớp lông cánh xòe nhẹ (4 lớp đơn giản hóa, không mào phượng) cho 4 cá thể cò trắng sải cánh bay cận cảnh trên kênh | `G-EXT` | Sải cánh `1.1m` | 2 | 1 800 | `whiteParts` |
| Biển nhắc nhở giữ yên lặng vùng chim làm tổ | `HV-I04` | 2 bảng gỗ mộc `"KHU VỰC CHIM LÀM TỔ — XIN GIỮ YÊN LẶNG"` dọc tuyến kênh lõi | `T-ATLAS` | `0.6×0.35m` | 2 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-B01, HV-I04` | — | — | — | **2 280** | — |

**LOD/ghi chú QC:** L0 giữ 6 tổ chim `HV-NEW-MN-11` và 2 cặp chim cận cảnh; L1 chuyển toàn bộ đàn chim đậu/bay sang instanced low-poly (< 80 tri/con).

#### `MN-081` — Cổng Chào Tre & Nhà Hàng Làng Quê Nam Bộ (ảnh ref: `34`, `100`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cổng chào vòm tre uốn cong đan mắt cáo & buộc nút mây | `HV-NEW-MN-11` | 22 module vòm tre cong đan hình quả trám buộc mây nối 2 trụ cổng lớn và khung nhà hàng làng quê mái lá | `G-INST` + `T-NRM` | Cổng `8.5×5.2m` | 22 | 1 760 | `woodParts` |
| Mái lá dừa nước & vách phên nứa đan hoa văn chữ nhân | `HV-G03` | Phên nứa đan lóng mốt chắn nắng hai đầu hồi nhà hàng và lót mặt bàn tre thưởng thức cá lóc nướng | `T-NRM` + `S-SHD` | `14×8m` | 1 | 0 | `woodParts` |
| Ao súng hồng – tím bên cầu khỉ dẫn vào nhà hàng | `HV-C06` | 24 lá súng khuyết V nổi quanh cầu khỉ tre kèm 3 cụm hoa sen nở `HV-C04` điểm xuyết | `G-EXT` | Ø `0.3m` | 24 | 768 | `woodParts` |
| 3 bông sen nở hồng tươi ven cầu khỉ | `HV-C04` | 3 bông sen 24 cánh nhị vàng nở rộ bên chân cầu khỉ đón khách | `G-INST` + `G-LATHE` | Ø `0.26m` | 3 | 3 600 | `crimsonParts` |
| Biển cổng chào chữ Quốc ngữ bằng thanh tre uốn | `HV-I04` | Dòng chữ `"KHU DU LỊCH SINH THÁI RỪNG TRÀM TRÀ SƯ"` gắn trên vòm cổng tre chính | `T-ATLAS` | `4.8×0.7m` | 1 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-G03, HV-C06, HV-C04, HV-I04` | — | — | — | **6 128** | — |

**LOD/ghi chú QC:** L0 giữ 22 module cổng tre `HV-NEW-MN-11` và 3 bông sen `HV-C04`; L1 giảm cánh sen còn 8 cánh và thay nan đan cổng bằng alpha cutout + `T-NRM`.

#### `MN-082` — Tổ Ong Mật Rừng Tràm & Gác Kèo Ong (ảnh ref: `34`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 kèo gỗ tràm gác nghiêng buộc lạt mây & cọc đỡ | `HV-NEW-MN-11` | 4 bộ kèo ong mật truyền thống U Minh – Trà Sư gác nghiêng 30° trên 2 cọc chống chữ Y buộc dây rừng | `G-INST` + `T-NRM` | Dài `2.2m` | 4 | 320 | `woodParts` |
| Mặt tàng ong mật rủ xuống có ô lỗ lục giác | `HV-C13` | Họa tiết lỗ tổ ong lục giác nhỏ mịn (bake normal map trên khối tàng ong vàng nâu rủ dài `0.85m`) | `T-NRM` | Tàng `0.85×0.45m` | 4 | 0 | `goldParts` |
| Biển giới thiệu nghề gác kèo ong mật rừng tràm | `HV-I04` | Bảng gỗ mộc `"NGHỀ GÁC KÈO ONG MẬT RỪNG TRÀM AN GIANG"` cắm bên đường gỗ | `T-ATLAS` | `0.75×0.45m` | 1 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-11, HV-C13, HV-I04` | — | — | — | **320** | — |

**LOD/ghi chú QC:** L0 giữ 4 bộ gác kèo `HV-NEW-MN-11` và normal map lỗ tổ ong `HV-C13`; L1 ẩn nút buộc dây rừng.

---

## 3.8. Đất Mũi Cà Mau (`MN-083` → `MN-090`)

> **Bối cảnh mỹ thuật**: Vùng đất cực Nam Tổ Quốc nơi hội tụ điêu khắc biểu tượng hiện đại (Con Tàu Mũi Cà Mau, Mốc GPS 0001, Cua Cà Mau), phiên bản tái hiện **Cột Cờ Hà Nội thời Nguyễn 1812** bằng gạch đá, tín ngưỡng nguồn cội **Đền Thờ Lạc Long Quân — Mẹ Âu Cơ** mang hoa văn **Đông Sơn** (sao 14 cánh, chim Lạc, vòng tròn tiếp tuyến) và hệ sinh thái rừng đước lấn biển.

#### `MN-083` — Biểu Tượng Con Tàu Mũi Cà Mau trắng (ảnh ref: `101`, `35`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt cánh buồm bê tông cong khắc chữ tọa độ | `HV-I04` | Dòng chữ nổi xanh dương đậm trên nền cánh buồm trắng `"MŨI CÀ MAU — 8°37'30"N 104°43'E"` cùng Quốc huy/ngôi sao nổi `3cm` | `T-ATLAS` + `G-EXT` | Cao `11m`, chữ cao `0.65m` | 1 | 260 | `whiteParts` |
| Bệ sóng nước điêu khắc nâng thân mũi tàu hướng Biển Đông | `HV-D06` | 3 tầng sóng bê tông uốn cuộn đầu nhọn cao `0.8–1.4m` ôm quanh chân con tàu dài `18m`, chiều sâu nổi `18cm` | `G-EXT` | Dài `26m`, cao `1.2m` | 26 | 2 340 | `whiteParts` |
| Lan can bảo vệ mũi tàu & bệ đài chụp ảnh | `HV-H09` | 28 trụ inox nối thanh ngang bo cong theo đường mũi tàu tạo sân đứng cho du khách | `G-INST` | Cao `1.0m` | 28 | 1 680 | `ironParts` |
| Huy hiệu ngôi sao vàng 5 cánh gắn mũi tàu | `HV-NEW-MN-12` | Ngôi sao vàng 5 cánh vát 5 múi nổi `5cm` gắn chính giữa sống mũi tàu màu trắng | `G-EXT` | Ø `0.85m` | 1 | 120 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I04, HV-D06, HV-H09, HV-NEW-MN-12` | — | — | — | **4 400** | — |

**LOD/ghi chú QC:** L0 giữ cánh buồm khắc tọa độ `HV-I04`, 3 tầng sóng `HV-D06` và ngôi sao `HV-NEW-MN-12`; L1 giảm phân đoạn uốn sóng 40% và chuyển lan can `HV-H09` sang thanh đơn. QC kiểm tra đúng chính xác tọa độ `"8°37'30"N 104°43'E"` theo ảnh `101`.

#### `MN-084` — Mốc Tọa Độ Quốc Gia GPS 0001 (ảnh ref: `35`, `101`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đỉnh khối đá granit hình ngôi sao 4 cánh & trục tim mốc đồng | `HV-NEW-MN-12` | Khối đá granit xám vát hình ngôi sao 4 cánh định hướng Đông–Tây–Nam–Bắc đặt trên bệ tròn 3 bậc, tâm gắn nút đồng tròn khắc chữ `"GPS 0001"` nổi `2cm` | `G-EXT` + `T-ATLAS` | Cao `2.2m`, rộng `1.8m` | 4 | 480 | `stoneParts` |
| Biển điểm cuối Đường Hồ Chí Minh `"KM 2436"` | `HV-I04` | Bia đá granit đen khắc chữ vàng `"ĐIỂM CUỐI ĐƯỜNG HỒ CHÍ MINH — KM 2436"` & bảng `"MỐC TỌA ĐỘ QUỐC GIA GPS 0001"` | `T-ATLAS` | `1.5×0.9m` | 2 | 0 | `stoneParts` |
| Băng hồi văn đá viền cổ bệ tròn 3 bậc | `HV-D01` | Đường hồi văn khắc sâu `2cm` chạy quanh cổ bệ tròn Ø `4.8m` của đài mốc quốc gia | `G-EXT` | Chu vi `15m` | 15 | 900 | `stoneParts` |
| 16 cánh sen đá viền chân cột mốc trung tâm | `HV-C01` | Vòng 16 cánh sen điêu khắc nông `2cm` bao quanh chân đế trụ sao 4 cánh | `G-INST` | Cánh `0.18×0.14m` | 16 | 768 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-12, HV-I04, HV-D01, HV-C01` | — | — | — | **2 148** | — |

**LOD/ghi chú QC:** L0 giữ 4 cánh sao `HV-NEW-MN-12`, hồi văn `HV-D01` và 16 cánh sen `HV-C01`; L1 chuyển hồi văn và cánh sen sang `T-NRM`. QC xác nhận đọc rõ `"GPS 0001"` và `"KM 2436"`.

#### `MN-085` — Cột Cờ Hà Nội tại Mũi Cà Mau (`33m`) (ảnh ref: `35`, `101`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 36 ô cửa thông gió hình hoa thị trên thân tháp bát giác | `HV-C14` | 36 cửa thông gió đục thủng hình hoa thị 6–8 cánh phân đều 8 mặt thân tháp gạch cao `18m`, viền vát sâu `12cm` theo chuẩn Cột Cờ Hà Nội 1812 | `G-EXT` | Ø `0.45m` | 36 | 1 728 | `plasterParts` |
| 4 bức đại tự chữ Hán & Quốc ngữ tại 3 cửa đế thành | `HV-I01` | 3 cửa tầng đế gắn biển chữ Hán đắp nổi sâu `3cm`: cửa Đông `"迎旭"` (*Nghênh Húc*), cửa Tây `"迴光"` (*Hồi Quang*), cửa Nam `"向明"` (*Hướng Minh*) + biển `"CỘT CỜ HÀ NỘI TẠI MŨI CÀ MAU"` | `T-ATLAS` + `G-EXT` | `1.8×0.65m` | 4 | 880 | `plasterParts` |
| Góc tường 3 tầng đế ốp đá giật bậc (*quoin*) kiểu Vauban | `HV-H11` | 48 khối đá xanh xếp so le dài–ngắn gia cố 12 cạnh góc của 3 tầng đế hình chóp cụt, nổi `4cm` | `G-INST` + `T-NRM` | Khối `0.55×0.38m` | 48 | 1 152 | `stoneParts` |
| Lan can gạch hoa chanh 4 cánh bao quanh 3 tầng thành | `HV-C13` | 64 ô gạch gốm thông gió hoa chanh 4 cánh chạy dọc mặt trên thành tầng 1–2–3, sâu `10cm` | `G-EXT` | Ô `0.28×0.28m` | 64 | 2 304 | `plasterParts` |
| Tầng lầu bát giác đỉnh tháp & 8 vòm cửa cuốn | `HV-H03` | 8 vòm bán nguyệt nhỏ trên lầu vọng lâu bát giác nâng chân cột cờ thép đại kỳ cao `33m` | `G-TUBE` | Ø `1.2m` | 8 | 2 400 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C14, HV-I01, HV-H11, HV-C13, HV-H03` | — | — | — | **8 464** | — |

**LOD/ghi chú QC:** L0 giữ 36 ô hoa thị `HV-C14`, 64 ô hoa chanh `HV-C13`, 4 đại tự `HV-I01` và 8 vòm đỉnh `HV-H03`; L1 chuyển quoin `HV-H11` và hoa chanh sang `T-NRM`/alpha cutout. QC kiểm tra đúng 3 hướng chữ Hán (Đông *Nghênh Húc*, Tây *Hồi Quang*, Nam *Hướng Minh* — mặt Bắc kín không có cửa theo chuẩn nguyên bản Cột Cờ Hà Nội).

#### `MN-086` — Rừng Đước Cà Mau với Bộ Rễ Chống Đan Chéo (ảnh ref: `102`, `35`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 12 biển gỗ nhận diện sinh thái ngập mặn gắn bên gốc đước | `HV-I04` | 4 bảng thông tin khoa học `"CÂY ĐƯỚC ĐÔI — RHIZOPHORA APICULATA — RỪNG NGẬP MẶN MŨI CÀ MAU"` | `T-ATLAS` | `0.65×0.4m` | 4 | 0 | `woodParts` |
| Hệ cọc kè tre – cừ tràm gia cố bãi bồi chân rừng đước | `HV-NEW-MN-11` | 16 đoạn hàng rào cọc tràm buộc dây mây/thép chắn sóng giữ phù sa non ven mép bãi bồi | `G-INST` + `T-NRM` | Đoạn `2.0×1.1m` | 16 | 1 280 | `woodParts` |
| Vệt gợn sóng triều cường trên bãi bùn phù sa lấn biển | `HV-D06` | Họa tiết gợn sóng bùn cát hình lưỡi liềm (normal map + shader ướt bóng) quanh chân bộ rễ nơm đước | `S-SHD` + `T-NRM` | Bãi bồi `80×30m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I04, HV-NEW-MN-11, HV-D06` | — | — | — | **1 280** | — |

**LOD/ghi chú QC:** L0 giữ 16 đoạn kè tràm `HV-NEW-MN-11` và shader vệt sóng bùn ướt `HV-D06`; L1 giữ hình bóng rễ nơm dày đặc đặc trưng ảnh `102`.

#### `MN-087` — Cầu Gỗ Xuyên Rừng Đước & Chòi Ngắm Biển (ảnh ref: `102`, `35`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Lan can gỗ con tiện mộc dọc tuyến cầu gỗ xuyên rừng đước | `HV-D10` | 56 con tiện gỗ dầu vuông vát mép đơn giản nối tay vịn an toàn hai bên cầu gỗ dài `65m` | `G-LATHE` + `G-INST` | Cao `0.9m` | 56 | 3 136 | `woodParts` |
| Chòi ngắm biển mái lá dừa nước & trần đan phên nứa | `HV-G03` | Chòi gỗ lục giác cuối cầu lợp lá dừa nước xẻ rãnh, trần ốp phên nứa đan chữ nhân | `T-NRM` + `S-SHD` | Ø `5.0m` | 1 | 0 | `woodParts` |
| Thanh giằng chéo chữ X & nút buộc trang trí chòi gỗ | `HV-NEW-MN-11` | 12 nhịp thanh giằng chéo gỗ – tre buộc dây mây bao quanh lan can chòi ngắm biển | `G-INST` + `T-NRM` | Nhịp `1.4×0.9m` | 12 | 960 | `woodParts` |
| Biển chỉ hướng tuyến tham quan xuyên rừng ngập mặn | `HV-I04` | 3 cột biển gỗ `"LỐI ĐI RỪNG ĐƯỚC — CHÒI NGẮM ĐẢO HÒN KHOAI"` | `T-ATLAS` | `0.8×0.35m` | 3 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D10, HV-G03, HV-NEW-MN-11, HV-I04` | — | — | — | **4 096** | — |

**LOD/ghi chú QC:** L0 giữ 56 con tiện `HV-D10` và 12 nhịp giằng chòi `HV-NEW-MN-11`; L1 chuyển con tiện cầu sang thanh hộp phẳng + alpha.

#### `MN-088` — Biểu Tượng Cua Cà Mau Khổng Lồ (ảnh ref: `35`, `101`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bệ sóng biển nâng đỡ tượng Cua Cà Mau đỏ cam (`5×2.8×1.7m`) | `HV-D06` | Băng sóng nước 2 lớp cuộn tròn ôm quanh chân bệ tròn tượng cua biển khổng lồ, nổi sâu `10cm` | `G-EXT` | Chu vi `16m`, cao `0.45m` | 16 | 1 440 | `stoneParts` |
| 6 cụm hoa văn đắp nổi mai cua & gai viền vỏ cua | `HV-C14` | Các mấu gai viền mai 9 răng đối xứng và đường gân chữ H đặc trưng mai cua biển Cà Mau chạm nổi `3cm` | `G-EXT` + `T-NRM` | Mai `2.6×1.9m` | 12 | 576 | `crimsonParts` |
| Bảng tên biểu tượng `"CUA CÀ MAU"` bằng đá granit | `HV-I04` | Biển đá nghiêng khắc chữ vàng `"BIỂU TƯỢNG CUA CÀ MAU — ĐẶC SẢN VÙNG ĐẤT MŨI"` | `T-ATLAS` | `1.2×0.6m` | 1 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D06, HV-C14, HV-I04` | — | — | — | **2 016** | — |

**LOD/ghi chú QC:** L0 giữ bệ sóng `HV-D06` và gai viền mai cua `HV-C14`; L1 chuyển gân mai sang `T-NRM`, giữ màu đỏ cam bóng sáng đặc trưng tượng composite.

#### `MN-089` — Bờ Kè Chắn Sóng Bê Tông Lấn Biển (ảnh ref: `35`, `102`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Lan can thép & trụ kè dọc đường dạo ven biển Tây | `HV-H09` | 36 module song sắt mạ kẽm chống ăn mòn muối biển chạy dọc đỉnh kè chắn sóng dài `54m` | `G-INST` | Cao `1.05m` | 36 | 2 160 | `ironParts` |
| Phù điêu sóng nước đúc nổi mặt ngoài tường kè chắn sóng | `HV-D06` | Băng sóng cuộn đúc bê tông nổi `4cm` chạy dọc `30m` tường kè giáp quảng trường Đất Mũi | `G-EXT` | Dài `30m`, cao `0.35m` | 20 | 1 800 | `stoneParts` |
| Cọc đá mốc chỉ giới Biển Đông — Vịnh Thái Lan | `HV-I04` | 2 cột biển chỉ hướng `"BIỂN ĐÔNG (HƯỚNG MẶT TRỜI MỌC)"` và `"VỊNH THÁI LAN (HƯỚNG MẶT TRỜI LẶN)"` | `T-ATLAS` | `0.9×0.5m` | 2 | 0 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H09, HV-D06, HV-I04` | — | — | — | **3 960** | — |

**LOD/ghi chú QC:** L0 giữ 36 lan can `HV-H09` và băng sóng kè `HV-D06`; L1 chuyển băng sóng sang `T-NRM`.

#### `MN-090` — Đền Thờ Lạc Long Quân & Tượng Mẹ Âu Cơ (ảnh ref: `35`, `101`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Sân tế & phù điêu Mặt Trời Đông Sơn 14 cánh sau tượng | `HV-E01` | Đĩa phù điêu đồng/đá mặt trời 14 tia nhọn giữa các tia có họa tiết lông công đặt làm hậu cảnh sau tượng Đức Quốc Tổ Lạc Long Quân, sâu `5cm` | `G-DISP` | Ø `5.2m` | 1 | 800 | `bronzeParts` |
| Vành chim Lạc bay ngược chiều kim đồng hồ bao đĩa mặt trời | `HV-E02` | 18 con chim Lạc mỏ dài, cánh xòe, chân mảnh đúc nổi `3cm` bay vòng quanh đĩa trống đồng Đền Lạc Long Quân | `G-DISP`/`G-EXT` | Chim `0.45m` | 18 | 720 | `bronzeParts` |
| Vòng tròn tiếp tuyến & băng răng cưa Đông Sơn trên bệ tượng | `HV-E04` | 2 vành hoa văn vòng tròn có chấm nối tiếp tuyến và răng lược khắc quanh bệ đá tượng Mẹ Âu Cơ bồng con hướng Hòn Khoai | `G-DISP`/`T-NRM` | Băng cao `15cm` | 2 | 600 | `bronzeParts` |
| Bờ nóc Đền Lạc Long Quân chạm Lưỡng long chầu nhật & 4 đầu đao | `HV-A04` | Cặp rồng phong cách Việt cổ hóa mây chầu quả cầu lửa trên nóc Đền Thờ (kết hợp 4 đầu đao `HV-A06` góc mái) | `G-TUBE` + `G-LATHE` | Dài `4.0m`/rồng | 1 | 2 800 | `roofParts` |
| Hoành phi Đền thờ & đài sen chân tượng Mẹ Âu Cơ | `HV-C01` | 24 cánh sen đá granit xếp 2 tầng nâng bệ tượng Mẹ Âu Cơ + biển chữ `"ĐỀN THỜ LẠC LONG QUÂN"` (`HV-I01`) | `G-INST` | Cánh `0.28×0.2m` | 24 | 1 152 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-E01, HV-E02, HV-E04, HV-A04, HV-C01` | — | — | — | **6 072** | — |

**LOD/ghi chú QC:** L0 giữ đầy đủ tổ hợp Đông Sơn `HV-E01 + E02 + E04`, lưỡng long `HV-A04` và 24 cánh sen `HV-C01`; L1 bake vòng tròn tiếp tuyến `HV-E04` và chim Lạc `HV-E02` sang `T-NRM` giữ mặt trời 14 cánh nổi. QC xác nhận đúng hệ hoa văn Đông Sơn (KHÔNG dùng hoa văn Pháp hay Chăm) cho Đền Quốc Tổ.

---

## 3.9. Đảo Ngọc Phú Quốc & Côn Đảo (`MN-091` → `MN-100`)

> **Bối cảnh mỹ thuật**: Giao thoa 3 dòng di sản biển đảo tiêu biểu: (1) **Tín ngưỡng biển Nam Bộ** khảm sành sứ rực rỡ tại Mũi Dinh Cậu Phú Quốc (1937); (2) **Kiến trúc thuộc địa Pháp nhiệt đới** tại Dinh Chúa Đảo & phố cổ Côn Đảo (1862–1876) với vòm cuốn, cửa chớp xanh lá, gạch bông Nam Bộ và cầu tàu đá hộc 914; (3) **Kiến trúc tưởng niệm cách mạng** trang nghiêm tại Nghĩa Trang Hàng Dương & Mộ Chị Võ Thị Sáu.

#### `MN-091` — Mũi Dinh Cậu & 29 Bậc Đá Leo Ghềnh (ảnh ref: `103`, `36`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc Miếu Dinh Cậu (*Lưỡng long tranh châu* khảm sành sứ) | `HV-A04` | Cặp rồng Nam Bộ uốn 7 khúc thân khảm mảnh sành sứ xanh lam–trắng–vàng (`HV-J01`) chầu quả cầu lửa giữa bờ nóc mái ngói đỏ tươi, sâu `8cm` | `G-TUBE` + `G-LATHE` | Dài `3.2m`/rồng | 1 | 2 800 | `roofParts` |
| 4 đầu đao góc mái cong & lớp khảm sành sứ viền bờ chảy | `HV-A06` | 4 đầu đao rồng hóa mây lửa vút cong 4 góc mái miếu Dinh Cậu phủ mảnh sứ vỡ đa sắc `HV-J01` | `G-TUBE` + `G-EXT` | `0.9m` | 4 | 2 600 | `roofParts` |
| Khảm mảnh sành sứ men lam – xanh lục trên bờ nóc & cổ diêm | `HV-J01` | Lớp shader khảm sành sứ voronoi óng ánh phủ toàn bộ thân rồng, đầu đao và ô cổ diêm miếu 1937 | `S-SHD` + `T-NRM` | Bờ nóc `8m` | 1 | 0 | `roofParts` |
| Hoành phi & đôi câu đối trước cửa miếu Dinh Cậu | `HV-I01` | Hoành phi sơn son thếp vàng `"DINH CẬU"` / `"龍王殿"` (*Long Vương Điện*) cùng cặp câu đối cột gỗ `"萬古英靈歸島嶼 — 千秋正氣鎮江山"` (`HV-I02`) | `T-ATLAS` + `G-EXT` | `1.8×0.55m` | 2 | 400 | `goldParts` |
| Viền ngói ống câu đầu trích thủy mép hiên miếu | `HV-D15` | 44 viên ngói câu đầu đỏ đất nung chạm hoa cúc & giọt trích thủy dọc 4 cạnh mái hiên cận cảnh | `G-INST` | Ống `0.12×0.38m` | 44 | 1 760 | `roofParts` |
| **Tổng** | — | `requiredMotifs`: `HV-A04, HV-A06, HV-J01, HV-I01, HV-D15` | — | — | — | **7 560** | — |

**LOD/ghi chú QC:** L0 giữ lưỡng long `HV-A04`, 4 đầu đao `HV-A06`, shader khảm sành sứ `HV-J01` và 44 ngói câu đầu `HV-D15`; L1 chuyển ngói câu đầu sang `T-NRM` và giản lược rồng 45%. QC đối chiếu mái đỏ tươi trên ghềnh đá granit nhô ra biển ảnh `103`.

#### `MN-092` — Ngọn Hải Đăng Dương Đông (`18m`) (ảnh ref: `103`, `36`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Lan can thép vòng tròn bao quanh đài đèn xoay đỉnh tháp | `HV-H09` | 24 song sắt sơn trắng uốn tròn ôm hành lang quan sát ở cao độ `15m`, chia 8 trụ góc | `G-INST` | Cao `1.05m`, Ø `3.4m` | 24 | 1 440 | `whiteParts` |
| Gờ phào vòng tròn phân tầng sơn sọc trắng – xanh biển | `HV-H04` | 4 vòng phào bê tông chạy quanh tháp trụ cao `18m` đánh dấu ranh giới sọc trắng – xanh dương và nâng sàn đèn | `G-EXT` | Chu vi `10m`/vòng | 20 | 800 | `whiteParts` |
| Lồng kính Fresnel & nan đồng bảo vệ chóa đèn xoay | `HV-H02` | 12 nan khung thép – đồng chia ô kính bảo vệ đèn chiếu biển xoay 360° trên đỉnh tháp | `G-EXT` | Cao `2.2m`, Ø `1.8m` | 4 | 1 040 | `ironParts` |
| Biển tên trạm hải đăng trên cửa vào chân tháp | `HV-I04` | Biển xanh chữ trắng `"HẢI ĐĂNG DƯƠNG ĐÔNG — PHÚ QUỐC"` gắn trên vòm cửa vào | `T-ATLAS` | `1.4×0.4m` | 1 | 0 | `whiteParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H09, HV-H04, HV-H02, HV-I04` | — | — | — | **3 280** | — |

**LOD/ghi chú QC:** L0 giữ 24 song lan can `HV-H09` và lồng đèn `HV-H02`; L1 gộp lan can thành alpha ring và giữ chùm tia đèn xoay ban đêm. QC kiểm tra vị trí hải đăng sọc trắng–xanh đứng sát cạnh Dinh Cậu ảnh `103`.

#### `MN-093` — Cầu Cảng Gỗ Hoàng Hôn (`60m`) & Chòi Bãi Biển (ảnh ref: `36`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Lan can gỗ con tiện mộc dọc 2 bên cầu cảng chữ T `60m` | `HV-D10` | 64 trụ tiện gỗ chịu mặn kết hợp dây thừng bện chéo trang trí dọc cầu cảng vươn ra biển Tây | `G-LATHE` + `G-INST` | Cao `0.95m` | 64 | 3 584 | `woodParts` |
| 3 chòi bãi biển mái lá dừa & khung tre buộc mây | `HV-NEW-MN-11` | 12 cụm cột kèo tre – gỗ buộc dây thừng/mây đỡ mái lá và võng lưới nằm ngắm hoàng hôn | `G-INST` + `T-NRM` | Chòi `3.2×3.2m` | 12 | 960 | `woodParts` |
| Trần chòi & dù bãi biển đan nan tre lóng mốt | `HV-G03` | Lớp phên tre đan che nắng dưới mái lá dừa và 6 dù bãi biển nan tre | `T-NRM` + `S-SHD` | Ø `2.6m` | 6 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-D10, HV-NEW-MN-11, HV-G03` | — | — | — | **4 544** | — |

**LOD/ghi chú QC:** L0 giữ 64 trụ lan can `HV-D10` (instanced) và 12 cụm kèo chòi `HV-NEW-MN-11`; L1 hạ trụ gỗ thành cọc đơn.

#### `MN-094` — Đội Tàu Đánh Cá Phú Quốc & Thuyền Thúng (ảnh ref: `36`, `103`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 cặp mắt tàu đánh cá biển Phú Quốc (8 mắt lớn) | `HV-NEW-MN-01` | 8 mắt tàu biển sơn đỏ–trắng–đen lớn nổi viền `1.5cm`, tròng hướng thẳng ra khơi (khác ghe sông nhìn xuống), gắn 2 bên mũi tàu gỗ cao `16m` | `T-ATLAS` + `G-EXT` | `0.55×0.26m` | 8 | 720 | `crimsonParts` |
| 3 thuyền thúng úp trên cát đan nan tre trét dầu rái | `HV-G03` | 3 thuyền thúng tròn Ø `1.8m` nan tre đan lóng mốt sắc nét, cạp vành mây dày `6cm` | `T-NRM` + `S-SHD` | Ø `1.8m` | 3 | 0 | `woodParts` |
| Số đăng ký tàu cá Kiên Giang (`KG-...-TS`) & hoa văn chỉ mạn | `HV-I04` | Mã tàu `"KG-94108-TS"`, `"KG-95216-TS"` sơn trắng trên thân gỗ xanh dương – đỏ truyền thống Phú Quốc | `T-ATLAS` | `1.2×0.3m` | 8 | 0 | `whiteParts` |
| Lưới rạn & phao đèn câu mực treo khung giàn tre đầu tàu | `HV-NEW-MN-11` | 8 khung giàn tre buộc dây thừng vươn hai bên mạn tàu cá câu mực đêm Phú Quốc | `G-INST` + `T-NRM` | Dài `3.2m` | 8 | 640 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-01, HV-G03, HV-I04, HV-NEW-MN-11` | — | — | — | **1 360** | — |

**LOD/ghi chú QC:** L0 giữ 8 mắt tàu `HV-NEW-MN-01` và 8 giàn câu mực `HV-NEW-MN-11`; L1 chuyển mắt tàu sang `T-ATLAS`. QC kiểm tra đúng mã tỉnh `"KG-...-TS"` của tàu Phú Quốc (Kiên Giang).

#### `MN-095` — Tán Dừa Biển Xẻ Răng Lược & Bãi Cát Trắng (ảnh ref: `36`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 cụm gốc dừa uốn cong có gợn đốt thân vòng ngang | `HV-C15` | 18 đoạn thân dừa biển cong gợn đốt vòng tự nhiên sâu `1.5cm` (tái sử dụng kỹ thuật Lathe phân đốt `HV-C15` bản vỏ cây nâu xám) | `G-LATHE` + `G-INST` | Cao `6–9m` | 18 | 1 728 | `woodParts` |
| Vệt gợn sóng cát trắng ven mép thủy triều | `HV-D06` | Hoa văn vân gợn sóng cát nước rút (*sand ripples*) bằng normal map + roughness bóng ẩm dọc bãi biển | `T-NRM` + `S-SHD` | Bãi cát `90×18m` | 1 | 0 | `whiteParts` |
| Bảng gỗ cảnh báo bãi tắm & bảo vệ san hô Phú Quốc | `HV-I04` | 2 biển gỗ `"BÃI BIỂN PHÚ QUỐC — CHUNG TAY BẢO VỆ RẠN SAN HÔ"` cắm dưới bóng dừa | `T-ATLAS` | `0.85×0.45m` | 2 | 0 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-C15, HV-D06, HV-I04` | — | — | — | **1 728** | — |

**LOD/ghi chú QC:** L0 giữ 18 đoạn đốt thân dừa `HV-C15` và normal map vân cát ẩm `HV-D06`; L1 giản lược đốt thân dừa thành trụ cong mượt + `T-NRM`.

#### `MN-096` — Nghĩa Trang & Đài Tưởng Niệm Hàng Dương (`21.6m`) (ảnh ref: `104`, `37`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Ngọn lửa thiêng & ngôi sao vàng 5 cánh đỉnh Đài Tưởng Niệm `21.6m` | `HV-NEW-MN-12` | Biểu tượng ngôi sao vàng 5 cánh vát 5 múi nổi `8cm` trong vòng lửa/búp sen cách điệu vươn cao trên đỉnh tháp đài tưởng niệm | `G-EXT` | Cao `2.8m`, Ø `1.6m` | 4 | 480 | `goldParts` |
| 4 trụ biểu quảng trường đỉnh gắn búp sen đá trắng | `HV-C03` | 4 trụ biểu vuông cao `8.5m` có ô lồng đèn khoét thủng, đỉnh gắn 4 búp sen đá trắng 3 lớp cánh khép cao `1.0m` | `G-LATHE` | Cao `1.0m` | 4 | 720 | `whiteParts` |
| Bệ đài & Cổng Tam Quan đá trắng chạm 32 cánh sen | `HV-C01` | 32 cánh sen đá granit trắng xếp 2 tầng so le quanh bệ đài trung tâm, gân giữa nổi `3cm` | `G-INST` | Cánh `0.32×0.24m` | 32 | 1 536 | `whiteParts` |
| Băng hồi văn & sóng biển Côn Đảo khắc quanh chân đài | `HV-D01` | Hồi văn chữ "Công" khắc sâu `2.5cm` chạy quanh 4 mặt chân tháp đài dài `28m`, tôn vẻ trang nghiêm | `G-EXT` | Dài `28m`, cao `0.22m` | 28 | 1 680 | `stoneParts` |
| Hoành phi Cổng Tam Quan & văn bia tưởng niệm chiến sĩ cách mạng | `HV-I04` | Dòng chữ đỏ/vàng sắc nét `"NGHĨA TRANG HÀNG DƯƠNG — TỔ QUỐC GHI CÔNG"` trên trán Cổng Tam Quan đá trắng | `T-ATLAS` + `G-EXT` | `5.6×0.85m` | 2 | 240 | `goldParts` |
| **Tổng** | — | `requiredMotifs`: `HV-NEW-MN-12, HV-C03, HV-C01, HV-D01, HV-I04` | — | — | — | **4 656** | — |

**LOD/ghi chú QC:** L0 giữ sao vàng đỉnh đài `HV-NEW-MN-12`, 4 búp sen trụ biểu `HV-C03`, 32 cánh sen `HV-C01` và hồi văn `HV-D01`; L1 chuyển hồi văn và cánh sen sang `T-NRM`. QC đối chiếu tổng thể 4 trụ biểu + Đài `21.6m` với ảnh `104`.

#### `MN-097` — Khu Mộ Liệt Sĩ & Mộ Chị Võ Thị Sáu (ảnh ref: `104`, `37`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bia Mộ Chị Võ Thị Sáu & hàng bia mộ liệt sĩ Hàng Dương | `HV-I03` | Bia đá granit đen khắc chữ vàng trang nghiêm `"LIỆT SĨ VÕ THỊ SÁU — SINH NĂM 1933 — HY SINH NGÀY 23/1/1952"` cùng 24 bia mộ liệt sĩ khu B, khắc chìm `0.4cm` | `T-NRM` + `T-ATLAS` | `0.8×1.3m` / `0.5×0.8m` | 25 | 0 | `stoneParts` |
| Ngôi sao vàng 5 cánh đắp nổi trên trán bia mộ liệt sĩ | `HV-NEW-MN-12` | 25 ngôi sao vàng 5 cánh nhỏ vát múi nổi `1.5cm` đặt chính tâm đỉnh các bia mộ (1 lớn mộ Chị Sáu + 24 mộ liệt sĩ) | `G-EXT` | Ø `0.14–0.22m` | 25 | 3 000 | `goldParts` |
| Lư hương đồng 3 chân lớn trước khu mộ Chị Võ Thị Sáu | `HV-E07` | Đỉnh đồng 3 chân 2 quai rồng cao `1.25m` tỏa khói hương GPU nghi ngút giữa ánh nến đêm | `G-LATHE` + `G-TUBE` | Cao `1.25m` | 1 | 900 | `bronzeParts` |
| Viền cánh sen đá trắng bao quanh bệ mộ Chị Võ Thị Sáu | `HV-C01` | 16 cánh sen đá trắng chạm đều quanh cổ bệ mộ nâng bát hương và lọ hoa trắng (lê-ki-ma / cúc trắng) | `G-INST` | Cánh `0.15×0.12m` | 16 | 768 | `whiteParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I03, HV-NEW-MN-12, HV-E07, HV-C01` | — | — | — | **4 668** | — |

**LOD/ghi chú QC:** L0 giữ 25 sao vàng `HV-NEW-MN-12` (instanced), đỉnh đồng `HV-E07` và 16 cánh sen `HV-C01`; L1 bake sao nhỏ trên 24 bia thường sang `T-ATLAS` (tiết kiệm 2.8k tri). QC kiểm tra sự trang nghiêm và chính xác thông tin trên bia Mộ Chị Võ Thị Sáu (`1933 – 23/1/1952`).

#### `MN-098` — Cầu Tàu 914 Lịch Sử (`40m`) (ảnh ref: `105`, `37`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bia đá tưởng niệm đầu cầu tàu lịch sử | `HV-I04` | Bia đá granit đặt trên bệ cao khắc chữ đỏ/vàng sắc nét `"DI TÍCH LỊCH SỬ CẦU TÀU 914 — NƠI GHI DẤU 914 TÙ NHÂN HY SINH"` | `T-ATLAS` | `1.5×1.1m` | 1 | 0 | `stoneParts` |
| Thành kè đá hộc ghép thô & góc đá khóa khối (*quoin*) | `HV-H11` | 40 khối đá tảng núi Chúa đẽo thô ghép cạnh dọc 2 mép cầu tàu dài `40m` (khởi công 1873), khe mạch sâu `4cm` bám hàu biển | `G-INST` + `T-NRM` | Khối `0.6×0.45m` | 40 | 960 | `stoneParts` |
| 6 cột bích neo tàu bằng gang đúc & dây xích sắt rỉ cổ | `HV-D14` | 6 cột bích neo gang đúc hình nấm tròn kèm vòng tán đinh và 36 mắt xích neo sắt nối 2 bên mép cầu tàu | `G-INST` + `G-LATHE` | Cao `0.65m`, Ø `0.38m` | 24 | 576 | `ironParts` |
| Phù điêu sóng nước khắc chân bia tưởng niệm Cầu Tàu 914 | `HV-D06` | Băng sóng biển khắc nông `2cm` chạy quanh 4 mặt chân bệ bia di tích đầu cầu | `G-EXT` | Chu vi `6.4m` | 6 | 540 | `stoneParts` |
| **Tổng** | — | `requiredMotifs`: `HV-I04, HV-H11, HV-D14, HV-D06` | — | — | — | **2 076** | — |

**LOD/ghi chú QC:** L0 giữ 40 khối đá hộc viền `HV-H11`, 6 cột bích neo `HV-D14` và bia chữ `HV-I04`; L1 chuyển đá hộc và băng sóng sang `T-NRM`. QC đối chiếu chính xác câu chữ `"DI TÍCH LỊCH SỬ CẦU TÀU 914"` và kết cấu đá hộc thô theo ảnh `105`.

#### `MN-099` — Phố Cổ Kiến Trúc Pháp Côn Đảo (Dinh Chúa Đảo) (ảnh ref: `105`, `37`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Dãy 10 vòm cuốn bán nguyệt hành lang vàng kem (1862–1876) | `HV-H03` | 10 vòm bán nguyệt kiểu thuộc địa Pháp 2 lớp giật cấp chạy suốt mặt tiền tầng trệt & tầng 1 Dinh Chúa Đảo, khóa vòm nổi `8cm` | `G-TUBE` | Ø `2.8m` | 10 | 3 000 | `plasterParts` |
| 24 cánh cửa chớp gỗ lá sách sơn xanh lá đặc trưng Côn Đảo | `HV-H05` | 24 cánh cửa chớp gỗ sơn xanh lá cây cổ điển (`#2e6b48`), mỗi cánh 22 lá nghiêng 30° sâu `3cm`, chống nắng gió biển | `G-INST` | `0.75×2.3m` | 24 | 2 880 | `woodParts` |
| Hệ phào mái cổ điển & hàng con sơn vữa dưới diềm ngói đỏ | `HV-H04` | Gờ phào 3 lớp lồi-lõm chạy suốt `48m` mặt tiền kèm 18 con sơn cuộn nâng đỡ diềm mái ngói tây đỏ | `G-EXT` | Dài `48m` | 48 | 1 920 | `plasterParts` |
| Lan can con tiện xi măng kiểu thuộc địa dọc hành lang tầng 2 | `HV-D10` | 48 con tiện xi măng sơn trắng-vàng 3 bầu cổ điển xếp đều trong các nhịp vòm hành lang tầng trên | `G-LATHE` + `G-INST` | Cao `0.78m` | 48 | 2 688 | `plasterParts` |
| Sàn hành lang lát gạch bông hoa văn Nam Bộ – Pháp | `HV-H07` | Gạch bông ô vuông `20×20cm` hoa 4 cánh vàng – nâu – xám lát kín hành lang đón gió biển | `T-ATLAS` | Viên `0.2×0.2m` | 1 | 0 | `plasterParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H03, HV-H05, HV-H04, HV-D10, HV-H07` | — | — | — | **10 488** | — |

**LOD/ghi chú QC:** L0 giữ 10 vòm `HV-H03`, 24 cửa chớp xanh lá `HV-H05` và 48 con tiện `HV-D10`; L1 chuyển cửa chớp và con tiện sang `T-NRM`/alpha card. QC bắt buộc khớp bảng màu **tường vàng kem + cửa chớp xanh lá + mái ngói đỏ** chuẩn Dinh Chúa Đảo ảnh `105`.

#### `MN-100` — Rặng Cây Bàng Cổ Thụ Di Sản & Vịnh Côn Sơn (ảnh ref: `37`, `105`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 8 cột đèn đường Pháp cổ gang đúc dọc đường Tôn Đức Thắng ven vịnh | `HV-H09` | 8 trụ đèn gang đúc sơn đen – xanh cổ điển có tay uốn cuộn xoắn ốc và chụp đèn lục giác dọc rặng bàng cổ thụ | `G-INST` | Cao `3.6m` | 16 | 960 | `ironParts` |
| 6 bệ bồn cây bàng di sản ốp đá kè & phào Pháp | `HV-H04` | Gờ phào đá vát 2 cấp chạy quanh 6 bồn cây bàng cổ thụ hơn 150 tuổi dọc bờ kè vịnh Côn Sơn | `G-EXT` | Chu vi `8m`/bồn | 24 | 960 | `stoneParts` |
| Biển công nhận `"CÂY DI SẢN VIỆT NAM"` gắn dưới gốc bàng cổ | `HV-I04` | 3 tấm bia đá nhỏ khắc chữ `"CÂY BÀNG CỔ THỤ — CÂY DI SẢN VIỆT NAM — CÔN ĐẢO"` | `T-ATLAS` | `0.65×0.45m` | 3 | 0 | `stoneParts` |
| Hoa văn mai rùa biển xanh lục giác bơi quanh vòm đá vịnh | `HV-B05` | 2 cá thể rùa biển (*Chelonia mydas* — đặc sản bảo tồn Vườn Quốc gia Côn Đảo) mai chia 13 múi lục giác rõ khối (tái sử dụng kỹ thuật chia múi mai `HV-B05` bản rùa biển mượt, không đầu rùa đội bia) | `G-DISP` | Dài `1.1m` | 1 | 1 300 | `woodParts` |
| **Tổng** | — | `requiredMotifs`: `HV-H09, HV-H04, HV-I04, HV-B05` | — | — | — | **3 220** | — |

**LOD/ghi chú QC:** L0 giữ 8 cột đèn Pháp `HV-H09`, 6 bồn cây `HV-H04` và 2 rùa biển chia múi mai `HV-B05`; L1 chuyển mai rùa sang `T-NRM` và hạ cột đèn thành trụ đơn. QC kiểm tra tán bàng cổ thụ vươn ngang rộng tạo bóng mát dọc đường ven Vịnh Côn Sơn ảnh `37`, `105`.

---

## Tổng Hợp Cuối Kế Hoạch

### (a) Bảng Tổng Ngân Sách Tri L0 Theo Cụm & Khuyến Nghị Tối Ưu

| STT | Cụm Di Sản | Số Component | Tổng Tri L0 | Tỷ Trọng (%) | Đánh Giá & Hạng Mục Tốn Tri Nhất |
|---|---|---:|---:|---:|---|
| 3.1 | Dinh Độc Lập — Sài Gòn | 16 | 92 760 | 18.2% | `MN-001` (rèm đốt trúc), `MN-014` (sen hồ cá), `MN-002` (cổng sắt) |
| 3.2 | Chợ Bến Thành — Sài Gòn | 12 | 58 916 | 11.5% | `MN-026` (24 cột gang + đèn), `MN-020` (18 vì kèo thép), `MN-018` (12 phù điêu gốm Biên Hòa) |
| 3.3 | Nhà Thờ Đức Bà Sài Gòn | 14 | 114 448 | 22.4% | `MN-029` (2 tháp chuông `57.6m`), `MN-040` (56 cửa kính màu), `MN-039` (14 chặng), `MN-033` (10 nhịp vòm) |
| 3.4 | Địa Đạo Củ Chi & Đền Bến Dược | 10 | 48 440 | 9.5% | `MN-043` (tháp 9 tầng 36 đầu đao), `MN-044` (Đền Chính Bến Dược) |
| 3.5 | Tháp Bà Ponagar — Nha Trang | 10 | 55 780 | 10.9% | `MN-055` (3 tháp phụ), `MN-053` (Tháp Chính `23m`), `MN-056` (22 cột Mandapa) |
| 3.6 | Chợ Nổi Cái Răng — Cần Thơ | 12 | 37 780 | 7.4% | `MN-074` (đèn bão), `MN-064` (60 mắt thuyền), `MN-068` (nhà sàn), `MN-071` (cầu Cái Răng) |
| 3.7 | Rừng Tràm Trà Sư — An Giang | 8 | 26 452 | 5.2% | `MN-076` (đài quan sát `23m`), `MN-081` (cổng tre & sen), `MN-075` (cầu tre `92m`) |
| 3.8 | Đất Mũi Cà Mau | 8 | 32 436 | 6.4% | `MN-085` (Cột Cờ Hà Nội Mũi Cà Mau), `MN-090` (Đền Lạc Long Quân), `MN-083` (Con Tàu) |
| 3.9 | Đảo Ngọc Phú Quốc & Côn Đảo | 10 | 43 580 | 8.5% | `MN-099` (Dinh Chúa Đảo), `MN-091` (Mũi Dinh Cậu), `MN-097` (Mộ liệt sĩ), `MN-096` (Hàng Dương) |
| **Tổng** | **Khu Vực 3 — Miền Nam & Hải Đảo** | **100** | **510 592** | **100.0%** | **Đạt chuẩn an toàn (`51.1%` trần `1,000,000 tri L0` khu vực; dư địa lớn cho hình học nền)** |

> **Khuyến nghị kiểm soát & cắt giảm ngân sách (nếu mở rộng chi tiết hoặc vượt ngưỡng `1,000,000 tri L0`)**:
> 1. **Tận dụng tuyệt đối `InstancedMesh` cho các cụm lặp mật độ cao**: `MN-001` (96 đốt trúc `HV-C15`), `MN-026` (24 cột gang `HV-NEW-MN-10`), `MN-040` (52 cửa lancet `HV-H02`), `MN-064` (60 mắt thuyền `HV-NEW-MN-01`), `MN-075` (60 nhịp cầu tre `HV-NEW-MN-11`), `MN-085` (64 ô hoa chanh `HV-C13`) — mỗi nhóm chỉ tốn **1 draw call**.
> 2. **Kế hoạch cắt giảm nhanh 25–35% khi cần siết ngân sách shadow-caster (`<= 900k` toàn map)**:
>    - Tắt `castShadow` cho toàn bộ hoa văn trang trí nội thất (`MN-007`..`MN-013`, `MN-035`..`MN-041`), lá sen/súng (`MN-014`, `MN-072`, `MN-077`), mắt thuyền (`MN-064`, `MN-078`) và đinh tán nhỏ (`HV-D14`).
>    - Hạ `MN-043` (đầu đao tầng 4–9 của Tháp Bến Dược `39m`) từ 36 đầu đao full-L0 xuống bản simplified từ tầng 4 trở lên (cắt ~14,000 tri mà không ảnh hưởng cận cảnh dưới đất).
>    - Chuyển 52 lưới cửa lancet `MN-040` ở độ cao `> 12m` và 14 thánh giá nhỏ `MN-039` sang `T-NRM` + alpha cutout ở cự ly > 20m (cắt ~13,000 tri).
>    - Chuyển 60 viền nổi mắt thuyền `MN-064` và 24 sao nhỏ bia mộ thường `MN-097` sang `T-ATLAS` có normal map bake (cắt ~8,200 tri).
> 3. **Kỷ luật Material Bucket**: Toàn bộ hoa văn gộp vào các bucket sẵn có (`whiteParts`, `stoneParts`, `plasterParts`, `brickParts`, `chamBrick`, `woodParts`, `ironParts`, `bronzeParts`, `goldParts`, `crimsonParts`, `marbleParts`, `roofParts`) trước `mergeNormalized()`, giữ `uniqueMaterials <= 250` và **0 draw call phát sinh** cho hoa văn.

---

### (b) Hoa Văn Đề Xuất Bổ Sung Vào Thư Viện (`HV-NEW-MN-01` → `HV-NEW-MN-12`)

Các hoa văn dưới đây là đặc trưng bản sắc của **Miền Nam & Hải Đảo**, chưa có mã tương ứng trong `HV-A01..HV-J07` của [MOTIF_LIBRARY_HOA_VAN.md](MOTIF_LIBRARY_HOA_VAN.md) và cần được chuẩn hóa bổ sung:

| Mã đề xuất | Tên hoa văn | Hình thái thực tế & phạm vi mỹ thuật | KT | Kích thước | Tri L0 / đv | Bucket gợi ý | Ảnh ref |
|---|---|---|---|---|---:|---|---|
| `HV-NEW-MN-01` | **Mắt thuyền Nam Bộ (nhãn thuyền sông / biển)** | Mắt hạnh nhân hoặc bán nguyệt sơn 3 màu trắng–đen–đỏ đối xứng 2 bên mũi tàu; ghe sông Cái Răng tròng nhìn chếch xuống dò luồng, tàu biển Nha Trang/Phú Quốc tròng nhìn thẳng ra khơi; viền nổi `1.2–1.5cm` | `T-ATLAS` + `G-EXT` | `0.22–0.65m` | 90 | `crimsonParts` / `woodParts` | `33`, `64`, `99`, `103` |
| `HV-NEW-MN-02` | **Thánh giá Roman-Gothic & hoa móc đỉnh chóp thép** | Thánh giá đồng đầu chẻ 3 lá (*fleury/trefoil*) cao `0.2–3.5m` kết hợp hàng hoa móc (*crocket*) và diềm sắt rèn trên mái chóp xanh patina Nhà Thờ Đức Bà | `G-EXT` + `G-TUBE` | `0.18–3.5m` | 420 | `bronzeParts` / `goldParts` | `30`, `61`, `120` |
| `HV-NEW-MN-03` | **Phù điêu Chặng Đàng Thánh Giá & Tượng Công giáo** | Khung vòm nhọn/chữ nhật đồng đúc chạm nổi `3.5–8cm` 14 Chặng Đàng Thánh Giá (*Via Dolorosa*, số La Mã `I–XIV`), bàn thờ thiên thần & Tượng Đức Mẹ Hòa Bình cẩm thạch Ý | `G-DISP` + `G-EXT` | `0.65×0.95m` / `4.6m` | 380 | `bronzeParts` / `marbleParts` | `30`, `61`, `120` |
| `HV-NEW-MN-04` | **Gạch trần Marseille & vòm gạch *voussoir*** | Tường gạch ép Marseille đỏ hồng không tô trát, mạch vữa lõm `3mm` sắc cạnh kết hợp hàng gạch xếp nan quạt (*voussoir*) nổi `6cm` trên các vòm cửa Nhà Thờ Đức Bà | `T-NRM` + `S-SHD` / `G-EXT` | Viên `0.22×0.11m`, vòm `1.6m` | 0 (tường) / 160 (vòm) | `brickParts` | `30`, `61`, `120` |
| `HV-NEW-MN-05` | **Tượng Nữ thần Po Nagar / Thần Shiva Chăm Kauthara** | Điêu khắc đá đen/sa thạch TK VIII–XIII: thần 4–10 tay cầm pháp khí, đội mũ tháp *Mukuta* 3 tầng, chuỗi hạt cổ *hara*, ngồi xếp bằng *padmasana* | `G-DISP` + `G-LATHE` | Cao `1.2–2.6m` | 1 600 | `stoneParts` | `32`, `66` |
| `HV-NEW-MN-06` | **Gốm Bàu Trúc Chăm (khắc vạch sóng nước — răng cưa)** | Bình/chum gốm nặn tay không bàn xoay, khắc vạch bằng vỏ sò hình sóng nước, răng cưa, móng tay quanh cổ bình; vân nung lộ thiên đỏ-đen loang tự nhiên | `G-LATHE` + `T-NRM` + `S-SHD` | Cao `0.3–0.75m` | 180 | `chamBrick` | `32`, `98` |
| `HV-NEW-MN-07` | **Bia ký chữ Phạn (*Sanskrit*) & Chăm cổ Kauthara** | Bia đá sa thạch đỉnh uốn hình lá đề, khắc chìm 18–26 dòng chữ Phạn *Pallava* & *Akhar Thrah* sâu `4mm` (TK VIII–XIII) | `G-EXT` + `T-NRM` + `T-ATLAS` | `0.75×1.65m` | 220 | `stoneParts` | `32`, `66`, `98` |
| `HV-NEW-MN-08` | **Bộ nhạc cụ Chăm (Trống Ginăng, Paranưng, Kèn Saranai)** | Thân trống gỗ hình ống dài/dẹt căng da, hệ dây mây buộc chữ V đan chéo 2 đầu mặt da, kèn gỗ tiện đốt đai đồng | `G-LATHE` + `G-TUBE` | Dài `0.45–0.75m` | 240 | `woodParts` / `bronzeParts` | `32`, `98` |
| `HV-NEW-MN-09` | **Trần ô cờ & bông gió hiện đại 1960s (Ngô Viết Thụ)** | Hệ ô vuông bê tông giật cấp `1.2×1.2m` sâu `15–18cm` tích hợp khe đèn và bông gió cách điệu chữ Hán (*Cát* 吉 / *Khẩu* 口 / *Hưng* 興) tại Dinh Độc Lập | `G-EXT` + `G-INST` | Ô `0.6–1.2m` | 64 | `whiteParts` / `plasterParts` | `28`, `60`, `118`, `119` |
| `HV-NEW-MN-10` | **Kết cấu vì kèo thép đinh tán & cột gang thuộc địa Pháp** | Nút kèo chữ A thép sơn xanh gắn bản mã đinh tán bán cầu và cột gang đúc khía 12 rãnh dọc (*fluted*) đầu cột lá acanthus 1914 (Chợ Bến Thành) | `G-INST` + `G-LATHE` | Cột `6.2m`, nút `1.4m` | 320 | `ironParts` | `29`, `93` |
| `HV-NEW-MN-11` | **Họa tiết buộc mây, nút lạt & lan can tre quả trám Nam Bộ** | Khớp buộc dây mây chữ thập, lan can tre uốn chéo hình quả trám, cần bẹo, giàn phơi hủ tiếu và khung chòi mái lá dừa nước Tây Nam Bộ | `G-INST` + `T-NRM` | Module `1.0–1.8m` | 80 | `woodParts` | `31`, `33`, `34`, `99`, `100` |
| `HV-NEW-MN-12` | **Ngôi sao 5 cánh đắp nổi & ký hiệu quân sự — di tích lịch sử** | Ngôi sao vàng 5 cánh vát kim tự tháp 5 múi nổi `1.5–8cm`, số hiệu xe tăng (`843`, `390`), 2 vòng đỏ đánh dấu bom 8/4/1975, sao 4 cánh Mốc GPS 0001 | `G-EXT` + `T-ATLAS` | Ø `0.14–1.8m` | 120 | `goldParts` / `ironParts` | `28`, `31`, `95`, `96`, `97`, `104` |

---

### (c) Thứ Tự Triển Khai 3 Đợt (`P0` / `P1` / `P2`) Theo Component

- **Đợt `P0` — Công trình biểu tượng (Hero Landmarks & Silhouette cốt lõi, 31 component)**: ưu tiên dựng trước để định hình toàn cảnh Khu vực 3, hoàn thiện helper cốt lõi (`HV-C15`, `HV-J06`, `HV-H01..H03`, `HV-F01..F10`, `HV-NEW-MN-01..05`, `HV-NEW-MN-09`, `HV-NEW-MN-10`, `HV-NEW-MN-12`):
  - **Dinh Độc Lập**: `MN-001`, `MN-002`, `MN-003`, `MN-004`, `MN-006`, `MN-009`
  - **Chợ Bến Thành**: `MN-017`, `MN-018`, `MN-019`, `MN-020`
  - **Nhà Thờ Đức Bà**: `MN-029`, `MN-030`, `MN-031`, `MN-032`, `MN-033`, `MN-040`
  - **Địa Đạo Củ Chi & Đền Bến Dược**: `MN-043`, `MN-044`, `MN-045`
  - **Tháp Bà Ponagar**: `MN-053`, `MN-054`, `MN-056`, `MN-057`
  - **Chợ Nổi & Rừng Tràm**: `MN-063`, `MN-064`, `MN-075`
  - **Đất Mũi & Hải Đảo**: `MN-083`, `MN-085`, `MN-091`, `MN-096`, `MN-099`

- **Đợt `P1` — Nội thất đi bộ, cụm di sản phụ & bản sắc vùng miền (38 component)**: bổ sung chiều sâu khám phá cận cảnh `< 25m`, nội thất bảo tàng — giáo đường — đền miếu và trải nghiệm sông nước:
  - **Dinh Độc Lập**: `MN-005`, `MN-007`, `MN-008`, `MN-010`, `MN-011`, `MN-012`, `MN-013`, `MN-014`, `MN-015`
  - **Chợ Bến Thành**: `MN-021`, `MN-026`, `MN-028`
  - **Nhà Thờ Đức Bà**: `MN-034`, `MN-035`, `MN-036`, `MN-037`, `MN-038`, `MN-039`, `MN-041`
  - **Củ Chi**: `MN-046`, `MN-047`, `MN-050`
  - **Ponagar**: `MN-055`, `MN-058`, `MN-061`
  - **Chợ Nổi Cái Răng**: `MN-065`, `MN-066`, `MN-068`, `MN-069`
  - **Trà Sư**: `MN-076`, `MN-077`, `MN-078`, `MN-081`
  - **Đất Mũi & Hải Đảo**: `MN-084`, `MN-090`, `MN-092`, `MN-097`, `MN-098`

- **Đợt `P2` — Gian hàng đời sống, cảnh quan sinh thái & tiểu cảnh hoàn thiện (31 component)**: hoàn thiện sức sống cộng đồng, vật dụng dân gian và môi trường phụ trợ (tận dụng mạnh `T-ATLAS`/`T-NRM` và `G-INST`):
  - **Dinh Độc Lập**: `MN-016`
  - **Chợ Bến Thành**: `MN-022`, `MN-023`, `MN-024`, `MN-025`, `MN-027`
  - **Nhà Thờ Đức Bà**: `MN-042`
  - **Củ Chi**: `MN-048`, `MN-049`, `MN-051`, `MN-052`
  - **Ponagar**: `MN-059`, `MN-060`, `MN-062`
  - **Chợ Nổi Cái Răng**: `MN-067`, `MN-070`, `MN-071`, `MN-072`, `MN-073`, `MN-074`
  - **Trà Sư**: `MN-079`, `MN-080`, `MN-082`
  - **Đất Mũi**: `MN-086`, `MN-087`, `MN-088`, `MN-089`
  - **Phú Quốc & Côn Đảo**: `MN-093`, `MN-094`, `MN-095`, `MN-100`
