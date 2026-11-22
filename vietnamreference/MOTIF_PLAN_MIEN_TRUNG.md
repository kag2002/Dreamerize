# Kế Hoạch Phân Rã Hoa Văn — Khu Vực Miền Trung & Tây Nguyên (`MT-001` → `MT-100`)

> **Phạm vi**: Phân rã chi tiết hoa văn kiến trúc, điêu khắc, nội thất và họa tiết địa mạo cho toàn bộ **100 component** (`MT-001` → `MT-100`) thuộc **7 cụm di sản Miền Trung & Tây Nguyên** (Cố Đô Huế, Phố Cổ Hội An, Cầu Vàng & Cầu Rồng Đà Nẵng, Sơn Đoòng & Phong Nha, Thánh Địa Mỹ Sơn & Poshanư, Đà Lạt — Langbiang, Tây Nguyên — Biển Hồ T'Nưng).  
> **Tài liệu chuẩn hóa**: Mọi mã hoa văn (`HV-A01`..`HV-J07`), kỹ thuật dựng (`G-EXT`, `G-LATHE`, `G-TUBE`, `G-DISP`, `G-INST`, `T-NRM`, `T-ATLAS`, `S-SHD`), quy ước LOD (`L0 < 25m`, `L1 25–120m`, `L2 > 120m`) và bucket vật liệu tuân thủ [MOTIF_LIBRARY_HOA_VAN.md](MOTIF_LIBRARY_HOA_VAN.md); danh mục component đối chiếu [MASTER_300_COMPONENTS_DETAIL_LIST.md](MASTER_300_COMPONENTS_DETAIL_LIST.md).  
> **Quy ước bổ sung tri L0 cho nhóm I & J** (chưa ghi cột tri trong thư viện gốc): `HV-I01` (hoành phi khung `G-EXT` + `T-ATLAS`) = `180 tri/bức`, `HV-I02` (câu đối cong/phẳng) = `120 tri/vế`, `HV-I03` (bia khắc chìm `T-NRM`) = `0 tri`, `HV-I04` (biển Quốc ngữ/Pháp khung nổi) = `60 tri/biển`, `HV-I05` (ô Nhất thi nhất họa `T-ATLAS`) = `0 tri`; `HV-J01..J05, J07` (shader/atlas/material) = `0 tri`, `HV-J06` (phù điêu gốm `G-DISP`+`S-SHD`) = `300 tri/ô`. Các hoa văn đặc thù miền Trung — Tây Nguyên chưa có trong thư viện được ký hiệu `HV-NEW-MT-01` → `HV-NEW-MT-16` và tổng hợp ở cuối tài liệu.

---

## Bảng Tóm Tắt Theo Cụm Di Sản

| STT | Cụm di sản | Phạm vi mã | Số component | Số mã HV riêng biệt | Tổng tri L0 ước tính |
|---|---|---|---:|---:|---:|
| 2.1 | Cố Đô Huế — Đại Nội, Ngọ Môn, Điện Thái Hòa, Thế Miếu | `MT-001` → `MT-022` | 22 | 45 | 397 540 |
| 2.2 | Phố Cổ Hội An, Chùa Cầu & Hội Quán Phúc Kiến | `MT-023` → `MT-038` | 16 | 34 | 135 352 |
| 2.3 | Cầu Vàng — Bà Nà Hills & Cầu Rồng — Đà Nẵng | `MT-039` → `MT-052` | 14 | 19 | 103 720 |
| 2.4 | Hang Sơn Đoòng & Động Phong Nha — Kẻ Bàng | `MT-053` → `MT-066` | 14 | 17 | 105 232 |
| 2.5 | Thánh Địa Mỹ Sơn & Tháp Chàm Poshanư | `MT-067` → `MT-078` | 12 | 24 | 65 332 |
| 2.6 | Đà Lạt — Langbiang & Hồ Xuân Hương | `MT-079` → `MT-088` | 10 | 18 | 48 836 |
| 2.7 | Biển Hồ T'Nưng, Nhà Rông & Tây Nguyên | `MT-089` → `MT-100` | 12 | 19 | 37 440 |
| **Tổng** | **Toàn Khu Vực Miền Trung & Tây Nguyên** | **`MT-001` → `MT-100`** | **100** | **98** *(82 chuẩn + 16 mới)* | **893 452** |

---

## 2.1. Cố Đô Huế — Đại Nội, Ngọ Môn, Điện Thái Hòa, Thế Miếu (`MT-001` → `MT-022`)

#### `MT-001` — Kỳ Đài Huế 3 tầng đài gạch (`42m`) (ảnh ref: `17`, `18`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 góc tường gạch 3 tầng chóp cụt | `HV-H11` | Khối đá thanh giật bậc (quoin) kiểu thành Vauban triều Gia Long ốp 4 góc × 3 tầng, cạnh vát nổi `3–4 cm`, mạch vữa lõm `1.5 cm` | `G-INST` + `T-NRM` | `0.5×0.4m` | 96 | 2 304 | `stoneParts` |
| Lan can tường hoa 3 tầng thành | `HV-C13` | Ô gạch gốm thông gió hoa chanh 4 cánh tròn đối xứng chạy viền 4 mặt đỉnh tầng 1–2–3, thủng xuyên sâu `8 cm` | `G-EXT` | `0.25×0.25m` | 120 | 4 320 | `plasterParts` |
| 2 cổng vòm bậc thang lên đài | `HV-D01` | Băng hồi văn chữ "Công" liên hoàn đắp vữa viền khung cổng phía Đông và Tây, nổi `2.5 cm` | `G-EXT` | Dài `14m` | 14 | 840 | `plasterParts` |
| Đỉnh 4 trụ góc tầng thượng | `HV-C03` | Búp sen 3 lớp cánh khép trên đế đài tròn đặt 4 góc sân Kỳ Đài hướng lên trời, sâu rãnh cánh `2 cm` | `G-LATHE` | Cao `0.7m` | 4 | 720 | `plasterParts` |
| **Tổng** | `requiredMotifs`: `HV-H11, HV-C13, HV-D01, HV-C03` | — | — | — | — | **8 184** | — |

**LOD/ghi chú QC:** Giữ khối đá góc `HV-H11` và 4 búp sen `HV-C03` ở L0; ở L1 gộp ô hoa chanh `HV-C13` và hồi văn `HV-D01` sang `T-NRM` alpha-cutout. QC kiểm tra `motifDepthCheck >= 2cm` trên tường góc và độ thẳng hàng 3 tầng thành.

#### `MT-002` — Phu Văn Lâu 2 tầng trên trục Thần Đạo (ảnh ref: `17`, `18`, `40`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc tầng 2 (trên cùng) | `HV-A04` | Cặp *Lưỡng long chầu nhật* thời Nguyễn (sừng nai 2 nhánh, 5 móng) khảm sành sứ đối xứng hướng Nam, quả cầu lửa giữa, nổi khối `12 cm` | `G-TUBE` + `G-LATHE` | Dài `3.2m` | 1 cặp | 2 800 | `roofParts`+`goldParts` |
| 8 góc mái tầng 1 & tầng 2 | `HV-A06` | Đầu đao rồng cuốn (long hóa) vút cong 4 góc × 2 tầng, phủ mảnh sành men lam-vàng (`HV-J01`), uốn nổi `8 cm` | `G-TUBE` + `G-EXT` | `1.1m` | 8 | 5 200 | `roofParts` |
| Dải ngói viền mái hoàng lưu ly | `HV-D15` | Ngói ống câu đầu chạm hoa thị và ngói trích thủy men vàng hoàng lưu ly (`HV-J03`) dọc 4 diềm mái 2 tầng, nổi `3 cm` | `G-INST` | `0.12×0.4m` | 96 | 3 840 | `roofParts` |
| Lan can gỗ son tầng 2 | `HV-D10` | Hàng con tiện gỗ sơn son 3 bầu 2 eo bao quanh 4 mặt gác lầu, tiện tròn sâu `2.5 cm` | `G-LATHE` + `G-INST` | Cao `0.65m` | 72 | 4 032 | `crimsonParts` |
| Bức đại tự mặt Nam tầng 2 | `HV-I01` | Hoành phi sơn son thếp vàng (`HV-J04`) viết 3 chữ Hán khải thư **`敷文樓`** (*Phu Văn Lâu*) từ phải sang trái, khung viền rồng mây nổi `4 cm` | `T-ATLAS` + `G-EXT` | `2.2×0.85m` | 1 | 180 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-A04, HV-A06, HV-D15, HV-D10, HV-I01, HV-J01, HV-J03, HV-J04` | — | — | — | — | **16 052** | — |

**LOD/ghi chú QC:** Giữ `HV-A04`, `HV-A06` và hoành phi `敷文樓` ở L0; chuyển con tiện `HV-D10` và trích thủy `HV-D15` sang đơn giản hóa 50% + `T-NRM` ở L1. QC xác nhận đúng 3 chữ `敷文樓` và sắc men hoàng lưu ly (`HV-J03`).

#### `MT-003` — 18 Khẩu Thần Công Triều Nguyễn (ảnh ref: `17`, `18`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Thân nòng & quai rồng 9 khẩu Xuân–Hạ–Thu–Đông + Ngũ Hành | `HV-NEW-MT-16` | Quai đôi hình rồng Nguyễn chung lưng, 6 đai gân tròn nổi `2.5 cm`, vòng mây lửa quanh lỗ châm ngòi, khắc chìm hiệu pháo `春/夏/秋/冬/木/火/土/金/水` (mô phỏng đại diện 18 khẩu hai bên Kỳ Đài) | `G-LATHE` + `G-TUBE` + `T-NRM` | Dài `4.5–5.1m` | 18 | 11 160 | `bronzeParts` |
| Dải hồi văn cổ miệng nòng pháo | `HV-D01` | Vòng hồi văn chữ "Công" đúc nổi quanh cổ loa miệng nòng mỗi khẩu, sâu `1.2 cm` | `G-EXT` | Chu vi `1.2m` | 18 | 1 080 | `bronzeParts` |
| Thành giá súng bằng gỗ lim chạm mây | `HV-D05` | Cụm mây xoắn 3 vòng đầu tròn đuôi nhọn chạm nổi hai bên má giá pháo, sâu `2 cm` | `G-EXT` | `0.45×0.2m` | 36 | 4 320 | `woodParts` |
| Đinh ốc đồng bịt trục bánh xe pháo | `HV-C14` | Đinh hoa thị 8 cánh đúc đồng gắn tâm trục và vành bánh xe gỗ bọc sắt, nổi `1.5 cm` | `G-EXT` | Ø `0.18m` | 36 | 1 728 | `bronzeParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-16, HV-D01, HV-D05, HV-C14` | — | — | — | — | **18 288** | — |

**LOD/ghi chú QC:** Dùng `G-INST` cho thân nòng `HV-NEW-MT-16` (18 khẩu chung 2 biến thể Xuân-Hạ-Thu-Đông / Ngũ Hành); ở L1 chuyển hồi văn `HV-D01` và mây xoắn `HV-D05` thành `T-NRM` trên đồng patina. QC kiểm tra đầy đủ 2 cụm 9 khẩu đối xứng.

#### `MT-004` — 5 Cửa Ngọ Môn chuẩn lịch sử (ảnh ref: `82`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 bộ cánh cửa chính (cửa giữa + Tả/Hữu Giáp Môn) | `HV-D14` | Đinh đồng bán cầu bố trí lưới `9×9` (81 đinh/cánh × 6 cánh cửa son đỏ, biểu trưng cửu ngũ chí tôn), nổi bán cầu `3.5 cm` | `G-INST` | Ø `8cm` | 486 | 11 664 | `bronzeParts` |
| Khung đá thanh 3 cửa giữa & 2 vòm Tả/Hữu Dịch Môn | `HV-D01` | Băng hồi văn chạm chìm-nổi chạy viền mặt tiền khung đá thanh Thanh Hóa hình chữ nhật và khóa vòm 2 cửa cánh, sâu `2 cm` | `G-EXT` | Dài `36m` | 36 | 2 160 | `stoneParts` |
| Đế chân khung đá 5 cửa | `HV-D06` | Băng sóng nước thủy ba xếp 3 lớp cuộn nhọn chạm ở bệ đá chân 6 trụ vách Ngọ Môn, sâu `3 cm` | `G-EXT` | Dài `18m` | 18 | 1 620 | `stoneParts` |
| Bức đá khắc tên phía trên cửa chính giữa | `HV-I01` | Biển đá thanh chữ Hán mạ vàng **`午門`** (*Ngọ Môn*) đọc từ phải sang trái, viền khung triện góc lõm (`HV-D07`), sâu chạm `3 cm` | `T-ATLAS` + `G-EXT` | `2.6×1.1m` | 1 | 180 | `stoneParts`+`goldParts` |
| Lan can tường hoa đỉnh đài chữ U | `HV-D04` | Ô gạch gốm men xanh chữ Vạn `卍` liên hoàn chạy dọc tường chắn tầng đài Ngọ Môn, thủng sâu `10 cm` | `G-EXT` + `G-INST` | `0.25×0.25m` | 140 | 5 600 | `roofParts` |
| **Tổng** | `requiredMotifs`: `HV-D14, HV-D01, HV-D06, HV-D07, HV-I01, HV-D04` | — | — | — | — | **21 224** | — |

**LOD/ghi chú QC:** Giữ 3 cửa khung vuông + 2 cửa cánh vòm cuốn và biển `午門` ở L0; đinh đồng `HV-D14` dùng 1 `InstancedMesh` duy nhất, chuyển sang `T-NRM` ở L1. QC bắt buộc xác nhận lưới đinh `9×9` và tỷ lệ 3 cửa vuông / 2 cửa vòm đúng ảnh `82`.

#### `MT-005` — Lòng 3 cổng giữa Ngọ Môn (ảnh ref: `82`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt trong cánh cửa gỗ lim sơn son | `HV-D07` | Khung ô triện chữ nhật góc lõm vuông chia 3 tầng pano trên mặt trong 6 cánh cửa mở rộng, sơn son thếp vàng (`HV-J04`), nổi `2 cm` | `G-EXT` | `0.9×1.1m` | 18 | 720 | `crimsonParts`+`goldParts` |
| Khóa đồng & vòng nắm cửa hình hoa thị | `HV-C14` | Mặt bích đồng chạm hoa thị 8 cánh gắn vòng kéo cửa nặng ở giữa 6 cánh cổng, nổi `3 cm` | `G-EXT` | Ø `0.32m` | 6 | 288 | `bronzeParts` |
| 6 dầm đá thanh chịu lực trần hầm | `HV-D01` | Đường gờ chỉ kép kèm hồi văn đơn chạm dọc mép dưới dầm đá thanh nguyên khối, sâu `1.5 cm` | `G-EXT` | Dài `24m` | 24 | 1 440 | `stoneParts` |
| Chân tường ốp đá xanh trong lòng hầm | `HV-D05` | Cụm mây xoắn triều Nguyễn chạm nông ở đá khóa chân tường hai bên lối đi vua (lối giữa), sâu `1.8 cm` | `G-EXT` | `0.4×0.25m` | 12 | 1 440 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-D07, HV-C14, HV-D01, HV-D05, HV-J04` | — | — | — | — | **3 888** | — |

**LOD/ghi chú QC:** Giữ khóa đồng `HV-C14` và dầm đá thanh ở L0 cho góc nhìn đi bộ xuyên hầm; chuyển hồi văn và mây xoắn sang `T-NRM` ở L1. QC kiểm tra cánh cửa mở rõ không chắn lối đi.

#### `MT-006` — Lầu Ngũ Phụng 9 bộ mái lưu ly (ảnh ref: `40`, `82`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc gian giữa (mái Hoàng Lưu Ly) | `HV-A04` | Cặp *Lưỡng long chầu nhật* thời Nguyễn (uốn chữ S, 5 móng, sừng 2 nhánh) khảm sành sứ men lam-vàng (`HV-J01`), quả cầu lửa tỏa tia giữa, nổi `15 cm` | `G-TUBE` + `G-LATHE` | Dài `4.8m` | 1 cặp | 2 800 | `roofParts`+`goldParts` |
| Bờ nóc 8 bộ mái cánh (Thanh Lưu Ly) | `HV-B01` | Chim Phượng hoàng múa (mỏ quặp, mào lửa, cánh 5 lớp, đuôi 5 dải lông công) khảm sành sứ (`HV-J01`) đặt trên bờ nóc mái cánh, nổi `10 cm` | `G-EXT` + `G-TUBE` | `1.4m` | 8 | 7 200 | `roofParts` |
| 16 đầu đao góc mái 2 tầng | `HV-A06` | Đầu đao rồng cuốn ngửa mồm ngậm châu, đắp vữa khảm mảnh sứ xanh-trắng, vút cong `25°`, nổi `10 cm` | `G-TUBE` + `G-EXT` | `1.2m` | 16 | 10 400 | `roofParts` |
| Dải cổ diêm dưới 9 bộ mái | `HV-I05` | Hệ ô *Nhất thi nhất họa* xen kẽ 1 ô thơ chữ Hán / 1 ô tứ quý pháp lam Huế (`HV-J02`) chạy vòng cổ diêm gian giữa và 2 cánh | `T-ATLAS` + `S-SHD` | Ô `0.4×0.4m` | 48 | 0 | `goldParts` |
| Diềm mái ống ngói lưu ly | `HV-D15` | Ngói ống câu đầu & trích thủy men Hoàng Lưu Ly (giữa) và Thanh Lưu Ly (cánh, `HV-J03`) chạy mép 9 bộ mái | `G-INST` | `0.12×0.4m` | 160 | 6 400 | `roofParts` |
| **Tổng** | `requiredMotifs`: `HV-A04, HV-B01, HV-A06, HV-I05, HV-D15, HV-J01, HV-J02, HV-J03` | — | — | — | — | **26 800** | — |

**LOD/ghi chú QC:** Giữ `HV-A04`, 8 phượng `HV-B01` và 16 đầu đao `HV-A06` ở L0; L1 giảm 50% segment ống rồng và gộp ngói trích thủy `HV-D15` vào bản viền mái. QC bắt buộc kiểm tra màu đúng: mái giữa Hoàng Lưu Ly vàng, 8 mái cánh Thanh Lưu Ly xanh lục theo ảnh `40`.

#### `MT-007` — Nội thất Tầng 1 Lầu Ngũ Phụng (ảnh ref: `40`, `53`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Kiệu Bát Cống thếp vàng | `HV-A03` | 4 đầu rồng triều Nguyễn chạm nổi tại 4 đầu đòn khiêng và nóc kiệu sơn son thếp vàng (`HV-J04`), sừng 2 nhánh, 5 móng, sâu `4 cm` | `G-TUBE` + `G-DISP` | `0.6m` | 2 | 4 800 | `goldParts` |
| Bình Phong Rồng đặt sau Kiệu | `HV-D12` | Mảng chạm lộng rồng chầu mây (`HV-A05`) khung viền hồi văn trên tấm bình phong 3 cánh sơn son thếp vàng, sâu chạm thủng `5 cm` | `G-EXT` | `2.8×1.8m` | 1 | 1 600 | `goldParts`+`crimsonParts` |
| Đôi giá Bát Bửu 8 binh khí | `HV-NEW-MT-15` | 2 giá gỗ sơn son cắm 8 món binh khí cung đình thếp vàng (kích, mác, xà mâu, chùy, búa Việt, phất trần, kích bán nguyệt, giáo), nổi `3 cm` | `G-EXT` + `G-LATHE` | Cao `2.2m` | 8 | 2 560 | `goldParts` |
| Khung ô chữ Thọ chân kiệu & chân bình phong | `HV-D02` | Chữ Thọ tròn (`團壽`) chạm lộng đối xứng trên yếm kiệu và đế bình phong, sâu `2 cm` | `G-EXT` | Ø `0.28m` | 8 | 1 120 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-A03, HV-D12, HV-A05, HV-NEW-MT-15, HV-D02, HV-J04` | — | — | — | — | **10 080** | — |

**LOD/ghi chú QC:** Nội thất cận cảnh giữ toàn bộ `G-*` ở L0, tắt toàn bộ ở L2 (`> 120m`). QC góc cận cửa mở tầng 1 phải thấy rõ Kiệu, Bình Phong và đủ 8 binh khí `HV-NEW-MT-15`.

#### `MT-008` — Lầu Cánh Trong mở 3 mặt (ảnh ref: `40`, `82`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đại Hồng Chung đồng (cánh Đông) | `HV-E06` | Quai 2 rồng bồ lao chung lưng bám đỉnh, thân chia 8 ô khắc chữ Hán triều Minh Mạng, 4 núm gõ hoa sen 8 cánh nổi `4 cm`, vành miệng uốn 8 múi | `G-LATHE` + `G-TUBE` | Cao `2.2m` | 1 | 1 400 | `bronzeParts` |
| Giá gỗ treo chuông & giá Trống Sấm (cánh Tây) | `HV-A05` | Đầu kèo và tay vịn giá gỗ lim chạm *Long hóa* (đầu rồng Nguyễn tan thành lá lật và mây xoắn), sơn son thếp vàng (`HV-J04`), sâu `3.5 cm` | `G-EXT` | `0.8m` | 8 | 3 360 | `crimsonParts`+`goldParts` |
| Mặt tang Trống Sấm sơn đỏ | `HV-D05` | Cụm mây xoắn 3 vòng sơn nhũ vàng chạy vành tang trống đường kính `1.8m`, nổi nhẹ `1 cm` + `T-NRM` | `G-EXT` | `0.35m` | 8 | 960 | `goldParts` |
| Lan can bao 3 mặt mở của 2 lầu cánh | `HV-D03` | Ô chấn song chạm chữ Thọ dài (`長壽`) xen con tiện gỗ sơn son bao quanh 3 mặt thoáng, sâu `2 cm` | `G-EXT` | `0.2×0.5m` | 24 | 2 880 | `crimsonParts` |
| **Tổng** | `requiredMotifs`: `HV-E06, HV-A05, HV-D05, HV-D03, HV-J04` | — | — | — | — | **8 600** | — |

**LOD/ghi chú QC:** Giữ `HV-E06` (quai bồ lao và 4 núm gõ) ở L0/L1 vì mở 3 mặt nhìn rõ từ sân; L1 chuyển chữ Thọ `HV-D03` thành alpha texture. QC xác nhận chuông (Đông) và trống (Tây) đúng vị trí đối xứng.

#### `MT-009` — Hồ Thái Dịch & Cầu Trung Đạo (ảnh ref: `17`, `40`, `106`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 hàng lan can Cầu Trung Đạo | `HV-D04` | Ô gạch gốm men xanh lục chữ Vạn `卍` liên hoàn kẹp giữa các trụ đá thanh dọc hai bên thành cầu dài `28m`, thủng sâu `9 cm` | `G-EXT` + `G-INST` | `0.25×0.25m` | 84 | 3 360 | `roofParts` |
| 12 trụ đá dọc lan can cầu | `HV-C03` | Búp sen 3 lớp cánh khép bằng đá thanh đội trên đỉnh 12 trụ vuông cầu Trung Đạo, sâu rãnh `2 cm` | `G-LATHE` | Cao `0.45m` | 12 | 2 160 | `stoneParts` |
| Hoa sen nở trên mặt Hồ Thái Dịch | `HV-C04` | Cụm hoa sen hồng 24 cánh nhiều lớp, nhị vàng, gương sen có hạt nổi rải rác 2 bên cầu | `G-INST` + `G-LATHE` | Ø `0.35m` | 12 | 14 400 | `crimsonParts`+`goldParts` |
| Lá sen khum phủ mặt hồ | `HV-C05` | Lá sen tròn peltate khum lòng chảo, mép gợn sóng, gân tỏa nổi bao quanh các bụi sen | `G-DISP` | Ø `0.55m` | 48 | 3 072 | `roofParts` |
| **Tổng** | `requiredMotifs`: `HV-D04, HV-C03, HV-C04, HV-C05` | — | — | — | — | **22 992** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho `HV-D04`, `HV-C04`, `HV-C05`; ở L1 giảm cánh sen xuống billboard/low-poly 8 cánh, giữ silhouettes lan can xanh. QC kiểm tra lan can chữ Vạn men xanh đặc trưng Cầu Trung Đạo.

#### `MT-010` — Tứ Trụ Nghi Môn pháp lam (ảnh ref: `40`, `106`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đỉnh 2 trụ đồng chính giữa | `HV-B04` | Tượng Nghê đồng triều Nguyễn ngồi chầu quay mặt vào trục Thần Đạo, bờm xoáy 3 lọn, mõm rộng nhe nanh, sâu chạm `4 cm` | `G-*` tổ hợp | Cao `0.85m` | 2 | 2 200 | `bronzeParts` |
| Đỉnh 2 trụ ngoài | `HV-C03` | Búp sen đồng tráng pháp lam 3 lớp cánh khép trên đài tròn, cao vút đỉnh trụ biểu | `G-LATHE` | Cao `0.65m` | 2 | 360 | `bronzeParts` |
| 4 mặt thân 4 trụ biểu | `HV-J02` | Mảng pháp lam Huế (đồng tráng men xanh lam-vàng-trắng) vẽ mây rồng, hoa dây và bát bửu trong ô khung nổi | `S-SHD` | `0.55×3.8m` | 16 | 0 | `goldParts` |
| Ô lồng đèn & chữ Thọ thân trụ | `HV-D02` | 4 ô chữ Thọ tròn (`團壽`) đồng mạ vàng gắn dưới đỉnh mỗi trụ biểu (4 trụ × 4 mặt), nổi `2.5 cm` | `G-EXT` | Ø `0.32m` | 16 | 2 240 | `goldParts` |
| Bệ chân 4 trụ biểu đá thanh | `HV-D01` | Băng hồi văn chữ "Công" chạy quanh cổ bệ vuông đá thanh đỡ 4 trụ, sâu `2 cm` | `G-EXT` | Dài `16m` | 16 | 960 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-B04, HV-C03, HV-J02, HV-D02, HV-D01` | — | — | — | — | **5 760** | — |

**LOD/ghi chú QC:** Giữ 2 Nghê `HV-B04`, 2 búp sen `HV-C03` và shader pháp lam `HV-J02` ở L0/L1; chuyển chữ Thọ `HV-D02` và hồi văn `HV-D01` sang `T-NRM` ở L1. QC xác nhận ánh men pháp lam xanh-vàng đặc trưng.

#### `MT-011` — Sân Đại Triều Nghi 2 tầng & 18 Phẩm Sơn (ảnh ref: `106`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 18 bia đá Phẩm Sơn (Văn bên Đông, Võ bên Tây) | `HV-I03` | Chữ Hán khắc chìm `3–5 mm` ghi phẩm trật triều Nguyễn từ **`正一品`** (*Chính Nhất Phẩm*) đến **`從九品`** (*Tòng Cửu Phẩm*) trên 2 hàng đá đối xứng | `T-NRM` | `0.35×0.75m` | 18 | 0 | `stoneParts` |
| Trán cong 18 bia Phẩm Sơn | `HV-D05` | Cụm mây xoắn 3 vòng chạm nổi đối xứng trên trán cong vòm từng bia đá thanh, sâu `1.8 cm` | `G-EXT` | `0.3×0.15m` | 18 | 2 160 | `stoneParts` |
| Bệ chân 18 Phẩm Sơn | `HV-C01` | Hàng 16 cánh sen úp chạm nổi quanh đế vuông mỗi bia (rút gọn 8 cánh nổi rõ mỗi đế × 18 đế), sâu `2 cm` | `G-INST` | Cánh `0.08m` | 144 | 6 912 | `stoneParts` |
| Bậc đá ngăn 2 tầng sân Đại Triều | `HV-D01` | Băng hồi văn chạm dọc viền bậc tam cấp đá thanh phân tách tầng trên (quan Nhất–Tam phẩm) và tầng dưới (Tứ–Cửu phẩm), sâu `1.5 cm` | `G-EXT` | Dài `28m` | 28 | 1 680 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-I03, HV-D05, HV-C01, HV-D01` | — | — | — | — | **10 752** | — |

**LOD/ghi chú QC:** Toàn bộ cánh sen `HV-C01` dùng 1 `InstancedMesh`, hạ sang `T-NRM` ở L1; giữ hình khối 2 hàng 9+9 Phẩm Sơn ở L1. QC kiểm tra đúng bố trí 2 dãy Văn (Đông) — Võ (Tây) trên sân 2 tầng.

#### `MT-012` — Bậc tam cấp đá thanh chạm Rồng 3 lối lên Điện Thái Hòa (ảnh ref: `106`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 thành bậc tam cấp lối giữa & 2 lối bên | `HV-A03` | 4 con Rồng đá thời Nguyễn uốn thân chữ S trườn xuống bậc tam cấp hướng Nam, đầu to mắt lồi, sừng nai 2 nhánh, chân 5 móng, vảy nổi `3.5 cm` | `G-TUBE` + `G-DISP` | Dài `3.2m` | 4 | 9 600 | `stoneParts` |
| Đôi Kỳ Lân đồng mạ vàng 2 bên thềm | `HV-B03` | 2 tượng Kỳ Lân đồng thếp vàng ngồi chống chân trước trên bệ đá thanh, đầu rồng, thân hươu phủ vảy, sừng 1 nhánh, đuôi lửa, nổi `4 cm` | `G-*` tổ hợp | Cao `1.3m` | 2 | 2 800 | `goldParts` |
| Chân đế bệ đá Kỳ Lân & má bậc thềm | `HV-D06` | Băng sóng nước thủy ba xếp 3 lớp cuộn nhọn chạm nổi chạy chân bệ Kỳ Lân và má ngoài thành rồng, sâu `2.5 cm` | `G-EXT` | Dài `16m` | 16 | 1 440 | `stoneParts` |
| Mảng mây lửa sau thân rồng bậc thềm | `HV-D05` | Cụm mây xoắn triều Nguyễn chèn khe giữa các khúc uốn rồng đá trên 4 thành bậc, sâu `2 cm` | `G-EXT` | `0.35m` | 16 | 1 920 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-A03, HV-B03, HV-D06, HV-D05` | — | — | — | — | **15 760** | — |

**LOD/ghi chú QC:** Hero asset trục chính — giữ nguyên 4 rồng `HV-A03` (chuẩn Nguyễn, tuyệt đối không dùng dáng Lý/Lê Sơ) và 2 Kỳ Lân `HV-B03` ở L0; L1 đơn giản hóa lưới thân rồng 40%, chuyển sóng/mây sang `T-NRM`.

#### `MT-013` — Hệ mái *Trùng Thiềm Điệp Ốc* Điện Thái Hòa (ảnh ref: `106`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc Tiền Điện & Chính Điện | `HV-A04` | 2 cặp *Lưỡng long chầu nhật* thời Nguyễn (5 móng, sừng nai) khảm sành sứ men lam-vàng (`HV-J01`) trên 2 bờ nóc song song, quả cầu lửa giữa, nổi `15 cm` | `G-TUBE` + `G-LATHE` | Dài `5.4m` | 2 cặp | 5 600 | `roofParts`+`goldParts` |
| 12 góc mái 2 tầng Trùng Thiềm Điệp Ốc | `HV-A06` | Đầu đao rồng cuốn đắp vữa khảm sứ vút cong, miệng rồng hướng ra ngoài 4 góc tầng trên + 8 góc tầng dưới, nổi `10 cm` | `G-TUBE` + `G-EXT` | `1.3m` | 12 | 7 800 | `roofParts` |
| Hệ ô cổ diêm chạy quanh 4 mặt điện | `HV-I05` | Dải *Nhất thi nhất họa* gồm 64 ô xen kẽ 1 ô thơ chữ Hán triều Minh Mạng / 1 ô tứ quý pháp lam Huế (`HV-J02`) | `T-ATLAS` + `S-SHD` | Ô `0.42×0.42m` | 64 | 0 | `goldParts` |
| Biển hiệu chính diện cổ diêm mặt Nam | `HV-I01` | Hoành phi sơn son thếp vàng (`HV-J04`) đề 3 chữ Hán đại tự **`太和殿`** (*Thái Hòa Điện*) đọc phải sang trái, khung rồng mây nổi `5 cm` | `T-ATLAS` + `G-EXT` | `3.0×1.1m` | 1 | 180 | `goldParts` |
| Diềm mái ống Hoàng Lưu Ly | `HV-D15` | Ngói ống câu đầu chạm rồng tròn & ngói trích thủy men Hoàng Lưu Ly (`HV-J03`) viền toàn bộ 2 lớp mái | `G-INST` | `0.12×0.4m` | 200 | 8 000 | `roofParts` |
| **Tổng** | `requiredMotifs`: `HV-A04, HV-A06, HV-I05, HV-I01, HV-D15, HV-J01, HV-J02, HV-J03, HV-J04` | — | — | — | — | **21 580** | — |

**LOD/ghi chú QC:** Giữ 2 cặp rồng nóc `HV-A04`, 12 đầu đao `HV-A06` và biển `太和殿` ở L0; L1 gộp `HV-D15` thành băng diềm liên tục có `T-NRM`. QC kiểm tra kỹ máng thừa lưu nối 2 nhà (*điệp ốc*) và đủ 3 chữ `太和殿`.

#### `MT-014` — 64–80 Cột Gỗ Lim Sơn Son Thếp Vàng (ảnh ref: `106b`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Thân 80 cột gỗ lim nội thất Điện Thái Hòa | `HV-A10` | Họa tiết *Long vân* (rồng vàng triều Nguyễn 5 móng ẩn hiện trong mây xoắn cuộn quanh thân cột sơn son thếp vàng `HV-J04`), vẽ nhũ vàng mịn không tạo hình học thừa | `S-SHD` / `T-NRM` | Cột cao `7.2m` | 80 | 0 | `crimsonParts` |
| Chân tảng đá cẩm thạch 80 cột | `HV-C02` | Chân tảng đá cẩm thạch trắng chạm 16 cánh sen úp đều quanh cổ cột, gân cánh nổi `2 cm`, đế vuông bo góc | `G-LATHE` + `G-DISP` | Ø `0.75m` | 80 | 25 600 | `marbleParts` |
| Hệ xà ngang & liên ba đầu cột | `HV-C07` | Dây hoa cúc leo 10 cánh uốn sin thếp vàng chạy dọc mặt xà ngang gian giữa và gian bên, sâu `2 cm` | `G-TUBE` + `G-INST` | Dài `36m` | 36 | 5 040 | `goldParts` |
| Câu đối ôm 4 cặp cột chính trục Ngai Vàng | `HV-I02` | 8 vế câu đối cong ôm thân cột sơn son chữ Hán thếp vàng ca ngợi hoàng quyền triều Nguyễn, khung viền chỉ nổi `1.5 cm` | `T-ATLAS` + `G-EXT` | `0.32×2.6m` | 8 | 960 | `goldParts`+`crimsonParts` |
| **Tổng** | `requiredMotifs`: `HV-A10, HV-C02, HV-C07, HV-I02, HV-J04` | — | — | — | — | **31 600** | — |

**LOD/ghi chú QC:** 80 chân tảng `HV-C02` bắt buộc dùng 1 `InstancedMesh` duy nhất; ở L1 thay `HV-C02` bằng trụ vát 12 cạnh + `T-NRM` (giảm từ 25,600 xuống ~3,200 tri) và chuyển `HV-C07` sang `T-NRM`. QC xác nhận shader *Long vân* `HV-A10` hiện rõ trên cột đỏ bóng.

#### `MT-015` — Ngai Vàng Triều Nguyễn & Bửu Tán (ảnh ref: `53`, `106b`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Ngai Vàng 9 rồng & đế 3 tầng | `HV-A09` | 9 đầu rồng triều Nguyễn chạm lộng trên đỉnh tựa lưng, 2 tay vịn và chân ngai (5 móng, mắt lồi, ngậm châu), sơn son thếp vàng (`HV-J04`), sâu `4–6 cm` | `G-TUBE` + `G-EXT` | `0.25–0.55m` | 1 bộ (9 rồng) | 2 340 | `goldParts` |
| Bửu Tán (lọng gỗ 9 rồng treo trên ngai) | `HV-A09` | 9 rồng mây đắp nổi uốn quanh 4 mặt vòm tán gỗ thếp vàng, 4 góc rủ tua chỉ kim tuyến vàng, sâu `5 cm` | `G-TUBE` + `G-EXT` | `0.3–0.6m` | 1 bộ (9 rồng) | 2 340 | `goldParts` |
| Cửa võng gian chính trước Ngai Vàng | `HV-D12` | Khung cửa võng chạm lộng 3 lớp *Lưỡng long triều nhật — Bát tiên — Mai điểu* thếp vàng rực rỡ, sâu chạm thủng `6 cm` | `G-EXT` | `3.8×1.1m` | 1 | 1 600 | `goldParts` |
| Bệ tam cấp gỗ dưới Ngai Vàng | `HV-D02` | Hàng chữ Thọ tròn (`團壽`) chạm nổi xen mây xoắn (`HV-D05`) trên cổ bệ 3 tầng sơn son thếp vàng, sâu `2 cm` | `G-EXT` | Ø `0.24m` | 12 | 1 680 | `goldParts`+`crimsonParts` |
| **Tổng** | `requiredMotifs`: `HV-A09, HV-D12, HV-D02, HV-D05, HV-J04` | — | — | — | — | **7 960** | — |

**LOD/ghi chú QC:** Điểm nhấn nội thất cao cấp nhất toàn khu Huế — giữ nguyên 100% hình học L0 ở `< 25m`; cắt toàn bộ khi camera ở ngoài điện (`L2`). QC kiểm tra đủ 9 rồng trên ngai, 9 rồng trên bửu tán và đệm gấm vàng theo ảnh `53`, `106b`.

#### `MT-016` — Đôi Tán Lọng Nghi Trượng & 6 Lọ Lục Bình Cung Đình (ảnh ref: `53`, `106b`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đôi Tán Lọng vàng 2 tầng tua rủ | `HV-NEW-MT-15` | 2 lọng nghi trượng hoàng gia 2 tầng tán thêu rồng mây vàng, viền diềm tua rủ, đỉnh chóp búp sen đồng mạ vàng đứng chầu 2 bên ngai, nổi `3 cm` | `G-EXT` + `G-LATHE` | Cao `3.1m` | 2 | 640 | `goldParts`+`crimsonParts` |
| 6 Lọ Lục Bình gốm men lam Huế | `HV-J01` | Thân lọ lục bình men lam trắng vẽ *Long ẩn vân* và *Tứ linh*, cổ loe sóng lượn, bóng sâu | `S-SHD` + `T-NRM` | Cao `1.3m` | 6 | 0 | `plasterParts` |
| Cổ & đế 6 Lọ Lục Bình + đôn gỗ | `HV-C01` | Hàng 16 cánh sen chạm nổi quanh cổ đôn gỗ gụ kê 6 lục bình (6 đôn × 8 cánh nổi chính), sâu `1.5 cm` | `G-INST` | Cánh `0.07m` | 48 | 2 304 | `woodParts` |
| Chữ Thọ viền diềm tán lọng | `HV-D02` | Ô chữ Thọ tròn (`團壽`) thêu/đắp nổi 8 mặt tán lọng (2 lọng × 4 mặt chính), nổi `1.5 cm` | `G-EXT` | Ø `0.18m` | 8 | 1 120 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-15, HV-J01, HV-C01, HV-D02` | — | — | — | — | **4 064** | — |

**LOD/ghi chú QC:** Giữ 2 tán lọng và 6 lục bình ở L0; ở L1 thay cánh sen đôn `HV-C01` và chữ Thọ `HV-D02` bằng `T-NRM`. QC kiểm tra đối xứng 3 lục bình + 1 lọng mỗi bên Ngai Vàng.

#### `MT-017` — Hệ hành lang Trường Lang Tử Cấm Thành (ảnh ref: `112`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Hàng cửa sổ chữ Thọ dọc 2 cánh Trường Lang | `HV-D02` | Khung cửa sổ tròn chạm thủng chữ Thọ tròn (`團壽`) sơn đỏ-vàng đối xứng dọc tường ngoài Trường Lang, sâu thủng `4 cm` | `G-EXT` | Ø `0.65m` | 24 | 3 360 | `crimsonParts`+`goldParts` |
| Ô thông gió dọc chữ Thọ dài giữa các gian | `HV-D03` | Khung chữ Thọ dài (`長壽`) sơn son thếp vàng xen kẽ các ô cửa tròn tạo nhịp hành lang cổ điển Huế, sâu `3 cm` | `G-EXT` | `0.25×0.55m` | 24 | 2 880 | `crimsonParts`+`goldParts` |
| Diềm ngói lưu ly dọc mái 2 dãy hành lang | `HV-D15` | Ngói ống câu đầu & trích thủy men Thanh Lưu Ly (`HV-J03`) chạy dọc 2 mái Trường Lang | `G-INST` | `0.12×0.4m` | 120 | 4 800 | `roofParts` |
| Chân tảng cột gỗ Trường Lang | `HV-C02` | Chân tảng đá thanh chạm 16 cánh sen đơn giản đỡ hàng cột sơn son dọc hành lang, sâu `1.5 cm` | `G-LATHE` + `G-DISP` | Ø `0.48m` | 28 | 8 960 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-D02, HV-D03, HV-D15, HV-C02, HV-J03` | — | — | — | — | **20 000** | — |

**LOD/ghi chú QC:** Toàn bộ `HV-D02`, `HV-D03`, `HV-D15`, `HV-C02` instancing theo nhịp gian `3.2m`; ở L1 chuyển chữ Thọ sang alpha cutout và giản lược chân tảng. QC đối chiếu nhịp cửa sổ chữ Thọ theo ảnh `112`.

#### `MT-018` — Thế Miếu — Chính Điện 9 Gian (ảnh ref: `111`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc Chính Điện 9 gian | `HV-A04` | Cặp *Lưỡng long chầu nhật* triều Nguyễn khảm sành sứ (`HV-J01`) trên đỉnh mái Hoàng Lưu Ly (`HV-J03`), quả cầu lửa giữa, nổi `14 cm` | `G-TUBE` + `G-LATHE` | Dài `5.0m` | 1 cặp | 2 800 | `roofParts`+`goldParts` |
| 8 đầu đao góc mái 2 tầng | `HV-A06` | Đầu đao rồng cuốn khảm sứ uốn cong 8 góc mái Thế Miếu, nổi `9 cm` | `G-TUBE` + `G-EXT` | `1.2m` | 8 | 5 200 | `roofParts` |
| Hệ cửa bức bàn mặt tiền 9 gian | `HV-D13` | Cánh cửa bức bàn gỗ sơn son chia 3 ô (trên song con tiện, giữa chạm tứ quý `HV-C08`, dưới pano kín), sâu chạm `2 cm` | `G-EXT` + `T-NRM` | `0.75×2.4m` | 36 | 7 920 | `crimsonParts` |
| Dải cổ diêm & biển hiệu Thế Miếu | `HV-I01` | Hoành phi **`世祖廟`** (*Thế Tổ Miếu*) thếp vàng (`HV-J04`) đặt giữa dải cổ diêm *Nhất thi nhất họa* (`HV-I05`, 40 ô), khung nổi `4 cm` | `T-ATLAS` + `G-EXT` | `2.8×1.0m` | 1 | 180 | `goldParts` |
| Chân tảng 20 cột lim đỏ mặt tiền | `HV-C02` | Chân tảng đá thanh chạm 16 cánh sen úp đều đỡ 2 hàng cột hiên, sâu `2 cm` | `G-LATHE` + `G-DISP` | Ø `0.65m` | 20 | 6 400 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-A04, HV-A06, HV-D13, HV-C08, HV-I01, HV-I05, HV-C02, HV-J01, HV-J03, HV-J04` | — | — | — | — | **22 500** | — |

**LOD/ghi chú QC:** Giữ rồng nóc, đầu đao và hoành phi `世祖廟` ở L0/L1; ở L1 gộp 36 cánh cửa bức bàn `HV-D13` sang `T-NRM` và giản lược `HV-C02`. QC kiểm tra đủ 9 gian mặt tiền theo ảnh `111`.

#### `MT-019` — 9 Khám Thờ & Ngai Thờ Liệt Đế Triều Nguyễn (ảnh ref: `111`, `106b`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 9 Cửa võng chạm lộng trước 9 gian khám | `HV-D12` | 9 bộ cửa võng sơn son thếp vàng (`HV-J04`) chạm lộng rồng-phượng-tứ quý riêng biệt từng gian thờ vua Gia Long, Minh Mạng, Thiệu Trị..., sâu thủng `5 cm` | `G-EXT` | `2.6×0.9m` | 9 | 14 400 | `goldParts` |
| 9 Ngai thờ bài vị Liệt Đế | `HV-A09` | Mỗi khám đặt ngai thờ chạm 9 đầu rồng triều Nguyễn thu nhỏ thếp vàng, sâu chạm `3 cm` | `G-TUBE` + `G-EXT` | `0.15–0.35m` | 9 bộ | 21 060 | `goldParts` |
| 9 Bức hoành phi miếu hiệu từng gian | `HV-I01` | 9 biển miếu hiệu chữ Hán thếp vàng (gian giữa **`世祖高皇帝`** Gia Long, hai bên Minh Mạng, Thiệu Trị, Tự Đức...), khung nổi `3 cm` | `T-ATLAS` + `G-EXT` | `1.6×0.65m` | 9 | 1 620 | `goldParts` |
| Đỉnh đồng hương án trước mỗi khám | `HV-E07` | Đỉnh đồng 3 chân 2 quai chạm rồng, nắp gắn nghê nhỏ đặt trên án thờ chính, nổi `2.5 cm` | `G-LATHE` + `G-TUBE` | Cao `0.75m` | 9 | 8 100 | `bronzeParts` |
| **Tổng** | `requiredMotifs`: `HV-D12, HV-A09, HV-I01, HV-E07, HV-J04` | — | — | — | — | **45 180** | — |

**LOD/ghi chú QC:** Toàn bộ 9 khám đặt trong nội thất Thế Miếu — tắt hoàn toàn ngoài `35m` (culling theo cửa); L0 dùng 1 `InstancedMesh` cho khung ngai và đỉnh đồng `HV-E07` để giữ 0 draw call thừa. QC kiểm tra đủ 9 gian đối xứng.

#### `MT-020` — Hàng Cửu Đỉnh Đồng (ảnh ref: `54`, `83`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 153 ô phù điêu nổi trên thân 9 đỉnh (Cao, Nhân, Chương, Anh, Nghị, Thuần, Tuyên, Dụ, Huyền) | `HV-E05` | Mỗi đỉnh đúc nổi 17 ô (3 tầng) mô tả mặt trời, núi, sông, biển, thú, cây, thuyền, binh khí Đại Nam (9×17 = 153 hình tượng di sản tư liệu UNESCO), nổi `2.5–4 cm` | `G-DISP` | Ô `0.26×0.32m` | 9 đỉnh (153 ô) | 27 540 | `bronzeParts` |
| Thân bầu, 3 chân thú & 2 quai 9 đỉnh | `HV-E07` | Thân đỉnh đồng đúc nguyên khối dáng tròn bụng phình, 2 quai uốn vuông/rồng, 3 chân thú vững chãi cao `2.2–2.5m`, nổi `4 cm` | `G-LATHE` + `G-TUBE` | Cao `2.3m` | 9 | 8 100 | `bronzeParts` |
| Minh văn khắc hiệu đỉnh ở cổ mỗi đỉnh | `HV-I03` | Chữ Hán khắc chìm/nổi ghi tên đỉnh (**`高鼎`**, **`仁鼎`**, **`章鼎`**...) cùng trọng lượng và năm Minh Mạng thứ 16 (1835), sâu `4 mm` | `T-NRM` | `0.3×0.45m` | 9 | 0 | `bronzeParts` |
| Bệ đá thanh kê 9 đỉnh đồng | `HV-D06` | Băng sóng nước thủy ba xếp lớp chạm viền 4 cạnh chân bệ đá thanh nâng từng đỉnh, sâu `2 cm` | `G-EXT` | Dài `36m` | 36 | 3 240 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-E05, HV-E07, HV-I03, HV-D06` | — | — | — | — | **38 880** | — |

**LOD/ghi chú QC:** Di sản tư liệu thế giới UNESCO — giữ `G-DISP` nổi thật `HV-E05` ở L0 (`< 25m`), ở L1 bake 153 ô phù điêu sang `T-NRM` cao phân giải (giảm 27,540 tri → 0 tri). QC bắt buộc kiểm tra Cao Đỉnh đặt nhô lên trước hàng 8 đỉnh còn lại theo đúng ảnh `54`, `83`.

#### `MT-021` — Hiển Lâm Các 3 tầng (`17m`) (ảnh ref: `113`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc tầng 3 & 12 đầu đao 3 tầng mái | `HV-A06` | Đầu đao rồng cuốn khảm sành sứ (`HV-J01`) vút cong tại 12 góc mái Hoàng Lưu Ly (`HV-J03`), nổi `9 cm` | `G-TUBE` + `G-EXT` | `1.0m` | 12 | 7 800 | `roofParts` |
| Tường gạch vàng tầng 1 với ô thông gió | `HV-C13` | Ô gạch gốm tráng men hình hoa chanh 4 cánh thông gió lắp trên tường tầng trệt, thủng sâu `8 cm` | `G-EXT` | `0.24×0.24m` | 32 | 1 152 | `plasterParts` |
| Lan can gỗ son tầng 2 & tầng 3 | `HV-D10` | Hàng con tiện gỗ sơn son 3 bầu 2 eo bao quanh hành lang 2 tầng gác lầu gỗ, tiện tròn sâu `2 cm` | `G-LATHE` + `G-INST` | Cao `0.6m` | 64 | 3 584 | `crimsonParts` |
| Bức đại tự chính diện tầng 2 | `HV-I01` | Hoành phi sơn son thếp vàng (`HV-J04`) đề 3 chữ Hán **`顯臨閣`** (*Hiển Lâm Các*), khung viền hồi văn nổi `4 cm` | `T-ATLAS` + `G-EXT` | `2.1×0.8m` | 1 | 180 | `goldParts` |
| Cửa võng & liên ba chạm tứ quý tầng 2 | `HV-C08` | 8 ô hộc chạm nổi Mai–Lan–Cúc–Trúc sơn son thếp vàng trên vách gỗ tầng 2, sâu `2 cm` | `G-DISP` / `T-NRM` | `0.4×0.55m` | 8 | 2 080 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-A06, HV-C13, HV-D10, HV-I01, HV-C08, HV-J01, HV-J03, HV-J04` | — | — | — | — | **14 796** | — |

**LOD/ghi chú QC:** Giữ 3 tầng mái Hoàng Lưu Ly, 12 đầu đao `HV-A06` và biển `顯臨閣` ở L0/L1; chuyển `HV-C13`, `HV-D10`, `HV-C08` sang `T-NRM` ở L1. QC xác nhận chiều cao vượt trội 3 tầng đúng tỉ lệ ảnh `113`.

#### `MT-022` — Cổng Hiển Nhơn & Cổng Chương Đức khảm sành sứ (ảnh ref: `40`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc tầng thượng 2 cổng tam quan | `HV-A04` | 2 cặp *Lưỡng long chầu nhật* khảm mảnh chai, đĩa sứ men lam-lục-vàng (`HV-J01`) rực rỡ trên đỉnh cổng Đông (Hiển Nhơn) và cổng Tây (Chương Đức), nổi `14 cm` | `G-TUBE` + `G-LATHE` | Dài `4.0m` | 2 cặp | 5 600 | `roofParts`+`goldParts` |
| Đầu hồi 2 tầng mái phụ 2 cổng | `HV-B02` | Phượng ngậm cuộn thư đắp nổi khảm sành sứ đứng giữa trán mái cổng phụ hai bên, nổi `8 cm` | `G-EXT` | `0.9m` | 4 | 2 080 | `roofParts` |
| 16 đầu đao 2 cổng tam quan | `HV-A06` | Đầu đao rồng cuốn khảm gốm đa sắc vút cong 2 tầng mái mỗi cổng, nổi `9 cm` | `G-TUBE` + `G-EXT` | `1.0m` | 16 | 10 400 | `roofParts` |
| Biển tên 2 cổng mặt ngoài | `HV-I01` | 2 bức đại tự khảm sứ chữ Hán **`顯仁門`** (*Hiển Nhơn Môn*) và **`彰德門`** (*Chương Đức Môn*), khung hồi văn nổi `4 cm` | `T-ATLAS` + `G-EXT` | `2.0×0.75m` | 2 | 360 | `plasterParts`+`goldParts` |
| 24 ô hộc khảm sứ tứ quý thân trụ cổng | `HV-C08` | Ô hộc đắp nổi Mai–Lan–Cúc–Trúc khảm mảnh gốm men lam-lục (`HV-J01`) ốp 4 trụ tam quan mỗi cổng, sâu `3 cm` | `G-DISP` | `0.45×0.6m` | 16 | 4 160 | `plasterParts` |
| **Tổng** | `requiredMotifs`: `HV-A04, HV-B02, HV-A06, HV-I01, HV-C08, HV-J01` | — | — | — | — | **22 600** | — |

**LOD/ghi chú QC:** Giữ `HV-A04`, `HV-B02` và shader khảm sành sứ `HV-J01` (voronoi màu lam-lục-trắng) ở L0/L1; chuyển 16 ô `HV-C08` sang `T-NRM` ở L1. QC đối chiếu sắc độ gốm khảm rực rỡ đặc trưng Cổng Hiển Nhơn ảnh `40`.

---
## 2.2. Phố Cổ Hội An, Chùa Cầu & Hội Quán Phúc Kiến (`MT-023` → `MT-038`)

#### `MT-023` — Chùa Cầu (Lai Viễn Kiều) mặt bằng chữ T (ảnh ref: `19`, `56`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 đầu kẻ & hệ xà ngang dưới mái cầu chữ T | `HV-C11` | Lá lật (lá hóa) cuộn ngược mép răng cưa chạm trên gỗ lim nâu sậm sơn son ở đầu bẩy gian cầu và gian miếu Bắc Đế Trấn Võ, sâu `3 cm` | `G-EXT` | `0.4m` | 16 | 1 760 | `woodParts` |
| Cửa võng trước ban thờ Bắc Đế Trấn Võ (nhánh Bắc) | `HV-D12` | Cửa võng chạm lộng *Lưỡng long triều nhật* giao thoa Việt–Hoa thếp vàng (`HV-J04`) treo trước gian thờ nhô về phía Bắc, sâu thủng `4.5 cm` | `G-EXT` | `2.4×0.75m` | 1 | 1 600 | `goldParts` |
| Mặt bích 2 đầu lối vào cầu chữ T | `HV-D08` | Cặp Mắt cửa Hội An bát giác chạm 8 cánh hoa cúc, tâm âm dương sơn đỏ-đen-vàng gắn trên vòm gỗ 2 đầu cầu, nổi `3 cm` | `G-EXT` + `G-LATHE` | Ø `0.28m` | 4 | 720 | `woodParts`+`goldParts` |
| Bờ chân cầu đá xanh uốn vòm | `HV-D06` | Băng sóng nước thủy ba chạm đơn giản ở đá khóa vòm chân trụ cầu bắc qua lạch nước, sâu `2 cm` | `G-EXT` | Dài `8m` | 8 | 720 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-C11, HV-D12, HV-D08, HV-D06, HV-J04` | — | — | — | — | **4 800** | — |

**LOD/ghi chú QC:** Giữ khối chữ T, vòm lối đi cong và 4 mắt cửa `HV-D08` ở L0; chuyển `HV-C11` và `HV-D06` sang `T-NRM` ở L1, tắt cửa võng nội thất ở L2. QC kiểm tra mặt bằng chữ T chuẩn hướng nhánh thờ về phía Bắc.

#### `MT-024` — Mái ngói âm dương cong theo nhịp Chùa Cầu (ảnh ref: `19`, `56`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc cong vồng gắn đĩa gốm & cá chép/rồng | `HV-A04` | Cặp *Lưỡng long chầu nhật* đắp vữa khảm đĩa gốm men lam (`HV-J01`) trên đỉnh nóc gian miếu chữ T, thân uốn ngắn kiểu Đàng Trong, nổi `10 cm` | `G-TUBE` + `G-LATHE` | Dài `2.6m` | 1 cặp | 2 800 | `roofParts` |
| Hàng ngói âm dương viền diềm mái cong | `HV-NEW-MT-02` | Các cặp ngói âm dương phủ rêu mốc chạy dọc 2 diềm mái uốn cong theo nhịp cầu dài `18m`, giọt nước đầu mái nổi `3 cm` | `G-INST` | `0.18×0.25m` | 160 | 5 120 | `roofParts` |
| Biển hoành phi chính diện cửa cầu | `HV-I01` | Hoành phi nền đỏ son chữ Hán thếp vàng **`來遠橋`** (*Lai Viễn Kiều* — do chúa Nguyễn Phúc Chu ban năm 1719), khung triện nổi `3.5 cm` | `T-ATLAS` + `G-EXT` | `1.8×0.75m` | 1 | 180 | `crimsonParts`+`goldParts` |
| Hàng cửa sổ con tiện gỗ dọc 2 mạn cầu | `HV-D10` | Con tiện gỗ tiện tròn 3 bầu xếp kín dọc 2 thành hành lang cầu nhìn xuống lạch nước, sâu `2 cm` | `G-LATHE` + `G-INST` | Cao `0.55m` | 64 | 3 584 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-A04, HV-NEW-MT-02, HV-I01, HV-D10, HV-J01` | — | — | — | — | **11 684** | — |

**LOD/ghi chú QC:** Giữ mái cong đặc trưng, biển `來遠橋` và rồng nóc `HV-A04` ở L0/L1; ở L1 gộp `HV-NEW-MT-02` thành normal-mapped roof strip và giảm 50% con tiện `HV-D10`. QC xác nhận chính xác 3 chữ `來遠橋` theo ảnh `19`.

#### `MT-025` — 2 Cặp Tượng Chó & Khỉ gỗ chạm khắc (ảnh ref: `56`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cặp tượng Khỉ (đầu Tây) & cặp tượng Chó (đầu Đông) | `HV-B09` | 4 tượng gỗ mít chạm khối rõ tai, mõm, tay chân ngồi chầu trên bệ gỗ, khoác áo vải gấm (biểu trưng khởi công năm Thân — hoàn thành năm Tuất), sâu khối `6 cm` | `G-*` | Cao `0.7m` | 4 | 3 600 | `woodParts` |
| Bệ gỗ thờ kê 4 tượng thú | `HV-D07` | Ô triện góc lõm vuông sơn son thếp vàng (`HV-J04`) chạm trên 4 mặt bệ gỗ kê tượng Chó và Khỉ, nổi `2 cm` | `G-EXT` | `0.45×0.35m` | 8 | 320 | `crimsonParts`+`goldParts` |
| Bát hương đồng & chân nến trước 2 bệ thờ | `HV-E07` | 2 lư hương đồng 3 chân nhỏ chạm mây đơn giản đặt trước cặp tượng Khỉ và cặp tượng Chó | `G-LATHE` + `G-TUBE` | Cao `0.35m` | 2 | 1 800 | `bronzeParts` |
| Dải hồi văn chân bệ gỗ | `HV-D01` | Đường hồi văn chữ "Công" chạy viền chân 2 bệ thờ gỗ lim, sâu `1.5 cm` | `G-EXT` | Dài `6m` | 6 | 360 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-B09, HV-D07, HV-E07, HV-D01, HV-J04` | — | — | — | — | **6 080** | — |

**LOD/ghi chú QC:** Tượng trong lòng cầu — chỉ dựng đầy đủ L0 khi camera `< 20m`, ẩn ở L2. QC kiểm tra đúng vị trí 2 đầu cầu (Khỉ phía Tây, Chó phía Đông) và áo vải đỏ theo ảnh `56`.

#### `MT-026` — Dãy 20 Nhà Ống Phố Cổ tường vàng rêu mốc (ảnh ref: `84`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Diềm mái ngói âm dương 20 mặt tiền phố cổ | `HV-NEW-MT-02` | Hàng ngói âm dương cổ phủ rêu xanh chạy dọc mép mái hiên 20 căn nhà ống mặt tiền `4.5–5.5m`, nổi `2.5 cm` | `G-INST` | `0.18×0.25m` | 320 | 10 240 | `roofParts` |
| Cửa chớp lá sách gỗ tầng 2 | `HV-H05` | Khung cửa gỗ nâu/xanh rêu chứa 20 lá sách nghiêng `30°` trên tầng gác 20 ngôi nhà ống (2 cánh × 20 nhà = 40 cánh, instanced), sâu `3 cm` | `G-INST` | `0.55×1.6m` | 40 | 4 800 | `woodParts` |
| Lan can gỗ con tiện ban công tầng 2 | `HV-D10` | Hàng con tiện gỗ lim 3 bầu chạy dọc ban công gỗ tầng 2 xen ô thoáng chữ đồng tiền (`HV-D09`), sâu `2 cm` | `G-LATHE` + `G-INST` | Cao `0.55m` | 120 | 6 720 | `woodParts` |
| Ô thông gió đồng tiền trên tường hồi giật bậc | `HV-D09` | Vòng tròn chồng mép lỗ vuông giữa bằng gốm/vữa gắn trên bức tường hồi giật bậc giữa các nhà, thủng sâu `6 cm` | `G-EXT` | `0.22×0.22m` | 40 | 1 920 | `plasterParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-02, HV-H05, HV-D10, HV-D09` | — | — | — | — | **23 680** | — |

**LOD/ghi chú QC:** Toàn bộ 4 nhóm hoa văn dùng 4 `InstancedMesh` dùng chung cho cả dãy 20 nhà; L1 thay `HV-H05`, `HV-D10` và `HV-D09` bằng `T-NRM` trên mặt tường vàng rêu. QC xác nhận sắc tường vàng nghệ có rêu chân mái đúng ảnh `84`.

#### `MT-027` — Bộ Mắt Cửa Hội An (*Môn Thần*) (ảnh ref: `55`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 20 cặp Mắt cửa bát giác (10 căn tiêu biểu × 2) | `HV-D08` | Khung gỗ bát giác chạm nổi 8 cánh hoa cúc đều xung quanh tâm vòng tròn Thái cực Âm–Dương đỏ-đen-vàng thếp vàng (`HV-J04`), gắn đối xứng hai bên xà trên cửa bàn khoa, sâu chạm `3.5 cm` | `G-EXT` + `G-LATHE` | Ø `0.28m` | 40 | 7 200 | `woodParts`+`goldParts` |
| Khung chữ Thọ vuông kẹp quanh mắt cửa kiểu cổ | `HV-D02` | Chữ Thọ tròn (`團壽`) chạm chìm-nổi gắn tâm biến thể mắt cửa tròn nhà thương nhân, sâu `2 cm` | `G-EXT` | Ø `0.22m` | 8 | 1 120 | `goldParts` |
| Ván ngưỡng & xà ngang đỡ mắt cửa | `HV-D01` | Đường chỉ hồi văn chạy dọc thanh xà gỗ lim gắn đôi mắt cửa, sâu `1.2 cm` | `G-EXT` | Dài `20m` | 20 | 1 200 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-D08, HV-D02, HV-D01, HV-J04` | — | — | — | — | **9 520** | — |

**LOD/ghi chú QC:** Dùng 2 `InstancedMesh` biến thể mắt cửa bát giác hoa cúc và mắt cửa chữ Thọ; L1 hạ sang `T-NRM` đĩa tròn. QC cận cảnh phải nhìn rõ 8 cánh hoa cúc và tâm âm dương đỏ-đen theo ảnh `55`.

#### `MT-028` — Nội thất Nhà Cổ Tấn Ký (ảnh ref: `114`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bộ bàn ghế, tủ chè & hoành phi khảm xà cừ | `HV-J07` | Mảnh xà cừ óng ánh (roughness `0.15`) khảm trên nền gỗ gụ đen hình *Bách điểu*, *Tứ quý* và đại tự **`積德累功`** (*Tích Đức Lũy Công*) | `T-ATLAS` | `1.8×0.7m` | 6 mảng | 0 | `woodParts` |
| Đôi câu đối khảm xà cừ *Bách Điểu* treo 2 cột chính | `HV-I02` | 4 vế câu đối gỗ đen khảm chữ Hán cách điệu từ 100 dáng chim bay (*Bách Điểu*), viền chỉ nổi `1.5 cm` | `T-ATLAS` + `G-EXT` | `0.28×2.2m` | 4 | 480 | `woodParts` |
| Hệ vì kèo chồng rường — giả thủ kiểu "chồng rường cánh dơi" | `HV-C11` | Đầu thanh rường và bẩy gỗ mít chạm lá lật, vỏ cua và dơi ngậm tiền (ngũ phúc), sâu chạm `3 cm` | `G-EXT` | `0.35m` | 16 | 1 760 | `woodParts` |
| Cửa bức bàn ngăn phòng khách & giếng trời | `HV-D13` | 6 cánh cửa gỗ chia 3 ô: trên chấn song, giữa chạm tứ quý (`HV-C08`), dưới pano kín, sâu `2 cm` | `G-EXT` + `T-NRM` | `0.7×2.3m` | 6 | 1 320 | `woodParts` |
| Chân tảng đá Thanh Hóa dưới 8 cột gỗ chính | `HV-C02` | Chân tảng đá tròn thấp vát cạnh chạm nhẹ 16 cánh sen úp đỡ cột gỗ lim nhà cổ 200 tuổi, sâu `1.5 cm` | `G-LATHE` + `G-DISP` | Ø `0.42m` | 8 | 2 560 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-J07, HV-I02, HV-C11, HV-D13, HV-C08, HV-C02` | — | — | — | — | **6 120** | — |

**LOD/ghi chú QC:** Nội thất cận cảnh — chỉ active ở L0 (`< 20m`); ánh xà cừ `HV-J07` dùng bản đồ roughness thấp + màu iridescent nhẹ. QC kiểm tra đúng bố cục 3 gian chồng rường và giếng trời giữa nhà theo ảnh `114`.

#### `MT-029` — Tam Quan Hội Quán Phúc Kiến (ảnh ref: `115`, `84`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc 3 tầng mái cong xanh ngọc — đỏ son | `HV-A04` | 2 cặp *Lưỡng long tranh châu* kiểu Phúc Kiến (đầu rồng bờm xù, thân uốn cao khảm mảnh sứ `HV-J01` men lam-lục-vàng), quả châu lửa giữa, nổi `15 cm` | `G-TUBE` + `G-LATHE` | Dài `4.2m` | 2 cặp | 5 600 | `roofParts`+`goldParts` |
| 12 đầu đao uốn vút kiểu đuôi én Mân Nam | `HV-A06` | Đầu đao mái vút cong cao chia 2 nhánh đuôi én đắp rồng phượng khảm sành sứ (`HV-J01`), nổi `10 cm` | `G-TUBE` + `G-EXT` | `1.1m` | 12 | 7 800 | `roofParts` |
| Đôi Sư tử đá chầu 2 bên bậc Tam Quan | `HV-B10` | Cặp sư tử đá Hoa kiều (đực đè quả cầu tú cầu, cái ôm sư tử con), bờm xoăn tròn nhiều xoáy, đặt trên bệ đá vuông, sâu khối `6 cm` | `G-*` | Cao `1.05m` | 2 | 2 400 | `stoneParts` |
| Biển hoành phi chính diện tầng 2 Tam Quan | `HV-I01` | Bảng đại tự đắp nổi nền đỏ viền vàng viết 4 chữ Hán **`金山寺`** (*Kim Sơn Tự*) và biển dưới **`福建議會`** (*Phúc Kiến Nghị Hội*), khung nổi `4 cm` | `T-ATLAS` + `G-EXT` | `2.2×0.85m` | 2 | 360 | `crimsonParts`+`goldParts` |
| Diềm mái ngói ống men xanh ngọc | `HV-D15` | Ngói ống câu đầu chạm hoa tròn & ngói trích thủy men xanh lục (`HV-J03`) chạy 3 tầng mái Tam Quan | `G-INST` | `0.12×0.4m` | 120 | 4 800 | `roofParts` |
| **Tổng** | `requiredMotifs`: `HV-A04, HV-A06, HV-B10, HV-I01, HV-D15, HV-J01, HV-J03` | — | — | — | — | **20 960** | — |

**LOD/ghi chú QC:** Giữ mái đuôi én 3 tầng, đôi sư tử `HV-B10`, 2 cặp rồng nóc `HV-A04` và biển `金山寺` ở L0/L1; ở L1 gộp ngói `HV-D15` vào bản viền mái. QC kiểm tra đúng màu đỏ son — xanh ngọc nổi bật của Tam Quan.

#### `MT-030` — Chính Điện Hội Quán Phúc Kiến (ảnh ref: `115`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Khám thờ Thiên Hậu Thánh Mẫu & cửa võng | `HV-D12` | Khung cửa võng chạm lộng nhiều lớp sơn son thếp vàng (`HV-J04`) hình phượng chầu mẫu đơn và sóng biển Nam Hải, sâu thủng `6 cm` | `G-EXT` | `3.6×1.1m` | 1 | 1 600 | `goldParts` |
| 2 Phượng hoàng chầu đỉnh khám thờ Thánh Mẫu | `HV-B01` | Cặp Phượng múa thếp vàng cánh xòe 5 lớp lông, đuôi dài uốn hai bên trán khám thờ hướng vào giữa, nổi `5 cm` | `G-EXT` + `G-TUBE` | `0.9m` | 2 | 1 800 | `goldParts` |
| Đỉnh đồng lớn đặt giữa tiền điện | `HV-E07` | Đỉnh đồng 3 chân 2 quai rồng cao `1.6m`, nắp chạm lân chầu cầu, đúc chữ **`天后宮`** (*Thiên Hậu Cung*), nổi `3 cm` | `G-LATHE` + `G-TUBE` | Cao `1.6m` | 1 | 900 | `bronzeParts` |
| Cặp câu đối sơn son thếp vàng 2 cột chính điện | `HV-I02` | 4 vế câu đối ca ngợi công đức Thiên Hậu phù hộ thương thuyền vượt sóng dữ, chữ Hán thếp vàng nổi `1.5 cm` | `T-ATLAS` + `G-EXT` | `0.32×2.6m` | 4 | 480 | `crimsonParts`+`goldParts` |
| 4 ô chạm Tứ quý trên yếm hương án chính | `HV-C08` | 4 ô Mai–Lan–Cúc–Trúc chạm nổi sơn son thếp vàng mặt trước hương án thờ Thánh Mẫu, sâu `2.5 cm` | `G-DISP` | `0.4×0.55m` | 4 | 1 040 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-D12, HV-B01, HV-E07, HV-I02, HV-C08, HV-J04` | — | — | — | — | **5 820** | — |

**LOD/ghi chú QC:** Nội thất cận cảnh giữ toàn bộ ở L0; ở L1 chuyển 4 ô `HV-C08` sang `T-NRM`. QC xác nhận đủ khám thờ Thiên Hậu, 2 hộ pháp Thiên Lý Nhãn — Thuận Phong Nhĩ và đỉnh đồng trung tâm theo ảnh `115`.

#### `MT-031` — Mô hình Thuyền Buồm Thương Gia & 6 Vòng Nhang Xoắn Ốc (ảnh ref: `115`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 vòng nhang xoắn ốc hình nón treo trần + thuyền gỗ | `HV-NEW-MT-14` | 6 nhang vòng xoắn 14 tầng treo thẻ đỏ ghi lời cầu an kín trần tiền điện + 1 mô hình thuyền buồm cổ Phúc Kiến (dài `1.8m`, mắt thuyền vẽ 2 bên mũi), sâu khối `4 cm` | `G-TUBE` + `G-EXT` | `0.5–1.8m` | 7 | 1 960 | `crimsonParts`+`woodParts` |
| Sóng nước chạm dọc mạn thuyền buồm | `HV-D06` | Băng sóng nước thủy ba uốn cuộn sơn xanh-vàng chạy dọc mạn thuyền gỗ trên bệ thờ, sâu `1.5 cm` | `G-EXT` | Dài `3.6m` | 4 | 360 | `woodParts`+`goldParts` |
| Thẻ chữ Hán cầu phúc treo dưới 6 vòng nhang | `HV-I02` | 6 thẻ giấy/gỗ đỏ treo tâm vòng nhang viết chữ Hán **`平安大吉`** (*Bình An Đại Cát*) màu vàng | `T-ATLAS` + `G-EXT` | `0.15×0.45m` | 6 | 720 | `crimsonParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-14, HV-D06, HV-I02` | — | — | — | — | **3 040** | — |

**LOD/ghi chú QC:** 6 vòng nhang dùng 1 `InstancedMesh` ống xoắn (`G-TUBE`) ở L0, chuyển thành nón alpha-mapped ở L1. QC kiểm tra đúng bố trí nhang vòng treo dày đặc trên trần và mô hình thuyền buồm theo ảnh `115`.

#### `MT-032` — Cửa hiệu Đèn Lồng Lụa mở tầng trệt (ảnh ref: `44`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 30 đèn lồng lụa đa dáng treo tầng trệt | `HV-NEW-MT-01` | 30 đèn lồng lụa Hội An đủ 5 dáng (tròn, tỏi, kim cương, lục giác, đĩa bay), khung 12–16 nan tre gân nổi `1.5 cm`, vòng gỗ 2 đầu, tua lụa đỏ-vàng rủ đáy, phát sáng ấm | `G-LATHE` + `G-INST` | Ø `0.3–0.55m` | 30 | 5 400 | `crimsonParts`+`goldParts` |
| Họa tiết gấm chữ Thọ in trên mặt lụa đèn | `HV-D02` | 4 mặt lụa đèn trung tâm gắn vòng hoa văn chữ Thọ tròn (`團壽`) cắt gỗ/nhũ vàng nổi nhẹ `1 cm` | `G-EXT` | Ø `0.18m` | 8 | 1 120 | `goldParts` |
| Biển hiệu gỗ cửa hiệu đèn lồng | `HV-I04` | Biển gỗ nâu viền triện khắc chữ Quốc ngữ sơn nhũ vàng **`"ĐÈN LỒNG HỘI AN"`**, nổi `1.5 cm` | `T-ATLAS` + `G-EXT` | `1.8×0.5m` | 1 | 60 | `woodParts`+`goldParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-01, HV-D02, HV-I04` | — | — | — | — | **6 580** | — |

**LOD/ghi chú QC:** 30 đèn lồng dùng 4 `InstancedMesh` (tròn/tỏi/kim cương/lục giác) kèm emissive map ấm (`#ffaa44`); ở L1 giảm segment lathe 50%. QC đối chiếu bảng màu đa sắc đỏ-vàng-cam-xanh-tím theo ảnh `44`.

#### `MT-033` — Tiệm May Áo Dài & Quán Trà Mót vỉa hè (ảnh ref: `84`, `44`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Sạp Trà Mót cắm hoa sen & lá sen tươi | `HV-C04` | 3 bông hoa sen hồng 24 cánh nở rộ cắm trong bình gốm lớn trên sạp thảo mộc vỉa hè cùng đĩa chanh-sả | `G-INST` + `G-LATHE` | Ø `0.25m` | 3 | 3 600 | `crimsonParts` |
| Lá sen tươi lót đĩa thảo mộc & ly trà | `HV-C05` | 8 lá sen xanh peltate mép gợn trải mặt bàn gỗ sạp Trà Mót | `G-DISP` | Ø `0.35m` | 8 | 512 | `roofParts` |
| Đèn lồng treo mái hiên tiệm may & quán trà | `HV-NEW-MT-01` | 6 đèn lồng lụa vàng-đỏ treo dọc hiên gỗ tiệm may áo dài | `G-LATHE` + `G-INST` | Ø `0.35m` | 6 | 1 080 | `goldParts`+`crimsonParts` |
| Biển gỗ viết tay *"Mót Hội An"* & *"May Đo Áo Dài"* | `HV-I04` | 2 biển gỗ cổ điển chữ Quốc ngữ thư pháp sơn trắng/vàng treo mặt tiền cửa hàng | `T-ATLAS` + `G-EXT` | `1.2×0.45m` | 2 | 120 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-C04, HV-C05, HV-NEW-MT-01, HV-I04` | — | — | — | — | **5 312** | — |

**LOD/ghi chú QC:** Giữ 2 biển gỗ và 6 đèn lồng ở L0/L1; ở L1 rút gọn 3 bông sen `HV-C04` thành 8 cánh low-poly. QC kiểm tra tính sống động của sạp Trà Mót và manơcanh áo dài.

#### `MT-034` — Con Hẻm Nhỏ Tường Vàng Hội An (ảnh ref: `84`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 12 dây đèn lồng căng ngang trên cao trong hẻm | `HV-NEW-MT-01` | 12 đèn lồng lụa dáng tròn & tỏi màu vàng-đỏ-xanh treo xen kẽ dây ngang giữa 2 bức tường vàng | `G-LATHE` + `G-INST` | Ø `0.32m` | 12 | 2 160 | `crimsonParts`+`goldParts` |
| Cửa sổ chớp gỗ xanh & ô thông gió hẻm | `HV-H05` | 8 cánh cửa chớp gỗ sơn xanh rêu mở hé dọc 2 tường hẻm sâu `16m`, sâu `3 cm` | `G-INST` | `0.5×1.4m` | 8 | 960 | `woodParts` |
| Ô gạch thông gió đồng tiền trên tường rào hẻm | `HV-D09` | 12 ô gạch thông gió hình đồng tiền lỗ vuông xếp 2 dải trên tường vàng rêu mốc, thủng sâu `6 cm` | `G-EXT` | `0.2×0.2m` | 12 | 576 | `plasterParts` |
| Viền ngói âm dương trên đỉnh tường rào | `HV-NEW-MT-02` | Hàng ngói âm dương lợp mũ tường hẻm chống mưa rêu phong, nổi `2.5 cm` | `G-INST` | `0.18×0.25m` | 48 | 1 536 | `roofParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-01, HV-H05, HV-D09, HV-NEW-MT-02` | — | — | — | — | **5 232** | — |

**LOD/ghi chú QC:** Tái sử dụng toàn bộ `InstancedMesh` của dãy phố cổ `MT-026` (0 draw call phát sinh); chuyển `HV-D09` và `HV-H05` sang `T-NRM` ở L1. QC kiểm tra nền lát đá cubic và vệt rêu chân tường.

#### `MT-035` — Giàn Hoa Giấy đa tầng sắc hồng — đỏ — cam (ảnh ref: `84`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Ban công gỗ con tiện đỡ giàn hoa giấy | `HV-D10` | 24 con tiện gỗ lim 3 bầu dọc ban công tầng 2 nơi thân dây hoa giấy quấn leo qua, sâu `2 cm` | `G-LATHE` + `G-INST` | Cao `0.55m` | 24 | 1 344 | `woodParts` |
| Mái hiên ngói âm dương nơi hoa giấy rủ xuống | `HV-NEW-MT-02` | 40 cặp ngói âm dương nhấp nhô lộ ra dưới tán hoa giấy hồng-đỏ-cam | `G-INST` | `0.18×0.25m` | 40 | 1 280 | `roofParts` |
| Dây leo & cụm hoa giấy 3 tầng sắc độ | `HV-C07` | Thân dây leo uốn lượn kiểu `G-TUBE` quấn cột ban công kèm cụm lá bắc 3 cánh (hồng cánh sen, đỏ thẫm, cam tươi) tạo mảng hoa phủ dày `15 cm` | `G-TUBE` + `G-INST` | Dài `14m` | 14 | 1 960 | `crimsonParts`+`woodParts` |
| **Tổng** | `requiredMotifs`: `HV-D10, HV-NEW-MT-02, HV-C07` | — | — | — | — | **4 584** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` tán lá bắc hoa giấy 3 màu (hồng/đỏ/cam) để giảm overdraw; ở L1 giản lược dây leo thành khối canopy alpha-tested. QC kiểm tra độ tương phản hoa giấy rực rỡ trên nền tường vàng Hội An.

#### `MT-036` — Bến Bậc Đá Sông Hoài & Đội Thuyền Hoa Đăng (ảnh ref: `20`, `44`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đèn lồng treo mũi 6 thuyền gỗ sông Hoài | `HV-NEW-MT-01` | 6 đèn lồng lụa đỏ-vàng dáng tròn treo cần tre nhô ra ở mũi 6 chiếc thuyền gỗ chèo tay, phát sáng ấm | `G-LATHE` + `G-INST` | Ø `0.3m` | 6 | 1 080 | `crimsonParts`+`goldParts` |
| 80 đèn hoa đăng hình đài sen thả trôi sông Hoài | `HV-C01` | Mỗi đèn hoa đăng giấy xếp 8 cánh sen nhọn nâng ngọn nến phát sáng giữa (80 đèn × 8 cánh instanced rút gọn còn 2 cánh gộp/module → 80×1 cánh đại diện 48 tri = 3,840 tri) | `G-INST` | Ø `0.14m` | 80 | 3 840 | `goldParts`+`crimsonParts` |
| Mắt thuyền & dải sóng nước vẽ mũi 6 thuyền | `HV-D06` | Băng sóng nước uốn lượn sơn trắng-xanh chạy dọc mạn đầu mũi 6 chiếc ghe gỗ Hội An, nổi nhẹ `1 cm` | `G-EXT` | Dài `12m` | 12 | 1 080 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-01, HV-C01, HV-D06` | — | — | — | — | **6 000** | — |

**LOD/ghi chú QC:** 80 đèn hoa đăng `HV-C01` dựng 1 `InstancedMesh` có emissive tâm nến; ở L1 chuyển hoa đăng thành quad billboard phát sáng. QC kiểm tra phản chiếu đèn lồng và hoa đăng trên mặt sông Hoài ban đêm.

#### `MT-037` — Cầu An Hội bắc qua Sông Hoài (ảnh ref: `20`, `44`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 24 đèn lồng lụa treo dọc 2 bên thành Cầu An Hội | `HV-NEW-MT-01` | 24 đèn lồng lụa đa sắc (đỏ, vàng, xanh, tím) treo đối xứng trên trụ đèn dọc 2 lan can cầu dài `32m` | `G-LATHE` + `G-INST` | Ø `0.38m` | 24 | 4 320 | `crimsonParts`+`goldParts` |
| Hàng lan can con tiện sơn đỏ dọc cầu | `HV-D10` | 80 con tiện tiện tròn sơn đỏ son xếp đều hai bên cầu An Hội nối phố cổ sang chợ đêm Nguyễn Hoàng, sâu `2 cm` | `G-LATHE` + `G-INST` | Cao `0.75m` | 80 | 4 480 | `crimsonParts` |
| Khung ô chữ Thọ tròn gắn 8 trụ đèn giữa cầu | `HV-D02` | Ô chữ Thọ tròn (`團壽`) sơn vàng gắn trên thân 8 trụ cột đèn chính của cầu An Hội, nổi `2 cm` | `G-EXT` | Ø `0.3m` | 8 | 1 120 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-01, HV-D10, HV-D02` | — | — | — | — | **9 920** | — |

**LOD/ghi chú QC:** Giữ 24 đèn lồng phát sáng và thành cầu đỏ ở L0/L1; chuyển `HV-D10` và `HV-D02` sang `T-NRM`/alpha-panel ở L1. QC xác nhận màu đỏ son đồng nhất của Cầu An Hội.

#### `MT-038` — Chùa Ông (Quan Công Miếu) & Giếng Cổ Bá Lễ (ảnh ref: `84`, `115`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ nóc cổng đỏ Chùa Ông | `HV-A04` | Cặp *Lưỡng long chầu nhật* khảm sành sứ (`HV-J01`) trên bờ nóc mái ngói ống xanh lục (`HV-J03`) của Quan Công Miếu (dựng năm 1653), nổi `12 cm` | `G-TUBE` + `G-LATHE` | Dài `3.6m` | 1 cặp | 2 800 | `roofParts` |
| Diềm mái ngói ống men xanh lục | `HV-D15` | Ngói ống câu đầu chạm hoa tròn & ngói trích thủy xanh ngọc viền cổng tam quan Chùa Ông | `G-INST` | `0.12×0.4m` | 64 | 2 560 | `roofParts` |
| Hoành phi chính diện Quan Công Miếu | `HV-I01` | Bảng đại tự nền son chữ Hán thếp vàng **`關帝廟`** (*Quan Đế Miếu*) gắn trên vòm cổng đỏ, khung triện nổi `3.5 cm` | `T-ATLAS` + `G-EXT` | `2.0×0.75m` | 1 | 180 | `crimsonParts`+`goldParts` |
| Thành Giếng Cổ Bá Lễ hình vuông đá-gạch cổ | `HV-D01` | Đường gờ viền hồi văn giản lược trên thành giếng vuông xây gạch không vữa từ thời Chăm (thế kỷ VIII–IX) cải tạo thời Hội An, kèm biển chỉ dẫn `HV-I04` *"GIẾNG CỔ BÁ LỄ"*, sâu `1.5 cm` | `G-EXT` | Dài `8m` | 8 | 480 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-A04, HV-D15, HV-I01, HV-D01, HV-I04, HV-J01, HV-J03` | — | — | — | — | **6 020** | — |

**LOD/ghi chú QC:** Giữ mái ngói ống xanh Chùa Ông, biển `關帝廟` và thành giếng vuông Bá Lễ ở L0/L1; chuyển `HV-D15` sang normal strip ở L1. QC kiểm tra đúng hình dáng giếng vuông đặc trưng Bá Lễ (không vẽ giếng tròn).

---
## 2.3. Cầu Vàng — Bà Nà Hills & Cầu Rồng — Đà Nẵng (`MT-039` → `MT-052`)

#### `MT-039` — Đôi Bàn Tay Khổng Lồ giải phẫu chi tiết (ảnh ref: `48`, `85`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 10 đốt ngón tay, móng đá & nếp gấp lòng bàn tay | `HV-NEW-MT-04` | Lưới điêu khắc địa mạo-đá giả cổ tạo rãnh nếp gấp đốt ngón tay, rãnh nứt phong hóa sâu `4–8 cm` và viền móng tay đá trên 2 bàn tay khổng lồ nâng dầm cầu | `G-DISP` + `T-NRM` | Mảng `3.5×4m` | 16 | 6 720 | `stoneParts` |
| Khe rêu phong & mảng đá nứt cổ tay | `HV-H11` | Khối đá xếp giả cổ giật cấp ở phần cổ tay cắm sâu vào sườn núi Bà Nà, rãnh mạch sâu `3 cm` | `G-INST` + `T-NRM` | `0.6×0.5m` | 32 | 768 | `stoneParts` |
| Viền gân nổi ôm sống bàn tay & mu bàn tay | `HV-D05` | Đường gân hữu cơ uốn lượn dọc mu bàn tay tạo hiệu ứng điêu khắc đá phong hóa tự nhiên, nổi `3 cm` | `G-TUBE` | Dài `2.5m` | 10 | 1 200 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-04, HV-H11, HV-D05` | — | — | — | — | **8 688** | — |

**LOD/ghi chú QC:** Hero landmark của Đà Nẵng — giữ đầy đủ giải phẫu 10 ngón tay và nếp nứt `HV-NEW-MT-04` ở L0; L1 bake nếp gấp nhỏ sang `T-NRM`, giữ silhouette bàn tay nâng cầu ở L2. QC đối chiếu trực tiếp ảnh `48`, `85`.

#### `MT-040` — Vỏ ốp sườn Cầu Vàng thép mạ vàng khoét lỗ (ảnh ref: `48`, `85`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 dải vỏ ốp sườn cong dài `150m` | `HV-NEW-MT-03` | Tấm thép mạ vàng bóng cắt CNC khoét lỗ hoa văn bán nguyệt & nhịp sóng đều nhau chạy uốn lượn suốt 8 nhịp cong, mép vát nổi `2 cm` | `G-EXT` + `G-INST` | `2.0×1.2m` | 72 | 11 520 | `goldParts` |
| Đường chỉ phào mép trên — dưới dải lụa vàng | `HV-H04` | Gờ phào thép uốn cong liên tục chạy dọc đỉnh và đáy dải ốp sườn cầu tạo độ bóng phản xạ nắng, nổi `4 cm` | `G-EXT` | Dài `60m` | 60 | 2 400 | `goldParts` |
| Khớp nối đầu 8 trụ thép đỡ dầm | `HV-C14` | Mặt bích hoa thị kỹ thuật 8 lỗ bu-lông bọc vàng ốp đỉnh 8 trụ đỡ thanh mảnh dưới bụng cầu, nổi `1.5 cm` | `G-EXT` | Ø `0.45m` | 16 | 768 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-03, HV-H04, HV-C14` | — | — | — | — | **14 688** | — |

**LOD/ghi chú QC:** 72 tấm `HV-NEW-MT-03` dùng 1 `InstancedMesh` theo spline cong cầu; ở L1 chuyển lỗ khoét CNC sang alpha-cutout + `T-NRM`. QC xác nhận ánh kim vàng rực không bị bệt xám dưới ánh mặt trời.

#### `MT-041` — Lan can ống thép mạ vàng & 2 Dải Hoa Cúc Lobelia tím (ảnh ref: `85`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 hàng lan can ống thép mạ vàng dọc `150m` | `HV-H09` | Thanh đứng inox mạ vàng đặt đều cách `1.5m` kết hợp tay vịn tròn và thanh ngang đỡ dọc hai bên lối đi sàn gỗ merbau rộng `5.6m`, nổi `4 cm` | `G-INST` | Cao `1.1m` | 120 | 7 200 | `goldParts` |
| 2 dải hoa cúc Lobelia tím dọc 2 mép sàn gỗ | `HV-C07` | Băng hoa cúc nhỏ màu tím biếc xen lá xanh chạy liền mạch 2 bên sát lan can gỗ merbau (dùng module instanced hoa cúc cụm), dày `12 cm` | `G-TUBE` + `G-INST` | Dài `40m` | 40 | 5 600 | `crimsonParts` |
| Gờ viền bồn hoa bằng thép vàng | `HV-H04` | Gờ chỉ nẹp thép mạ vàng bo mép bồn hoa Lobelia giáp mặt ván gỗ merbau, nổi `2 cm` | `G-EXT` | Dài `40m` | 40 | 1 600 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-H09, HV-C07, HV-H04` | — | — | — | — | **14 400** | — |

**LOD/ghi chú QC:** Dùng `InstancedMesh` cho `HV-H09` và băng hoa `HV-C07`; ở L1 gộp hoa Lobelia thành dải alpha-cards tím có normal map. QC xác nhận đủ 2 dải hoa tím chạy sát lan can theo ảnh `85`.

#### `MT-042` — 2 Trụ Mố Cầu bằng đá granit rêu phong (ảnh ref: `48`, `85`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 4 góc 2 trụ mố đá granit đầu Tây & đầu Đông | `HV-H11` | Khối đá granit chẻ thô giật bậc (quoin) xếp so le ốp 4 góc × 2 trụ mố cầu bám sườn núi Bà Nà, sâu mạch `3 cm` | `G-INST` + `T-NRM` | `0.55×0.4m` | 48 | 1 152 | `stoneParts` |
| Mũ trụ & gờ phào đầu mố đá | `HV-H04` | Phào đá granit 3 cấp nhô ra `12 cm` bao quanh đỉnh 2 mố cầu chuyển tiếp vào lan can vàng | `G-EXT` | Dài `24m` | 24 | 960 | `stoneParts` |
| Tấm đồng gắn tên công trình trên mố Tây | `HV-I04` | Biển đồng chữ nổi serif **`"CẦU VÀNG — GOLDEN BRIDGE"`** gắn mặt tường đá granit mố Tây | `T-ATLAS` + `G-EXT` | `1.4×0.5m` | 1 | 60 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-H11, HV-H04, HV-I04` | — | — | — | — | **2 172** | — |

**LOD/ghi chú QC:** Giữ hình khối 2 mố đá và góc `HV-H11` ở L0/L1; chuyển mạch đá sang `T-NRM` ở L1. QC kiểm tra rêu bám tự nhiên phần tiếp giáp vách núi.

#### `MT-043` — Ga Cáp Treo Marseille (Đầu Tây Cầu Vàng) (ảnh ref: `48`, `85`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt tiền lâu đài đá kiểu Pháp 3 vòm cuốn | `HV-H03` | 3 lớp vòm bán nguyệt Romanesque đá xám giật cấp lùi dần tại cổng ra vào ga cáp treo Marseille, sâu hốc `15 cm` | `G-TUBE` | Ø `4.0m` | 3 | 900 | `stoneParts` |
| Hàng cửa sổ vòm nhọn & cửa chớp kiểu Pháp | `HV-H02` | Cửa sổ lancet chia 2 ô kính có vòng tròn đỉnh chạy dọc tường đá tầng 2 nhà ga Marseille, sâu `8 cm` | `G-EXT` | `1.2×3.2m` | 8 | 2 080 | `stoneParts` |
| Gờ phào mái đá & con sơn đỡ ban công | `HV-H04` | Dải phào 3 lớp kết hợp con sơn đá cuộn chạy dọc mép mái ngói xanh đen kiểu lâu đài Pháp, nổi `10 cm` | `G-EXT` | Dài `36m` | 36 | 1 440 | `stoneParts` |
| Khối đá góc tường lâu đài Marseille | `HV-H11` | Khối đá chẻ dài-ngắn giật bậc tại 4 góc tháp nhà ga cáp treo, nổi `3.5 cm` | `G-INST` + `T-NRM` | `0.5×0.4m` | 40 | 960 | `stoneParts` |
| Biển tên nhà ga kiểu Pháp trên vòm chính | `HV-I04` | Chữ kim loại mạ đồng phông serif **`"GARE MARSEILLE"`** gắn nổi trên vòm đá chính diện | `T-ATLAS` + `G-EXT` | `2.8×0.5m` | 1 | 60 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-H03, HV-H02, HV-H04, HV-H11, HV-I04` | — | — | — | — | **5 440** | — |

**LOD/ghi chú QC:** Kiến trúc Tân cổ điển Pháp — tuyệt đối không dùng họa tiết Á Đông; giữ 3 vòm `HV-H03`, mái xanh và chữ `GARE MARSEILLE` ở L0/L1, chuyển `HV-H11` và `HV-H04` sang `T-NRM` ở L1.

#### `MT-044` — Cổng Vườn Hoa Le Jardin d'Amour (Đầu Đông Cầu Vàng) (ảnh ref: `48`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 3 vòm đá hoa cương lối vào Vườn Hoa Tình Yêu | `HV-H03` | 3 vòm cuốn bán nguyệt 2 lớp lùi dần sơn trắng-kem theo phong cách vườn châu Âu cổ điển, nổi `10 cm` | `G-TUBE` | Ø `3.2m` | 3 | 900 | `whiteParts` |
| Cánh cổng & hàng rào sắt uốn nghệ thuật | `HV-H09` | Song sắt đứng sơn đen xen vòng tròn uốn chữ C và đầu giáo đồng mạ vàng hai bên cổng vườn hoa, nổi `3 cm` | `G-INST` | Cao `2.4m` | 36 | 2 160 | `ironParts` |
| Phào đỉnh vòm & con sơn trắng cổ điển | `HV-H04` | Đường phào cổ điển châu Âu chạy đỉnh tường cánh cổng và bệ tượng đá cẩm thạch trắng, nổi `6 cm` | `G-EXT` | Dài `22m` | 22 | 880 | `whiteParts` |
| Biển vòm sắt tên vườn hoa | `HV-I04` | Chữ sắt uốn mạ vàng **`"LE JARDIN D'AMOUR"`** gắn cong theo cung vòm cổng chính | `T-ATLAS` + `G-EXT` | `2.6×0.45m` | 1 | 60 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-H03, HV-H09, HV-H04, HV-I04` | — | — | — | — | **4 000** | — |

**LOD/ghi chú QC:** Giữ 3 vòm trắng và biển tên `LE JARDIN D'AMOUR` ở L0/L1; chuyển song sắt `HV-H09` sang alpha-plane ở L1. QC kiểm tra sự liên kết bậc thang từ đầu Đông Cầu Vàng xuống vườn hoa.

#### `MT-045` — Làn mây sương trôi ngang kẽ ngón tay đá (ảnh ref: `48`, `85`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Dải mây uốn lượn nghệ thuật trôi qua kẽ ngón tay | `HV-D05` | Cụm mây mềm bán trong suốt dạng ribbon 3D uốn lượn quanh cổ tay và gầm cầu ở cao độ `1.414m` hỗ trợ hệ hạt volumetric | `G-TUBE` | `2.5–6m` | 12 | 1 440 | `whiteParts` |
| Biển độ cao đặt trên đài ngắm mây | `HV-I04` | Biển inox khắc chữ **`"BÀ NÀ HILLS — 1.414m"`** gắn gần đầu cầu để người chơi định vị cao độ | `T-ATLAS` + `G-EXT` | `1.0×0.4m` | 1 | 60 | `whiteParts` |
| Gờ viền đá bệ ngắm mây sát sườn núi | `HV-H04` | Gờ đá vát cạnh bo ban công ngắm biển mây cạnh đầu Cầu Vàng, nổi `3 cm` | `G-EXT` | Dài `10m` | 10 | 400 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-D05, HV-I04, HV-H04` | — | — | — | — | **1 900** | — |

**LOD/ghi chú QC:** Mây sương chủ yếu dùng shader alpha mềm không đổ bóng (`castShadow = false`) để tránh vượt ngân sách shadow-caster; L2 tắt lớp mây cận cảnh kẽ ngón tay.

#### `MT-046` — Thân Rồng kết cấu 5 ống thép không gian (`310m`) (ảnh ref: `21`, `57`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 5 nhịp sóng thân rồng vàng vươn qua Sông Hàn | `HV-A08` | Cụm tấm vảy thép cắt uốn mạ vàng ốp dọc sống lưng 5 vòm uốn sóng lấy cảm hứng từ thân Rồng thời Lý mềm mại (không có cánh, vảy xếp nhịp đều dài `0.8m`), nổi `12 cm` | `G-EXT` + `G-INST` | Vảy `0.8m` | 2 cụm | 12 000 | `goldParts` |
| Khớp mặt bích liên kết dàn 5 ống thép không gian | `HV-C14` | Mặt bích tròn 8 lỗ bu-lông sơn vàng bọc tại các nút giằng tam giác giữa 1 ống đỉnh + 2 ống giữa + 2 ống bụng, nổi `3 cm` | `G-EXT` | Ø `0.6m` | 40 | 1 920 | `goldParts` |
| Gờ dọc gân sống lưng rồng thép | `HV-D05` | Dải vây lửa cách điệu bằng tấm thép uốn sóng chạy liên tục trên đỉnh ống thép cao nhất qua 5 nhịp vòm, nổi `15 cm` | `G-EXT` | `0.9m` | 25 | 3 000 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-A08, HV-C14, HV-D05` | — | — | — | — | **16 920** | — |

**LOD/ghi chú QC:** Giữ 5 nhịp vòm 5 ống thép và dải vảy chính `HV-A08` ở L0/L1; L1 bỏ mặt bích `HV-C14` và giảm 50% segment vây lưng. QC xác nhận hình sóng 5 vòm liên hoàn đúng thực tế Cầu Rồng Đà Nẵng ảnh `21`.

#### `MT-047` — Hệ dây cáp treo bám khít đáy vòm Cầu Rồng (ảnh ref: `21`, `57`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đầu neo cáp treo bám dầm hộp mặt cầu | `HV-C14` | Khối chụp neo cáp hình hoa thị kỹ thuật sơn vàng-xám gắn tại chân 48 dây cáp treo theo quỹ đạo sóng `z(t)`, nổi `4 cm` | `G-EXT` | Ø `0.35m` | 48 | 2 304 | `goldParts` |
| Lan can thép cầu đi bộ 2 bên mặt cầu | `HV-H09` | Hàng thanh đứng thép sơn xám-vàng có tay vịn uốn sóng nhẹ chạy dọc 2 làn bộ hành hai bên Cầu Rồng | `G-INST` | Cao `1.15m` | 80 | 4 800 | `ironParts` |
| Gờ chỉ mép dầm cầu sơn vàng đồng bộ thân rồng | `HV-H04` | Dải gờ thép bo mép ngoài dầm cầu 2 bên nơi lắp dải đèn LED viền, nổi `5 cm` | `G-EXT` | Dài `60m` | 60 | 2 400 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-C14, HV-H09, HV-H04` | — | — | — | — | **9 504** | — |

**LOD/ghi chú QC:** Neo cáp `HV-C14` và lan can `HV-H09` instanced 100%; L1 bỏ neo cáp nhỏ và gộp lan can thành dải phẳng. QC kiểm tra đầu trên cáp treo khớp chặt vào bụng vòm thép không bị hở lơ lửng.

#### `MT-048` — Đầu Rồng thời Lý cách điệu (ảnh ref: `21`, `57`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Toàn khối đầu rồng thép xếp vảy hướng ra biển Đông | `HV-A08` | Đầu rồng cao `12m` lấy cảm hứng Rồng thời Lý (không sừng, mào lửa hình lá đề uốn cong phía đỉnh đầu, tấm thép cắt uốn xếp lớp vảy, bờm lửa tỏa tròn, hàm mở lộ răng nanh, mắt LED hình trái tim), nổi khối `25 cm` | `G-EXT` + `G-INST` | Cao `12m` | 1 | 6 000 | `goldParts` |
| Mào lửa lá đề đặc trưng Rồng Lý trên trán rồng | `HV-C09` | Cụm 5 tấm thép uốn hình lá đề vút nhọn tạo mào rồng thời Lý chạy từ mũi lên đỉnh đầu, sâu `10 cm` | `G-EXT` | `1.8m` | 5 | 450 | `goldParts` |
| Dải mây xoắn & râu thép hai bên hàm rồng | `HV-D05` | 6 cụm râu-mây xoắn thép vàng uốn lượn hai bên má đầu rồng, sâu `8 cm` | `G-TUBE` | `2.2m` | 6 | 720 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-A08, HV-C09, HV-D05` | — | — | — | — | **7 170** | — |

**LOD/ghi chú QC:** Hero centerpiece của cụm Đà Nẵng — giữ đầy đủ `HV-A08` và mắt LED trái tim ở L0; ở L1 giản lược 40% tấm vảy con. QC đối chiếu trực tiếp dáng đầu rồng Lý không sừng theo ảnh `57`.

#### `MT-049` — Đuôi Rồng hình Búp Sen thép vàng (ảnh ref: `21`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cụm cánh sen thép vàng nở xòe đầu cầu phía Tây | `HV-C04` | Đuôi rồng cách điệu hình hoa sen thép mạ vàng 24 cánh nhiều lớp uốn cong hướng lên trời cao `8m`, nổi gân sống cánh `10 cm` | `G-INST` + `G-LATHE` | Ø `7.5m` | 1 | 1 200 | `goldParts` |
| Lõi búp sen nhọn đỉnh đuôi | `HV-C03` | Búp sen 3 lớp cánh khép bằng thép mạ vàng vươn lên ở trung tâm cụm hoa sen đuôi rồng, sâu gân `6 cm` | `G-LATHE` | Cao `3.2m` | 1 | 180 | `goldParts` |
| Viền cánh sen phụ nối tiếp thân ống thép | `HV-C01` | 16 cánh sen chuyển tiếp ôm quanh ống thép cuối nhịp phía Tây, nổi `6 cm` | `G-INST` | Cánh `0.6m` | 16 | 768 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-C04, HV-C03, HV-C01` | — | — | — | — | **2 148** | — |

**LOD/ghi chú QC:** Giữ silhouette hoa sen nở `HV-C04` ở cả L0–L2 vì nằm ngay trục đầu cầu Tây; L1 bỏ 16 cánh chuyển tiếp nhỏ `HV-C01`.

#### `MT-050` — Hệ 2.500 Đèn LED đổi màu & Phun Lửa — Phun Nước (ảnh ref: `21`, `57`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cụm vòi phun lửa — phun nước & cụm đèn mắt trái tim | `HV-C14` | Vỏ đèn LED hoa thị chống nước gắn dọc 5 vòm thân rồng (đại diện 64 cụm sáng lớn điều khiển shader đổi màu vàng-xanh-đỏ-tím theo nhịp) | `G-INST` | Ø `0.25m` | 64 | 3 072 | `goldParts` |
| Dải sóng cầu vồng & vệt lửa mô phỏng phun từ miệng rồng | `HV-D06` | Ribbon hình sóng lửa cam rực và luồng sương trắng phun dài `15m` từ miệng đầu rồng (kết hợp shader động) | `G-EXT` | Dài `15m` | 15 | 1 350 | `crimsonParts`+`whiteParts` |
| Biển thông tin lịch phun lửa cuối tuần đầu cầu | `HV-I04` | Biển hiện đại nền xanh-vàng ghi **`"CẦU RỒNG — ĐÀ NẴNG"`** tại quảng trường đầu rồng | `T-ATLAS` + `G-EXT` | `1.6×0.6m` | 1 | 60 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-C14, HV-D06, HV-I04` | — | — | — | — | **4 482** | — |

**LOD/ghi chú QC:** 2.500 điểm sáng LED thực hiện bằng emissive shader theo UV thân rồng + 64 cụm đèn instanced `HV-C14` (0 đèn PointLight thừa). QC kiểm tra hiệu ứng phun lửa cam không che khuất mắt trái tim.

#### `MT-051` — Công viên bờ Đông — Tượng Cá Chép Hóa Rồng (ảnh ref: `21`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Thân tượng Cá Chép Hóa Rồng đá cẩm thạch trắng (`7.5m`) | `HV-B08` | Đầu rồng lấy cảm hứng Rồng thời Lý (mào lửa, râu uốn), thân cá chép vảy tròn chạm nổi sâu `4 cm`, vây lưng lửa, đuôi xòe chéo vươn ra Sông Hàn, miệng phun cột nước | `G-TUBE` + `G-DISP` | Cao `7.5m` | 1 | 2 200 | `marbleParts` |
| Bệ sóng nước đá trắng đỡ đuôi cá chép | `HV-D06` | Băng sóng nước thủy ba xếp 3 tầng cuộn tròn quanh chân bệ tượng đá cẩm thạch Ngũ Hành Sơn, sâu `5 cm` | `G-EXT` | Dài `14m` | 14 | 1 260 | `marbleParts` |
| Viền cánh sen quanh bồn phun nước chân tượng | `HV-C01` | 16 cánh sen đá trắng xếp vòng quanh bồn thu nước bát giác dưới chân tượng, nổi `3 cm` | `G-INST` | Cánh `0.35m` | 16 | 768 | `marbleParts` |
| **Tổng** | `requiredMotifs`: `HV-B08, HV-D06, HV-C01` | — | — | — | — | **4 228** | — |

**LOD/ghi chú QC:** Giữ nguyên tượng `HV-B08` ở L0/L1; ở L1 bake vảy cá sang `T-NRM` đá trắng bóng nhẹ. QC kiểm tra hướng tượng quay mặt phun nước ra Sông Hàn đúng ảnh `21`.

#### `MT-052` — Cầu Tình Yêu Sông Hàn (ảnh ref: `21`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 14 cột đèn lồng hình trái tim đỏ rực dọc cầu tàu | `HV-NEW-MT-01` | 14 cột sắt đen vươn nhánh treo cụm 5 đèn lồng hình trái tim đỏ (70 đèn instanced rút gọn theo module 28 đèn đại diện) tỏa ánh sáng đỏ ấm dọc cầu dài `68m` | `G-LATHE` + `G-INST` | Ø `0.35m` | 28 | 5 040 | `crimsonParts` |
| Lan can sắt móc hàng trăm ổ khóa tình yêu | `HV-H09` | Hệ lan can thép đứng dọc 2 mép cầu tàu cong hình vòng cung có cụm ổ khóa đồng nhỏ gắn theo nhóm, nổi `3 cm` | `G-INST` | Cao `1.1m` | 48 | 2 880 | `ironParts` |
| Tấm đồng khắc tên Cầu Tình Yêu đầu cầu | `HV-I04` | Biển nền đỏ-vàng chữ nổi **`"CẦU TÌNH YÊU — LOVE BRIDGE"`** đặt tại cổng chào đầu cầu | `T-ATLAS` + `G-EXT` | `1.5×0.5m` | 1 | 60 | `crimsonParts`+`goldParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-01, HV-H09, HV-I04` | — | — | — | — | **7 980** | — |

**LOD/ghi chú QC:** Dùng 1 `InstancedMesh` cho đèn lồng trái tim emissive đỏ và 1 `InstancedMesh` cho lan can `HV-H09`; L1 ẩn ổ khóa chi tiết nhỏ. QC xác nhận vị trí nằm sát tượng Cá Chép Hóa Rồng bờ Đông.

---

## 2.4. Hang Sơn Đoòng & Động Phong Nha — Kẻ Bàng (`MT-053` → `MT-066`)

#### `MT-053` — Đại hành lang Hang Sơn Đoòng (`220×130×105m`) (ảnh ref: `22`, `58`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vách đá vôi chảy canxit 2 bên hành lang chính | `HV-NEW-MT-04` | Mảng gờ đá vôi chảy canxit màu kem ẩm bóng, đường vân rãnh xâm thực ngang-dọc sâu `15–40 cm` chạy suốt 2 vách hang cao `105m` | `G-DISP` + `T-NRM` | Mảng `8×8m` | 16 | 6 720 | `stoneParts` |
| Khối tảng đá vôi sụp gãy góc chân hành lang | `HV-H11` | Khối đá phân tầng đứt gãy vuông vắn xếp chồng tự nhiên dọc đáy hang Sơn Đoòng, nổi góc `10 cm` | `G-INST` + `T-NRM` | `1.2×0.8m` | 36 | 864 | `stoneParts` |
| Đường vân dòng chảy địa chất chân vách hang | `HV-D06` | Gờ sóng ăn mòn nước ngầm nhiều lớp khắc vào chân vách đá vôi cổ đại, sâu `8 cm` | `G-EXT` | Dài `24m` | 24 | 2 160 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-04, HV-H11, HV-D06` | — | — | — | — | **9 744** | — |

**LOD/ghi chú QC:** Vách đại hang giữ macro silhouette ở mọi LOD; chi tiết gờ chảy `HV-NEW-MT-04` chuyển sang triplanar `T-NRM` + roughness ướt (`0.25`) ở L1 để tiết kiệm tri.

#### `MT-054` — Hố Sụt 1 (*Watch Out for Dinosaurs*) (ảnh ref: `22`, `58`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Khối thạch nhũ *Bàn Tay Của Chàng* cao `68m` | `HV-NEW-MT-04` | Tháp thạch nhũ khổng lồ xếp tầng vảy canxit rủ dọc thân, đỉnh chóp vươn thẳng về phía miệng giếng trời `Ø45m`, rãnh chảy sâu `20 cm` | `G-DISP` + `T-NRM` | Mảng `6×8m` | 10 | 4 200 | `stoneParts` |
| Vành đá vôi vỡ bậc quanh miệng giếng trời `Ø45m` | `HV-H11` | Đá vôi gãy lớp xếp bậc quanh viền trên hố sụt nơi ánh nắng chiếu cột thể tích xuống hang, nổi `15 cm` | `G-INST` + `T-NRM` | `1.0×0.7m` | 32 | 768 | `stoneParts` |
| Mảng rêu & dương xỉ cổ sinh bám chân thạch nhũ | `HV-C07` | Dải dây leo và dương xỉ bám dày quanh sườn đá ẩm nhận ánh sáng từ Hố Sụt 1, nổi `10 cm` | `G-TUBE` + `G-INST` | Dài `16m` | 16 | 2 240 | `roofParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-04, HV-H11, HV-C07` | — | — | — | — | **7 208** | — |

**LOD/ghi chú QC:** Giữ dáng tháp thạch nhũ `68m` và miệng giếng trời `Ø45m` ở L0/L1; ở L1 hạ tán dương xỉ `HV-C07` sang alpha-cards. QC kiểm tra tia nắng volumetric chiếu đúng đỉnh *Bàn Tay Của Chàng*.

#### `MT-055` — Hố Sụt 2 (*Vườn Địa Đàng — Garden of Edam*) (ảnh ref: `58`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vách giếng trời `Ø58m` rủ rêu & nhũ đá | `HV-NEW-MT-04` | Thành vách đá vôi dựng đứng có các dải chảy canxit xen kẽ vệt rêu xanh dày đặc bao quanh Hố Sụt 2, sâu `18 cm` | `G-DISP` + `T-NRM` | Mảng `7×7m` | 12 | 5 040 | `stoneParts` |
| Dây leo nguyên sinh rủ từ miệng hố xuống rừng `22–30m` | `HV-C07` | Cụm dây leo nhiệt đới uốn lượn rủ dọc vách giếng trời vào tán rừng nguyên sinh Vườn Địa Đàng, dày `12 cm` | `G-TUBE` + `G-INST` | Dài `24m` | 24 | 3 360 | `roofParts` |
| Bậc đá rêu tự nhiên dẫn vào khu rừng trong hang | `HV-H11` | Tảng đá vôi phủ rêu xếp bậc theo lối mòn thám hiểm giữa khu rừng ngầm, nổi `8 cm` | `G-INST` + `T-NRM` | `0.9×0.5m` | 24 | 576 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-04, HV-C07, HV-H11` | — | — | — | — | **8 976** | — |

**LOD/ghi chú QC:** Rừng tán cây dùng `InstancedMesh` lá xanh rậm nhận ánh sáng chiếu thẳng từ giếng trời; L1 chuyển gờ đá vách sang `T-NRM`. QC đối chiếu góc nhìn ngược lên bầu trời theo ảnh `58`.

#### `MT-056` — Bức Tường Việt Nam (*Great Wall of Vietnam*, `80m`) (ảnh ref: `22`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt vách nhũ canxit cao `80m` cuối hang | `HV-NEW-MT-04` | Bức tường nhũ đá canxit đồ sộ có hàng chục gờ sóng kết tủa bùn-canxit màu vàng nâu ướt bóng chảy dọc từ đỉnh xuống chân, sâu `25 cm` | `G-DISP` + `T-NRM` | Mảng `8×8m` | 14 | 5 880 | `stoneParts` |
| Gờ bậc thang nhũ kết tủa ngang thân tường | `HV-D06` | Các dải gờ sóng canxit xếp lớp ngang tạo bậc bám leo núi trên Bức Tường Việt Nam, nổi `10 cm` | `G-EXT` | Dài `20m` | 20 | 1 800 | `stoneParts` |
| Thang dây thép & móc neo leo núi Oxalis | `HV-H09` | Thanh bậc thang kim loại treo cáp dọc vách dựng đứng kèm dây bảo hiểm neo vách đá, nổi `4 cm` | `G-INST` | Cao `1.0m` | 30 | 1 800 | `ironParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-04, HV-D06, HV-H09` | — | — | — | — | **9 480** | — |

**LOD/ghi chú QC:** Giữ chiều cao `80m` và thang leo `HV-H09` ở L0/L1; chuyển gờ sóng `HV-D06` sang `T-NRM` ở L1. QC xác nhận vị trí chốt chặn cuối đại hành lang Sơn Đoòng.

#### `MT-057` — Ruộng bậc thang Hồ Nhũ (*Gour Pools*) & Ngọc Động (ảnh ref: `22`, `58`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 12 tầng bờ đê canxit hình ruộng bậc thang | `HV-NEW-MT-04` | Gờ bờ đê canxit uốn lượn viền răng cưa nhỏ chứa nước xanh ngọc xếp tầng bậc thang tự nhiên, cao bờ `15–40 cm` | `G-DISP` + `T-NRM` | Mảng `3×3m` | 12 | 5 040 | `stoneParts` |
| Đường viền gờ sóng canxit trên mặt bờ đê | `HV-D06` | Họa tiết gờ sóng kết tủa vi mô xếp lớp đều theo hướng nước tràn qua từng bậc hồ nhũ, sâu `2 cm` | `G-EXT` | Dài `16m` | 16 | 1 440 | `stoneParts` |
| Cụm 24 viên Ngọc Động (*Cave Pearls*) trắng tròn | `HV-C12` | Các viên ngọc động canxit hình cầu/trứng bóng mịn màu trắng ngà kích cỡ `3–10 cm` nằm gọn trong các hốc hồ khô (tận dụng helper hình cầu/quả `G-LATHE`) | `G-LATHE` | Ø `6–10cm` | 24 | 1 440 | `marbleParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-04, HV-D06, HV-C12` | — | — | — | — | **7 920** | — |

**LOD/ghi chú QC:** Ngọc động `HV-C12` dùng 1 `InstancedMesh` ở L0 và tắt ở L1 (`> 25m`); mặt nước hồ nhũ dùng shader xanh ngọc trong suốt. QC cận cảnh kiểm tra đủ các viên ngọc động trong hốc canxit.

#### `MT-058` — Hệ 100 Trụ Nhũ Đá rủ trần (*Stalactites*) (ảnh ref: `22`, `23`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 100 trụ nhũ đá dài `6–18m` có rãnh nhỏ giọt | `HV-NEW-MT-04` | Các cột nhũ đá rủ trần dạng nón ngược nhiều khía dọc nhỏ giọt canxit (instanced 4 biến thể đại diện 100 trụ thành 12 cụm chính), sâu khía `5–12 cm` | `G-DISP` + `G-INST` | Dài `6–18m` | 12 cụm | 5 040 | `stoneParts` |
| Dải mầm nhũ nhỏ & rèm rủ xen kẽ chân trụ | `HV-C03` | Chóp nhũ nhỏ đầu nhọn xếp tầng rủ xuống quanh gốc các cột nhũ lớn (tận dụng profile `G-LATHE` búp nhọn lật ngược), nổi `4 cm` | `G-LATHE` + `G-INST` | Dài `1.2m` | 32 | 5 760 | `stoneParts` |
| Vệt rêu dương xỉ quanh nhóm nhũ gần hố sụt | `HV-C07` | Cụm rêu xanh bám dọc thân nhũ phía nhận ánh nắng hố sụt, nổi `3 cm` | `G-TUBE` + `G-INST` | Dài `10m` | 10 | 1 400 | `roofParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-04, HV-C03, HV-C07` | — | — | — | — | **12 200** | — |

**LOD/ghi chú QC:** 100 trụ nhũ gom vào 2 `InstancedMesh` (trụ lớn + mầm nhỏ); L1 giảm segment thân nón 50% và tắt `HV-C07`. QC kiểm tra độ phân bố tự nhiên trên trần hang, không xếp lưới đều giả tạo.

#### `MT-059` — Trại Thám Hiểm Bãi Cát Sơn Đoòng (ảnh ref: `22`, `58`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 lều vòm & lều bếp dã chiến mở cửa | `HV-H03` | Khung cung vòm chéo fibreglass nâng vải lều xanh-cam mở cửa hắt ánh đèn vàng ấm trên bãi cát hang, nổi gân khung `2 cm` | `G-TUBE` | Ø `2.2m` | 7 | 2 100 | `crimsonParts`+`goldParts` |
| Biển đánh dấu điểm cắm trại & nội quy bảo tồn | `HV-I04` | Biển nhôm dã chiến chữ **`"CAMP 1 — HANG ÉN / SƠN ĐOÒNG"`** cắm cạnh lều bếp và thùng thiết bị Oxalis | `T-ATLAS` + `G-EXT` | `0.8×0.5m` | 2 | 120 | `whiteParts` |
| Đá cuội xếp vòng quanh bếp dã chiến & đường lều | `HV-H11` | Hàng đá vôi cuội xếp viền lối đi bãi cát quanh 6 lều cắm trại và mũ bảo hộ có đèn pin, nổi `6 cm` | `G-INST` | `0.3×0.25m` | 24 | 576 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-H03, HV-I04, HV-H11` | — | — | — | — | **2 796** | — |

**LOD/ghi chú QC:** 6 lều vòm dùng 1 `InstancedMesh` với vật liệu emissive dịu bên trong tạo điểm sáng dẫn hướng cho người chơi trong hang tối; L2 giữ ánh sáng lều làm mốc định vị.

#### `MT-060` — Dòng Sông Ngầm Rào Thương & Mây Mù trong hang (ảnh ref: `22`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bọt sóng nước chảy xiết quanh ghềnh đá ngầm | `HV-D06` | Dải gợn sóng trắng uốn quanh các tảng đá lớn giữa dòng sông ngầm Rào Thương (kết hợp UV scroll shader), nổi `3 cm` | `G-EXT` | Dài `18m` | 18 | 1 620 | `whiteParts` |
| Tảng đá sụp mài mòn dọc 2 bờ sông ngầm | `HV-NEW-MT-04` | Cụm tảng đá vôi bị nước xoáy bào mòn tạo hốc tròn (*potholes*) và gờ chảy dọc 2 bờ sông, sâu `12 cm` | `G-DISP` + `T-NRM` | Mảng `4×3m` | 8 | 3 360 | `stoneParts` |
| Dải sương mù cuộn bay sát mặt sông lạnh | `HV-D05` | Dải sương mềm uốn xoắn bay là là trên dòng sông ngầm do chênh lệch nhiệt độ trong hang, bán trong suốt | `G-TUBE` | `3.0m` | 8 | 960 | `whiteParts` |
| **Tổng** | `requiredMotifs`: `HV-D06, HV-NEW-MT-04, HV-D05` | — | — | — | — | **5 940** | — |

**LOD/ghi chú QC:** Sương mù không đổ bóng (`castShadow = false`); ở L1 chuyển hốc đá bờ sông sang `T-NRM`. QC xác nhận mặt nước sông ngầm có phản chiếu nhũ đá từ trần hang.

#### `MT-061` — Núi Đá Vôi Cửa Động Phong Nha (`55m`) (ảnh ref: `23`, `92`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vách đá vôi dựng đứng & vòm cửa động `20×10m` | `HV-NEW-MT-04` | Khối vách karst có rãnh nước mưa ăn mòn dọc màu xám đen-kem bao quanh miệng vòm cửa động Phong Nha soi bóng sông Son, sâu rãnh `20 cm` | `G-DISP` + `T-NRM` | Mảng `8×8m` | 10 | 4 200 | `stoneParts` |
| Dây leo & tán cây rủ từ trên vòm cửa động | `HV-C07` | Hàng dây leo rủ dày đặc trước cửa hang chạm sát mặt nước sông Son xanh ngọc, dày `15 cm` | `G-TUBE` + `G-INST` | Dài `20m` | 20 | 2 800 | `roofParts` |
| Tầng đá vôi nứt khối 2 bên chân cửa động | `HV-H11` | Khối đá karst phân lớp nằm ngang lộ thiên hai bên mép nước cửa động, nổi bậc `10 cm` | `G-INST` + `T-NRM` | `1.0×0.6m` | 24 | 576 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-04, HV-C07, HV-H11` | — | — | — | — | **7 576** | — |

**LOD/ghi chú QC:** Giữ vòm cửa động rộng mở đủ cho thuyền `11m` đi vào trơn tru; L1 chuyển gờ đá nhỏ sang `T-NRM`. QC đối chiếu dáng cửa hang và màu nước sông Son xanh ngọc theo ảnh `23`, `92`.

#### `MT-062` — Lòng Động Sông Ngầm Phong Nha uốn chữ S (`95m`) (ảnh ref: `23`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vách vòm cong Hang Bi Ký & Hang Cung Đình | `HV-NEW-MT-04` | Mặt vòm hang uốn cong hình chữ S có các vân sóng đá vôi và dải nhũ chảy ánh kem-hổ phách, sâu `15 cm` | `G-DISP` + `T-NRM` | Mảng `7×6m` | 12 | 5 040 | `stoneParts` |
| Đường nước ăn mòn sát mép bãi cát ngầm | `HV-D06` | Băng rãnh sóng ăn mòn ngang sát mực nước sông ngầm trong 2 buồng hang lớn, sâu `5 cm` | `G-EXT` | Dài `22m` | 22 | 1 980 | `stoneParts` |
| Dấu tích bàn thờ Chăm cổ đổ nát trong Hang Bi Ký | `HV-F09` | Mảnh vỡ bệ thờ đá sa thạch kiểu Linga-Yoni thu nhỏ từ thế kỷ IX–X lưu lại trong Hang Bi Ký (chứng tích văn hóa Chăm Pa), sâu `3 cm` | `G-LATHE` + `G-EXT` | `0.65m` | 1 | 260 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-04, HV-D06, HV-F09` | — | — | — | — | **7 280** | — |

**LOD/ghi chú QC:** Chuẩn lịch sử — Hang Bi Ký từng là thánh đường Chăm Pa cổ nên đặt di tích bệ đá `HV-F09` thay vì đồ thờ Nguyễn; L1 hạ gờ sóng `HV-D06` sang `T-NRM`.

#### `MT-063` — Nhũ Đá Điêu Khắc Hữu Cơ ướt ánh tinh thể (ảnh ref: `23`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Màn rèm đá vôi (*curtains*) xếp nếp lượn sóng | `HV-NEW-MT-04` | Các tấm rèm đá vôi mỏng uốn nếp rủ dọc vách hang, viền răng cưa nhỏ giọt phản chiếu ánh đèn rọi hổ phách — xanh ngọc, sâu nếp `8–15 cm` | `G-DISP` + `T-NRM` | Mảng `3×5m` | 14 | 5 880 | `stoneParts` |
| Cụm cột nhũ tầng hình ngai vua — sư tử — kỳ lân | `HV-C03` | Nhũ đá mọc ngược (*stalagmites*) dáng búp nhọn xếp tầng tại buồng Hang Cung Đình (tận dụng profile `G-LATHE` hữu cơ), cao `2–4m` | `G-LATHE` + `G-INST` | Cao `2.8m` | 20 | 3 600 | `stoneParts` |
| Khía vảy tinh thể canxit lấp lánh | `HV-C01` | Mảng vảy kết tinh canxit xếp lớp như cánh sen ngược quanh gốc cột nhũ tầng (instanced), nổi `3 cm` | `G-INST` | `0.15m` | 48 | 2 304 | `marbleParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-04, HV-C03, HV-C01` | — | — | — | — | **11 784** | — |

**LOD/ghi chú QC:** Vật liệu tinh thể dùng roughness thấp (`0.18`) + specular mạnh để bắt sáng đèn hắt hổ phách/xanh ngọc; L1 tắt vảy nhỏ `HV-C01`. QC đối chiếu ánh sáng kỳ ảo trong hang theo ảnh `23`.

#### `MT-064` — Đội Thuyền Du Lịch Phong Nha (ảnh ref: `92`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Khung mái bạt vòm của 3 thuyền `11m` | `HV-H03` | Hệ 5 cung ống thép uốn vòm nâng mái bạt xanh-trắng trên mỗi thuyền du lịch Phong Nha (3 thuyền × 5 cung = 15 cung instanced), nổi `3 cm` | `G-TUBE` | Rộng `2.0m` | 15 | 4 500 | `whiteParts` |
| Họa tiết sóng nước & mắt thuyền mũi 3 thuyền | `HV-D06` | Đường kẻ sóng xanh lam — trắng uốn dọc mạn thân thuyền dài `11m` và mắt thuyền sơn đỏ-trắng ở mũi, nổi nhẹ `1 cm` | `G-EXT` | Dài `18m` | 18 | 1 620 | `whiteParts` |
| Biển số hiệu thuyền du lịch Phong Nha | `HV-I04` | Biển số đăng ký chữ trắng nền xanh **`"QB-0128 / PHONG NHA"`** gắn 2 bên mũi 3 thuyền | `T-ATLAS` + `G-EXT` | `0.7×0.25m` | 6 | 360 | `whiteParts` |
| **Tổng** | `requiredMotifs`: `HV-H03, HV-D06, HV-I04` | — | — | — | — | **6 480** | — |

**LOD/ghi chú QC:** 3 thuyền dùng chung 1 cụm `InstancedMesh` khung mái `HV-H03` và ghế gỗ; L1 giản lược đường sóng mạn thành texture. QC xác nhận đúng phối màu xanh dương — trắng, áo phao cam và đèn mũi theo ảnh `92`.

#### `MT-065` — Lối đi cầu gỗ chiếu sáng sát vách Hang Bi Ký (ảnh ref: `23`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Văn khắc chữ Chăm cổ trên vách đá Hang Bi Ký | `HV-NEW-MT-05` | 97 dòng chữ Chăm cổ (hệ tự mẫu Pallava — Chăm tk IX–X) khắc chìm `3–6 mm` trên mặt vách đá vôi mịn sát lối cầu gỗ, tuyệt đối không dùng chữ Hán | `T-NRM` + `T-ATLAS` | `1.8×1.2m` | 2 mảng | 0 | `stoneParts` |
| Lan can gỗ dọc lối cầu đi bộ sát vách hang | `HV-D10` | Trụ tiện gỗ nâu trầm đặt dọc 1 bên lối đi cầu gỗ dài `24m` dẫn khách tham quan Hang Bi Ký, sâu `2 cm` | `G-LATHE` + `G-INST` | Cao `0.85m` | 36 | 2 016 | `woodParts` |
| Khung dây lá Chăm cổ mờ phai quanh bia khắc | `HV-C10` | Dây lá cuốn Chăm chạm nông bị phong hóa viền trên vách văn khắc cổ trong Hang Bi Ký, sâu `1.5 cm` | `G-TUBE` / `T-NRM` | Dài `4m` | 4 | 720 | `stoneParts` |
| Biển thuyết minh di tích Hang Bi Ký | `HV-I04` | Biển inox đèn hắt ghi **`"HANG BI KÝ — VĂN KHẮC CHĂM CỔ THẾ KỶ IX–X"`** đặt sát lan can gỗ | `T-ATLAS` + `G-EXT` | `0.9×0.5m` | 1 | 60 | `whiteParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-05, HV-D10, HV-C10, HV-I04` | — | — | — | — | **2 796** | — |

**LOD/ghi chú QC:** Chuẩn lịch sử — bắt buộc dùng chữ Chăm cổ `HV-NEW-MT-05` trên vách đá; L1 chuyển `HV-C10` sang `T-NRM` và giản lược con tiện `HV-D10`. QC kiểm tra đèn LED hắt vàng chiếu rõ mảng văn khắc.

#### `MT-066` — Bến Thuyền Cửa Động Phong Nha (ảnh ref: `92`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Diềm mái ngói đỏ nhà chờ bến thuyền | `HV-D15` | Hàng ngói ống viền diềm mái 4 dốc nhà chờ khách tham quan bến Phong Nha | `G-INST` | `0.12×0.4m` | 64 | 2 560 | `roofParts` |
| Biển hiệu lớn mặt tiền nhà chờ bến thuyền | `HV-I04` | Chữ nổi kim loại vàng nền xanh **`"ĐỘNG PHONG NHA — DI SẢN THIÊN NHIÊN THẾ GIỚI"`** gắn trên mái sảnh đón khách | `T-ATLAS` + `G-EXT` | `4.2×0.8m` | 1 | 60 | `goldParts` |
| Lan can gỗ ven cầu tàu & cọc neo thuyền | `HV-D10` | Hàng con tiện gỗ sơn nâu chạy dọc hành lang bến lên xuống thuyền bờ sông Son, sâu `2 cm` | `G-LATHE` + `G-INST` | Cao `0.8m` | 32 | 1 792 | `woodParts` |
| Gờ phào cột bê tông sơn trắng nhà chờ | `HV-H04` | Phào chỉ đơn giản bọc đầu 8 cột vuông nhà chờ du lịch Phong Nha, nổi `3 cm` | `G-EXT` | Dài `16m` | 16 | 640 | `whiteParts` |
| **Tổng** | `requiredMotifs`: `HV-D15, HV-I04, HV-D10, HV-H04` | — | — | — | — | **5 052** | — |

**LOD/ghi chú QC:** Giữ biển `"ĐỘNG PHONG NHA"` và dáng mái ngói đỏ ở L0/L1; chuyển `HV-D15` và `HV-D10` sang `T-NRM` ở L1. QC kiểm tra đúng vị trí nối liền tuyến thuyền vào cửa động.

---
## 2.5. Thánh Địa Mỹ Sơn & Tháp Chàm Poshanư (`MT-067` → `MT-078`)

#### `MT-067` — Tháp Chính A1 Mỹ Sơn & Tiền Sảnh đơn chuẩn (ảnh ref: `24`, `41`, `86b`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt vòm cửa Tiền Sảnh & 3 cửa giả thân tháp | `HV-F01` | Mặt quái vật *Kala* (mắt lồi, nanh nhọn, không hàm dưới, 2 tay giữ dây hoa lá cuốn) chạm nổi sâu `8 cm` trên đỉnh vòm nhọn sa thạch & gạch nung | `G-DISP` | `0.9×0.7m` | 4 | 2 800 | `chamBrick`+`stoneParts` |
| 2 chân vòm cuốn cửa chính & cửa giả | `HV-F02` | Đôi thủy quái *Makara* (thân cá sấu, vòi voi cuộn ngược, mồm nhả dây lá cuốn) đặt đối xứng ở 2 chân vòm nhọn phong cách Mỹ Sơn A1 thế kỷ X, sâu `6 cm` | `G-DISP` | `0.6×0.5m` | 8 | 3 840 | `chamBrick` |
| 3 cửa giả mặt Bắc — Tây — Nam thân tháp | `HV-F05` | Khung cửa giả lồng 3 tầng giật cấp lùi dần kết hợp vòm cuốn lá đề 4 lớp (`HV-F03`), chạm trực tiếp trên gạch mài chập (`HV-F11`), sâu hốc `18 cm` | `G-EXT` | `1.6×3.8m` | 3 | 1 260 | `chamBrick` |
| Hệ cột áp tường khía rãnh quanh 4 mặt tháp | `HV-F04` | 16 trụ áp tường ốp gạch Chăm khía 5 rãnh dọc, đầu cột nở hoa sen và dây lá cuốn (`HV-C10`), sâu rãnh `3 cm` | `G-EXT` | Cao `5.5m` | 16 | 1 920 | `chamBrick` |
| 12 tháp góc (*kudu* / tháp mô hình) trên 3 tầng mái | `HV-F10` | 4 tháp góc thu nhỏ đặt 4 góc mỗi tầng × 3 tầng mái giật cấp vươn cao chuẩn phong cách Mỹ Sơn A1, nổi khối `12 cm` | `G-*` thu nhỏ | Cao `1.2m` | 12 | 2 640 | `chamBrick` |
| **Tổng** | `requiredMotifs`: `HV-F01, HV-F02, HV-F05, HV-F03, HV-F04, HV-C10, HV-F10, HV-F11` | — | — | — | — | **12 460** | — |

**LOD/ghi chú QC:** Hero monument của Mỹ Sơn (chuẩn tk X, tuyệt đối không dùng rồng Việt hay ngói lưu ly); giữ *Kala–Makara*, cửa giả 3 tầng và 12 tháp góc `HV-F10` ở L0, chuyển *Kala–Makara* và rãnh cột `HV-F04` sang `T-NRM` ở L1. QC yêu cầu `motifCoverage >= 9` cho cụm Mỹ Sơn theo quy chuẩn thư viện.

#### `MT-068` — Tháp Kho (Kosa / B5) mái hình thuyền yên ngựa (ảnh ref: `86`, `86b`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 đầu hồi mái hình thuyền yên ngựa vươn cao | `HV-NEW-MT-07` | Mái cuốn hình vòm cong lõm giữa, 2 đầu hồi vút cong như mũi thuyền, viền 3 lớp gờ bậc thang và hình lá đề đỉnh hồi đặc trưng Tháp Kho B5 (Kosa Graha), nổi `14 cm` | `G-EXT` + `G-TUBE` | Dài `7.5m` | 2 | 1 080 | `chamBrick` |
| Mặt vòm cuốn lá đề 2 đầu hồi Đông — Tây | `HV-F03` | 4 lớp vòm nhọn lá đề lồng nhau ốp gạch Chăm mài chập (`HV-F11`) trên 2 đầu hồi cao vút, nổi `10 cm` | `G-EXT` | Cao `3.2m` | 2 | 1 200 | `chamBrick` |
| Dải dây lá cuốn Chăm chạy ngang chân mái thuyền | `HV-C10` | Băng dây lá xoắn ốc kiểu acanthus chạm sâu `3 cm` vào gạch nung đỏ sẫm bao quanh 4 mặt cổ mái Kosa | `G-TUBE` / `T-NRM` | Dài `20m` | 20 | 3 600 | `chamBrick` |
| Hệ cột áp tường khía rãnh thân tháp B5 | `HV-F04` | 12 trụ áp tường khía 3 rãnh dọc phân chia các ô vách gạch đỏ sẫm rêu phong, sâu `2.5 cm` | `G-EXT` | Cao `3.6m` | 12 | 1 440 | `chamBrick` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-07, HV-F03, HV-C10, HV-F04, HV-F11` | — | — | — | — | **7 320** | — |

**LOD/ghi chú QC:** Giữ dáng mái hình thuyền yên ngựa độc đáo `HV-NEW-MT-07` ở cả L0–L2; ở L1 chuyển dây lá cuốn `HV-C10` sang `T-NRM` gạch Chăm. QC đối chiếu silhouette 2 đầu hồi cong vút theo ảnh `86`.

#### `MT-069` — Tháp phụ phế tích tàn phá nửa phần (ảnh ref: `86b`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt gạch nung Chăm lộ lõi vỡ & mạch mài chập | `HV-F11` | Mảng gạch nung đỏ sẫm mài chập gần như không mạch vữa xen vùng gãy vỡ phủ rêu đen-xanh đậm do tàn phá chiến tranh | `T-NRM` + `S-SHD` | Toàn khối | 1 mảng | 0 | `chamBrick` |
| Cửa giả bị vỡ một nửa trên vách còn lại | `HV-F05` | 2 khung cửa giả giật cấp còn nguyên phần dưới và sứt mẻ phần đỉnh vòm nhọn, sâu hốc `15 cm` | `G-EXT` | `1.2×2.4m` | 2 | 840 | `chamBrick` |
| Cột áp tường khía rãnh đứt đoạn | `HV-F04` | 8 trụ áp tường bị gãy ngang thân lộ đầu gạch răng cưa rêu mốc, sâu rãnh `2.5 cm` | `G-EXT` | Cao `2.2–4m` | 8 | 960 | `chamBrick` |
| Khối gạch đổ & dương xỉ mọc từ khe tường vỡ | `HV-C07` | Cụm dây leo dương xỉ bám rủ từ miệng vách gạch đổ nát phía đỉnh phế tích, dày `8 cm` | `G-TUBE` + `G-INST` | Dài `8m` | 8 | 1 120 | `roofParts` |
| **Tổng** | `requiredMotifs`: `HV-F11, HV-F05, HV-F04, HV-C07` | — | — | — | — | **2 920** | — |

**LOD/ghi chú QC:** Giữ mặt cắt sứt mẻ phế tích chân thực theo ảnh `86b`; L1 chuyển `HV-C07` sang alpha-cards rêu/dương xỉ. QC kiểm tra không tạo thành khối tháp nguyên vẹn giả tạo.

#### `MT-070` — Tường thành gạch Chăm cổ & Suối Khe Thẻ (ảnh ref: `86`, `86b`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cổng tháp Gopura mở qua tường thành Khu B–C–D | `HV-F03` | 2 vòm cuốn lá đề 3 lớp lồng nhau bằng gạch mài chập (`HV-F11`) trên cổng vào tường thành bao rộng `68×62m`, nổi `10 cm` | `G-EXT` | Cao `2.8m` | 2 | 1 200 | `chamBrick` |
| Gờ mũ tường thành chạm dây lá cuốn & cánh sen | `HV-C01` | Hàng cánh sen gạch nung úp ngược chạy dọc đỉnh tường gạch thấp đoạn mặt tiền cổng Khu B (64 cánh đại diện instanced), sâu `2 cm` | `G-INST` | Cánh `0.15m` | 64 | 3 072 | `chamBrick` |
| Viền bậc đá suối Khe Thẻ chảy ngang thung lũng | `HV-H11` | Khối đá cuội và sa thạch kè 2 bờ suối Khe Thẻ dẫn cầu gỗ vào Khu B–C–D, nổi `6 cm` | `G-INST` + `T-NRM` | `0.6×0.4m` | 36 | 864 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-F03, HV-F11, HV-C01, HV-H11` | — | — | — | — | **5 136** | — |

**LOD/ghi chú QC:** Giữ cổng Gopura `HV-F03` và tuyến tường thành gạch đỏ `68×62m` ở L0/L1; chuyển `HV-C01` sang `T-NRM` ở L1. QC kiểm tra rêu ẩm và dòng suối Khe Thẻ trong xanh.

#### `MT-071` — Phù điêu Vũ nữ Apsara & Nhạc công Gandharva (ảnh ref: `41`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 ô phù điêu Vũ nữ Apsara trên bệ đá sa thạch | `HV-F06` | Vũ nữ Apsara dáng múa *Tribhanga* uốn hông chữ S, tay bắt ấn mềm mại, đội mũ tháp nhọn, chân co nhảy múa trong vòm lá đề (`HV-C09`), nổi `5 cm` | `G-DISP` | Cao `0.8m` | 6 | 3 600 | `stoneParts` |
| 4 ô phù điêu Nhạc công trời Gandharva | `HV-F07` | Nhạc công Gandharva ngồi xếp bằng thổi sáo, gảy đàn dây, đầu đội mũ chóp, dải khăn bay uốn quanh vai đặt xen kẽ Apsara, nổi `4.5 cm` | `G-DISP` | Cao `0.65m` | 4 | 2 000 | `stoneParts` |
| Khung vòm lá đề ôm từng tượng phù điêu | `HV-C09` | 10 khung lá đề nhọn đỉnh (hình tim đuôi dài) chạm nổi viền quanh 6 ô Apsara và 4 ô Gandharva, sâu `3 cm` | `G-EXT` | Cao `0.9m` | 10 | 900 | `stoneParts` |
| Dải dây lá cuốn Chăm chạy chân bệ sa thạch | `HV-C10` | Băng dây lá xoắn ốc liên tục chạm viền trên và dưới bệ đá phù điêu dài `12m`, sâu `2.5 cm` | `G-TUBE` / `T-NRM` | Dài `12m` | 12 | 2 160 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-F06, HV-F07, HV-C09, HV-C10` | — | — | — | — | **8 660** | — |

**LOD/ghi chú QC:** Đỉnh cao điêu khắc đá Chăm Pa (bệ thờ Mỹ Sơn E1 / A1) — giữ nổi thật `G-DISP` ở L0 (`< 20m`); chuyển toàn bộ sang `T-NRM` ở L1. QC cận cảnh đối chiếu dáng múa Apsara theo ảnh `41`.

#### `MT-072` — Tượng Hộ Pháp Dvarapala & Bệ Linga-Yoni (ảnh ref: `41`, `86`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đôi Tượng Hộ Pháp Dvarapala gác cửa Tiền Sảnh | `HV-NEW-MT-06` | 2 tượng Hộ pháp sa thạch cao `1.5m` đứng 2 bên lối vào, mắt tròn dữ, ria vểnh, đội mũ chóp nhiều tầng, tay chống chùy lớn bảo vệ đền Shiva, nổi khối `8 cm` | `G-DISP` + `G-LATHE` | Cao `1.5m` | 2 | 2 200 | `stoneParts` |
| Bệ thờ Linga-Yoni đặt giữa lòng Tiền Sảnh | `HV-F09` | Bệ Yoni vuông có vòi máng thoát nước thiêng hướng Bắc đỡ trụ tròn Linga biểu trưng thần Shiva (gồm 3 phần Brahma vuông — Vishnu bát giác — Rudra tròn), sâu `4 cm` | `G-LATHE` + `G-EXT` | `1.1×1.1m` | 1 | 260 | `stoneParts` |
| Hàng cánh sen Chăm chạm quanh cổ bệ Yoni | `HV-C01` | 16 cánh sen bầu Chăm chạm nổi đều 4 cạnh bệ đá Yoni dưới trụ Linga, sâu `2.5 cm` | `G-INST` | Cánh `0.12m` | 16 | 768 | `stoneParts` |
| Mâm hoa sứ trắng & lư hương gốm Chăm | `HV-C14` | Cụm 12 bông hoa sứ (hoa đại) 5 cánh trắng nhị vàng xếp trên bệ Yoni (dùng module hoa tròn `G-EXT`) | `G-EXT` | Ø `0.08m` | 12 | 576 | `whiteParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-06, HV-F09, HV-C01, HV-C14` | — | — | — | — | **3 804** | — |

**LOD/ghi chú QC:** Chuẩn tín ngưỡng Shiva giáo Chăm Pa — máng Yoni bắt buộc quay về hướng Bắc; giữ `HV-NEW-MT-06` và `HV-F09` ở L0, ẩn hoa nhỏ `HV-C14` ở L1.

#### `MT-073` — 2 Nhà Trưng Bày Bia Ký Sa Thạch (ảnh ref: `41`, `86`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 tấm bia ký sa thạch khắc chữ Phạn & Chăm cổ | `HV-NEW-MT-05` | Chữ Phạn (Sanskrit) và Chăm cổ khắc chìm sâu `3–5 mm` trên 6 tấm bia đá lớn (niên đại vua Bhadravarman — Prakasadharma) đặt trong 2 nhà trưng bày | `T-NRM` + `T-ATLAS` | `0.8×1.5m` | 6 | 0 | `stoneParts` |
| Đầu tượng Makara trưng bày trên bệ đá | `HV-F02` | 2 đầu thủy quái Makara sa thạch chạm nổi tinh xảo mắt tròn, vòi cuốn, hàm răng nanh trưng bày cạnh bia ký, sâu `6 cm` | `G-DISP` | `0.7m` | 2 | 960 | `stoneParts` |
| Mảnh vỡ bệ Yoni & phù điêu Durga lưu giữ | `HV-F08` | 1 tấm tympanum sa thạch chạm nổi nữ thần *Durga Mahishasuramardini* 6 tay cầm khí giới đứng trên đầu trâu trưng bày trong nhà bảo vệ, sâu `5 cm` | `G-DISP` | Cao `1.2m` | 1 | 1 200 | `stoneParts` |
| Mái ngói đỏ bảo vệ 2 nhà trưng bày & biển thuyết minh | `HV-I04` | 2 biển thuyết minh song ngữ Việt–Anh **`"NHÀ TRƯNG BÀY BIA KÝ CHĂM PA"`** đặt cạnh bệ trưng bày | `T-ATLAS` + `G-EXT` | `0.9×0.5m` | 2 | 120 | `whiteParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-05, HV-F02, HV-F08, HV-I04` | — | — | — | — | **2 280** | — |

**LOD/ghi chú QC:** Nội thất trưng bày — giữ `HV-F02`, `HV-F08` và normal map chữ Phạn `HV-NEW-MT-05` ở L0 (`< 25m`), tắt các hiện vật nhỏ bên trong ở L2.

#### `MT-074` — Tháp Chính A Poshanư phong cách Hòa Lai (ảnh ref: `25`, `87`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vòm cửa Đông rộng & 3 vòm cửa giả phong cách Hòa Lai | `HV-F03` | Hệ vòm cuốn cung nhọn rộng 5 lớp lồng nhau vươn cao mềm mại đặc trưng phong cách Hòa Lai (cuối thế kỷ VIII – đầu thế kỷ IX) trên 4 mặt Tháp A cao `15m`, sâu `18 cm` | `G-EXT` | Cao `3.8m` | 4 | 2 400 | `chamBrick` |
| 3 cửa giả giật cấp mặt Bắc — Tây — Nam | `HV-F05` | Khung cửa giả 3 tầng giật cấp sâu đục chạm trực tiếp trên gạch mài chập (`HV-F11`) gió biển màu nâu đỏ sáng, sâu `16 cm` | `G-EXT` | `1.5×3.4m` | 3 | 1 260 | `chamBrick` |
| Cột áp tường khía rãnh đặc trưng Hòa Lai | `HV-F04` | 16 trụ áp tường khía 4 rãnh dọc bản rộng kèm băng dây lá cuốn Chăm (`HV-C10`) ở đầu trụ, sâu `3 cm` | `G-EXT` | Cao `4.8m` | 16 | 1 920 | `chamBrick` |
| 8 tháp góc thu nhỏ trên 2 tầng mái trên | `HV-F10` | 4 tháp góc mỗi tầng × 2 tầng mái vuông giật cấp mềm mại đúng nguyên mẫu Tháp A Poshanư, nổi `10 cm` | `G-*` thu nhỏ | Cao `1.0m` | 8 | 1 760 | `chamBrick` |
| **Tổng** | `requiredMotifs`: `HV-F03, HV-F05, HV-F11, HV-F04, HV-C10, HV-F10` | — | — | — | — | **7 340** | — |

**LOD/ghi chú QC:** Chuẩn niên đại Hòa Lai tk VIII–IX (không gán Kala-Makara dày kiểu Mỹ Sơn A1 hay rồng Việt); giữ 4 vòm cung nhọn rộng `HV-F03` và 8 tháp góc `HV-F10` ở L0/L1 theo ảnh `87`.

#### `MT-075` — Lòng Tháp A Poshanư đục thông cửa Đông (ảnh ref: `25`, `87`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bệ thờ Linga-Yoni đá đen nguyên khối giữa lòng tháp | `HV-F09` | Bộ Linga-Yoni đá bazan đen bóng nguyên khối cao `1.1m` đặt chính tâm lòng tháp, vòi Yoni hướng Bắc, chạm gờ chỉ sắc nét sâu `3 cm` | `G-LATHE` + `G-EXT` | `1.0×1.0m` | 1 | 260 | `stoneParts` |
| Hàng cánh sen chạm trên cổ bệ đá đen | `HV-C01` | 16 cánh sen bầu đều chạm quanh thắt eo bệ Yoni đá đen nguyên khối, sâu `2 cm` | `G-INST` | Cánh `0.1m` | 16 | 768 | `stoneParts` |
| Mâm hoa cúc vàng, trầu cau & đèn dầu thờ cúng | `HV-C12` | Mâm lễ vật đặt trước bệ Linga gồm cụm quả cau, chùm hoa cúc vàng và 2 chén đèn dầu đồng | `G-LATHE` nhỏ | `0.08m` | 12 | 720 | `goldParts`+`crimsonParts` |
| **Tổng** | `requiredMotifs`: `HV-F09, HV-C01, HV-C12` | — | — | — | — | **1 748** | — |

**LOD/ghi chú QC:** Nội thất đục thông cửa Đông cho phép người chơi bước vào chiêm bái; toàn bộ chi tiết bên trong cull ở L2 (`> 60m`). QC xác nhận màu đá đen nguyên khối của Linga-Yoni Poshanư.

#### `MT-076` — Tháp B & Tháp C Poshanư trên đồi Bà Nài (ảnh ref: `25`, `87`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vòm cửa lá đề 2 tháp phụ (Tháp B thờ Nandin, Tháp C thờ Agni) | `HV-F03` | 6 vòm cuốn nhọn 3 lớp (Tháp B cao `12m`, Tháp C cao `5m`) mang phong cách Hòa Lai tương đồng Tháp A, nổi `10 cm` | `G-EXT` | Cao `2.2–3.0m` | 6 | 3 600 | `chamBrick` |
| Cửa giả giật cấp trên mặt tường Tháp B & Tháp C | `HV-F05` | 4 ô cửa giả 3 tầng giật cấp đắp gạch mài chập (`HV-F11`) chịu gió biển Phan Thiết rêu mốc, sâu `12 cm` | `G-EXT` | `1.1×2.5m` | 4 | 1 680 | `chamBrick` |
| Cột áp tường khía rãnh bao quanh 2 tháp | `HV-F04` | 16 trụ áp tường khía 3 rãnh dọc ốp 4 mặt Tháp B và Tháp C, sâu `2.5 cm` | `G-EXT` | Cao `2.5–3.8m` | 16 | 1 920 | `chamBrick` |
| 8 tháp góc thu nhỏ trên tầng mái Tháp B | `HV-F10` | 4 tháp góc × 2 tầng mái giật cấp trên đỉnh Tháp B, nổi `8 cm` | `G-*` thu nhỏ | Cao `0.8m` | 8 | 1 760 | `chamBrick` |
| **Tổng** | `requiredMotifs`: `HV-F03, HV-F05, HV-F11, HV-F04, HV-F10` | — | — | — | — | **8 960** | — |

**LOD/ghi chú QC:** Giữ cụm 3 tháp A–B–C đầy đủ tương quan tỷ lệ trên đồi Bà Nài ở mọi LOD; ở L1 chuyển rãnh cột `HV-F04` sang `T-NRM`.

#### `MT-077` — Lối gạch đỏ lên đồi & Sân lễ hội Katê (ảnh ref: `25`, `87`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tường chắn đá chẻ 2 bên bậc thang gạch đỏ lên đồi | `HV-H11` | Khối đá chẻ ong-granit xếp giật bậc giữ taluy dọc lối gạch đỏ dẫn từ chân đồi lên sân tháp Bà Nài, nổi `5 cm` | `G-INST` + `T-NRM` | `0.5×0.35m` | 48 | 1 152 | `stoneParts` |
| Cột cổng sân lễ hội Katê chạm lá đề Chăm | `HV-C09` | 4 mảng phù điêu hình lá đề nhọn chạm trên 4 mặt trụ gạch đón khách bước vào sân lễ hội Katê, nổi `3 cm` | `G-EXT` | Cao `0.8m` | 4 | 360 | `chamBrick` |
| Tán hoa sứ trắng (hoa đại) cổ thụ trên sân tháp | `HV-C14` | Cụm 24 bông hoa sứ 5 cánh trắng tâm vàng nở rộ trên 2 cây hoa sứ cổ thụ cạnh Tháp A | `G-EXT` + `G-INST` | Ø `0.1m` | 24 | 1 152 | `whiteParts` |
| Biển giới thiệu di tích Tháp Poshanư | `HV-I04` | Biển đá khắc chữ **`"DI TÍCH THÁP CHĂM POSHANƯ — THẾ KỶ VIII–IX"`** đặt đầu sân lễ hội | `T-ATLAS` + `G-EXT` | `1.2×0.6m` | 1 | 60 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-H11, HV-C09, HV-C14, HV-I04` | — | — | — | — | **2 724** | — |

**LOD/ghi chú QC:** Giữ lối bậc gạch đỏ và cây hoa sứ cổ thụ ở L0/L1; ẩn hoa sứ nhỏ `HV-C14` ở L1. QC kiểm tra thêm bụi xương rồng thanh long ven biển đặc trưng Bình Thuận.

#### `MT-078` — Bộ Nhạc Cụ Lễ Hội Katê (ảnh ref: `25`, `87`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Trống Paranưng, cặp Trống Ghi-năng & Kèn Saranai | `HV-NEW-MT-08` | 2 trống Paranưng vỗ 1 mặt dây căng da chữ V, 2 trống Ghi-năng dài 2 mặt sơn vạch đỏ-trắng và 2 kèn Saranai gỗ 7 lỗ chuông đồng đặt trên giá trưng bày lễ hội Katê, sâu chi tiết `2 cm` | `G-LATHE` + `G-TUBE` | `0.4–0.9m` | 6 | 1 440 | `woodParts`+`bronzeParts` |
| Dải thổ cẩm Chăm dệt phủ bàn trưng bày nhạc cụ | `HV-G01` | Dải vải thổ cẩm Chăm (hoa văn hình thoi, răng cưa, chó thần cách điệu màu đỏ-trắng-đen-vàng) phủ trên kệ gỗ trưng bày nhạc cụ | `T-NRM` / `T-ATLAS` | `2.4×0.8m` | 1 | 0 | `crimsonParts` |
| Viền dây lá cuốn Chăm trên giá gỗ kê trống | `HV-C10` | Băng dây lá cuốn Chăm chạm nông dọc thanh ngang giá đỡ cặp trống Ghi-năng, sâu `1.5 cm` | `G-TUBE` / `T-NRM` | Dài `3m` | 3 | 540 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-08, HV-G01, HV-C10` | — | — | — | — | **1 980** | — |

**LOD/ghi chú QC:** Bộ nhạc cụ đặt trên sân lễ hội Katê — chỉ render chi tiết L0 khi camera `< 25m`, ẩn ở L2. QC kiểm tra đủ 3 loại nhạc cụ cốt lõi của người Chăm (Paranưng, Ghi-năng, Saranai).

---

## 2.6. Đà Lạt — Langbiang & Hồ Xuân Hương (`MT-079` → `MT-088`)

#### `MT-079` — Tượng Đôi K'Lang & H'Biang đỉnh Langbiang (ảnh ref: `26`, `88`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Khối tượng đôi K'Lang & H'Biang trên bệ granit | `HV-G06` | Điêu khắc tượng đôi truyền thuyết dân tộc K'Ho (chàng K'Lang cầm cung, nàng H'Biang tựa vai) tạo hình khối sắc nét đặt hướng nhìn về thung lũng Đà Lạt, sâu khối `8 cm` | `G-*` | Cao `2.8m` | 2 tượng | 1 200 | `stoneParts` |
| Dải thổ cẩm K'Ho khắc nổi viền quanh bệ đá granit | `HV-G01` | Băng hoa văn thổ cẩm K'Ho hình thoi lồng thoi và đường răng cưa khắc chìm-sơn nhẹ chạy quanh 4 mặt bệ đá | `T-NRM` / `T-ATLAS` | Dài `8m` | 4 mặt | 0 | `stoneParts` |
| Khối đá granit ốp giật cấp bậc đế tượng đài | `HV-H11` | Khối đá granit xám đẽo thô ốp 2 cấp đế vuông nâng tượng đôi trên đỉnh Radar Langbiang, nổi `4 cm` | `G-INST` + `T-NRM` | `0.5×0.35m` | 24 | 576 | `stoneParts` |
| Tấm đồng khắc truyền thuyết K'Lang — H'Biang | `HV-I04` | Biển đồng chữ nổi **`"TRUYỀN THUYẾT K'LANG & H'BIANG"`** gắn chính diện mặt trước bệ đá | `T-ATLAS` + `G-EXT` | `1.1×0.5m` | 1 | 60 | `goldParts` |
| **Tổng** | `requiredMotifs`: `HV-G06, HV-G01, HV-H11, HV-I04` | — | — | — | — | **1 836** | — |

**LOD/ghi chú QC:** Chuẩn văn hóa K'Ho bản địa (dùng thổ cẩm `HV-G01`, không dùng hoa văn cung đình); giữ silhouette tượng đôi ở cả L0–L2.

#### `MT-080` — Sân Vọng Cảnh Langbiang & Biển hiệu `1.929m` (ảnh ref: `26`, `88`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Biển mốc độ cao nổi tiếng đỉnh Radar | `HV-I04` | Cổng khung gỗ-đá gắn chữ nổi trắng-đỏ lớn **`"LANGBIANG — ĐỈNH RADAR 1.929m"`** hướng ra bãi đỗ xe Jeep | `T-ATLAS` + `G-EXT` | `3.2×0.9m` | 2 | 120 | `whiteParts`+`crimsonParts` |
| Hàng lan can gỗ tròn khép kín quanh sân vọng cảnh | `HV-D10` | 64 trụ con tiện gỗ thông mộc ghép khung lan can bao viền ban công ngắm thung lũng Suối Vàng & Suối Bạc, sâu `2 cm` | `G-LATHE` + `G-INST` | Cao `0.9m` | 64 | 3 584 | `woodParts` |
| Bệ đá chẻ lát viền sân vọng cảnh & chân ống nhòm | `HV-H11` | Hàng đá chẻ bazan Đà Lạt viền mép sân tròn bán kính `10m` và bệ 2 ống nhòm ngắm cảnh, nổi `4 cm` | `G-INST` + `T-NRM` | `0.45×0.3m` | 32 | 768 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-I04, HV-D10, HV-H11` | — | — | — | — | **4 472** | — |

**LOD/ghi chú QC:** Giữ biển `1.929m` dễ đọc từ xa và lan can gỗ `HV-D10` ở L0; L1 giản lược `HV-D10` thành khung phẳng. QC kiểm tra đúng cao độ ghi trên biển `1.929m`.

#### `MT-081` — Đội Xe Jeep Địa Hình Leo Đỉnh Langbiang (ảnh ref: `88`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Lưới tản nhiệt 7 khe & la-zăng bánh gai 2 xe Jeep | `HV-H09` | 7 thanh lưới tản nhiệt đứng đặc trưng đầu xe Jeep UAZ/Willys (2 xe × 7 thanh = 14 thanh + khung chống lật mui trần), nổi `3 cm` | `G-INST` | Cao `0.55m` | 20 | 1 200 | `ironParts` |
| Cụm đèn pha tròn & vỏ bánh dự phòng sau đuôi xe | `HV-C14` | Cặp đèn pha tròn cổ điển + la-zăng 8 lỗ cho 10 bánh xe (4 bánh chính + 1 bánh dự phòng mỗi xe), nổi `3 cm` | `G-EXT` | Ø `0.25m` | 14 | 672 | `ironParts`+`whiteParts` |
| Chữ sơn thân xe Jeep du lịch Langbiang | `HV-I04` | Chữ stencil trắng-vàng sơn trên cửa 2 xe màu xanh quân đội & vàng cam: **`"LANGBIANG JEEP TOUR — 49A"`** | `T-ATLAS` + `G-EXT` | `0.9×0.25m` | 4 | 240 | `whiteParts` |
| **Tổng** | `requiredMotifs`: `HV-H09, HV-C14, HV-I04` | — | — | — | — | **2 112** | — |

**LOD/ghi chú QC:** 2 xe dùng chung lưới hình học chỉ khác màu sơn (xanh quân đội / vàng cam); L1 bỏ bu-lông la-zăng `HV-C14`. QC đối chiếu dáng xe mui trần leo đỉnh theo ảnh `88`.

#### `MT-082` — Quán Cà Phê Gỗ Thông Đỉnh Đồi (ảnh ref: `26`, `89`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Diềm mái ngói đỏ kiểu nhà gỗ cao nguyên | `HV-D15` | Hàng ngói viền mái 2 dốc màu đỏ đất nung che hiên gỗ thông ngắm mây | `G-INST` | `0.12×0.4m` | 48 | 1 920 | `roofParts` |
| Lan can gỗ thông & cửa chớp xanh kiểu Đà Lạt | `HV-H05` | 8 cánh cửa chớp gỗ lá sách sơn xanh rêu mở đón gió lạnh cao nguyên quanh quán cà phê, sâu `2.5 cm` | `G-INST` | `0.55×1.4m` | 8 | 960 | `woodParts` |
| Ống khói đá chẻ bếp lửa củi & vách đá chân quán | `HV-H11` | Khối đá chẻ Đà Lạt xếp đều xây lò sưởi củi và ống khói cao vượt mái ngói đỏ, nổi `4 cm` | `G-INST` + `T-NRM` | `0.4×0.3m` | 28 | 672 | `stoneParts` |
| Biển gỗ viết phấn cổ điển trước quán | `HV-I04` | Biển gỗ thông mộc khắc chữ **`"CÀ PHÊ SĂN MÂY — ĐÀ LẠT"`** treo cạnh cửa vào | `T-ATLAS` + `G-EXT` | `1.2×0.45m` | 1 | 60 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-D15, HV-H05, HV-H11, HV-I04` | — | — | — | — | **3 612** | — |

**LOD/ghi chú QC:** Giữ ống khói đá chẻ và ánh lửa bếp củi ấm ở L0/L1; chuyển `HV-H05` và `HV-D15` sang `T-NRM` ở L1.

#### `MT-083` — Rừng Thông 3 Lá Đà Lạt (ảnh ref: `89`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bụi hoa Dã Quỳ vàng rực xen thảm cỏ hồng ven đồi thông | `HV-C07` | Dải hoa cúc Dã Quỳ 12 cánh vàng tươi mọc thành vệt uốn lượn dọc lối mòn dưới tán thông 3 lá (instanced cụm hoa), dày `12 cm` | `G-TUBE` + `G-INST` | Dài `24m` | 24 | 3 360 | `goldParts` |
| Hàng cọc đá & biển chỉ dẫn đường mòn rừng thông | `HV-H11` | Cọc đá chẻ thấp định tuyến lối đi bộ xuyên đồi thông và thảm cỏ hồng Đà Lạt, nổi `5 cm` | `G-INST` | `0.35×0.6m` | 16 | 384 | `stoneParts` |
| Biển gỗ cảnh quan rừng thông | `HV-I04` | Biển gỗ mộc ghi **`"ĐỒI THÔNG BA LÁ — CỎ HỒNG ĐÀ LẠT"`** đặt bên vệ đường mòn | `T-ATLAS` + `G-EXT` | `1.0×0.45m` | 1 | 60 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-C07, HV-H11, HV-I04` | — | — | — | — | **3 804** | — |

**LOD/ghi chú QC:** Thân thông 3 lá thẳng tắp tán ô phân tầng dựng bằng `InstancedMesh` cây riêng; hoa Dã Quỳ `HV-C07` hạ thành alpha-cards vàng ở L1 để tiết kiệm overdraw. QC đối chiếu sắc vàng-hồng-xanh theo ảnh `89`.

#### `MT-084` — Nhà Hàng Thủy Tạ bên Hồ Xuân Hương (ảnh ref: `26`, `89`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Gờ phào ngang kiểu Streamline Moderne 1930s (màu trắng tinh) | `HV-H04` | Dải phào cong lượn ôm sát ban công hình du thuyền màu trắng nổi trên mặt Hồ Xuân Hương (xây năm 1936), nổi `8 cm` | `G-EXT` | Dài `42m` | 42 | 1 680 | `whiteParts` |
| Họa tiết Art Deco giật bậc trên tháp mái cong Thủy Tạ | `HV-NEW-MT-10` | Mảng gờ giật cấp bậc thang đối xứng và cửa tròn kiểu du thuyền Art Deco 1930s trên mái sảnh tròn, nổi `6 cm` | `G-EXT` | `1.5×1.0m` | 8 | 1 120 | `whiteParts` |
| Hàng lan can ống ngang & song đứng uốn cong cầu dẫn | `HV-H09` | Lan can sơn trắng chạy dọc cầu dẫn nối bờ và toàn bộ vòng cung sân thượng nổi trên mặt hồ, nổi `3 cm` | `G-INST` | Cao `1.0m` | 48 | 2 880 | `whiteParts` |
| Biển hiệu chữ nổi sơn xanh cổ điển trên mặt tiền trắng | `HV-I04` | Chữ serif nổi sơn xanh lam **`"THỦY TẠ — HỒ XUÂN HƯƠNG"`** gắn cong trên vòm sảnh trắng | `T-ATLAS` + `G-EXT` | `2.6×0.5m` | 1 | 60 | `whiteParts` |
| **Tổng** | `requiredMotifs`: `HV-H04, HV-NEW-MT-10, HV-H09, HV-I04` | — | — | — | — | **5 740** | — |

**LOD/ghi chú QC:** Chuẩn phong cách Streamline Moderne / Art Deco Pháp 1930s màu trắng tuyền soi bóng mặt nước; giữ khối cong và biển `"THỦY TẠ"` ở L0/L1, chuyển lan can `HV-H09` sang alpha-plane ở L1.

#### `MT-085` — Quảng Trường Lâm Viên — Nụ Hoa Atisô & Hoa Dã Quỳ kính (ảnh ref: `26`, `89`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Khung kính đa giác Diagrid Nụ Hoa Atisô (`15m`, xanh-vàng) | `HV-NEW-MT-09` | Hệ 96 ô kính màu xanh lục — vàng xếp xoắn ốc theo hình cánh búp hoa Atisô với khung thép sơn xanh lá, nổi gân khung `6 cm` | `G-INST` + `S-SHD` | `1.4×1.8m` | 96 | 4 608 | `roofParts`+`goldParts` |
| Khung kính đa giác Hoa Dã Quỳ (`18m`, vàng rực) | `HV-NEW-MT-09` | Hệ 110 ô kính tam giác — hình thoi màu vàng-xanh xếp nghiêng thành khối bông hoa Dã Quỳ khổng lồ bên quảng trường, nổi gân `8 cm` | `G-INST` + `S-SHD` | `1.6×2.0m` | 110 | 5 280 | `goldParts` |
| Sàn gạch lát quảng trường hoa văn tia tỏa | `HV-H07` | Mảng gạch đá granit 2 màu sáng-tối lát họa tiết hình học tỏa tròn quanh 2 khối hoa kính | `T-ATLAS` | Viên `0.4m` | 1 mặt sân | 0 | `stoneParts` |
| Biển chữ nổi Quảng Trường Lâm Viên | `HV-I04` | Hàng chữ khối 3D trắng-đỏ lớn **`"QUẢNG TRƯỜNG LÂM VIÊN — ĐÀ LẠT"`** đặt trước bậc thang ven hồ | `T-ATLAS` + `G-EXT` | `6.0×1.0m` | 1 | 60 | `whiteParts`+`crimsonParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-09, HV-H07, HV-I04` | — | — | — | — | **9 948** | — |

**LOD/ghi chú QC:** 206 ô kính `HV-NEW-MT-09` dựng 2 `InstancedMesh` (xanh Atisô + vàng Dã Quỳ) kèm shader phản chiếu bầu trời + emissive nội thất về đêm; ở L1 gộp khung thép thành shader grid trên lưới thấp poly.

#### `MT-086` — Đội Thuyền Đạp Vịt trên Hồ Xuân Hương (ảnh ref: `26`, `89`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 6 thân thuyền thiên nga trắng cổ cong & cánh xếp lớp | `HV-B06` | 6 thuyền đạp vịt hình thiên nga trắng cổ cong chữ S, mỏ cam, 2 cánh khắc gân nổi hai bên mạn (tận dụng helper cổ cong chim `G-TUBE` + `G-LATHE`), dài `2.6m` | `G-TUBE` + `G-LATHE` | Dài `2.6m` | 6 | 5 400 | `whiteParts` |
| Vệt sóng mũi & đuôi thuyền trên mặt hồ sương sớm | `HV-D06` | 6 dải sóng chữ V trắng nhẹ tách ra từ mũi 6 thuyền thiên nga trôi chậm trên mặt Hồ Xuân Hương | `G-EXT` | Dài `2.0m` | 6 | 540 | `whiteParts` |
| Biển bến thuê thuyền đạp vịt ven hồ | `HV-I04` | Biển gỗ xanh-trắng **`"BẾN THUYỀN ĐẠP VỊT — HỒ XUÂN HƯƠNG"`** gắn trên cầu tàu nhỏ | `T-ATLAS` + `G-EXT` | `1.4×0.45m` | 1 | 60 | `whiteParts` |
| **Tổng** | `requiredMotifs`: `HV-B06, HV-D06, HV-I04` | — | — | — | — | **6 000** | — |

**LOD/ghi chú QC:** 6 thuyền thiên nga dùng 1 `InstancedMesh` duy nhất; ở L1 giảm segment cổ cong 50% và tắt sóng `HV-D06`. QC kiểm tra độ sáng trắng thanh lịch hài hòa với sương sớm mặt hồ.

#### `MT-087` — Ga Đà Lạt Cổ (3 Mái Chóp Núi Langbiang) (ảnh ref: `26`, `89`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Mặt tiền 3 mái chóp nhọn mô phỏng 3 đỉnh Langbiang | `HV-NEW-MT-10` | Họa tiết Art Deco 1932–1938 giật cấp hình học, đường sọc đứng trên tường vàng kem dưới 3 mái chóp nhọn ngói đỏ đặc trưng Ga Đà Lạt, nổi `6 cm` | `G-EXT` | `2.0×1.2m` | 12 | 1 680 | `plasterParts`+`whiteParts` |
| Mặt đồng hồ cổ lớn dưới chóp mái giữa | `HV-H08` | Đồng hồ tròn Pháp cổ đường kính `1.8m`, vòng số La Mã nổi sơn đen trên nền trắng, kim sắt hoa văn đen đặt chính tâm chóp giữa, nổi `4 cm` | `G-EXT` + `T-ATLAS` | Ø `1.8m` | 1 | 280 | `whiteParts`+`ironParts` |
| 3 ô cửa kính màu kiểu Pháp dưới 3 mái chóp | `HV-H01` | 3 cửa sổ vòm tròn/tam giác chia nan chì kính đa sắc (xanh-đỏ-vàng) phát sáng ấm dưới 3 chóp mái mặt tiền Ga Đà Lạt, sâu `5 cm` | `G-EXT` + `S-SHD` | Ø `2.2m` | 3 | 2 700 | `goldParts`+`whiteParts` |
| Gờ phào & biển tên nhà ga kiểu Art Deco | `HV-I04` | Chữ nổi Art Deco màu trắng/đỏ gắn trên mái hiên sảnh chính **`"GA ĐÀ LẠT"`** kèm gờ phào ngang `HV-H04` (`18m` = `720 tri` gộp riêng bên dưới) | `T-ATLAS` + `G-EXT` | `3.2×0.6m` | 1 | 60 | `crimsonParts`+`whiteParts` |
| Phào ngang sảnh đón & toa tàu hơi nước bánh răng cưa | `HV-H04` | Phào ngang trắng chạy dọc mái hiên nhà ga và đường gờ chỉ trang trí dọc đầu máy hơi nước cổ chạy than (số hiệu `131-428`), nổi `4 cm` | `G-EXT` | Dài `24m` | 24 | 960 | `whiteParts`+`ironParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-10, HV-H08, HV-H01, HV-I04, HV-H04` | — | — | — | — | **5 680** | — |

**LOD/ghi chú QC:** Kiến trúc Art Deco Pháp 1930s (tuyệt đối không dùng đầu đao cong Á Đông); giữ 3 mái chóp, đồng hồ `HV-H08`, 3 kính màu `HV-H01` và chữ `"GA ĐÀ LẠT"` ở L0/L1.

#### `MT-088` — Biệt Thự Pháp Cổ & Hàng Rào Hoa Cẩm Tú Cầu (ảnh ref: `26`, `89`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Chân tường, góc tường & ống khói ốp đá chẻ Đà Lạt | `HV-H11` | Khối đá chẻ thô giật bậc (quoin) xếp dài-ngắn ở 4 góc biệt thự, chân móng và ống khói lò sưởi kiểu Norman/Savoyard Pháp, nổi `4 cm` | `G-INST` + `T-NRM` | `0.45×0.35m` | 48 | 1 152 | `stoneParts` |
| Hệ cửa chớp lá sách gỗ sơn xanh lá đặc trưng Đà Lạt | `HV-H05` | 12 cánh cửa chớp gỗ sơn xanh lá mạ gồm 20 lá sách nghiêng `30°` trên tường vàng kem 2 tầng biệt thự cổ, sâu `3 cm` | `G-INST` | `0.6×1.8m` | 12 | 1 440 | `roofParts` |
| Phào chỉ mái nhọn & con sơn gỗ đỡ hiên | `HV-H04` | Gờ phào sơn trắng và con sơn gỗ nâu dưới mái ngói vảy cá dốc đứng kiểu Pháp, nổi `6 cm` | `G-EXT` | Dài `28m` | 28 | 1 120 | `whiteParts`+`woodParts` |
| Hàng rào sắt uốn & dãy cụm hoa Cẩm Tú Cầu xanh tím | `HV-H09` | Song sắt uốn cổ điển sơn đen chạy trước sân vườn biệt thự (kết hợp cụm hoa Cẩm Tú Cầu cầu tròn xanh-tím xếp hàng phía trước), nổi `3 cm` | `G-INST` | Cao `1.4m` | 32 | 1 920 | `ironParts` |
| **Tổng** | `requiredMotifs`: `HV-H11, HV-H05, HV-H04, HV-H09` | — | — | — | — | **5 632** | — |

**LOD/ghi chú QC:** Giữ mái dốc cao, ống khói đá chẻ và cửa chớp xanh lá `HV-H05` ở L0/L1; chuyển `HV-H11` và song rào `HV-H09` sang `T-NRM`/alpha-plane ở L1. QC xác nhận màu hoa Cẩm Tú Cầu xanh-tím tự nhiên.

---
## 2.7. Biển Hồ T'Nưng, Nhà Rông & Tây Nguyên (`MT-089` → `MT-100`)

#### `MT-089` — Nhà Rông Tây Nguyên mái lưỡi rìu (ảnh ref: `90`, `122`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| 2 đầu đỉnh bờ nóc mái lưỡi rìu cao `20–22m` | `HV-G05` | 2 cặp sừng trâu gỗ/mây đan cong vút đối xứng 2 đầu nóc mái tranh lưỡi rìu đặc trưng Nhà Rông Ba Na — Gia Rai, cao vươn `1.8m`, nổi `10 cm` | `G-TUBE` | `1.8m` | 2 cặp | 440 | `woodParts` |
| 2 vách đầu hồi tam giác cao dưới mái tranh | `HV-G02` | Họa tiết Mặt trời 12 tia tỏa, ngôi sao 8 cánh và chim Kơ-tia vẽ màu đỏ-đen-trắng trực tiếp lên phên nứa 2 đầu hồi cao vút | `T-ATLAS` | Ø `1.4m` | 4 cụm | 0 | `woodParts` |
| Toàn bộ vách phên nứa bao quanh Nhà Rông | `HV-G03` | Nan nứa chẻ đan lóng mốt tạo hoa văn xương cá chữ nhân (*人*) phủ kín vách ngoài và 2 tam giác đầu hồi | `T-NRM` + `S-SHD` | Toàn vách | 4 vách | 0 | `woodParts` |
| Dải viền trang trí cổ mái & mép sàn hiên | `HV-G01` | Dải hoa văn thổ cẩm hình thoi lồng thoi và răng cưa đen-đỏ-trắng-vàng chạy dọc thanh đà mặt tiền Nhà Rông | `T-NRM` / `T-ATLAS` | Dài `14m` | 2 dải | 0 | `crimsonParts` |
| Hàng cột gỗ nguyên cây nâng sàn cao `2.2m` | `HV-D01` | Vòng khoanh răng cưa và khía gỗ hình học đẽo tay quanh cổ 12 cột gỗ trụ sàn đón mặt tiền Nhà Rông, sâu `2 cm` | `G-EXT` | Dài `12m` | 12 | 720 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-G05, HV-G02, HV-G03, HV-G01, HV-D01` | — | — | — | — | **1 160** | — |

**LOD/ghi chú QC:** Biểu tượng Tây Nguyên — tối ưu cực tốt vì phên nứa `HV-G03`, mặt trời `HV-G02` và thổ cẩm `HV-G01` dùng `T-NRM`/`T-ATLAS` (0 tri); giữ nguyên mái lưỡi rìu `22m` và cặp sừng trâu `HV-G05` ở mọi LOD. QC đối chiếu trực tiếp ảnh `90`, `122`.

#### `MT-090` — Cầu thang gỗ độc mộc chạm khắc bầu sữa & trăng khuyết (ảnh ref: `122`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đỉnh đầu 2 cầu thang độc mộc lên sàn Nhà Rông | `HV-G04` | Đôi bầu sữa căng tròn và vầng trăng khuyết chạm nổi trực tiếp trên đầu thân gỗ lớn nguyên khối (biểu trưng chế độ mẫu hệ & sự sinh sôi), sâu chạm `5 cm` | `G-LATHE` / `G-EXT` | `0.45m` | 4 cụm | 640 | `woodParts` |
| 2 tay vịn thân cây uốn cong & khía bậc thang | `HV-G05` | Chóp đầu tay vịn đẽo hình sừng trâu cong và mỏ chim thần đặt 2 bên cầu thang độc mộc 7 bậc, nổi `4 cm` | `G-TUBE` | `0.9m` | 4 | 880 | `woodParts` |
| Dải hoa văn răng cưa khắc 2 bên má cầu thang | `HV-G01` | Đường vạch răng cưa và hình thoi sơn đen-đỏ khắc nông dọc 2 cạnh thân gỗ độc mộc | `T-NRM` / `T-ATLAS` | Dài `3.2m` | 4 dải | 0 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-G04, HV-G05, HV-G01` | — | — | — | — | **1 520** | — |

**LOD/ghi chú QC:** Giữ đôi bầu sữa — trăng khuyết `HV-G04` rõ nét ở L0 (`< 20m`); L1 giữ dáng thân gỗ độc mộc 7 bậc (luôn là số lẻ theo luật tục Tây Nguyên) và tắt chạm nhỏ.

#### `MT-091` — Nội thất bên trong Nhà Rông (ảnh ref: `122`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cột Thần trung tâm gắn sừng trâu & khiên mây đan | `HV-G05` | 4 bộ sừng trâu thật/gỗ buộc dây mây đỏ-đen và 2 tấm khiên tròn mây đan treo cao trên *Cột Thần* giữa lòng Nhà Rông, nổi `10 cm` | `G-TUBE` | `1.1m` | 4 | 880 | `woodParts` |
| 2 tấm khiên mây đan tròn gắn trên Cột Thần | `HV-C14` | Hoa văn vòng tròn đồng tâm 8 tia nan mây đan thủ công đen-đỏ trên mặt khiên chiến binh Tây Nguyên, nổi `2 cm` | `G-EXT` | Ø `0.65m` | 2 | 96 | `woodParts`+`crimsonParts` |
| Vách trong 2 đầu hồi & sạp gỗ dài | `HV-G03` | Phên nứa đan chữ nhân lộ hệ vì kèo gỗ chữ A đan chéo vươn cao lên đỉnh mái `20m` | `T-NRM` + `S-SHD` | Toàn vách | 2 vách | 0 | `woodParts` |
| Tấm thổ cẩm phủ 2 sạp gỗ tiếp khách đầu hồi | `HV-G01` | Vải thổ cẩm Ba Na nền đen viền đỏ-trắng hình thoi và người nhảy xoang trải dọc 2 sạp gỗ dài | `T-NRM` / `T-ATLAS` | `4.0×1.2m` | 2 tấm | 0 | `crimsonParts` |
| **Tổng** | `requiredMotifs`: `HV-G05, HV-C14, HV-G03, HV-G01` | — | — | — | — | **976** | — |

**LOD/ghi chú QC:** Nội thất cận cảnh — chỉ render đầy đủ khi người chơi leo cầu thang vào trong Nhà Rông (`L0 < 20m`), ẩn ở L2. QC kiểm tra hệ kèo gỗ chữ A đan chéo lên tận đỉnh mái theo ảnh `122`.

#### `MT-092` — Bếp Lửa Trung Tâm & Dàn Ché Rượu Cần (ảnh ref: `90`, `122`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Dàn 8 Ché Rượu Cần gốm men da lươn cổ | `HV-NEW-MT-11` | 8 ché gốm cổ (ché Tuk, ché Tang) bụng phình vai rộng có 4–6 tai nhỏ, đắp nổi dây sóng và rồng mây đơn sơ quanh vai, buộc dây mây vào cọc gỗ, cắm cần tre uốn cong dài `1.2m`, nổi `2 cm` | `G-LATHE` + `G-DISP` | Cao `0.65–0.85m` | 8 | 2 560 | `chamBrick`+`bronzeParts` |
| Khung gỗ vuông bọc đất sét quanh Bếp Lửa Trung Tâm | `HV-G01` | Đường khắc răng cưa và hình thoi đốt cháy sẫm màu dọc 4 thanh gỗ viền bếp lửa hồng giữa Nhà Rông | `T-NRM` / `T-ATLAS` | `1.6×1.6m` | 4 cạnh | 0 | `woodParts` |
| Giá gác củi & ống bầu khô treo trên bếp lửa | `HV-C12` | 6 quả bầu khô thắt eo dùng múc nước rượu cần treo trên giàn hun khói phía trên bếp lửa (tận dụng helper `G-LATHE` quả tròn) | `G-LATHE` nhỏ | `0.25m` | 6 | 360 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-11, HV-G01, HV-C12` | — | — | — | — | **2 920** | — |

**LOD/ghi chú QC:** 8 ché rượu cần dùng 1 `InstancedMesh` với 2 biến thể kích thước; L1 giản lược nổi vai ché sang `T-NRM`. QC kiểm tra đủ cần tre cong cắm trong miệng ché và ánh than hồng bếp lửa.

#### `MT-093` — Dàn Cồng Chiêng Tây Nguyên (ảnh ref: `91`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bộ 12 chiêng đồng (6 chiêng núm + 6 chiêng bằng) | `HV-G07` | 6 chiêng đồng có núm bầu tròn đánh bóng vàng óng ở tâm + 6 chiêng bằng mặt rộng `0.35–0.85m`, vành dập nổi vòng tròn đồng tâm và hoa văn răng cưa treo trên giá gỗ, sâu `2 cm` | `G-LATHE` + `G-INST` | Ø `0.35–0.85m` | 12 | 1 680 | `bronzeParts` |
| Đầu 2 cột giá gỗ treo dàn Cồng Chiêng | `HV-G05` | 2 đầu trụ giá treo đẽo hình cặp sừng trâu cong và mỏ chim vươn lên giữ thanh xà ngang buộc dây chiêng, nổi `6 cm` | `G-TUBE` | `0.85m` | 2 | 440 | `woodParts` |
| Thanh xà ngang giá chiêng phủ vải thổ cẩm | `HV-G01` | Dải thổ cẩm đen-đỏ-trắng quấn trang trí thanh xà treo 12 chiếc chiêng (Di sản văn hóa phi vật thể UNESCO) | `T-NRM` / `T-ATLAS` | Dài `3.6m` | 1 | 0 | `crimsonParts` |
| **Tổng** | `requiredMotifs`: `HV-G07, HV-G05, HV-G01` | — | — | — | — | **2 120** | — |

**LOD/ghi chú QC:** 12 chiêng `HV-G07` dùng 2 `InstancedMesh` (chiêng núm + chiêng bằng, vật liệu đồng metalness `0.85`, roughness `0.25` tạo độ bóng núm chiêng); L1 giảm segment vành chiêng 50%. QC đối chiếu ánh đồng và cỡ chiêng giảm dần theo ảnh `91`.

#### `MT-094` — Trống Hơgơr (Trống Da Trâu) & Đàn T'rưng (ảnh ref: `91`, `122`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Trống Hơgơr (da trâu) & 2 bộ Đàn T'rưng ống nứa | `HV-NEW-MT-13` | 1 trống cái Hơgơr gỗ nguyên khối đường kính mặt `0.9m` căng da trâu có hàng chốt gỗ xung quanh tang trống + 2 giàn đàn T'rưng mỗi giàn 14 ống nứa vát chéo đầu treo trên khung gỗ cong, sâu `2.5 cm` | `G-LATHE` + `G-INST` | `0.9–1.5m` | 3 bộ | 1 080 | `woodParts` |
| Dải họa tiết thổ cẩm chạm quanh tang trống Hơgơr | `HV-G01` | Băng hình thoi và đường răng cưa đỏ-trắng-đen sơn vẽ chạy vòng giữa tang trống Hơgơr lễ hội đâm trâu | `T-NRM` / `T-ATLAS` | Chu vi `2.8m` | 1 | 0 | `crimsonParts` |
| Chân giá gỗ đỡ trống Hơgơr chạm đầu sừng trâu | `HV-G05` | 2 cặp đầu gỗ uốn cong hình sừng trâu đỡ thân trống cái Hơgơr nghiêng góc `15°` hướng ra sân lễ hội, nổi `5 cm` | `G-TUBE` | `0.8m` | 2 | 440 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-13, HV-G01, HV-G05` | — | — | — | — | **1 520** | — |

**LOD/ghi chú QC:** Giữ hình khối trống Hơgơr và các ống nứa vát chéo Đàn T'rưng ở L0/L1; ẩn chi tiết chốt da trống ở L1. QC kiểm tra đúng tỷ lệ ống đàn T'rưng dài ngắn tăng dần từ thấp lên cao.

#### `MT-095` — Cây Nêu Lễ Hội Tây Nguyên (ảnh ref: `90`, `122`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Trụ Cây Nêu cao `9m`, chùm tua tre chẻ bông & chim thần Pơ-lang | `HV-NEW-MT-12` | 2 cây nêu lễ hội (1 cây chính giữa sân + 1 cây phụ) có thân tre khắc khoanh đỏ-đen-trắng, 4 tầng chùm bông tre chẻ tua rủ (*k'la*), đỉnh gắn tượng chim thần Pơ-lang gỗ dang cánh dài `0.8m`, nổi `6 cm` | `G-TUBE` + `G-EXT` | Cao `9.0m` | 2 | 1 360 | `woodParts`+`crimsonParts` |
| Vành phên đan hình mặt trời treo tầng giữa cây nêu | `HV-G02` | Vòng nan tre đan ô vuông và mặt trời 8 tia treo lơ lửng dưới đỉnh cây nêu đón gió | `T-ATLAS` | Ø `0.6m` | 4 | 0 | `woodParts` |
| Lá cờ thổ cẩm & dải tua vải buộc dọc thân nêu | `HV-G01` | Dải vải thổ cẩm đỏ-đen-vàng buộc bay phất phới dọc thân cây nêu lễ hội mừng lúa mới | `T-NRM` / `T-ATLAS` | `0.3×1.4m` | 4 | 0 | `crimsonParts` |
| Khung gỗ vuông chân cây nêu chạm hình sừng trâu | `HV-G05` | 4 đầu cọc gỗ bảo vệ gốc cây nêu đẽo nhọn uốn sừng trâu cắm quanh chân nêu, nổi `4 cm` | `G-TUBE` | `0.7m` | 4 | 880 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-NEW-MT-12, HV-G02, HV-G01, HV-G05` | — | — | — | — | **2 240** | — |

**LOD/ghi chú QC:** Giữ dáng cao vút `9m`, chùm bông tre và chim thần Pơ-lang ở L0–L2 làm mốc nhận diện buôn làng từ xa; L1 chuyển tua tre nhỏ sang alpha-cards.

#### `MT-096` — Nhà Dài Ê Đê (`30m`) (ảnh ref: `42`, `43`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Cầu thang cái đầu hiên *Gah* chạm bầu sữa & trăng khuyết | `HV-G04` | Cầu thang chính (thang cái dành cho khách và phụ nữ theo chế độ mẫu hệ Ê Đê) chạm đôi bầu sữa tròn và trăng khuyết sâu `5 cm` trên đầu gỗ nguyên khối | `G-LATHE` / `G-EXT` | `0.45m` | 2 cụm | 320 | `woodParts` |
| Vách phên nứa đan & hành lang đón khách dài `30m` | `HV-G03` | Toàn bộ vách bao Nhà Dài Ê Đê đan phên nứa lóng mốt chữ nhân, kết hợp vách gỗ trạm trổ mộc | `T-NRM` + `S-SHD` | Dài `30m` | 4 vách | 0 | `woodParts` |
| Khung dệt thổ cẩm thủ công & tấm vải đang dệt trên hiên *Gah* | `HV-G01` | 2 khung dệt eo Ê Đê căng tấm vải thổ cẩm đen-đỏ-vàng dệt họa tiết hình thoi, răng cưa, con rùa, cây nêu cực sắc nét | `T-NRM` / `T-ATLAS` | `1.8×0.7m` | 4 tấm | 0 | `crimsonParts` |
| Ghế Kpan (ghế dài độc mộc `12m`) & đầu xà chạm voi/thằn lằn | `HV-G05` | Đầu 2 thanh xà dọc gian khách *Gah* và đầu ghế Kpan đẽo chạm sừng trâu, cặp ngà voi và hình kỳ đà dân gian Ê Đê, nổi `5 cm` | `G-TUBE` | `0.9m` | 4 | 880 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-G04, HV-G03, HV-G01, HV-G05` | — | — | — | — | **1 200** | — |

**LOD/ghi chú QC:** Chuẩn văn hóa Ê Đê (tuyệt đối không trộn mái lưỡi rìu Ba Na vào Nhà Dài Ê Đê — Nhà Dài mái thấp hình thuyền trải dài `30m`, đầu hiên *Gah* mở rộng); khung dệt `HV-G01` giữ chi tiết ở L0, đối chiếu sắc thổ cẩm ảnh `42`, `43`.

#### `MT-097` — Khu Nhà Mồ & Tượng Gỗ Dân Gian Tây Nguyên (ảnh ref: `27`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Vòng 12 Tượng Nhà Mồ đẽo rìu thô quanh rào gỗ | `HV-G06` | 12 tượng gỗ dân gian Gia Rai — Ba Na cao `1.2–1.6m` đẽo nhát rìu thô khối phẳng (người ngồi ôm mặt suy tư, mẹ bồng con, người đánh trống, đôi chim công) xếp vòng quanh hàng rào nhà mồ, sâu mảng `6 cm` | `G-*` low-poly | Cao `1.4m` | 12 | 7 200 | `woodParts` |
| Mái nhọn nhà mồ vẽ họa tiết mặt trời & chim thần | `HV-G02` | Mặt trời 12 tia, hình người cầm khiên và răng cưa vẽ bằng màu đất đỏ — than đen — vôi trắng trên 2 tam giác đầu mái nhà mồ | `T-ATLAS` | `1.8×1.4m` | 2 mặt | 0 | `woodParts` |
| 4 cột góc nhà mồ đẽo sừng trâu & ngà voi | `HV-G05` | 4 đầu cột chính nhà mồ tạc hình cặp sừng trâu vươn lên đỡ chóp mái nhọn, nổi `6 cm` | `G-TUBE` | `0.9m` | 4 | 880 | `woodParts` |
| Dải thổ cẩm vẽ chạy diềm mái & rào gỗ | `HV-G01` | Băng tam giác răng cưa và hình thoi sơn đen-đỏ-trắng chạy viền chân mái nhà mồ | `T-NRM` / `T-ATLAS` | Dài `12m` | 4 cạnh | 0 | `crimsonParts` |
| **Tổng** | `requiredMotifs`: `HV-G06, HV-G02, HV-G05, HV-G01` | — | — | — | — | **8 080** | — |

**LOD/ghi chú QC:** Giữ 12 tượng nhà mồ `HV-G06` với 4 mẫu đẽo rìu low-poly (instanced, giữ chất thô mộc không smooth-shading giả bóng) theo ảnh `27`; L1 giữ 6 tượng góc chính, tắt 6 tượng phụ.

#### `MT-098` — Lầu Vọng Cảnh Biển Hồ T'Nưng (ảnh ref: `27`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Tượng Quan Âm đá trắng đứng trên đài sen hướng ra hồ | `HV-C04` | Đài sen đá trắng 24 cánh nở 2 tầng nâng tượng Phật Bà Quan Âm đứng hướng mặt ra miệng núi lửa Biển Hồ T'Nưng, sâu cánh `4 cm` | `G-INST` + `G-LATHE` | Ø `1.4m` | 1 | 1 200 | `marbleParts` |
| 8 đầu đao mái chòi bát giác Lầu Vọng Cảnh | `HV-A06` | 8 góc mái chòi bát giác 2 tầng ngói đỏ vút cong nhẹ kiểu kiến trúc cảnh quan Việt hiện đại, nổi `6 cm` | `G-TUBE` + `G-EXT` | `0.75m` | 8 | 5 200 | `roofParts` |
| Lan can con tiện dọc cầu dẫn & 8 cạnh chòi bát giác | `HV-D10` | 48 con tiện đá-gỗ chạy dọc cầu dẫn bậc thang vươn ra mặt hồ xanh ngọc và 8 cạnh lầu bát giác, sâu `2 cm` | `G-LATHE` + `G-INST` | Cao `0.75m` | 48 | 2 688 | `stoneParts` |
| Biển đá tên thắng cảnh Biển Hồ T'Nưng | `HV-I04` | Bia đá tự nhiên khắc chữ nổi sơn đỏ **`"BIỂN HỒ T'NƯNG — ĐÔI MẮT PLEIKU"`** đặt đầu bậc thang dẫn ra lầu | `T-ATLAS` + `G-EXT` | `1.5×0.7m` | 1 | 60 | `stoneParts` |
| **Tổng** | `requiredMotifs`: `HV-C04, HV-A06, HV-D10, HV-I04` | — | — | — | — | **9 148** | — |

**LOD/ghi chú QC:** Giữ hình khối chòi bát giác vươn ra mặt hồ và tượng Quan Âm đá trắng trên đài sen `HV-C04` ở L0/L1; chuyển `HV-D10` sang `T-NRM` ở L1. QC kiểm tra đúng màu nước xanh ngọc sâu của miệng núi lửa T'Nưng.

#### `MT-099` — Đường Thông Cổ Thụ & Đồi Chè Biển Hồ (ảnh ref: `27`, `89`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Bờ kè đá bazan dọc con đường đất đỏ trăm tuổi | `HV-H11` | Khối đá bazan tổ ong đen xám xếp kè hai bên vệ đường đất đỏ rợp bóng hàng thông cổ thụ dẫn vào đồi chè Biển Hồ, nổi `5 cm` | `G-INST` + `T-NRM` | `0.45×0.3m` | 40 | 960 | `stoneParts` |
| Dải luống chè xanh uốn lượn & bụi hoa Dã Quỳ ven đường | `HV-C07` | Băng hoa Dã Quỳ vàng điểm xuyết dọc rìa các luống chè xanh cắt tỉa thẳng tắp trên đất đỏ bazan, dày `10 cm` | `G-TUBE` + `G-INST` | Dài `20m` | 20 | 2 800 | `goldParts`+`roofParts` |
| Biển gỗ chỉ đường đồi chè Biển Hồ | `HV-I04` | Biển gỗ mộc chữ sơn trắng **`"HÀNG THÔNG TRĂM TUỔI — ĐỒI CHÈ BIỂN HỒ"`** cắm đầu tuyến đường đất đỏ | `T-ATLAS` + `G-EXT` | `1.3×0.5m` | 1 | 60 | `woodParts` |
| **Tổng** | `requiredMotifs`: `HV-H11, HV-C07, HV-I04` | — | — | — | — | **3 820** | — |

**LOD/ghi chú QC:** Hàng thông cổ thụ thân nghiêng tạo vòm cổng tự nhiên dựng bằng `InstancedMesh` cây; L1 hạ hoa Dã Quỳ `HV-C07` thành alpha-cards vàng. QC xác nhận sắc đất đỏ bazan đặc trưng Gia Lai.

#### `MT-100` — Vòng Lửa Trại & Sân Múa Xoang Buôn Làng (ảnh ref: `42`, `90`, `91`)

| Bộ phận | Mã HV | Mô tả hoa văn cụ thể tại vị trí này (hình thái, số lượng, hướng, độ sâu chạm) | KT | Kích thước | SL | Tri L0 | Bucket |
|---|---|---|---|---|---:|---:|---|
| Đống củi cháy rực & vòng đá bazan quây lửa trại | `HV-H11` | 24 khối đá bazan xếp tròn bao quanh đống củi lửa trại bùng sáng chính tâm sân đất đỏ múa xoang, nổi `8 cm` | `G-INST` | `0.4×0.3m` | 24 | 576 | `stoneParts` |
| 6 băng ghế gỗ dài phủ thổ cẩm xếp vòng quanh sân | `HV-G01` | Hoa văn thổ cẩm Ba Na — Gia Rai (hình thoi, răng cưa, đường sóng nước, mặt trời màu đen-đỏ-trắng-vàng) dệt nổi trải kín 6 băng ghế dài quanh vòng múa xoang | `T-NRM` / `T-ATLAS` | `3.0×0.6m` | 6 tấm | 0 | `crimsonParts` |
| 4 cột đuốc tre khắc mặt trời & sừng trâu quanh sân | `HV-G05` | 4 cột gỗ cắm đuốc lửa xung quanh sân múa xoang, đầu cột đẽo cặp sừng trâu nhỏ hướng vào tâm lửa, nổi `5 cm` | `G-TUBE` | `0.8m` | 4 | 880 | `woodParts` |
| 4 ché rượu cần đặt cạnh vòng múa xoang mời khách | `HV-NEW-MT-11` | 4 ché gốm cổ men da lươn đắp nổi dây sóng, cắm 4 cần tre cong đặt bên cạnh 6 băng ghế gỗ phục vụ đêm hội cồng chiêng | `G-LATHE` + `G-DISP` | Cao `0.7m` | 4 | 1 280 | `chamBrick` |
| **Tổng** | `requiredMotifs`: `HV-H11, HV-G01, HV-G05, HV-NEW-MT-11` | — | — | — | — | **2 736** | — |

**LOD/ghi chú QC:** Giữ vòng lửa trại ấm (1 PointLight mềm ở tâm + emissive than hồng) và 4 cột đuốc ở L0/L1; tắt chi tiết đắp nổi trên 4 ché rượu `HV-NEW-MT-11` ở L1. QC xác nhận tổng thể sân lễ hội kết nối liền mạch với Nhà Rông `MT-089` và Cây Nêu `MT-095`.

---
## Tổng Kết Ngân Sách, Đề Xuất Thư Viện & Lộ Trình Triển Khai

### (a) Bảng Tổng Ngân Sách Tri L0 Theo Cụm & Khuyến Nghị Cắt Giảm

| STT | Cụm di sản | Số component | Tổng tri L0 | Tỷ trọng | Tri L1 dự kiến (`~38%` L0) | Trạng thái ngân sách |
|---|---|---:|---:|---:|---:|---|
| 2.1 | Cố Đô Huế — Đại Nội, Ngọ Môn, Điện Thái Hòa, Thế Miếu | 22 | 397 540 | 44.5% | ~138 000 | Nặng nhất — tập trung tối ưu nội thất & `InstancedMesh` |
| 2.2 | Phố Cổ Hội An, Chùa Cầu & Hội Quán Phúc Kiến | 16 | 135 352 | 15.1% | ~51 000 | Hợp lý — dùng chung 4 `InstancedMesh` phố cổ |
| 2.3 | Cầu Vàng — Bà Nà Hills & Cầu Rồng — Đà Nẵng | 14 | 103 720 | 11.6% | ~44 000 | Hợp lý — giữ silhouette hero, giản lược CNC/cáp ở L1 |
| 2.4 | Hang Sơn Đoòng & Động Phong Nha — Kẻ Bàng | 14 | 105 232 | 11.8% | ~41 000 | Hợp lý — chuyển phần lớn gờ karst sang triplanar `T-NRM` |
| 2.5 | Thánh Địa Mỹ Sơn & Tháp Chàm Poshanư | 12 | 65 332 | 7.3% | ~26 000 | Rất tối ưu — `HV-F11` & `HV-NEW-MT-05` tốn 0 tri |
| 2.6 | Đà Lạt — Langbiang & Hồ Xuân Hương | 10 | 48 836 | 5.5% | ~19 000 | Rất tối ưu — diagrid kính & Art Deco gọn nhẹ |
| 2.7 | Biển Hồ T'Nưng, Nhà Rông & Tây Nguyên | 12 | 37 440 | 4.2% | ~15 000 | Nhẹ nhất — phên nứa, thổ cẩm & họa tiết đầu hồi tốn 0 tri |
| **Tổng** | **Khu Vực Miền Trung & Tây Nguyên** | **100** | **893 452** | **100.0%** | **~334 000** | **Đạt trần `< 1 000 000 tri` (dư biên độ `106 548 tri`)** |

**Đánh giá & khuyến nghị tối ưu dự phòng** (để giữ toàn bản đồ 3 miền `< 3.46M tri` và `shadow-caster <= 900k`):
1. **Tổng L0 hiện tại là `893 452 tri` (`< 1 000 000 tri`)** — không vượt ngưỡng vùng. Tuy nhiên, **Cụm 2.1 Cố Đô Huế chiếm 44.5% (`397 540 tri`)**, do đó cần kích hoạt cơ chế **Interior Culling** cho nội thất kín (`MT-007`, `MT-014`, `MT-015`, `MT-016`, `MT-019`, `MT-028`, `MT-030`, `MT-075`, `MT-091`): chỉ render L0 khi camera ở trong bán kính `30m`, giảm ngay **`~120 000 tri`** khỏi khung hình ngoài trời.
2. **Nếu tổng 3 miền cần cắt giảm sâu thêm `-165 000 tri` tại Miền Trung** (hạ xuống `~728 000 tri`), thực hiện 5 bước chuyển `G-*` → `T-NRM` không ảnh hưởng silhouette:
   - `MT-020` Cửu Đỉnh: bake 153 ô `HV-E05` sang `T-NRM` độ phân giải `2048px` (tiết kiệm **`27 540 tri`**).
   - `MT-014` & `MT-017` & `MT-018`: hạ chân tảng `HV-C02` (128 cột tổng) từ 320 tri xuống trụ vát 12 cạnh + `T-NRM` 64 tri (tiết kiệm **`32 768 tri`**).
   - `MT-004` Đinh đồng Ngọ Môn (`HV-D14`, 486 đinh): chuyển thành normal + bump map bóng kim loại trên cánh cửa son (tiết kiệm **`11 664 tri`**).
   - `MT-009` Hoa sen Hồ Thái Dịch (`HV-C04`, 12 cụm): giảm từ 24 cánh/bông xuống 12 cánh + `T-NRM` (tiết kiệm **`7 200 tri`**).
   - `MT-002`, `MT-006`, `MT-013`, `MT-017`, `MT-024`, `MT-026`, `MT-029`, `MT-038`: gộp ngói diềm `HV-D15` & `HV-NEW-MT-02` thành băng diềm liên tục 1 quad/m + `T-NRM` (tiết kiệm **`~42 000 tri`**).
   - Tắt `castShadow = false` cho toàn bộ hoa văn chạm nông (`< 5 cm`), đèn lồng, hoa sen, mây sương và nội thất để giữ `shadow-caster` Miền Trung `<= 280 000 tri`.

---

### (b) Hoa Văn Đề Xuất Bổ Sung Vào Thư Viện (`HV-NEW-MT-01` → `HV-NEW-MT-16`)

| Mã đề xuất | Tên hoa văn | Hình thái thực tế | KT | Kích thước | Tri L0 | Bucket / Helper gợi ý | Ảnh ref | Component dùng |
|---|---|---|---|---|---:|---|---|---|
| `HV-NEW-MT-01` | **Đèn lồng lụa Hội An (khung tre bọc gấm)** | 5 dáng (tròn, tỏi, kim cương, lục giác, trái tim), 12–16 nan tre gân nổi `1.5 cm`, vòng gỗ 2 đầu, tua lụa rủ đáy, emissive ấm | `G-LATHE` + `G-INST` | Ø `0.25–0.65m` | 180/đèn | `crimsonParts`/`goldParts` · `createHoiAnLanternParts(shape)` | `44`, `84`, `20`, `21` | `MT-032`, `MT-033`, `MT-034`, `MT-036`, `MT-037`, `MT-052` |
| `HV-NEW-MT-02` | **Ngói âm dương & giọt nước đầu mái Miền Trung** | Cặp ngói sấp (dương) & ngói ngửa (âm) lợp rãnh sâu phủ rêu mốc, viền giọt nước đầu mái | `G-INST` | `0.18×0.25m` | 32/cặp | `roofParts` · `createYinYangRoofEaveParts` | `19`, `84` | `MT-024`, `MT-026`, `MT-034`, `MT-035` |
| `HV-NEW-MT-03` | **Vỏ thép CNC khoét lỗ hoa văn (Cầu Vàng)** | Tấm thép mạ vàng bóng cắt CNC khoét lỗ bán nguyệt & nhịp sóng đều, mép vát nổi `2 cm` | `G-EXT` + `G-INST` | `2.0×1.2m` | 160/tấm | `goldParts` · `createPerforatedGoldCladdingParts` | `48`, `85` | `MT-040` |
| `HV-NEW-MT-04` | **Gờ đá vôi chảy canxit, ruộng hồ nhũ & điêu khắc đá phong hóa** | Vân gờ sóng canxit xếp tầng bậc thang (*Gour Pools*), màn rèm đá (*curtains*), nhũ rãnh nhỏ giọt & nếp nứt đá bàn tay Cầu Vàng | `G-DISP` + `T-NRM` | Mảng `3–8m` | 420/mảng | `stoneParts` · `createKarstSpeleothemParts` | `22`, `23`, `48`, `58`, `85` | `MT-039`, `MT-053`→`MT-058`, `MT-060`→`MT-063` |
| `HV-NEW-MT-05` | **Văn khắc Chăm cổ & chữ Phạn (Bia ký / Hang Bi Ký)** | Hệ tự mẫu Pallava — Chăm cổ & Sanskrit khắc chìm `3–6 mm` trên bia sa thạch hoặc vách đá vôi hang động | `T-NRM` + `T-ATLAS` | `0.8–1.8m` | 0 | `stoneParts` · `createVietnamSignageTexture('cham_sanskrit')` | `41`, `86`, `92` | `MT-065`, `MT-073` |
| `HV-NEW-MT-06` | **Tượng Hộ Pháp Dvarapala Chăm Pa** | Tượng sa thạch cao `1.2–1.8m`, mắt tròn, ria vểnh, mũ chóp nhiều tầng, tay chống chùy lớn gác cửa đền Shiva | `G-DISP` + `G-LATHE` | Cao `1.5m` | 1 100 | `stoneParts` · `createChamGuardianParts('dvarapala')` | `41`, `86` | `MT-072` |
| `HV-NEW-MT-07` | **Bờ nóc mái hình thuyền yên ngựa Chăm (Kosa / B5)** | Mái vòm cong lõm giữa, 2 đầu hồi vút cong như mũi thuyền, viền 3 lớp gờ bậc thang và lá đề đỉnh hồi | `G-EXT` + `G-TUBE` | Dài `7.5m` | 540/đầu | `chamBrick` · `createChamSaddleRoofParts` | `86`, `86b` | `MT-068` |
| `HV-NEW-MT-08` | **Nhạc cụ lễ hội Katê Chăm (Paranưng, Ghi-năng, Saranai)** | Trống vỗ 1 mặt dây chữ V, trống dài 2 mặt sơn vạch đỏ-trắng, kèn gỗ 7 lỗ chuông đồng | `G-LATHE` + `G-TUBE` | `0.4–0.9m` | 240/món | `woodParts`+`bronzeParts` · `createChamKateInstrumentParts` | `25`, `87` | `MT-078` |
| `HV-NEW-MT-09` | **Khung kính đa giác Diagrid hình hoa (Quảng Trường Lâm Viên)** | Mảng kính xanh lục — vàng xếp hình thoi/tam giác xoắn ốc tạo nụ Atisô và cánh Hoa Dã Quỳ | `G-INST` + `S-SHD` | `1.4×1.8m` | 48/ô | `roofParts`+`goldParts` · `createDiagridGlassPanelParts` | `26`, `89` | `MT-085` |
| `HV-NEW-MT-10` | **Họa tiết Art Deco hình học & đầu mái 3 chóp (Đà Lạt 1930s)** | Gờ giật cấp bậc thang đối xứng, đường sọc đứng, khung cửa tròn kiểu Streamline Moderne / Art Deco | `G-EXT` | `1.5–2.0m` | 140/ô | `plasterParts`/`whiteParts` · `createArtDecoReliefParts` | `26`, `89` | `MT-084`, `MT-087` |
| `HV-NEW-MT-11` | **Ché rượu cần Tây Nguyên (gốm men da lươn đắp nổi)** | Ché bụng phình vai rộng 4–6 tai nhỏ, đắp nổi dây sóng/rồng mây đơn sơ quanh vai, cắm cần tre uốn cong | `G-LATHE` + `G-DISP` | Cao `0.7m` | 320/ché | `chamBrick`/`bronzeParts` · `createTayNguyenWineJarParts` | `42`, `90`, `122` | `MT-092`, `MT-100` |
| `HV-NEW-MT-12` | **Cây nêu lễ hội Tây Nguyên (tua tre & chim thần Pơ-lang)** | Trụ tre cao `9m` khắc khoanh đen-đỏ-trắng, 4 tầng bông tre chẻ tua (*k'la*), đỉnh gắn chim thần Pơ-lang dang cánh | `G-TUBE` + `G-EXT` | Cao `9.0m` | 680/cây | `woodParts`+`crimsonParts` · `createTayNguyenNeuPoleParts` | `90`, `122` | `MT-095` |
| `HV-NEW-MT-13` | **Trống Hơgơr (da trâu) & Đàn T'rưng Tây Nguyên** | Trống gỗ nguyên khối căng da trâu có hàng chốt gỗ quanh tang; giàn 14 ống nứa T'rưng vát chéo đầu | `G-LATHE` + `G-INST` | `0.9–1.5m` | 360/bộ | `woodParts` · `createTayNguyenPercussionParts` | `91`, `122` | `MT-094` |
| `HV-NEW-MT-14` | **Nhang vòng xoắn ốc & Mô hình Thuyền buồm thương gia (Hội Quán)** | Nhang vòng hình nón xoắn 14 tầng treo thẻ đỏ kín trần; mô hình thuyền buồm Phúc Kiến có mắt thuyền ở mũi | `G-TUBE` + `G-EXT` | `0.5–1.8m` | 280/món | `crimsonParts`+`woodParts` · `createIncenseCoilAndJunkParts` | `115` | `MT-031` |
| `HV-NEW-MT-15` | **Bộ Bát Bửu cung đình & Tán lọng nghi trượng triều Nguyễn** | 8 món binh khí đồng/thếp vàng (kích, mác, xà mâu, búa Việt...) và lọng 2 tầng tua rủ thêu rồng mây | `G-EXT` + `G-LATHE` | Cao `2.2–3.1m` | 320/món | `goldParts`+`crimsonParts` · `createImperialRegaliaParts` | `40`, `53`, `106b` | `MT-007`, `MT-016` |
| `HV-NEW-MT-16` | **Họa tiết đúc đồng Súng Thần Công triều Nguyễn (Cửu Vị Thần Công)** | Quai rồng đôi chung lưng, 6 vòng đai gân tròn, mây lửa quanh lỗ châm ngòi, khắc chữ Hán hiệu pháo | `G-LATHE` + `G-TUBE` + `T-NRM` | Dài `4.5–5.1m` | 620/khẩu | `bronzeParts` · `createNguyenCannonParts` | `17`, `18` | `MT-003` |

---

### (c) Thứ Tự Triển Khai 3 Đợt (`P0` / `P1` / `P2`) Theo Component

#### Đợt P0 — Di Sản Biểu Tượng & Trục Hero Cốt Lõi (34 component — `422 838 tri L0`)
Ưu tiên dựng trước toàn bộ trục di sản tạo nhận diện bản đồ từ trung cảnh & viễn cảnh, khóa xong toàn bộ helper P0/P1 và shader `HV-J01..J03`, `HV-F11`, `HV-G01..G03`:
- **2.1 Huế (10)**: `MT-001` (Kỳ Đài), `MT-002` (Phu Văn Lâu), `MT-004` (5 Cửa Ngọ Môn), `MT-006` (Lầu Ngũ Phụng), `MT-009` (Hồ Thái Dịch & Cầu Trung Đạo), `MT-012` (Thềm Rồng Điện Thái Hòa), `MT-013` (Mái Trùng Thiềm Điệp Ốc), `MT-014` (80 Cột Long Vân), `MT-015` (Ngai Vàng & Bửu Tán), `MT-020` (Hàng Cửu Đỉnh Đồng).
- **2.2 Hội An (5)**: `MT-023` (Chùa Cầu chữ T), `MT-024` (Mái ngói Chùa Cầu), `MT-026` (20 Nhà Ống Phố Cổ), `MT-027` (Bộ Mắt Cửa Hội An), `MT-029` (Tam Quan Hội Quán Phúc Kiến).
- **2.3 Đà Nẵng (5)**: `MT-039` (Đôi Bàn Tay Cầu Vàng), `MT-040` (Vỏ thép mạ vàng Cầu Vàng), `MT-046` (Thân Rồng 5 ống thép), `MT-048` (Đầu Rồng thời Lý cách điệu), `MT-049` (Đuôi Rồng Búp Sen).
- **2.4 Sơn Đoòng & Phong Nha (4)**: `MT-053` (Đại hành lang Sơn Đoòng), `MT-054` (Hố Sụt 1), `MT-055` (Hố Sụt 2 Vườn Địa Đàng), `MT-061` (Núi Đá Vôi Cửa Động Phong Nha).
- **2.5 Mỹ Sơn & Poshanư (4)**: `MT-067` (Tháp Chính A1 Mỹ Sơn), `MT-068` (Tháp Kho Kosa B5 mái thuyền), `MT-071` (Phù điêu Apsara & Gandharva), `MT-074` (Tháp Chính A Poshanư).
- **2.6 Đà Lạt (3)**: `MT-079` (Tượng Đôi K'Lang & H'Biang), `MT-085` (Quảng Trường Lâm Viên Atisô & Dã Quỳ), `MT-087` (Ga Đà Lạt 3 Mái Chóp).
- **2.7 Tây Nguyên (3)**: `MT-089` (Nhà Rông mái lưỡi rìu), `MT-090` (Cầu thang độc mộc bầu sữa & trăng khuyết), `MT-093` (Dàn Cồng Chiêng Tây Nguyên).

#### Đợt P1 — Nội Thất Đi Bộ, Cụm Công Trình Kế Cận & Di Tích Đặc Thù (36 component — `292 326 tri L0`)
Mở rộng trải nghiệm tham quan đi bộ xuyên nội thất, hoàn thiện các công trình vệ tinh quan trọng và triển khai toàn bộ helper `HV-NEW-MT-*` chuyên sâu:
- **2.1 Huế (7)**: `MT-003` (18 Khẩu Thần Công), `MT-005` (Lòng 3 cổng Ngọ Môn), `MT-007` (Nội thất Lầu Ngũ Phụng), `MT-008` (Lầu Cánh Trong — Đại Hồng Chung & Trống Sấm), `MT-010` (Tứ Trụ Nghi Môn pháp lam), `MT-018` (Thế Miếu Chính Điện 9 gian), `MT-019` (9 Khám Thờ Liệt Đế).
- **2.2 Hội An (6)**: `MT-025` (Tượng Chó & Khỉ Chùa Cầu), `MT-028` (Nội thất Nhà Cổ Tấn Ký), `MT-030` (Chính Điện Hội Quán Phúc Kiến), `MT-032` (Cửa hiệu Đèn Lồng Lụa), `MT-036` (Bến Sông Hoài & Thuyền Hoa Đăng), `MT-038` (Chùa Ông & Giếng Cổ Bá Lễ).
- **2.3 Đà Nẵng (5)**: `MT-041` (Lan can & Hoa Lobelia Cầu Vàng), `MT-043` (Ga Cáp Treo Marseille), `MT-047` (Dây cáp treo Cầu Rồng), `MT-050` (Hệ LED & Phun Lửa — Phun Nước), `MT-051` (Tượng Cá Chép Hóa Rồng).
- **2.4 Sơn Đoòng & Phong Nha (5)**: `MT-056` (Bức Tường Việt Nam), `MT-057` (Hồ Nhũ Gour Pools & Ngọc Động), `MT-058` (100 Trụ Nhũ Đá), `MT-062` (Lòng Động Phong Nha — Bi Ký & Cung Đình), `MT-063` (Nhũ Đá Điêu Khắc tinh thể).
- **2.5 Mỹ Sơn & Poshanư (4)**: `MT-069` (Tháp phụ phế tích), `MT-072` (Hộ Pháp Dvarapala & Linga-Yoni), `MT-075` (Lòng Tháp A Poshanư), `MT-076` (Tháp B & Tháp C Poshanư).
- **2.6 Đà Lạt (4)**: `MT-080` (Sân Vọng Cảnh `1.929m`), `MT-084` (Nhà Hàng Thủy Tạ), `MT-086` (Đội Thuyền Đạp Vịt Hồ Xuân Hương), `MT-088` (Biệt Thự Pháp Cổ & Cẩm Tú Cầu).
- **2.7 Tây Nguyên (5)**: `MT-091` (Nội thất Nhà Rông & Cột Thần), `MT-092` (Bếp Lửa & Ché Rượu Cần), `MT-095` (Cây Nêu Lễ Hội), `MT-096` (Nhà Dài Ê Đê `30m`), `MT-097` (Khu Nhà Mồ & Tượng Gỗ Dân Gian).

#### Đợt P2 — Cảnh Quan, Đời Sống Văn Hóa, Hậu Cảnh & Điểm Nhấn Phụ (30 component — `178 288 tri L0`)
Bổ sung sức sống văn hóa đường phố, lễ hội, thiên nhiên phụ trợ và chạy kiểm thử toàn diện `MultiAngleQcAgent` (10 góc/component + `motifCoverage` + `motifDepthCheck`):
- **2.1 Huế (5)**: `MT-011` (Sân Đại Triều Nghi & 18 Phẩm Sơn), `MT-016` (Tán Lọng & 6 Lục Bình), `MT-017` (Trường Lang Tử Cấm Thành), `MT-021` (Hiển Lâm Các 3 tầng), `MT-022` (Cổng Hiển Nhơn & Chương Đức).
- **2.2 Hội An (5)**: `MT-031` (Thuyền Buồm Thương Gia & 6 Vòng Nhang), `MT-033` (Tiệm May Áo Dài & Trà Mót), `MT-034` (Con Hẻm Tường Vàng), `MT-035` (Giàn Hoa Giấy đa tầng), `MT-037` (Cầu An Hội).
- **2.3 Đà Nẵng (4)**: `MT-042` (2 Trụ Mố Đá Cầu Vàng), `MT-044` (Cổng Vườn Hoa Le Jardin d'Amour), `MT-045` (Mây sương kẽ ngón tay), `MT-052` (Cầu Tình Yêu Sông Hàn).
- **2.4 Sơn Đoòng & Phong Nha (5)**: `MT-059` (Trại Thám Hiểm Sơn Đoòng), `MT-060` (Sông Ngầm Rào Thương), `MT-064` (Đội Thuyền Du Lịch Phong Nha), `MT-065` (Cầu gỗ & Chữ Chăm Hang Bi Ký), `MT-066` (Bến Thuyền Phong Nha).
- **2.5 Mỹ Sơn & Poshanư (4)**: `MT-070` (Tường thành Chăm & Suối Khe Thẻ), `MT-073` (2 Nhà Trưng Bày Bia Ký), `MT-077` (Lối gạch đỏ & Sân lễ hội Katê), `MT-078` (Bộ Nhạc Cụ Lễ Hội Katê).
- **2.6 Đà Lạt (3)**: `MT-081` (Đội Xe Jeep Langbiang), `MT-082` (Quán Cà Phê Gỗ Thông), `MT-083` (Rừng Thông 3 Lá & Cỏ Hồng — Dã Quỳ).
- **2.7 Tây Nguyên (4)**: `MT-094` (Trống Hơgơr & Đàn T'rưng), `MT-098` (Lầu Vọng Cảnh Biển Hồ T'Nưng), `MT-099` (Đường Thông Cổ Thụ & Đồi Chè), `MT-100` (Vòng Lửa Trại & Sân Múa Xoang).
