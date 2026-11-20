# Báo Cáo QC Trực Tiếp Từng Bức Tường, Viên Gạch & Danh Sách Yêu Cầu Nâng Tầm Map Việt Nam (Vòng 2 — Hậu `1318a39`)

> **Ngày kiểm định**: 2026-11-20  
> **Phạm vi kiểm tra**: Toàn bộ ~27.000 dòng code hiện hành sau commit `1318a39` trên 5 builder (`VietnamHeritageScene.ts`, `vietnamNorthBuilder.ts`, `vietnamCentralBuilder.ts`, `vietnamSouthBuilder.ts`, `vietnamReferenceShowBuilder.ts`) + 4 file nền tảng (`pbrTextures.ts`, `vietnamGeometryHelpers.ts`, `vietnamMotifHelpers.ts`, `vietnamHeritageShader.ts`), đối chiếu **trực quan trực tiếp** với toàn bộ **111 ảnh đời thực** (`vietnamreference/real_life_refs/`) và **15 ảnh sân khấu mẫu** (`vietnamreference/01..15_*.jpg`).  
> **Ghi chú kho ảnh**: Phát hiện 1 ảnh (`04_hoa_van_hoa_tiet/41_cham_khac_thap_cham.jpg`) đang ở định dạng JPEG Grayscale 8-bit (`Format8bppIndexed`) gây lỗi đọc trên một số pipeline vision; nên chuyển sang RGB 24-bit khi chuẩn hóa kho ảnh.

---

## PHẦN I — NÂNG CẤP NỀN TẢNG VẬT LIỆU PBR, SHADER & THƯ VIỆN HOA VĂN DÙNG CHUNG (LÀM TRƯỚC — CROSS-CUTTING P0)

Trước khi chỉnh từng địa danh, cần xử lý dứt điểm **6 lỗi hệ thống** và bổ sung **8 bộ PBR texture + 7 nâng cấp geometry helper** để loại bỏ tận gốc tình trạng tường gạch bị bọc texture ngói lợp, nhựa phẳng hoặc khối hộp thô:

### 1.1. 6 Lỗi Hệ Thống Vật Liệu & UV Phải Vá Ngay
| # | Vị trí code | Lỗi nghiêm trọng phát hiện | Giải pháp chuẩn |
|---|---|---|---|
| **S1** | `VietnamHeritageScene.ts:777-784` | `chamBrick` đang gán `map/normalMap/roughnessMap: pbr.terracotta` (**ngói ống lợp mái!**) → toàn bộ tường Mỹ Sơn, Poshanư, Ponagar, Nhà Thờ Đức Bà, Đoan Môn, Đền Hùng, Cột Cờ Cà Mau đều bị **bọc họa tiết ngói lợp** thay vì gạch xây! | Tách riêng vật liệu gạch xây chuẩn: `chamRubbedBrick`, `marseilleBrick`, `weatheredImperialBrick`, `lateriteHoneycomb`. |
| **S2** | `vietnamGeometryHelpers.ts:682-690` | `createJadeTileMaterial` gán `bumpMap: darkRoof?.bumpMap ?? null` trong khi `darkRoof` dùng `normalMap` (`bumpMap === null`) → **ngói Thanh Lưu Ly Huế phẳng lì như nhựa**, không có sóng ngói! | Truyền `normalMap` + `roughnessMap` của `darkRoof` vào `jadeRoof` (kèm `roughness: 0.28`, `metalness: 0.12`). |
| **S3** | `vietnamSouthBuilder.ts:1680` | `NotreDameRoseWindowGlow` dùng `ctx.materials.lanternSilk` (màu đỏ cam rực, sọc nan đèn lồng Hội An và **vertex shader đung đưa theo gió**!) → kính màu & đèn phố Nhà Thờ Đức Bà phát sáng đỏ rực và uốn éo theo gió! | Tách sang `stainedGlassMat` tĩnh có họa tiết ô kính màu & ánh sáng vàng ấm/đa sắc. |
| **S4** | `VietnamHeritageScene.ts:793-802` & `vietnamGeometryHelpers.ts:695-712` | `gold`, `bronze`, `whiteMarble`, `ochreSand` **không có bất kỳ texture/normal/roughness map nào** → bề mặt kim loại/đá nhìn như nhựa trơn đơn sắc. | Bổ sung micro-grain normal + roughness map cho vàng thếp, đồng cổ patina xanh ngọc (*verdigris*), đá cẩm thạch có vân và đá sa thạch phân lớp. |
| **S5** | `vietnamGeometryHelpers.ts:194-273, 306-339` | `BoxGeometry` trải UV `0..1` bất kể kích thước (tường 46m kéo giãn đá thành tảng 4.5m!), còn `ExtrudeGeometry` (vòm cửa) dùng UV theo mét thực → **lệch mật độ gạch/đá nghiêm trọng** khi merge chung. `createVietnameseCurvedRoofGeometry` trải UV vuông `0..1` khiến sóng ngói ở 2 mái hông chạy **ngang** thay vì xuôi theo dốc mái, lại mỏng 0mm không có diềm mái/rui mè. | Thêm helper `applyWorldBoxUV(geo, metersPerTile)` cho tường/gạch trước khi merge; nâng cấp `createVietnameseCurvedRoofGeometry` có UV theo 4 mái dốc chuẩn hướng ngói, độ dày diềm mái, bờ chảy và tùy chọn dải *ngói câu đầu – trích thủy*. |
| **S6** | `vietnamMotifHelpers.ts:110-160` | `SignageAtlas` mục `style: 'ceramic_relief'` bỏ qua `subText` khi `text: ''` và vẽ cùng 1 hình 7 quả bầu dục vàng chung chung cho mọi phù điêu; chưa có normal/bump map và khung viền chạm nổi. | Tách hàm vẽ riêng từng chủ đề (4 phù điêu Biên Hòa, văn bia Hán-Nôm, Pháp lam *Nhất Thi Nhất Họa*, phù điêu Lũng Cú), hỗ trợ `bumpMap` chữ khắc chìm/nổi. |

### 1.2. 8 Bộ PBR Texture Mới Cần Bổ Sung Trong `pbrTextures.ts`
1. **`createChamRubbedBrickPbrTextures` (`chamRubbedBrick`)**: Gạch Chăm mài chập mạch siêu khít, sắc cam đất nung – đỏ gạch loang mảng mốc đen/rêu mưa nhiệt đới (Mỹ Sơn, Poshanư, Ponagar).
2. **`createMarseilleBrickPbrTextures` (`marseilleBrick`)**: Gạch trần Marseille đỏ cam xếp mạch ngang phẳng đều, vữa mảnh xám sáng (Nhà Thờ Đức Bà Sài Gòn).
3. **`createImperialBrickPbrTextures` (`weatheredImperialBrick`)**: Gạch vồ cổ xám-nâu cháy loang vệt ố rêu đen dọc (Đoan Môn, 2 cánh Ngọ Môn Huế, Cột Cờ Hà Nội, Cột Cờ Cà Mau).
4. **`createLateriteHoneycombPbrTextures` (`lateriteHoneycomb`)**: Đá ong tổ ong lỗ khí rỗ nâu gỉ sắt có mạch vữa xám & rêu chân tường (Đường Lâm, Đền Hùng).
5. **`createAgedVietnamesePlasterPbrTextures` (`agedPlaster`)**: Vữa vôi cổ vàng nghệ / trắng xám loang vệt nước mưa đen chảy từ dưới phào chỉ & chân tường ẩm (Hội An, Tháp Rùa, Chùa Một Cột, Đoan Môn, Lăng Vua Hùng).
6. **`createBatTrangFloorPbrTextures` (`batTrangBrickFloor`)**: Gạch Bát Tràng đỏ nâu lát vuông & lát xương cá cho sân Văn Miếu, Điện Kính Thiên, Cửu Đỉnh, Thiên Trù, Đình Mông Phụ.
7. **`createThatchAndBambooWeavePbrTextures` (`thatchFiber`, `bambooWeave`)**: Sợi cỏ tranh xù dày nhiều lớp + phên nứa đan mắt cáo/xương cá (Nhà Rông, Nhà Sàn Thái, Chòi canh lúa, Nón lá).
8. **`createBronzeVerdigrisPbrTextures` (`bronzePatina`)**: Đồng cổ đúc có mảng patina xanh ngọc lục bảo loang trên nền đồng đen (Cửu Đỉnh, Đại Tượng Phật Fansipan, Đỉnh đồng cổ).

### 1.3. 7 Nâng Cấp Thư Viện Hình Học Hoa Văn (`vietnamMotifHelpers.ts` & `vietnamGeometryHelpers.ts`)
1. **`createPiercedBalustradeParts`**: (a) `con_tien` dùng `LatheGeometry` hình con tiện bầu thắt eo thật thay trụ 6 cạnh thẳng; (b) `chu_van` đủ 4 móc chữ Vạn `卍`; (c) thêm biến thể mới **`hoa_chanh_ceramic`** (tường vữa xám + ô gạch thông gió hoa chanh men xanh lục cho Giếng Thiên Quang, Chùa Một Cột, Ngọ Môn); (d) `lotus_stone` có khung ô đắp nổi/thủng bát giác hoa 4 cánh thay hộp trơn.
2. **`createChamTowerGeometry`**: Thêm cột ốp tường **khía 3 rãnh dọc sâu**, chân đế & phào cổ tháp giật 5–6 bậc, **cửa giả 3 lớp vòm lá đề / giật bậc corbel** (thay 1 hộp + 1 chóp 4 cạnh), tháp góc thu nhỏ giật tầng, và tùy chọn **tháp mái hình thuyền (Kosa / Tháp Tây Bắc Ponagar)** cong mượt.
3. **`createCarvedDragonBalustradeParts`**: Thay đầu rồng 3 hộp vuông bằng khối điêu khắc bo cong có râu xoắn ốc, **bờm sóng mây dày cuộn ngược**, vây lưng liên hoàn, và **vách bệ xiên nguyên khối có phù điêu nổi mây/hoa sen** (thay 7 hộp rời).
4. **`createCarvedTurtleSteleParts`**: Mai rùa vòm lục giác phân múi rõ, đầu tròn bóng đen rụt sát mai, 4 chân bẹt xòe ngón, thân bia áp **texture/normal chữ Hán dọc + trán bia vòm chạm Lưỡng long chầu nguyệt**.
5. **`createSculptedDeityParts`**: Thêm cờ `skipHalo?: boolean` (tắt vòng vàng thừa cho Phật Fansipan, Đức Mẹ Hòa Bình, Quan Âm Hương Tích), cánh sen mập bầu 3 tầng (thay nón nhọn 5 cạnh), khuôn mặt rõ sống mũi/mày/môi/tai, nếp áo cà sa chéo, và tùy chọn tách 2 vật liệu đồng đen (áo) + đồng đỏ ấm (mặt/ngực chữ Vạn/tay).
6. **`createRoofFinialSetParts`**: Thêm tùy chọn `finish: 'mossy_plaster' | 'hue_ceramic_mosaic' | 'gilded'` để hết tình trạng toàn bộ chùa/đình Bắc Bộ bị gắn rồng vàng kim loại bóng loáng phi thực tế.
7. **`createVietnameseCurvedRoofGeometry` + `createGableRoofGeometry` + `createSteppedCorbelArchGeometry`**: Thêm 2 helper chuẩn cho mái 2 dốc bít đốc (Hội An, Đường Lâm, Nhà Sàn Thái, Chòi canh) và vòm gạch giật bậc corbel Chăm Pa (Poshanư, Mỹ Sơn).

---

## PHẦN II — BẢNG TỔNG HỢP 38 LỖI HÌNH HỌC, CẮT XUYÊN, LƠ LỬNG & SAI KIẾN TRÚC NGHIÊM TRỌNG (P0 — PHÁT HIỆN MỚI HẬU `1318a39`)

| # | Địa danh | File & Dòng | Lỗi P0 phát hiện trực tiếp trong code & ảnh |
|---|---|---|---|
| **R1** | **Khuê Văn Các** | `VietnamHeritageScene.ts:1617-1647` | Cửa sổ Mặt Trời **đảo ngược cấu trúc** (vẽ vòng tâm + nan hướng vào trong màu vàng kim thay vì lỗ tròn rỗng 100% + 8 tia gỗ sơn son tỏa ra khung vuông); `roof1Geo` cắt xuyên `upperDeck`; `cauDoiBoard` bay cách tường `0.27m` cắt vào cột. |
| **R2** | **Khuê Văn Các & Nhà Bia** | `VietnamHeritageScene.ts:1073, 1650` | Toàn bộ mái gán nhầm `darkRoof` xám đen (thực tế ngói đất nung đỏ cam rêu) + đỉnh nóc vàng kim loại bóng (thực tế vữa vôi xám). |
| **R3** | **Chùa Một Cột** | `VietnamHeritageScene.ts:2333, 2350-2425` | Hệ vì kèo dùng 12 nan xòe tròn (sai hoàn toàn hệ **vì kèo vuông trực giao 8 thanh gỗ lim**); toàn bộ gỗ tô đỏ sơn son (sai gỗ lim nâu đen); thành cầu thang gạch răng cưa đâm xuyên lan can ban công. |
| **R4** | **Tháp Rùa & Cầu Thê Húc & Đắc Nguyệt Lâu** | `VietnamHeritageScene.ts:2970-3183` | Tháp Rùa dựng sai **lỗ châu mai răng cưa + sao vàng 5 cánh** (thực tế mái ngói 2 tầng + 4 đầu đao rồng khảm gốm + bầu hồ lô); Cầu Thê Húc dùng con tiện đứng + cột thẳng 90° (thực tế **lan can chữ X + cột nghiêng chữ A `±13°`**); Đắc Nguyệt Lâu thiếu **cửa sổ tròn Nguyệt Môn + phù điêu xanh ngọc lam**. |
| **R5** | **Cầu Vàng — Bà Nà** | `VietnamHeritageScene.ts:3920-4025, 3666` | **Cả 4 ngón tay + ngón cái đâm xuyên thân cầu & máng hoa**; cổ tay đeo 2 vòng torus như lốp xe; lòng bàn tay lồi 3 thanh xà ngang; mố cầu Tây chồng Z-fighting nền Ga Marseille; trụ cầu sai thành ống vàng (thực tế ống xanh rêu đậm + chạc V/Y vàng). |
| **R6** | **Vịnh Hạ Long** | `VietnamHeritageScene.ts:4081, 4278, 4444` | **10 bậc thang Đảo Ti Tốp cách nhau 1.75m/bậc bay lơ lửng**; nan tre 3D thuyền buồm đâm xuyên ra sau cánh buồm cong; Hòn Đỉnh Hương thành 2 chân que đội nấm. |
| **R7** | **Mù Cang Chải** | `VietnamHeritageScene.ts:4689, 4731`; `North:3550` | **Thang chòi canh ngược góc cắt thành chữ X**; **máng nước cọn nước dài 9.5m bay lơ lửng ở `+5.6m` không cột đỡ**; Nhà sàn Thái dùng mái đao cong đình chùa áp map ngói `darkRoof`. |
| **R8** | **Hoàng Thành — Đoan Môn** | `vietnamNorthBuilder.ts:293, 326-530, 886` | Vọng Lâu tầng 2–3 dựng sai thành **nhà gỗ sơn son viền vàng** (thực tế tường vôi vàng rêu + 3 cửa sổ chấn song hoa thị trắng); tường Đoan Môn dùng `chamBrick` đỏ + lỗ châu mai răng cưa không tồn tại. |
| **R9** | **Cột Cờ Hà Nội** | `vietnamNorthBuilder.ts:679-773` | 3 tầng đế dựng khối hộp thẳng 90° (sai tường vát chóp cụt Vauban + lan can gạch hoa thủng); Vọng Lâu đỉnh rỗng 8 cột (sai tường bát giác đặc 8 cửa sổ chớp). |
| **R10** | **Cột Cờ Lũng Cú** | `vietnamNorthBuilder.ts:1045-1171` | **Cửa vòm lệch trục `22.5°` so với cầu thang & biển `LungCuSovereigntyPlaque` bay lơ lửng cách tháp `>2m`**; thiếu bệ chóp cụt vát 45° phù điêu đá xanh & vành đỏ bát giác gắn 8 trống đồng; thừa 5 vòng đồng ngang thân tháp; đài đỉnh sai thành bát giác (thực tế tròn + lan can inox trắng). |
| **R11** | **Đỉnh Fansipan** | `vietnamNorthBuilder.ts:1515-1656` | **3 biển `Fansipan3143Plaque` bay lơ lửng cách chóp inox `0.28m`**; Đại Tượng Phật bị gắn sai **vòng hào quang vàng `r=3.43m`** + bệ vuông (thực tế bệ bát giác đồng đen chạm rồng Trần, không hào quang); Chùa Kim Sơn Bảo Thắng sai thành đình sơn son viền vàng (thực tế gỗ mộc + tường đá xanh). |
| **R12** | **Chùa Hương** | `vietnamNorthBuilder.ts:1988, 2250, 2413, 2543` | **Thân thuyền `TubeGeometry` đặc khiến ghế & hành khách chìm xuyên thân thuyền**; mái Thiên Trù gán sai `darkRoof` đen; cổ diêm hộp đặc trơn; chữ *"NAM THIÊN ĐỆ NHẤT ĐỘNG"* treo biển đồng lơ lửng ở `12.8m` (thực tế khắc chìm vách đá trái tiền sảnh). |
| **R13** | **Đền Hùng** | `vietnamNorthBuilder.ts:2675, 2897-2974, 3176-3276` | **Hùng Vương Lăng** dựng sai thành đình cột đỏ mái đỏ (thực tế lăng vuông vữa trắng-xám 4 vòm + 4 rồng vữa bờ chảy + lan can bát giác hoa 4 cánh); **Nghi Môn Đền Thượng** dựng sai thành cổng trụ đỏ mái đỏ (thực tế cổng 3 vòm vữa xám + 2 phù điêu Võ Sĩ đa sắc); Z-fighting thành đá ong & bệ rồng suốt 3 vế thang. |
| **R14** | **Ngọ Môn Huế** | `vietnamCentralBuilder.ts:435-573, 699-738` | **2 cửa vòm Tả/Hữu Dịch Môn đặt sai mặt phẳng** (thực tế nằm ở mặt hông trong 2 cánh chữ U vuông góc 90°); cánh cửa chữ nhật đâm xuyên vòm; biển `NGỌ MÔN` che lẹm đỉnh Chính Môn & chồi quá tường thành; mái Lầu Ngũ Phụng chồng lấn `2.1m` và hở khe chữ U `3.6m`; đài thành thiếu độ vát ~8° & sai vật liệu đá thay gạch vồ. |
| **R15** | **Kỳ Đài Huế** | `vietnamCentralBuilder.ts:983-984` | Tường gạch tầng 1 (`17.8×5.8×17.8`) bị **chôn vô hình 100% bên trong khối đá** (`18.2×6.2×18.2`) và thiếu độ vát thành Vauban. |
| **R16** | **Hội An & Chùa Cầu** | `vietnamCentralBuilder.ts:1199-1551, 1658` | Chùa Cầu thiếu **4 vòm bán nguyệt + 1 khoang giữa phẳng + dầm vòm vữa trắng + 2 tường cánh sơn đỏ**; sai mái đen + cột đỏ (thực tế ngói đỏ sọc vữa trắng + gỗ lim nâu đen); biển `LAI VIỄN KIỀU` đâm xuyên mái; **Mắt cửa bay lơ lửng** ở 6 nhà `hasOpenShop`; Z-fighting tường hồi 16 nhà ống; shader nan đèn lồng vẽ **sọc ngang** thay vì nan tre dọc. |
| **R17** | **Cầu Rồng — Đà Nẵng** | `vietnamCentralBuilder.ts:1874-1972` | Thân rồng lắc ngang `zWeave` xâm lấn làn xe & không chui dưới gầm cầu ôm trụ; vòng collar lệch tiếp tuyến; thanh chéo vàng lệch góc; đầu rồng là 4 khối hộp vuông thay vì thép tấm CNC xếp lớp đục lỗ tròn phong cách Lý. |
| **R18** | **Hang Sơn Đoòng** | `vietnamCentralBuilder.ts:2122-2274, 2506` | **Mái bếp trại (`kitchenCanopy`) bay lơ lửng không cột**; **mặt nước Gour Pools bị gán vật liệu đá kem** (`calciteParts`); 88 cục đá vòm hang hở khe sáng ngang hông; Bức Tường Việt Nam là 1 hộp phẳng `46×52×4.4m` + thang leo bị chôn trong đá. |
| **R19** | **Động Phong Nha** | `vietnamCentralBuilder.ts:2564-2670` | **Sàn gỗ Hang Bi Ký đâm xuyên 6.7m vào vách đá trái**; phần lớn 20 nhũ bờ bị chôn trong vách đá; cửa động tròn cao 25m sai vách đá vôi nứt xéo bất đối xứng; 3 thuyền du lịch chỉ là 2 khối hộp không mũi vểnh & không hoa văn rồng. |
| **R20** | **Mỹ Sơn & Poshanư** | `vietnamCentralBuilder.ts:2770, 2940`; `Helpers:484` | `chamBrick` bọc texture ngói ống; **Tháp Kho Kosa B5** dùng mái cong 4 góc đình chùa thay vì **mái vòm hình thuyền yên ngựa có 2 đầu hồi gạch cong**; **cổng Poshanư** dùng vòm nhọn Gothic mượt thay vì **vòm gạch giật bậc corbel** (`87_thap_poshanu_chi_tiet.jpg`). |
| **R21** | **Đà Lạt & Nhà Rông — Nhà Mồ** | `vietnamCentralBuilder.ts:3103, 3112, 3446-3465` | Tượng K'Lang–H'Biang là 2 ống trụ + 2 quả cầu; thiếu biển chữ 3D trắng `"LANGBIANG"` có 2 chữ A hình đỉnh núi & chấm chữ I hoa mai anh đào (`26`/`88`); Nhà Mồ dùng sai mái đao đình chùa + tượng là 1 trụ 1 cầu thiếu hàng rào cọc gỗ vót nhọn (`90`). |
| **R22** | **Chợ Bến Thành** | `vietnamSouthBuilder.ts:558-569, 623-718` | **Tháp Đồng Hồ nhô lơ lửng `2.7m` ra trước cổng chính**; `northEave` đâm xuyên chân tháp; mái tháp sai thành 2 tầng + lan can đá (thực tế 1 tầng mái ngói xòe rộng có con sơn); 4 phù điêu Biên Hòa giống hệt nhau; trần nội thất bịt kín cửa trời. |
| **R23** | **Dinh Độc Lập** | `vietnamSouthBuilder.ts:1030-1131` | **Trực thăng UH-1 + 2 vòng bom đặt sai lên mái *Tứ Phương Vô Sự* kèm chữ `"H"` vàng** (thực tế nằm ở sân thượng cánh chữ T sau, 2 vòng tròn đơn chữ đỏ, không chữ H); rèm đốt trúc bị 3 thanh ngang cắt thành lưới vuông; cột cờ giữa mái trống trơn không có cờ. |
| **R24** | **Nhà Thờ Đức Bà Sài Gòn** | `vietnamSouthBuilder.ts:1525-1680` | Tường gạch bị bọc texture ngói ống; kính màu & đèn Paris gán nhầm `lanternSilk` đỏ đung đưa theo gió; **Đồng hồ đặt sai dưới cửa sổ Hoa Hồng & bị `centerGableTri` đâm xuyên** (thực tế đồng hồ nằm trên đỉnh hồi tam giác); 2 chóp tháp sơn sai xanh lục đồng (thực tế **xám bạc kẽm**). |
| **R25** | **Địa Đạo Củ Chi & Bến Dược** | `vietnamSouthBuilder.ts:1756-1768, 1915-2002` | **Tháp Bến Dược 9 tầng** dựng sai thành tháp chùa bát giác sơn son thu nhỏ (thực tế **tháp vuông thẳng không thu nhỏ có 4 cột góc nâu vàng + 7 tầng ban công trắng diềm ngói đỏ viền xanh + 2 trụ rồng cuốn**); 3 nắp hầm bí mật bị lỗi thứ tự `rotateY/translate` nên **lệch khỏi khung miệng hầm**. |
| **R26** | **Tháp Bà Ponagar** | `vietnamSouthBuilder.ts:2323-2379, 2523` | Toàn bộ 4 tháp & 22 cột Mandapa bọc texture ngói ống; 22 cột Mandapa quá mảnh, thiếu **đầu cột giật 3 cấp & lỗ mộng vuông khoét thân cột**; Tháp thứ 4 mái hình thuyền ghép 12 lát trụ răng cưa + gắn sai 2 chóp vàng. |
| **R27** | **Rừng Tràm Trà Sư** | `vietnamSouthBuilder.ts:3356-3364` | **20 tổ cò & cò trắng sinh bằng seed độc lập nên BAY LƠ LỬNG GIỮA TRỜI** không nằm trên tán 300 cây tràm! |
| **R28** | **Mũi Cà Mau** | `vietnamSouthBuilder.ts:3575, 3611-3683` | **Chóp Mốc GPS 0001 truyền nhầm `rotX = PI/4` khiến chóp bị NGHIÊNG ĐỔ 45°**; biển `conTauSign` đặt ngược mặt vào trong buồm; Con Tàu sai hoàn toàn màu sắc & dáng buồm (thực tế thân nâu cam đất viền xanh da trời, buồm tam giác khoét vòm chân + 4 nẹp ngang trắng nổi). |
| **R29** | **Phú Quốc — Dinh Cậu** | `vietnamSouthBuilder.ts:3853-3908, 4019` | **Ghềnh đá `dcRock` vọt lên `+7.0m` ĐÂM XUYÊN NGẬP NỬA TƯỜNG MIẾU DINH CẬU** (`4.95..7.75m`); võng không có cọc đỡ; xích đu không có dây treo; Hải đăng Dương Đông đội sai chóp nón xanh (thực tế buồng đèn mái bằng + lan can sắt đen). |
| **R30** | **Côn Đảo — Hàng Dương & 914** | `vietnamSouthBuilder.ts:4167-4271` | Thiếu **4 cột Tứ Trụ granite độc lập** & **Tam Quan 3 vòm sơn trắng 2 tầng mái** của Nghĩa trang Hàng Dương; 2 cánh kiến trúc Pháp Cầu Tàu 914 rỗng thông không tường/cửa chớp xanh; 2 tàu neo là 2 khối hộp thô. |
| **R31** | **Chùa Bích Động (Tam Cốc)** | `vietnamReferenceShowBuilder.ts:2890-2902` | **Cầu thang lên Chùa Trung lệch `11m` theo trục X** khỏi Tam Quan; không có vòm hang đá vôi che trùm nóc Chùa Trung; Chùa Trung sai thành cột đỏ + tường đá (thực tế gỗ lim mộc + cửa bức bàn + cột đá Hán tự đỉnh Nghê đa sắc). |
| **R32** | **Hội An Macro & Sông Hoài** | `vietnamReferenceShowBuilder.ts:3040-3047, 3217-3252` | **Mái Chùa Cầu Macro lơ lửng `2.27m` không cột đỡ**; **Cầu gỗ 92m Sông Hoài lơ lửng `2.1m` cả hai đầu không bậc thang/mố cầu**; tháp đèn lồng 7 tầng không phát sáng. |
| **R33** | **Điện Thái Hòa Macro** | `vietnamReferenceShowBuilder.ts:3474-3524` | **Xóa mất dải Cổ Diềm *Nhất Thi Nhất Họa*** do 2 mái dính sát; **Bửu Tán** vẫn là trụ bát giác bị hộp đỏ đâm xuyên; **Cửa Võng** dựng thành 4 bức tường vàng đặc; thiếu cửa bức bàn 9 gian & 2 tường hồi vôi trắng có ô tròn chữ Thọ. |
| **R34** | **Đường Lâm & Đình Mông Phụ** | `vietnamReferenceShowBuilder.ts:3968-4165` | Thiếu texture đá ong lỗ rỗ tổ ong; Cổng Mông Phụ sai thành cổng cung đình 2 tầng rồng vàng (thực tế 1 tầng mái 2 dốc bít đốc dân gian); Nghi Môn sai màu nâu + đặt Nghê cả 4 trụ + thiếu 2 cổng nách; giếng cổ là trụ đặc không khoét nước. |
| **R35** | **Hầm De Castries (Điện Biên Phủ)** | `vietnamReferenceShowBuilder.ts:5511-5523` | **Đáy vòm hầm lơ lửng `+1.6m` trên không**; **tấm bê tông `8.4×1.2×10.4m` (`L5522`) ĐÂM XUYÊN NGANG GIỮA LÒNG HẦM**; không có gân tôn thép lượn sóng; không có bao cát quanh hầm; thiếu dây thép gai & Tượng đài Chiến thắng Điện Biên Phủ. |
| **R36** | **Thủy Chiến Bạch Đằng** | `vietnamReferenceShowBuilder.ts:5749-5761` | Cột buồm thứ 3 trơ 6 thanh tre không có buồm; tấm buồm lệch `Z = +0.35m` cắt chéo cột; thiếu hoàn toàn dây chằng (`rigging`) & mắt thuyền soái hạm. |
| **R37** | **Hẻm Núi Trường Sơn** | `vietnamReferenceShowBuilder.ts:5304-5401` | **4 thác nước đứng lơ lửng giữa khoảng không không có vách đá sau lưng**; **cầu treo 116m hẫng lơ lửng cách 2 vách núi 16m mỗi bên**, không có trụ tháp neo cáp & dốc tiếp cận. |
| **R38** | **Các Đại Quảng Trường Nghệ Thuật** | `vietnamReferenceShowBuilder.ts:3823, 4421, 4599-4616, 4818, 5062, 5210` | **Trống đồng Ø22m lắp ngược đầu đuôi** & nhòe UV thành trụ; **cầu Long Vân dính shader vảy rồng**; **600 hoa sen Đại Liên Hoa đâm xuyên cầu đá vòm**; **khung `truss` Nón Lá Tây Nguyên bay lệch không xoay theo nón**; **Hẻm Đất Nước không có nhân vật điêu khắc trên vách đá**; **`setAtmosphere` bỏ sót 12/16 bia phim Ký Ức 35mm**. |

---

## PHẦN III — DANH SÁCH YÊU CẦU CẢI TIẾN CHI TIẾT TỪNG MỤC MAP VIỆT NAM (35 CỤM DI SẢN / 45 POIs)

### NHÓM A — HÀ NỘI LÕI & MIỀN BẮC (`VietnamHeritageScene.ts` & `vietnamNorthBuilder.ts`)

#### 1. Khuê Văn Các & Quần Thể Văn Miếu (`VietnamHeritageScene.ts:1055-2136`)
- **Ảnh đối chiếu**: `01_khue_van_cac_van_mieu.jpg`, `49_cua_so_mat_troi_khue_van_cac.jpg`, `47_bia_tien_si_rua_da_van_mieu.jpg`, `71_gieng_thien_quang_van_mieu.jpg`.
- **Yêu cầu P0**:
  - Đảo lại cấu trúc **Cửa sổ Mặt Trời** (`L1617-1647`): bỏ `innerRing` tâm, giữ vòng tròn rỗng xuyên sáng 100%, dựng 8–16 tia gỗ tỏa **từ vành tròn ra khung vuông ngoài** bằng gỗ sơn son bạc màu (không dùng vàng kim loại).
  - Đổi toàn bộ mái Khuê Văn Các & Hai Nhà Bia từ `darkRoof` đen sang **ngói ống/mũi hài đỏ cam rêu mốc**; đổi đỉnh bờ nóc/mặt nguyệt/đầu đao 8 góc sang **vữa vôi xám đen đắp nổi**, bổ sung 2 đầu hồi tam giác mái trên.
  - Sửa cắt xuyên `roof1Geo`/`upperDeck`, xóa khối `recess` chết trong `pil`, áp sát `cauDoiBoard` & hoành phi `奎 文 閣` lên sát vách gỗ tầng 2 (`z = 2.18`).
- **Yêu cầu P1**:
  - 4 trụ gạch tầng 1: bỏ `midBand`, tạo **ô hộc lõm chạy suốt thân trụ có phù điêu rồng mây đắp nổi**, thêm dải yếm gỗ chạm dưới ban công, 4 bộ **con sơn/bẩy góc** đỡ mái dưới và **2 bức tường gạch trần cổ** nối 2 bên Khuê Văn Các.
  - **Giếng Thiên Quang**: thay lan can bằng tường vữa xám + trụ đầu chóp 3 cấp + ô **gạch thông gió men xanh hoa chanh** (`hoa_chanh_ceramic`) + hạ mặt nước sâu hơn mặt thành `0.65m` trên kè đá hộc.
  - **Nhà Bia Tiến Sĩ**: đổi kết cấu gỗ sang gỗ lim nâu sẫm (`darkWood`), lát nền gạch Bát Tràng đỏ nhạt, nâng cấp rùa đá mai lục giác đầu rụt sát mai + texture văn bia Hán tự & trán bia rồng chầu nguyệt.
- **Yêu cầu P2**: Bổ sung rui mè dưới mái Nhà Bia, độ dày diềm ngói mũi hài và chậu bonsai ven tường gạch trần.

#### 2. Chùa Một Cột & Hồ Linh Chiểu (`VietnamHeritageScene.ts:2145-2752`)
- **Ảnh đối chiếu**: `02_chua_mot_cot.jpg`, `50_he_vi_keo_chua_mot_cot.jpg`, `45_sen_hong_viet_nam.jpg`.
- **Yêu cầu P0**:
  - Thay 12 nan gỗ xòe tròn bằng **Hệ vì kèo vuông trực giao** (4 cặp thanh chống chéo gỗ lim + cột treo đứng + dầm gánh vuông) và đổi toàn bộ gỗ ngoại thất Liên Hoa Đài sang **gỗ lim mộc nâu đen (`#2c221b`)**.
  - Xây lại **cầu thang 13 bậc**: thay tường gạch đỏ bậc răng cưa bằng **tường vữa xám vát dốc liền mạch chảy rêu đen**, bổ sung 2 trụ búp sen đá ở chiếu nghỉ trên, cổng gỗ 2 cánh chân cầu, mở rộng khe lan can ban công tránh clip (`±1.36`).
  - Đổi lan can Hồ Linh Chiểu sang **tường vữa xám + gạch thông gió men xanh hoa chanh** (đồng bộ Văn Miếu).
- **Yêu cầu P1**:
  - Thêm 2 đầu hồi tam giác mái có mảng gỗ chạm thủng (`cốn mê`), đổi `opcFinials` từ vàng kim sang vữa vôi xám rêu, bỏ `pillarSeam` lồi trên trụ đá.
  - Sửa sinh học đầm sen: **lá sen tròn nguyên không xẻ V** vươn cao trên cuống khỏi mặt nước, tách riêng **đài sen + nhị vàng tươi** khỏi cánh hoa sen gradient trắng→hồng, bổ sung búp sen & bát sen xanh.
- **Yêu cầu P2**: Treo dải tua đèn vải dọc diềm mái gỗ như ảnh `02`.

#### 3. Tháp Rùa, Hồ Hoàn Kiếm, Cầu Thê Húc & Đền Ngọc Sơn (`VietnamHeritageScene.ts:2761-3442`)
- **Ảnh đối chiếu**: `03_thap_rua_ho_hoan_kiem.jpg`, `70_cau_the_huc_den_ngoc_son.jpg`.
- **Yêu cầu P0**:
  - **Tháp Rùa tầng 3–4**: xóa lỗ châu mai răng cưa + sao vàng 5 cánh; dựng đúng **mái ngói ống cong 2 tầng rêu xám + 4 đầu đao rồng đắp mảnh gốm xanh-trắng + bầu hồ lô đỉnh nóc** + huy hiệu tròn Đông & ô bảng chữ nhật cổ lầu.
  - **Cầu Thê Húc**: đổi sang **lan can đan chéo chữ X sơn đỏ son**, mở rộng 15 nhịp, **nghiêng chéo các cặp cột trụ dưới nước `±13°`** tạo dáng chữ A.
  - **Đắc Nguyệt Lâu**: dựng lại tầng 2 là **tường xây mở cửa sổ tròn lớn (`Nguyệt Môn`) + mảng phù điêu rồng/hổ nền xanh ngọc lam + mái chồng diêm 2 tầng bờ cong lớn + biển `得 月 樓`**.
- **Yêu cầu P1**:
  - Tháp Rùa tầng 1–2: vòm giữa rộng `1.35×` 2 vòm bên, thêm cột bổ trụ đứng & ô hộc chìm quanh từng vòm, lan can ô đá sỏi tầng 1 + lan can con tiện vữa xám tầng 2, shader vữa xám nhạt loang vệt rêu đen dọc.
  - Thay vòng 22 tảng đá khổng lồ quanh Gò Rùa bằng bờ cỏ xanh mượt sát nước.
- **Yêu cầu P2**: Thêm **3 con cóc đá** đội nghiên mực hình quả đào trên đỉnh Đài Nghiên (`L3323`).

#### 4. Hoàng Thành Thăng Long — Đoan Môn, Điện Kính Thiên & Cột Cờ Hà Nội (`vietnamNorthBuilder.ts:200-908`)
- **Ảnh đối chiếu**: `06_hoang_thanh_thang_long_doan_mon.jpg`, `39_rong_da_dien_kinh_thien.jpg`, `72_dien_kinh_thien_rong_da.jpg`, `73_cot_co_ha_noi.jpg`.
- **Yêu cầu P0**:
  - **Vọng Lâu Đoan Môn tầng 2–3**: dựng lại thành **tường vôi vàng ochre loang rêu + 3 ô cửa sổ chữ nhật chấn song hoa thị trắng + lan can gạch hoa đục lỗ vàng** ở tầng 2; tầng 3 khối vàng có vòm giữa + 2 ô chữ Thọ + mái chồng diêm cổ diêm nan gỗ ngói nâu trầm.
  - **Tường thành Đoan Môn**: chuyển sang `weatheredImperialBrick` (gạch vồ xám-nâu rêu), bỏ lỗ châu mai răng cưa, thay bằng tường lan can vôi vàng phẳng cắm sen hồng/cờ ngũ sắc.
  - **Cột Cờ Hà Nội**: chuyển 3 tầng đế sang **khối chóp cụt vát nghiêng Vauban** có gờ phào đậm + **lan can gạch hoa đục lỗ**; sửa Vọng Lâu đỉnh thành **khối tường bát giác gạch đặc mở 8 cửa sổ chớp** + vành mái trắng loe rộng.
- **Yêu cầu P1**:
  - **Rồng đá Điện Kính Thiên**: nâng cấp `createCarvedDragonBalustradeParts` (đầu tròn râu xoắn, bờm sóng mây dày cuộn ngược, vách bệ xiên nguyên khối có phù điêu mây/sen); sửa cao độ gờ chân nền Kính Thiên tránh chìm đất.
  - **Cột Cờ Hà Nội**: thay 36 lỗ thông gió bằng **lỗ tròn hoa thị 8 nan** + ô cửa hình quạt chân tháp; đóng kín mặt Bắc tầng 2–3 (chỉ mở 3 cổng Đông–Tây–Nam).
  - **Đoan Môn**: thêm đá xanh xếp răng cưa (*quoining*) chân 5 cổng vòm + khung chữ nhật âm tường quanh mỗi vòm.
- **Yêu cầu P2**: Lát gạch Bát Tràng đỏ sân Long Trì & nền Kính Thiên; bổ sung quai rồng chữ S + nắp song long cho Đỉnh đồng; bỏ 2 đĩa vàng bên cạnh biển Đoan Môn.

#### 5. Vịnh Hạ Long, Hòn Trống Mái, Hòn Đỉnh Hương & Thuyền Buồm (`VietnamHeritageScene.ts:4045-4519` & `North:3306-3397`)
- **Ảnh đối chiếu**: `04_vinh_ha_long_hon_trong_mai.jpg`, `51_hon_dinh_huong_ha_long.jpg`, `68_thuyen_buom_canh_doi_ha_long.jpg`.
- **Yêu cầu P0**:
  - **Thuyền Buồm Cánh Dơi**: dựng thân tàu loft 3D vuốt nhọn mũi & thuôn lái có **chỉ mạn cam-vàng**, **khoang 2 tầng có cửa sổ kính tối + lan can boong thượng**; gân nan tre 3D bám khít độ cong `billow` của cánh buồm quạt xòe nâu cánh gián + dây néo cột buồm (`rigging`).
  - **Hòn Đỉnh Hương**: khối đá vôi nguyên khối phân tầng nghiêng 60° (xám tro sáng + vệt canxit trắng + khe đen) có khe sóng hẹp sát mặt nước, chỉ giữ vài bụi cây còi trên đỉnh. Cân đối lại tỉ lệ Hòn Trống Mái (hẹp khe, thắt chân rõ).
  - **Đảo Ti Tốp**: sửa 10 bậc thang bay lơ lửng thành cầu thang đá liên tục bước `≤ 0.30m` bám sườn núi; xóa khối hộp cát cắt xuyên bãi cát tròn.
- **Yêu cầu P1**: Tăng lớp phủ tán rừng xanh thẫm sần sùi dọc sườn 42 đảo karst + thu nhỏ bán kính bụi cây đảo xa `archType === 0` (`North:3378`) tránh lơ lửng; nâng cấp nhà nổi **Cửa Vạn** sang tường xanh da trời/trắng + mái tôn 2 dốc đỏ/xanh + phao trắng.
- **Yêu cầu P2**: Bổ sung phao cứu sinh, dù trắng boong thượng và cờ đỏ sao vàng trên tàu Hạ Long.

#### 6. Ruộng Bậc Thang Mù Cang Chải & Bản Làng Tây Bắc (`VietnamHeritageScene.ts:4525-4780` & `North:3398-3619`)
- **Ảnh đối chiếu**: `05_ruong_bac_thang_mu_cang_chai.jpg`, `76_ruong_bac_thang_choi_canh.jpg`, `77_nha_san_thai_tay_bac.jpg`.
- **Yêu cầu P0**:
  - Fix **thang chòi canh ngược chữ X** (`đổi dấu rotateZ(+0.48)`); dựng **cột tre chữ A chống đỡ máng dẫn nước 9.5m** của Cọn Nước + tách bánh xe quay động kèm dòng suối nhỏ.
  - **Chòi Canh Ruộng**: đổi mái nón 4 mặt thành **mái cỏ tranh 2 mái hồi dốc xù xì** có texture sợi tranh + vách ván đứng màu gỗ bạc cũ, bỏ chóp `finial`.
  - **4 Nhà Sàn Thái (`North:3547-3571`)**: đổi mái cong đao chùa áp map ngói thành **mái tranh 2 mái dày `~35cm` có tam giác đầu hồi ván gỗ ghép ngang** + texture tranh thật; kê **đá tảng vuông** dưới chân 12 cột sàn; neo chắc chân khung cửi theo `getLocalGround`.
- **Yêu cầu P1**: Tăng độ dày cụm lúa instanced + thêm **bông lúa vàng trĩu hạt** & làm rõ bờ taluy đất giữa bậc ruộng; thêm cửa sổ chớp lá sách + con tiện gỗ & tam cấp chân thang Nhà Sàn Thái; uốn cong đầu `Khau Cút`.
- **Yêu cầu P2**: Điêu khắc hoàn chỉnh đàn trâu nước (đầu, mõm, tai, u vai, đuôi, bám địa hình).

#### 7. Cột Cờ Lũng Cú — Hà Giang (`vietnamNorthBuilder.ts:916-1322`)
- **Ảnh đối chiếu**: `07_cot_co_lung_cu.jpg`, `62_phu_dieu_cot_co_lung_cu.jpg`, `38_trong_dong_ngoc_lu_pattern.jpg`.
- **Yêu cầu P0**:
  - Sửa ngay **lệch trục `22.5°`** để mặt cửa vòm `i = 0` hướng thẳng trục `45°` cầu thang SE; xóa `lcPlaque` đang bay lơ lửng ở `r = 5.35m` và thay bằng **bia đá xanh gắn Quốc huy vàng** đặt ngay chân bậc thang.
  - Dựng đúng chân tháp theo ảnh `62`: **Bệ chóp cụt bát giác vát 45° ốp 8 phù điêu đá xanh** → **Vành đai bát giác màu đỏ gạch (`#7a261f`) ôm chân thân tháp gắn 8 mặt Trống Đồng Đông Sơn** dùng `ctx.cachedTextures?.dongSon` (sao 14 cánh). Bỏ 5 vòng đồng ngang thân tháp.
  - Đổi đài quan sát đỉnh thành **đĩa TRÒN + lan can ống inox trắng**; đổi 8 rãnh thân tháp thành **khe chữ nhật dọc chìm lắp chấn song kỷ hà**.
- **Yêu cầu P1**: Đổi lan can sân Tier 1 từ `lotus_stone` sang **lan can đá xám hiện đại + trụ đèn cầu trắng** dọc bậc thang; sửa `cVoid` lồi ra trước khung gỗ ở 3 nhà trình tường Lô Lô Chải + đắp tường rào đá tai mèo gồ ghề.
- **Yêu cầu P2**: Bổ sung nhà dừng chân mái ngói xám xanh giữa cầu thang SE (`07`).

#### 8. Đỉnh Fansipan — Cột Mốc 3.143m, Đại Tượng Phật & Chùa Kim Sơn Bảo Thắng (`vietnamNorthBuilder.ts:1381-1812`)
- **Ảnh đối chiếu**: `08_dinh_fansipan.jpg`, `08b_fansipan_buddha_pagoda.jpg`, `74_chua_kim_son_bao_thang_fansipan.jpg`, `75_dai_tuong_phat_fansipan.jpg`.
- **Yêu cầu P0**:
  - Sửa **3 biển `Fansipan3143Plaque` bay lơ lửng** (`L1532`): ép sát mặt chóp inox (`r = 0.51m`, nghiêng `0.205 rad`), khắc ngôi sao trong vòng tròn nền thép mờ; bỏ chóp đồng lồi ở đỉnh.
  - **Đại Tượng Phật A Di Đà**: bỏ vòng hào quang vàng sau đầu (`skipHalo: true`), đổi bệ trên thành **bệ BÁT GIÁC đồng đen có 8 ô phù điêu song long thời Trần màu đồng đỏ**, đài sen **3 lớp cánh mập bầu đồng đen-đỏ**, tách 2 sắc đồng (**áo cà sa đồng đen có nếp rủ** vs **mặt/ngực chữ Vạn 卍/tay đồng đỏ ấm**).
  - **Chùa Kim Sơn Bảo Thắng**: đổi toàn bộ sang **kiến trúc gỗ mộc nâu trầm thời Trần + tường bao đá xanh xẻ khối + cổng đá vòm tròn mái đá chồng diêm**, bỏ sơn son đỏ & viền vàng chóe.
- **Yêu cầu P1**: Đổi **Bảo Tháp 11 tầng** sang mặt bằng **lục giác/bát giác đá xanh có chóp búp sen mạ vàng rực rỡ** (`74`); bổ sung **đôi hạc đồng cao ngậm sen** & **4 tượng Hộ Pháp đồng đen** quanh sân bát giác Đại Tượng Phật (`08b`).
- **Yêu cầu P2**: Thêm cờ Phật giáo 5 màu dọc lối đá xanh & dải hoa vàng chân bệ tượng Phật.

#### 9. Chùa Hương — Suối Yến, Cầu Hội, Chùa Thiên Trù & Động Hương Tích (`vietnamNorthBuilder.ts:1818-2563`)
- **Ảnh đối chiếu**: `09_chua_huong_suoi_yen.jpg`, `78_chua_thien_tru_tam_bao.jpg`, `52_dong_huong_tich_chua_huong.jpg`, `107_thuyen_nan_suoi_yen.jpg`.
- **Yêu cầu P0**:
  - **Chùa Thiên Trù**: đổi mái sang **ngói mũi hài đỏ nâu rêu cổ** (`terracottaRoof`), mở **cổ diêm chấn song gỗ dọc nâu sẫm** kèm đại tự `"香天寶刹 — HƯƠNG THIÊN BẢO SÁT"` đặt chính giữa cổ diêm.
  - **Thuyền Suối Yến**: thay `TubeGeometry` đặc bằng **vỏ thuyền rỗng lòng** hết clip ghế/hành khách; bỏ mui tre vòm, dù màu và đèn lồng mũi để khớp thuyền chèo tay tối giản trong ảnh `107`.
  - **Động Hương Tích**: chuyển 5 chữ `"南天第一洞 — NAM THIÊN ĐỆ NHẤT ĐỘNG"` thành **bia khắc chìm trực tiếp lên vách đá xám bên trái tiền sảnh động** (`52`), bỏ biển đồng treo ở `+12.8m`.
- **Yêu cầu P1**:
  - Sân Thiên Trù: thêm **cặp Sư tử vàng nằm trên bệ đỏ viền trắng**, **tháp hương đài sen giữa sân**, mở bậc thềm rộng sân gạch Bát Tràng đỏ (bỏ lan can chắn mặt tiền).
  - Động Hương Tích: nâng **Đụn Gạo** lên `~6.2m` phủ dây leo xanh rậm, kéo bàn thờ gỗ chạm rồng vàng + mâm bưởi/hoa sát chân Đụn Gạo; tăng chồng lấn vòm trần hang (`rz = 7.5m`) bịt kín khe sáng; gỡ 8 tay vàng sau lưng tượng Quan Âm đá xanh.
  - Bổ sung dầm vòm đá đỡ bụng Cầu Hội và khóm lau sậy ven Suối Yến.
- **Yêu cầu P2**: Bổ sung Tả Vu / Hữu Vu thấp bên sân Thiên Trù & diễn hoạt mái chèo tay trên thuyền.

#### 10. Đền Hùng — Núi Nghĩa Lĩnh (`vietnamNorthBuilder.ts:2570-3298`)
- **Ảnh đối chiếu**: `10_den_hung_nghia_linh.jpg`, `65_cong_nghi_mon_den_hung.jpg`, `79_den_thuong_den_hung.jpg`.
- **Yêu cầu P0**:
  - **Hùng Vương Lăng (`L3176-3276`)**: dựng lại hoàn toàn theo ảnh `10` — **khối lăng vuông trát vữa trắng-xám cổ**, 4 mặt mở **cửa vòm tròn có phù điêu Hổ Phù**, 4 trụ góc câu đối chữ Hán đen-trắng, ô `"雄王陵"`, **2 tầng mái chồng diêm có 4 con rồng vữa trắng-xám uốn dọc 4 bờ chảy**, bao quanh bởi **lan can đá xanh đục lỗ bát giác hoa 4 cánh** + lư hương đá vuông.
  - **Cổng Nghi Môn Đền Thượng (`L2897-2974`)**: dựng lại theo ảnh `79` — **cổng vữa/đá xám cổ 3 cửa vòm + 4 trụ biểu vuông câu đối**, hai bên vòm chính đắp **2 phù điêu Võ Sĩ/Hộ Pháp đa sắc**, đại tự `"南越肇祖"` + rồng vàng và **Lưỡng Long Chầu Nguyệt vữa xám** trên đỉnh.
- **Yêu cầu P1**:
  - Sửa **Z-fighting cầu thang Đền Hùng**: hạ gờ đá ong xuống ngang mặt bậc đỡ dưới chân rồng đá và dùng vật liệu `lateriteHoneycomb` nâu tổ ong (thay `chamBrick` đỏ).
  - Đổi gỗ & mái Đền Thượng / Trung / Giếng sang **gỗ lim nâu trầm + ngói mũi hài rêu cổ** (`65`), bổ sung đèn đá xanh sân đền và tạo dáng đá tự nhiên cho **Cột Đá Thề**.
- **Yêu cầu P2**: Thêm cây vạn tuế, chậu cảnh đá và cờ hội dọc bậc đá hành hương.

---

### NHÓM B — MIỀN TRUNG & TÂY NGUYÊN (`VietnamHeritageScene.ts` & `vietnamCentralBuilder.ts`)

#### 11. Cầu Vàng & Bàn Tay Khổng Lồ — Bà Nà (`VietnamHeritageScene.ts:3451-4038`)
- **Ảnh đối chiếu**: `16_cau_vang_ba_na.jpg`, `48_ban_tay_cau_vang_detail.jpg`, `85_cau_vang_loi_di_hoa.jpg`.
- **Yêu cầu P0**:
  - Fix **clipping 4 ngón tay & ngón cái** (đẩy ra ngoài biên cầu `|z| ≥ deckHalfW + r + 0.12`, vươn cao uy nghi `6.5–8.5m` trên sàn cầu).
  - Đại tu giải phẫu **Bàn Tay Khổng Lồ**: xóa 2 vòng `cuff` torus & 3 thanh hộp `crease`; dựng ngón tay & lòng bàn tay bằng **loft/spline mesh thuôn mượt có rãnh móng chạm chìm**, chuyển vật liệu sang **đá xám trắng sáng (`#cfd2ce`) + shader vết nứt đen & mảng rêu xanh-đen tương phản sắc nét**.
  - Sửa thân cầu thành **mặt cắt lòng máng bán nguyệt cong mượt** màu **vàng champagne đồng mờ (`#c9a452`, roughness `0.36`)**; đổi lan can cáp ngang sang **thanh đứng dày đặc + khung tay vịn ống kép có giằng chéo**.
- **Yêu cầu P1**: Đổi 8 trụ đỡ thành **cột thép ống xanh rêu đậm (`#1f4d2e`) có bích nối + chùm thanh chống chữ V/Y mạ vàng**; tách rạch ròi mố cầu Tây khỏi nền Ga Marseille.
- **Yêu cầu P2**: Mịn hóa dải hoa Lobelia tím đa sắc & thêm đường lát đá vân lượn sóng đen-trắng dưới chân bàn tay (`16`, `85`).

#### 12. Cố Đô Huế — Ngọ Môn, Lầu Ngũ Phụng, Cầu Trung Đạo, Kỳ Đài & Cửu Đỉnh (`vietnamCentralBuilder.ts:395-1134`)
- **Ảnh đối chiếu**: `17_ngo_mon_hue.jpg`, `40_mai_dao_long_phuong_hue.jpg`, `82_ngo_mon_lau_ngu_phung.jpg`, `54_cuu_dinh_dai_noi_hue.jpg`, `83_cuu_dinh_phu_dieu.jpg`.
- **Yêu cầu P0**:
  - Đài thành chữ U Ngọ Môn: thêm **độ vát tường thành (~8°)**, đổi 2 cánh chữ U sang `weatheredImperialBrick` (gạch vồ rêu đen) giữ đá Thanh ghép khối cho 3 cửa giữa; **dời 2 cửa vòm Tả/Hữu Dịch Môn vào mặt hông trong 2 cánh chữ U (vuông góc 90° Chính Môn)** & cắt vòm cánh cửa gỗ không đâm xuyên khung; bỏ lỗ châu mai `merlons` sai thực tế.
  - Sửa **clipping mái Lầu Ngũ Phụng** (`2.1m`) & nối liền mái tầng 1 chữ U; chia rõ **9 bộ mái tách bậc** (trung tâm Hoàng Lưu Ly, 8 mái cánh Thanh Lưu Ly có normal map sóng ngói).
  - Thu gọn biển `NGỌ MÔN — 午門` lọt vào dải lan can trên Chính Môn; sửa bug **tường gạch tầng 1 Kỳ Đài bị chôn 100% trong `stoneParts`** & làm tường 3 tầng Kỳ Đài vát nghiêng Vauban.
- **Yêu cầu P1**:
  - Thêm **2 ô thông gió tròn đục chữ Thọ khung trắng** giữa mặt tiền 2 cánh chữ U; thêm **dải cổ diêm pháp lam *Nhất Thi Nhất Họa*** & mở thoáng cửa bức bàn/lá sách tầng 1 Lầu Ngũ Phụng.
  - Nâng cấp lan can đài Ngọ Môn & Cầu Trung Đạo: khung đá xám trắng + gạch thông phong men xanh/vàng đất + tay vịn ngói ống vàng; làm vòm Cầu Trung Đạo mượt & kè hồ đá hộc.
  - **Cửu Đỉnh**: dùng `bronzePatina` (đồng đen loang xanh ngọc), 3 chân quỳ cong `TubeGeometry`, 3 tầng phù điêu nổi (normal/relief) trên bụng đỉnh, đặt trên nền gạch Bát Tràng đỏ.
- **Yêu cầu P2**: Thêm dải **ngói ống câu đầu tròn** diềm mái & vật liệu **khảm sành sứ đa sắc** (cô-ban, hổ phách, đỏ gạch, trắng) cho rồng/phụng bờ nóc (`40`).

#### 13. Phố Cổ Hội An & Chùa Cầu (`vietnamCentralBuilder.ts:1144-1778`)
- **Ảnh đối chiếu**: `19_chua_cau_hoi_an.jpg`, `20_pho_co_hoi_an_den_long.jpg`, `44_den_long_hoi_an_detail.jpg`, `55_mat_cua_hoi_an.jpg`, `56_tuong_khi_cho_chua_cau_hoi_an.jpg`, `84_pho_hoi_an_mat_tien.jpg`.
- **Yêu cầu P0**:
  - **Chùa Cầu (`19`)**: dựng đủ **1 khoang giữa chữ nhật phẳng + 4 khoang vòm bán nguyệt 2 bên**, **dầm vòng cung sơn vữa trắng**, **2 mảng tường cánh sơn đỏ son 2 đầu cầu**; đổi cột/lan can sang gỗ lim nâu đen (`darkWood`); đổi mái sang **ngói âm dương nâu đỏ có sọc vữa trắng** chia 3 khoang giật cấp + bờ nóc gốm xanh trắng.
  - Fix **biển `LAI VIỄN KIỀU` đâm xuyên mái**, **Mắt cửa bay lơ lửng** ở 6 nhà `hasOpenShop` (thêm xà gỗ đỡ), và **Z-fighting tường hồi** giữa 16 nhà ống.
  - Đổi mái 16 nhà cổ từ mái cong 4 góc sang **mái 2 dốc thẳng (`gable roof`)**; sửa **cửa bàn khoa** thành ván gỗ ghép NGANG kín khít có cửa đôi mở giữa (`55`, `84`).
- **Yêu cầu P1**:
  - Nội thất **Miếu Bắc Đế Trấn Võ (`56`)**: thêm tượng Bắc Đế, khám thờ gỗ chạm, đỉnh đồng, **cặp hạc chầu quy** (`createBronzeCraneOnTortoiseParts`), bát hương chữ nhật & liễn đối; đưa cặp tượng Chó/Khỉ vào bệ thờ trong 2 gian đầu cầu & tách rõ tạo hình.
  - Áp `agedPlaster` đa sắc độ (3–4 tông vàng nghệ/kem/vôi loang vệt mưa & rêu) cho 16 nhà cổ; thêm **dải vải lụa đỏ buông rủ** dưới Mắt cửa Hội An (`55`).
  - **Đèn lồng (`44`)**: sửa shader vẽ **nan tre DỌC theo UV.x** (bỏ sọc ngang world Y), tạo 4 dáng đèn (`tròn bí`, `tỏi`, `kim cương`, `ống`), gắn đủ cổ gỗ + **tua rua đỏ/vàng riêng vật liệu** cho mọi đèn.
- **Yêu cầu P2**: Thêm rêu xanh trên mái hiên nhà cổ, chỉ trắng quanh cửa sổ lá sách tầng 2 & bờ cong yên ngựa trên đỉnh tường hồi (`84`).

#### 14. Cầu Rồng — Đà Nẵng (`vietnamCentralBuilder.ts:1785-2096`)
- **Ảnh đối chiếu**: `21_cau_rong_da_nang.jpg`, `57_dau_rong_cau_rong_da_nang.jpg`.
- **Yêu cầu P0**:
  - Bỏ `zWeave` (giữ thân rồng chạy thẳng tim cầu `z = cz`); uốn sóng `y(t)` **xuyên xuống dưới mặt cầu để bụng rồng ôm gọn vào các trụ cầu bê tông** (`21`).
  - Dựng lại **giàn không gian 5 ống thép đường kính bằng nhau** + bản kẹp xoay đúng theo vector tiếp tuyến + **giằng chéo không gian (`addStrut`)**; xóa thanh chéo vàng sai góc (`L1939`), thay bằng cáp treo đứng màu bạc song song.
  - Thiết kế lại **Đầu Rồng thời Lý bằng `ExtrudeGeometry` thép tấm CNC xếp lớp** (`57`): mặt nạ hàm răng cưa có **hàng lỗ tròn đục xuyên (`shape.holes`)**, sống mũi chữ S, **5–7 dải bờm lửa vuốt nhọn**, mào cuộn dấu hỏi lớn & ổ mắt tròn nổi chứa **mắt trái tim LED**.
- **Yêu cầu P1**: Đổi 7 trụ cầu sang **trụ bê tông bản rộng bo tròn 2 đầu**, thêm cột đèn cong sơn trắng & khe co giãn mặt cầu; làm lại **đuôi búp sen thép tấm**; nâng cấp **Cá Chép Hóa Rồng** (đầu rồng, vảy, vây, đài sen, tia nước) & **Cầu Tình Yêu** (chùm 5 đèn trái tim đỏ + lan can treo khóa).
- **Yêu cầu P2**: Đổi kỳ lưng sang vây thép tam giác vát cạnh & bổ sung LED đổi màu động dọc thân rồng.

#### 15. Hang Sơn Đoòng — Quảng Bình (`vietnamCentralBuilder.ts:2103-2526`)
- **Ảnh đối chiếu**: `22_hang_son_doong.jpg`, `58_hang_son_doong_hand_of_dog_doline.jpg`.
- **Yêu cầu P0**:
  - Thay 88 cục đá vòm hở khe bằng **vỏ hang động liền mạch (`DoubleSide` sculpted shell)** nối kín **ống vách giếng trời Doline dựng đứng phân tầng** phủ dây leo rủ miệng hố.
  - Fix **mái bếp bay lơ lửng** (thêm 4 cột khung + dây néo); đổi **mặt nước Gour Pools** sang vật liệu nước xanh trong; tách **thang leo Bức Tường Việt Nam** bám mặt ngoài dốc không chôn trong đá.
  - Thay khối hộp phẳng `46×52×4.4m` của **Bức Tường Việt Nam** bằng **các tầng flowstone calcite chảy giật cấp** màu kem-vàng đất ẩm bóng (`roughness ~0.35`).
- **Yêu cầu P1**:
  - Phân hóa 3 chất liệu địa chất: đá vôi tối sâu (`#2c2e32`), đá phủ **thảm rêu xanh sáng rực** quanh vùng nắng hố sụt (`22`), và **calcite vàng mật ong có gân chảy tầng** cho Hand of Dog, 5 trụ nhũ & bờ hồ gour pools uốn lượn tự nhiên.
  - Nâng cấp **Vườn Địa Đàng (`58`)**: cây thân mảnh cao vút, cụm **chuối rừng lá bản to** và đá vôi vỡ rải nền tối.
- **Yêu cầu P2**: Thay nhũ trần đơn bằng chùm rèm nhũ nhiều tầng sắc nét viền miệng hố sụt; uốn cong tự nhiên sông Rào Thương + đèn pin trại thám hiểm.

#### 16. Động Phong Nha — Kẻ Bàng (`vietnamCentralBuilder.ts:2533-2697`)
- **Ảnh đối chiếu**: `23_dong_phong_nha.jpg`, `92_phong_nha_thuyen_dong.jpg`.
- **Yêu cầu P0**:
  - Dựng lại **mặt tiền vách đá vôi Phong Nha** chuẩn ảnh `23`: vách đá phẳng gãy góc cạnh màu **xám trắng pha vệt khoáng vàng đất**, mở **miệng hang thấp dốc xéo bất đối xứng** sát mặt sông Son (thay vòm bán nguyệt cao 25m).
  - Fix **clipping sàn gỗ Hang Bi Ký** (đâm xuyên 6.7m vào vách trái) và dời **20 nhũ bờ** vào đúng lòng hang lộ thiên.
  - Thiết kế lại **3 Thuyền Du Lịch Động Phong Nha (`23`, `92`)**: vỏ thuyền gỗ thon nhọn vểnh cong 2 đầu, **hoa văn rồng vàng–đỏ–xanh sơn dọc mạn**, khung gỗ mui bạt xanh hở 2 bên thấy ghế, phao cứu sinh & mái chèo tay.
- **Yêu cầu P1**: Đổi nhũ hang sang vật liệu **calcite vàng hổ phách bóng ẩm** dạng rèm nhũ đa tầng; thêm hốc bào mòn tổ ong (`karst dissolution pockets`) & rêu xanh nhạt vùng cửa hang (`92`); thêm bãi cát + lan can Hang Bi Ký & cho 1–2 thuyền chèo chậm vào/ra hang.
- **Yêu cầu P2**: Thêm điểm nhấn bia chữ Chăm cổ & ánh sáng phản chiếu ngược sáng từ cửa động.

#### 17. Thánh Địa Mỹ Sơn — Quảng Nam (`vietnamCentralBuilder.ts:2704-2898`)
- **Ảnh đối chiếu**: `24_thanh_dia_my_son.jpg`, `86_my_son_thap_cham_chi_tiet.jpg`, `86b_my_son_cua_gia_gach.jpg`.
- **Yêu cầu P0**:
  - Thay `chamBrick` (ngói ống) bằng **`chamRubbedBrick`** với mảng gạch phục chế cam nhạt xen gạch cổ đen sạm rêu mốc (`24`, `86b`).
  - Dựng lại **Tháp Kho Kosa B5 (`L2770-2773`)** đúng ảnh `24_thanh_dia_my_son.jpg`: **5 trụ ốp tường khía rãnh dọc** mỗi mặt, bệ giật cấp & phào 6–7 bậc, **khung cửa đá sa thạch chữ U xám sáng** lồng trong **vòm gạch giật bậc corbel + bậc thang gạch**, **4 tháp góc lớn** và **mái vòm hình thuyền yên ngựa cong vút 2 đầu hồi gạch** (bỏ mái cong 4 góc đình chùa).
  - Nâng cấp `createChamTowerGeometry` cho 3 tháp A1/B/C: trụ ốp khía 3 rãnh sâu, cửa giả nhiều tầng, vòm cổng đá sa thạch nguyên khối (`86b`).
- **Yêu cầu P1**: Bổ sung **1 tháp phụ phế tích sụp nửa thân** lộ lõi gạch cổ, **cây dương xỉ & địa y trắng** bám trực tiếp trên gờ ngang gạch (`86b`), và nâng cấp phù điêu Kala-Makara / tượng Dvarapala rõ khối sa thạch phong hóa.
- **Yêu cầu P2**: Mở tầm nhìn xuyên trục Đông–Tây qua các khung cửa đá sa thạch từ Gopura → Mandapa → Tiền Sảnh A1 (`86b`) và thêm phế tích bia Phạn ngữ ven sân.

#### 18. Tháp Chàm Poshanư — Phan Thiết (`vietnamCentralBuilder.ts:2904-3019`)
- **Ảnh đối chiếu**: `25_thap_cham_poshanu.jpg`, `87_thap_poshanu_chi_tiet.jpg`.
- **Yêu cầu P0**:
  - Thay `chamBrick` (ngói ống) bằng **`chamRubbedBrick`**, tạo tương phản rõ giữa **gạch mài cam mịn ở khung trụ/cổng** và **mảng lõi gạch cổ sần sùi bị gió biển bào mòn đen sạm** trong các ô hộc & chóp tháp (`25`, `87`).
  - Sửa **cổng Tiền Sảnh Tháp A (`L2949-2955`) & cửa giả** sang đúng **vòm gạch giật bậc hình tam giác corbel (`stepped corbel arch`)** + **3 bậc tam cấp gạch** + **3 tầng gờ phào ngang bọc kín tiền sảnh** đúng cận cảnh `87_thap_poshanu_chi_tiet.jpg`.
- **Yêu cầu P1**: Tăng số băng phào ngang giật cấp trên mỗi tầng mái (5–6 gờ/tầng như ảnh `25`), thêm cỏ dại/bụi cây nhỏ mọc từ khe gạch đỉnh tháp và thay tán hoa sứ hình cục đá bằng cành khẳng khiu tán hoa sứ/phượng vĩ đỏ cam (`25`).
- **Yêu cầu P2**: Bổ sung sân lát tấm đá/gạch phẳng viền cỏ dại ven đồi Bà Nài & bộ trống Paranưng / kèn Saranai lễ hội Katê.

#### 19. Đà Lạt — Đỉnh Langbiang & Thung Lũng Tình Yêu (`vietnamCentralBuilder.ts:3026-3249`)
- **Ảnh đối chiếu**: `26_da_lat_langbiang.jpg`, `88_thung_lung_tinh_yeu_langbiang.jpg`.
- **Yêu cầu P0**:
  - Bổ sung biểu tượng kinh điển của ảnh `26` & `88`: **Hàng chữ cắt nổi 3D màu trắng khổng lồ `"LANGBIANG"`** cắm trực tiếp trên triền cỏ — trong đó **2 chữ `A` vút nhọn hình đỉnh núi** và **dấu chấm chữ `I` là bông hoa mai anh đào 5 cánh màu hồng**, kèm **bia Di tích Quốc gia trên bệ đá chẻ hình thang** ngay bên phải!
  - Điêu khắc lại **Tượng đôi tình nhân K'Lang & H'Biang (`L3103-3106`)** (thay 2 ống trụ + 2 quả cầu bằng tạo hình 2 nhân vật ôm nhau có nếp áo thổ cẩm, cánh tay & gương mặt).
- **Yêu cầu P1**:
  - Nâng cấp **2 Xe Jeep Langbiang (`88`)** theo đúng dáng **UAZ-469 xanh ngọc lam đậm**, thêm **cản ống thép đen bảo vệ đèn pha trước**, kính chắn gió khung thép, **mui bạt mềm màu đen**, lốp gai dày & decal chữ trắng `"LANG BIANG"` + logo xanh Dalat Tourist bên hông.
  - Bổ sung **1 ngôi biệt thự gỗ kiểu Pháp cổ** mái ngói ống khói đá bên góc hồ Đa Thiện; nâng cấp **thiên nga đạp vịt** (thêm đầu, mỏ cam, cánh cong, ghế ngồi) & mềm hóa tán Thông Ba Lá/Mai Anh Đào (bỏ cảm giác cục đá `createSculptedRockGeometry`).
- **Yêu cầu P2**: Hàng thông kiểng chóp nhọn dọc triền cỏ dưới dòng chữ `LANGBIANG` & cụm hoa dã quỳ vàng ven đường đất đỏ (`26`, `88`).

#### 20. Biển Hồ T'Nưng — Pleiku & Làng Nhà Rông Tây Nguyên (`vietnamCentralBuilder.ts:3256-3581`)
- **Ảnh đối chiếu**: `27_bien_ho_tnung.jpg`, `42_tho_cam_tay_nguyen.jpg`, `43_nha_rong_tay_nguyen.jpg`, `89_nha_rong_kon_tum.jpg`, `90_tuong_nha_mo_tay_nguyen.jpg`, `91_cong_chieng_tay_nguyen.jpg`.
- **Yêu cầu P0**:
  - **Nhà Rông (`43`, `89`)**: thay vách hộp gỗ đặc bằng **vách phên tre nứa đan xương cá nửa dưới + lưới ô quả trám thoáng nửa trên**; nâng cấp mái lưỡi rìu có **vật liệu 2 lớp (`2/3 trên là phên nứa đan mắt cáo chia múi dọc kẹp nẹp tre` + `1/3 váy mái dưới là cỏ tranh xù dày`)** + **5 chùm sừng tre đứng dọc sống nóc** + nẹp tre chạy dọc 2 mép hồi.
  - **Nhà Mồ Tây Nguyên (`L3446-3465` vs `90_tuong_nha_mo_tay_nguyen.jpg`)**: đổi mái cong đình chùa thành **mái chữ A dốc lợp ván/phên sẫm màu** có **diềm bờ nóc chạm thủng sóng nước & mặt trời + 2 đầu sừng cong**; dựng **hàng rào cọc gỗ vót nhọn khép kín bao quanh**; thay 8 trụ-cầu bằng **tượng nhà mồ tạc khối lập thể góc cạnh** (người ôm mặt khóc, cặp đôi, vật tổ răng cưa).
- **Yêu cầu P1**:
  - Nâng cấp **giá Cồng Chiêng (`91`)** bằng khung ống tre nâu buộc lạt + gân vành sâu cho bộ cồng chiêng; nâng cấp **cầu thang độc mộc** thành 2 thân gỗ đẽo bậc nguyên khối gắn bầu sữa mẹ/trăng khuyết liền thân; nâng cấp **Thuyền Độc Mộc** Biển Hồ rỗng lòng mũi nhọn (thay 1 trụ đặc).
  - Thêm **con đường đá kè bê tông + hàng thông cổ thụ + lan can trắng** ven sườn dốc xuống Biển Hồ (`27_bien_ho_tnung.jpg`).
- **Yêu cầu P2**: Bổ sung 2 nhà sàn dài phụ của buôn làng, họa tiết thổ cẩm dệt nổi & tua rủ bông tre cạo mỏng trên Cây Nêu.

---

### NHÓM C — MIỀN NAM & HẢI ĐẢO (`vietnamSouthBuilder.ts`)

#### 21. Chợ Bến Thành — TP. Hồ Chí Minh (`vietnamSouthBuilder.ts:332-769`)
- **Ảnh đối chiếu**: `28_cho_ben_thanh.jpg`, `59_phu_dieu_gom_cho_ben_thanh.jpg`, `93_cho_ben_thanh_ben_trong.jpg`.
- **Yêu cầu P0**:
  - Căn lại trục `Z` giữa `centerPortico` & thân Tháp Đồng Hồ (triệt tiêu lỗi tháp treo lơ lửng `2.7m` & `northEave` cắt xuyên chân tháp).
  - Sửa **Tháp Đồng Hồ** đúng ảnh `28`/`59`: **1 tầng mái ngói 4 dốc xòe rộng duy nhất có con sơn đỡ diềm + băng thông gió áp mái + đỉnh thu lôi thanh mảnh**, bỏ tầng mái thừa & lan can đá `lotus_stone`, bỏ cửa chớp dưới đồng hồ.
  - Dựng **chữ cắt nổi 3D màu xanh đen `"CHỢ BẾN THÀNH"`** đứng tự do trên đỉnh tường chắn mái cổng chính; tách vẽ riêng **4 bộ phù điêu gốm Biên Hòa** chuẩn chủ đề (Nam: Bò & Vịt khung dọc + 2 ô nhỏ cánh bên; Đông: Lúa/Cà phê; Tây: Sen/Cá; Bắc: Chuối/Cá đuối).
- **Yêu cầu P1**: Nâng cấp mặt đồng hồ (**vành xanh dương nhạt + nền trắng + số Ả Rập + khung gờ trắng vát góc**); thêm 3 ô song gió hoa văn sóng nước trên cổng chính & chỉnh màu tường sang vàng kem nhạt (`#efe0b4`); đổi nội thất (`93`) sang **khung vòm bê tông vàng uốn cong + khe giếng trời nóc mái** + sàn gạch vuông nâu be `0.5m`.
- **Yêu cầu P2**: Gỡ mái che xanh khỏi mặt tiền Cửa Nam, thêm bảng hiệu sạp chữ đỏ/trắng (*TRẦN MỸ, THÀNH LỢI*), tủ kính & quạt treo tường.

#### 22. Dinh Độc Lập — TP. Hồ Chí Minh (`vietnamSouthBuilder.ts:776-1248`)
- **Ảnh đối chiếu**: `29_dinh_doc_lap.jpg`, `60_rem_dot_truc_dinh_doc_lap.jpg`, `94_dinh_doc_lap_xe_tang.jpg`, `95_dinh_doc_lap_truc_thang.jpg`.
- **Yêu cầu P0**:
  - Tạo lại **Rèm Hoa Đá *Đốt Trúc*** (`60`) đúng biên dạng **đồng hồ cát thắt eo 3 tầng** tạo hàng lỗ mắt cáo hình thoi cong, **xóa 3 tầng thanh ngang cắt khe** và chia nhịp bằng trụ bê tông đứng.
  - Di dời **Trực thăng UH-1 Huey + 2 vòng tròn bom ĐƠN có chữ đỏ** xuống đúng **sân thượng cánh chữ T phía sau (`y ≈ 22.15m`)**, xóa vòng chữ `"H"` vàng sai thực tế; sơn rằn ri 3 màu + số `445`/`45` + vạch trắng đầu cánh quạt (`95`).
  - Gắn lá cờ đỏ sao vàng tung bay lên **cột cờ trục giữa** trên mái *Tứ Phương Vô Sự* (`29`).
- **Yêu cầu P1**:
  - Ốp **đá chẻ nâu xám đậm** cho tầng trệt + thêm **tường kè vát đá hộc đa giác** hai bên đường xe lên sảnh (`29`); đổi 2 cánh ngoài mặt tiền thành tường kem đặc có lưới 3×2 cửa sổ tối & ô phù điêu spandrel.
  - Nâng cấp **Xe tăng #843 & #390 (`94`)**: sơn số trắng lớn bên hông tháp pháo, **viền trắng 5 bánh chịu lực**, súng máy nóc, ăng-ten, biển thuyết minh nền xanh dương & dây xích đỏ-vàng.
- **Yêu cầu P2**: Thay chậu cây mái thành **hàng cau cảnh thân mảnh trong chậu tròn**, thêm hàng rào cây xanh cắt tỉa trước hồ phun nước.

#### 23. Nhà Thờ Đức Bà — Sài Gòn (`vietnamSouthBuilder.ts:1255-1692`)
- **Ảnh đối chiếu**: `30_nha_tho_duc_ba_saigon.jpg`, `61_nha_tho_duc_ba_rose_window_statue.jpg`, `96_nha_tho_duc_ba_cua_chinh.jpg`.
- **Yêu cầu P0**:
  - Đổi tường gạch sang **`marseilleBrick`** (chấm dứt texture ngói ống); tách kính màu & đèn Paris khỏi `lanternSilk` sang vật liệu tĩnh không lắc theo gió.
  - Sửa bố cục mặt đứng giữa chuẩn ảnh `96`: **xóa `centerGableTri` đang đâm xuyên**, **đưa Đồng hồ tròn lên đỉnh hồi tam giác (`y ≈ 25.5m`)**, thêm **bộ 3 cửa sổ vòm hẹp Romanesque** ngay dưới Cửa sổ Hoa Hồng, dựng đúng Hoa Hồng **1 bông tâm + 8 ô tròn vệ tinh**.
  - Đổi màu 2 chóp tháp nhọn sang **tôn kẽm/slate XÁM BẠC NHẠT (`#b5bac0`)**, hạ và phóng lớn 4 cửa sổ mái nhọn `lucarnes` về sát chân chóp tháp, bỏ vòng sắt tròn & 4 chóp góc thừa.
- **Yêu cầu P1**: Xây đủ **4 tầng cho 2 tháp chuông** (tầng 3 cặp cửa vòm + ô tròn *oculus* lồng trong vòm đá kem lớn, tầng 4 lá sách tối dày đặc); đổi bệ tượng Đức Mẹ Hòa Bình thành **cột TRÒN granite đỏ nâu đánh bóng** + vòng phù điêu đồng xanh + biển đồng cong (`61`), gỡ vòng hào quang vàng thừa sau đầu tượng.
- **Yêu cầu P2**: Thêm cột đôi đá kem, cửa sắt rèn trong 3 cổng vòm chính & chỉ phào răng cưa chạy ngang mặt tiền.

#### 24. Địa Đạo Củ Chi & Đền Tưởng Niệm Bến Dược (`vietnamSouthBuilder.ts:1700-2163`)
- **Ảnh đối chiếu**: `31_dia_dao_cu_chi.jpg`, `67_ham_bi_mat_cu_chi_detail.jpg`, `97_den_ben_duoc_cu_chi.jpg`.
- **Yêu cầu P0**:
  - Dựng lại hoàn toàn **Tháp Bến Dược 9 tầng (`97`)**: khối nhà đế 2 tầng vuông kem + **thân tháp VUÔNG KHÔNG THU NHỎ với 4 cột góc lớn nâu vàng chạy suốt** + 7 tầng ban công bê tông trắng vát góc lợp diềm ngói đỏ viền men xanh + 2 tầng mái vuông có mảng tam giác khảm hoa sen xanh nhạt + **cặp trụ biểu rồng cuốn đa sắc** hai bên cổng.
  - Sửa lỗi thứ tự xoay/dịch **3 nắp hầm bí mật (`L1756-1768`)** để hết lệch khung; hạ miệng hầm phẳng bằng mặt đất (`0.45m × 0.45m`), bỏ gò đất cao và đặt nắp phủ lá khô nằm cạnh lỗ (`67`).
- **Yêu cầu P1**: Bổ sung **bảng gỗ chào kinh điển *"Kính chào quý khách! / WELCOME TO THE CU CHI TUNNELS!"*** (`31`) ở bìa rừng.
- **Yêu cầu P2**: Tách tạo hình tháp pháo hàn góc cạnh bị cháy hỏng cho xác xe tăng M41 (không dùng chung T-54B); mở vòm hầm tối ăn sâu vào đất trong hầm chỉ huy.

#### 25. Tháp Bà Ponagar — Nha Trang (`vietnamSouthBuilder.ts:2171-2543`)
- **Ảnh đối chiếu**: `32_thap_ba_ponagar.jpg`, `66_tuong_cham_ponagar_linga_yoni.jpg`, `98_ponagar_mandapa_cot.jpg`.
- **Yêu cầu P0**:
  - Đổi toàn bộ 4 tháp & 22 cột Mandapa sang **`chamRubbedBrick`** (bỏ texture ngói ống).
  - Nâng cấp **22 cột bát giác Mandapa (`98`)**: tăng tiết diện bề thế (`r ≈ 0.68m` hàng trong), bổ sung chân đế gạch giật cấp, **đầu cột bát giác loe giật 3 cấp** và **lỗ mộng vuông khoét sâu trên thân trên cột** + tảng đá khắc chữ `"THÁP BÀ PONAGAR — Nha Trang"`.
- **Yêu cầu P1**: Thay 12 lát trụ răng cưa của **Tháp thứ 4 mái hình thuyền (`32`)** bằng **lưới mái thuyền cong mượt**, thêm 2 tháp góc nhỏ, cổng lá đề gạch 3 lớp, dãy cánh sen chân mái & bỏ 2 chóp vàng; chỉnh **phù điêu Durga (`66`)** sang đá sa thạch xám rêu có dáng chân co chữ ngũ múa trên đầu trâu.
- **Yêu cầu P2**: Đẩy tượng Po Nagar lùi sâu vào điện thờ & tăng độ sâu rãnh cột ốp trên thân tháp.

#### 26. Chợ Nổi Cái Răng — Cần Thơ (`vietnamSouthBuilder.ts:2551-3030`)
- **Ảnh đối chiếu**: `33_cho_noi_cai_rang.jpg`, `64_ghe_bau_cay_beo_cai_rang.jpg`, `99_cai_rang_cay_beo.jpg`.
- **Yêu cầu P1**:
  - Sửa cấu tạo **Cây Bẹo (`64`)**: bỏ thanh ngang chữ T ở đỉnh, buộc nông sản so le **dọc theo thân sào tre đứng**.
  - Thêm biến thể **ghe bầu mui bạt đen căng phẳng khung ống sắt** chất đầy ụ dưa hấu sọc xanh/khóm (`99`) + **lốp ô tô lớn cột bọc ngay mũi ghe** (`64`).
  - Thả thêm **6–8 xuồng bán lẻ** (hủ tiếu, cà phê, dứa, nước ngọt) len lỏi giữa 28 ghe lớn (`33`).
- **Yêu cầu P2**: Nâng cấp **mắt thuyền hình hạnh nhân đa sắc** + biển số `CT-xxxx` rõ chữ; tăng mật độ & độ ngẫu nhiên dãy nhà sàn mái tôn ven bờ.

#### 27. Rừng Tràm Trà Sư — An Giang (`vietnamSouthBuilder.ts:3032-3514`)
- **Ảnh đối chiếu**: `34_rung_tram_tra_su.jpg`, `100_tra_su_cau_tre_rung_tram.jpg`.
- **Yêu cầu P0**: Neo **20 tổ cò & đàn cò trắng** chính xác lên tọa độ `(wx, wz, crownY)` thực của 300 cây tràm (chấm dứt tổ chim bay lơ lửng giữa trời).
- **Yêu cầu P1**: Tạo 2–3 dáng **thân tràm cong phân nhánh** với **gốc ngập rêu sẫm chuyển lên vỏ tràm trắng xám bong tróc** (thay trụ thẳng dùng map vữa tường); nâng sắc độ thảm bèo cám sang **xanh cốm tươi sáng** (`#74b838`–`#a6d654`) & thu gọn/làm mềm rãnh xuồng (`100`).
- **Yêu cầu P2**: Thêm vân nan tre ngang & khớp buộc cho mặt sàn cầu tre; bổ sung thanh giằng chéo chữ X cho đài quan sát 23m.

#### 28. Mũi Cà Mau — Cực Nam Tổ Quốc (`vietnamSouthBuilder.ts:3520-3734`)
- **Ảnh đối chiếu**: `35_mui_ca_mau.jpg`, `101_mui_ca_mau_con_tau_gps0001.jpg`, `102_rung_duoc_ca_mau.jpg`.
- **Yêu cầu P0**:
  - **Con Tàu Mũi Cà Mau (`35`, `101`)**: đổi thân tàu sang **nâu cam đất nung (`#a85a3b`) viền xanh da trời (`#5fa8c9`)**, dựng lại **cánh buồm trắng tam giác vút nhọn có vòm khoét lõm sâu ở chân đuôi + 4 thanh nẹp ngang trắng nổi**, gắn trực tiếp chữ đỏ `"MŨI CÀ MAU / 8°37'30" VĨ ĐỘ BẮC / 104°43' KINH ĐỘ ĐÔNG"` đúng chiều đọc trên **cả 2 mặt buồm** (sửa lỗi lật ngược `L3681`).
  - **Mốc GPS 0001 (`L3575`)**: sửa lỗi `rotX -> rotY` đang làm chóp nghiêng đổ 45°, vuốt nhọn 4 cánh sao la bàn đá granite.
  - **Cột Cờ Hà Nội tại Mũi Cà Mau**: đổi sang `weatheredImperialBrick`, mở cửa vòm 3 tầng đế, thêm lan can gạch & ô thông gió hoa thị.
- **Yêu cầu P1**: Bổ sung **bãi bùn phù sa + cụm rễ thở mọc tua tủa** quanh gốc 64 cây đước (`102`); thay 2 vỏ lãi hộp bằng vỏ xuồng mũi nhọn cong.
- **Yêu cầu P2**: Thêm cột mốc **Km 2436 — Điểm cuối Đường Hồ Chí Minh** cạnh sân GPS 0001.

#### 29. Đảo Ngọc Phú Quốc & Dinh Cậu (`vietnamSouthBuilder.ts:3740-4068`)
- **Ảnh đối chiếu**: `36_dao_phu_quoc.jpg`, `103_dinh_cau_phu_quoc.jpg`.
- **Yêu cầu P0**:
  - Hạ đỉnh ghềnh đá `dcRock` xuống dưới `dcDeckY = 4.95m` & xóa đá trùng `boulderCoords[0]` để hết đá đâm xuyên ngập nửa Miếu Dinh Cậu.
  - Dựng lại **Mũi Dinh Cậu (`103`)**: hệ **cột & dầm bê tông trắng chống gầm** trên ghềnh đá đen gồ ghề + **lan can con tiện trắng viền mũ đỏ** + mái miếu diềm trắng-đỏ có **tháp nóc bát giác nhỏ** + **con đê chắn sóng bê tông vát** nối vào bờ.
  - Sửa **Hải đăng Dương Đông**: 5 khoang trắng–xanh da trời nhạt, đỉnh có **lan can sắt đen + buồng đèn trụ mái bằng + cột thu lôi** (bỏ chóp nón xanh).
- **Yêu cầu P1**: Thay 3 tàu cá hộp bằng vỏ tàu mũi nhọn có bo mạn, cửa sổ cabin & cần câu mực; thêm mỏm đá *sea-stack* đầu mũi & cây sộp/phi lao sau miếu.
- **Yêu cầu P2**: Gắn 2 dây treo dọc cho xích đu biển (`L3861`) và 2 cọc/thân dừa đỡ đúng 2 đầu võng (`L3853`).

#### 30. Côn Đảo — Vịnh Côn Sơn, Hàng Dương & Cầu Tàu 914 (`vietnamSouthBuilder.ts:4074-4308`)
- **Ảnh đối chiếu**: `37_con_dao_vinh_con_son.jpg`, `104_nghia_trang_hang_duong.jpg`, `105_cau_tau_914_con_dao.jpg`.
- **Yêu cầu P0**:
  - **Nghĩa Trang Hàng Dương (`104`)**: dựng **4 cột Tứ Trụ granite xám độc lập** (2 cột giữa cao đội búp sen, 2 cột ngoài thấp đội nghê đá) phía trước **Cổng Tam Quan 3 vòm sơn trắng tinh 2 tầng mái ngói đỏ + lưỡng long chầu nguyệt trắng + 2 cánh cửa gỗ vòm**.
  - **Khu Kiến Trúc Pháp & Cầu Tàu 914 (`105`)**: đóng tường lùi cho 2 cánh hành lang vòm, bổ sung **cửa chớp lá sách gỗ xanh / cửa song sắt trại giam**, phào chỉ trắng & dãy hiên cột vuông mái ngói đỏ xiên kiểu Côn Đảo.
- **Yêu cầu P1**: Sửa mặt Cầu Tàu 914 thành đá hộc cổ xếp bậc & dời 4 đèn đường xuống bệ trụ chắc chắn; thay 2 hộp tàu gỗ bằng thân tàu cong có mũi & cabin; thêm phù điêu đồng nổi & bia chữ chân Đài tưởng niệm Hàng Dương.
- **Yêu cầu P2**: Mềm hóa tán ngang cây bàng cổ thụ (*Terminalia catappa*) & thêm bụi phi lao/dứa biển ven vịnh (`37`).

---

### NHÓM D — VÒNG ĐẠI QUẦN THỂ VĂN HÓA MACRO (`vietnamReferenceShowBuilder.ts`)

#### 31. Tràng An `(120,-110)` & Tam Cốc — Bích Động `(680,-320)` (`L459-774`, `L2406-2956`)
- **Ảnh đối chiếu**: `11_trang_an_ninh_binh.jpg`, `12_tam_coc_bich_dong.jpg`, `63_chua_bich_dong_ninh_binh.jpg`, `63b_chua_bich_dong_mai_dau_dao.jpg`, `80_trang_an_do_thuyen_hang.jpg`.
- **Yêu cầu P0**:
  - Sửa cầu thang **Chùa Bích Động (`L2890`)** nối thẳng trục từ sau Tam Quan (`776.5`) lên Chùa Trung (hết lệch 11m).
  - Dựng **vòm hang đá vôi nâu vàng nhô trùm sát nóc mái Chùa Trung (`63`)**; đổi mặt tiền Chùa Trung sang **gỗ lim mộc nâu sẫm + cửa bức bàn 4 cánh (song con tiện trên, pano dưới) + bậu đá xanh chạm nổi + cột đá vuông khắc Hán tự đỉnh gắn Nghê đa sắc (`63b`)**.
- **Yêu cầu P1**: Thêm đầu đao góc mái rồng cuộn đa sắc & bờ giải vôi trắng cho Bích Động; gắn **đèn treo trần ánh vàng ấm + cụm nhũ đá phân tầng** trong lòng Hang Cả (`80`); tạo vách đá vôi phân tầng sọc ngang + cây si rủ rễ sát sông (`11`) & mảng thửa ruộng đan xen xanh non–vàng chanh–vàng chín (`12`).
- **Yêu cầu P2**: Bo cong vỏ đò Tam Cốc + diễn hoạt nhịp chèo chân; bổ sung Chùa Hạ & Chùa Thượng trên sườn núi.

#### 32. Quảng Trường Hội Quán `(640,128)` & Bến Sông Hoài Đêm Hoa Đăng `(775,248)` (`L780-1011`, `L2990-3402`)
- **Ảnh đối chiếu**: `02_hoian_lanterns_bridge.jpg`, `03_hoian_river_lanterns.jpg`.
- **Yêu cầu P0**:
  - Dựng đủ hàng cột gỗ đỏ đỡ mái cho **Chùa Cầu Macro (`L3045`)** (hết lơ lửng `2.27m`).
  - Xây bậc thang/mố nối đất cho **2 đầu cầu gỗ 92m Sông Hoài (`L3217`)** & đổi cầu sang gỗ sơn đỏ son (`crimsonLacquer`) đúng ảnh `03`.
  - Thiết kế lại **tháp đèn lồng 7 tầng trung tâm (`02`)** dạng khung lầu gỗ đỏ có bệ lan can chứa đèn lồng phát sáng 3 tầng màu đỏ–trắng vàng–lam.
- **Yêu cầu P1**: Nâng cấp 450 **hoa đăng** thành đóa sen 2 tầng cánh + lõi nến trắng vàng (`03`); thêm dây cáp võng (`catenary wires`) + chóp gỗ đỏ + tua rua cho đèn lồng treo; thêm cầu thang hông 2 lầu Hội Quán.
- **Yêu cầu P2**: Bo cong vỏ 6 thuyền sông Hoài, thêm ghế/người chèo & dải đèn cung tròn nền hậu (`03`).

#### 33. Đại Nội Huế Macro — Điện Thái Hòa `(-692,80)` & Inner `(-235,42)` (`L1017-1135`, `L3404-3636`)
- **Ảnh đối chiếu**: `18_dien_thai_hoa_hue.jpg`, `53_ngai_vang_dien_thai_hoa_hue.jpg`, `106_dien_thai_hoa_mai_rong.jpg`, `106b_dien_thai_hoa_noi_that.jpg`, `04_imperial_court_red_gold.jpg`.
- **Yêu cầu P0**:
  - Tách cao độ giữa mái dưới và mái trên (`+0.85m`) để dựng **dải Cổ Diềm *Nhất Thi Nhất Họa*** có canvas/texture pháp lam đa sắc xen kẽ ô thơ Hán tự – tranh tứ linh (`18`, `106`).
  - Sửa **Bửu Tán (`L3521`)** thành khung hộp vuông chạm lộng thếp vàng có **diềm tua rủ lượn sóng viền 4 cạnh + 4 tua góc** (xóa trụ bát giác bị đâm xuyên); thay 4 tường vàng đặc `L3523` bằng **Cửa Võng chạm thủng uốn vòm** theo từng gian cột (`106b`).
  - Đổi bệ tam cấp sang **gỗ nâu sẫm viền mặt đứng chạm phù điêu rồng vàng** + điêu khắc lại **Ngai Vàng** tay vịn rồng cong, chân quỳ & bệ gác chân (`53`, `106b`).
  - Bổ sung **hệ cửa bức bàn đỏ 9 gian** mặt Đông + **2 cánh tường hồi vôi trắng mở ô cửa tròn chữ Thọ đỏ** (`18`).
- **Yêu cầu P1**: Bỏ hàng rào `chu_van` chắn mặt tiền điện, làm rõ **Sân Đại Triều Nghi 2 cấp đá Thanh** + 2 chậu bonsai gốm hoa lam; dựng vách pano nội thất vàng kem khung đỏ–vàng + ô hộc bầu dục (`106b`); nâng cấp bản Inner lên mái kép *Trùng Thiềm Điệp Ốc*.
- **Yêu cầu P2**: Hoàn thiện quạt vả/tàn lọng họa tiết cung đình (`04`) & đèn lồng lục giác khung chạm.

#### 34. Làng Cổ Đường Lâm `(-640,-196)` & Đình Mông Phụ (`L1190-1361`, `L3843-4255`)
- **Ảnh đối chiếu**: `13_lang_co_duong_lam.jpg`, `69_nha_co_duong_lam_da_ong.jpg`, `06_banyan_tree_village_night.jpg`.
- **Yêu cầu P0**:
  - Áp PBR texture **`lateriteHoneycomb`** (đá ong tổ ong lỗ rỗ nâu gỉ sắt + mạch vữa xám & rêu) cho toàn bộ tường bao, kè cây đa và nhà cổ.
  - Dựng lại **Cổng Làng Mông Phụ (`L3968-3994`)** chuẩn ảnh `13`: **1 tầng mái 2 dốc ngói mũi hài rêu + 2 tường hồi bít đốc vôi xám loang rêu** (bỏ 2 tầng mái chồng diêm rồng vàng cung đình).
  - Sửa **Nghi Môn Đình Mông Phụ (`L4092-4101`)** chuẩn ảnh `69`: chất liệu vôi xám rêu, **2 trụ giữa cao đội Nghê**, **2 trụ ngoài thấp có ô lồng đèn rỗng 4 mặt + búp sen**, nối bằng **2 cổng nách có câu đối** + **tường hoa đá ong ô thoáng** 2 bên.
- **Yêu cầu P1**: Khoét rỗng lòng **Giếng Cổ** + mặt nước âm + dây thừng/gầu múc; bổ sung **2 dãy nhà Tả/Hữu Mạc** hai bên sân Đình & chỉnh cao độ cột cái tránh đâm xuyên mái; lát sân gạch Bát Tràng xương cá (`batTrangBrickFloor`).
- **Yêu cầu P2**: Bổ sung mái hiên gỗ, cửa bức bàn 3 gian & đầu hồi tam giác cho 8 nhà cổ Đường Lâm.

#### 35. Khu Lịch Sử Hào Hùng: Điện Biên Phủ `(-820,-545)` & Bạch Đằng `(-240,-780)` (`L2024-2405`, `L5469-5868`)
- **Ảnh đối chiếu**: `14_dien_bien_phu_doi_a1.jpg`, `81_dien_bien_phu_ham_de_castries.jpg`, `15_bai_coc_bach_dang.jpg`, `14_mountain_citadel_blue_red.jpg`, `15_bach_dang_naval_fleet.jpg`.
- **Yêu cầu P0**:
  - **Hầm De Castries (`L5511-5523` vs `81`)**: hạ đáy vòm sát nền hào, **xóa tấm đá `L5522` đâm xuyên lòng hầm**, dựng **vòm tôn thép lượn sóng 3D gỉ sét dài 16–18m**, xếp **hàng trăm bao cát bịt kín 2 đầu vòm, phủ dọc đỉnh hầm & viền bờ hào bê tông** + cầu thang bậc xuống cửa hầm gỗ âm đất.
  - Bổ sung **hàng rào dây thép gai bùng nhùng** (cuộn lò xo) quanh Đồi A1 & Hầm De Castries; dựng **Tượng đài Chiến thắng Điện Biên Phủ** (3 chiến sĩ đồng giương cờ trên bệ đá xanh 3 cấp — `14`).
  - **Thủy Chiến Bạch Đằng (`L5749-5761`)**: gắn đủ **buồm cho cột thứ 3**, căn tọa độ tấm buồm khớp thanh tre `battens` (bỏ lệch `Z = 0.35`), bổ sung **hệ dây chằng cột buồm (`rigging/shrouds`)**.
- **Yêu cầu P1**: Tách mẫu **xác xe tăng M24 Chaffee** (tháp pháo vát góc cạnh, nòng 75mm, màu thép cháy gỉ); khoét lõm terrain hoặc đắp gờ đất quanh **Hố Bộc Phá Đồi A1**; thêm đường ván ghép mạn & **cặp mắt thuyền trắng-đen** cho soái hạm Bạch Đằng (`15`); tách thân gỗ lim đen sần & mũi vát/sắt rèn cho bãi cọc.
- **Yêu cầu P2**: Làm phồng bao cát có texture vải bố, thêm cọc kè ván hào giao thông & thay cầu lửa đơn bằng ngọn lửa đa tầng + khói đen.

#### 36. 7 Đại Quảng Trường Nghệ Thuật Văn Hóa Macro (`L3638-5467`)
- **Ảnh đối chiếu**: `05_lotus_pink_stage.jpg`, `07_dragon_non_quai_thao.jpg`, `38_trong_dong_ngoc_lu_pattern.jpg`, `09_clouds_brocade_non_la.jpg`, `10_heroic_rock_relief.jpg`, `11_historical_filmstrip.jpg`.
- **Yêu cầu P0 (theo từng quảng trường)**:
  1. **Liên Hoa Bạch Ngọc Đài `(0,-562)`**: viết shader/texture cánh sen có vân gân dọc & gradient trắng→hồng sen phát quang (tăng phân giải cánh `14×10`); **lọc loại trừ vùng cầu đá vòm** khỏi 600 hoa sen & 720 lá sen (`L3823`).
  2. **Thung Lũng Long Vân Sơn Mài `(820,-96)`**: tách mặt **cầu ngắm cảnh** khỏi `dragonParts` (`L4421` — đang dính shader vảy rồng!); nâng cấp shader **vảy rồng vỏ sò theo UV thân + dải bụng đốt ngang lam–vàng**, điêu khắc mềm đầu & bờm rồng (`07`).
  3. **Quảng Trường Trống Đồng `(-680,385)`**: **xoay đúng chiều `uprightWaist`** (`L4611`) & tách vật liệu `[bronzeMat, drumFaceMat, bronzeMat]` để không nhòe UV thành trụ; thêm hoa văn dập nổi cho thân trống 3D & điêu khắc rõ chân/mắt 4 tượng cóc.
  4. **Thánh Địa Thổ Cẩm Tây Nguyên `(-840,106)`**: đồng bộ vị trí/góc nghiêng `(0.42, 0.2, 0.14)` cho khung `truss` Nón Lá + thêm texture nan tre đan & dải lụa đỏ lớn (`09`); dựng lại mái Nhà Rông 1 khối lưới mượt không gãy bậc (`L4876`).
  5. **Hẻm Núi Anh Hùng Đất Nước `(-560,-680)`**: điêu khắc **6–8 cụm nhân vật anh hùng lịch sử 3D nổi** (`9–12m`) áp lên vách đá cong + chữ `"ĐẤT NƯỚC"` phát sáng (`10`); thay cánh chim Lạc hộp vuông bằng cánh cong điêu khắc.
  6. **Đại Lộ Ký Ức 35mm `(0,-338)`**: trả về đủ mảng 4 `variantMats` để `setAtmosphere` đồng bộ cả 16 bia (`L5210`); nâng độ phân giải phim lên `256×1024px` có **viền cam rực phát sáng & hàng lỗ đục phim đen sắc nét** (`11`).
  7. **Hẻm Núi Trường Sơn `(740,-595)`**: dựng **vách đá vôi 3 bậc thang ngay sau 4 thác nước (`z = cz - 82`)** + hồ/suối chân thác; nối kín **cầu treo 116m** vào vách núi kèm **2 cổng trụ tháp neo cáp + dây neo đất + mố đá** (`L5375-5401`).
- **Yêu cầu P1**: Thêm diềm hoa sen & bệ cánh sen ngọc bích cho Đại Liên Hoa (`05`); thêm nan tỏa tia & dải lụa đỏ cho Nón Quai Thao (`07`); thêm băng đàn hươu cho mặt Trống Đồng Ngọc Lũ (`38`) & nối kín 8 cột tới 5 vòng vàng; thêm `normalMap` dệt cho thổ cẩm, họa tiết hoa thị cho 3 đĩa tím & mây Tường Vân cuộn xoắn ốc (`09`); bật `DoubleSide` cho `sunDisc` + cụm bia trung tâm Ký Ức 35mm (`11`); mềm hóa tượng lãnh tụ & thêm dây cáp treo `nonCrown` cho Hẻm Đất Nước.

---

## PHẦN IV — LỘ TRÌNH THỰC THI ĐỀ XUẤT & NGƯỠNG KIỂM SOÁT HIỆU NĂNG

Tất cả đợt nâng cấp phải vượt qua đầy đủ các cổng kiểm định trong `tests/unit/vietnamHeritageBudget.test.ts`:
- `totalTriangles < 3_650_000`
- `uniqueMaterials <= 250` (tận dụng tối đa `MaterialLibrary` + `SignageAtlas` + vertex colors)
- `shaderMaterials <= 26`
- `frustumCulledOffCount <= 45`
- `activeShadowCasterTriangles <= 900_000`

| Đợt | Trọng tâm | Hạng mục cốt lõi |
|---|---|---|
| **Đợt 1 (Nền tảng PBR & Helpers)** | Vá sạch 6 lỗi hệ thống `S1–S6` | 8 bộ PBR texture mới (`chamRubbedBrick`, `marseilleBrick`, `weatheredImperialBrick`, `lateriteHoneycomb`, `agedPlaster`, `batTrangBrickFloor`, `thatchAndBambooWeave`, `bronzePatina`), sửa `jadeRoof`, `lanternSilk` Đức Bà, UV theo mét thực, nâng cấp 7 helper hình học/hoa văn + `SignageAtlas`. |
| **Đợt 2 (Fix toàn bộ 38 P0 Bugs)** | Diệt sạch lơ lửng, cắt xuyên & sai kiến trúc cốt lõi | Sửa R1–R38: Cửa sổ Khuê Văn Các, vì kèo Chùa Một Cột, đỉnh Tháp Rùa & Cầu Thê Húc, ngón tay Cầu Vàng, bậc Ti Tốp & thang/cọn nước Mù Cang Chải, Vọng Lâu Đoan Môn, Cột Cờ HN, Lũng Cú, Fansipan, thuyền Chùa Hương, Lăng & Nghi Môn Đền Hùng, Ngọ Môn/Kỳ Đài Huế, Chùa Cầu/Hội An, Cầu Rồng, Sơn Đoòng, Phong Nha, Kosa Mỹ Sơn/vòm Poshanư, chữ LANGBIANG, Nhà Mồ, Chợ Bến Thành, UH-1/rèm Dinh Độc Lập, mặt tiền & chóp Đức Bà, Tháp 9 tầng Bến Dược, Mandapa Ponagar, tổ cò Trà Sư, Con Tàu & GPS Cà Mau, Dinh Cậu, Tứ Trụ Hàng Dương, Bích Động, Cầu Sông Hoài, Cổ Diềm Thái Hòa, Đường Lâm, Hầm De Castries, Bạch Đằng, Thác & Cầu Trường Sơn, 7 Quảng trường. |
| **Đợt 3 (Nâng tầm Hoa Văn & Điêu Khắc P1)** | Từng bức tường, phù điêu, nội thất & thực vật | Hoàn thiện toàn bộ mục **P1** (rồng đá Lê Sơ, Cửu Đỉnh patina + phù điêu, 4 phù điêu Biên Hòa, nội thất Miếu Bắc Đế/Thái Hòa/Bến Thành, xe tăng 843/390/M24/M41, UAZ-469 Langbiang, thuyền rồng Phong Nha, Cái Răng, Trà Sư, rễ thở Cà Mau, cụm tượng Hẻm Đất Nước). |
| **Đợt 4 (Tinh xảo Cận Cảnh P2 & Visual QC)** | Đánh bóng & chụp kiểm tra trực tiếp trên trình duyệt | Hoàn thiện các mục **P2** + chạy `vitest` budget gate + duyệt ảnh thực tế từng POI ở cả chế độ ngày/hoàng hôn/đêm. |
