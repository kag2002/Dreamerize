# Báo Cáo QC & Danh Sách Mở Rộng Kích Thước — Tăng Độ Chi Tiết Map Địa Danh Việt Nam (Vietnam Heritage 3D)

> **Ngày QC**: 2026-11-21  
> **Phạm vi kiểm tra**: Toàn bộ 5 file xây dựng bản đồ 3D (`VietnamHeritageScene.ts`, `vietnamNorthBuilder.ts`, `vietnamCentralBuilder.ts`, `vietnamSouthBuilder.ts`, `vietnamReferenceShowBuilder.ts`) + `vietnamGeometryHelpers.ts` & `vietnamHeritageShader.ts` — tổng cộng **35 địa danh & cụm di sản**.  
> **Kho ảnh tham chiếu đời thực**: **127 ảnh độ phân giải cao (Wikimedia Commons, đã kiểm duyệt hình ảnh)** lưu tại [`vietnamreference/real_life_refs/`](real_life_refs/manifest.json).

---

## 0. Kết Quả Kiểm Duyệt & Bổ Sung Kho Ảnh Tham Chiếu Đời Thực (127 Ảnh)

Kho ảnh lưu tại `vietnamreference/real_life_refs/` (chỉ mục đầy đủ trong `manifest.json`) đã được kiểm tra trực quan và bổ sung:

| Thư mục | Số lượng | Nội dung |
|---|---:|---|
| `01_mien_bac/` | 16 | Toàn cảnh 15 địa danh miền Bắc (`01`–`15`, kèm `08b`) |
| `02_mien_trung_tay_nguyen/` | 12 | Toàn cảnh 12 địa danh miền Trung & Tây Nguyên (`16`–`27`) |
| `03_mien_nam_hai_dao/` | 10 | Toàn cảnh 10 địa danh miền Nam & Hải Đảo (`28`–`37`) |
| `04_hoa_van_hoa_tiet/` | 32 | Ảnh cận cảnh hoa văn, họa tiết, điêu khắc (`38`–`69`) — **đã thay mới 8 ảnh bị sai chủ thể/lỗi tải** (`49`, `50`, `52`, `55`, `57`, `59`, `62`, `63`) |
| `05_chi_tiet_mo_rong/` | 41 | **41 ảnh mới tải & kiểm duyệt thị giác** (`63b`, `70`–`107`, `86b`, `106b`) cho các hạng mục mở rộng kiến trúc, nội thất, tàu thuyền, tượng, xe tăng/trực thăng, thảm thực vật đặc trưng |
| `06_noi_that_thanh_tri_toa_nha/` | 16 | **16 ảnh chuyên sâu (`108`–`123`) phục vụ mở rộng kích thước & phát triển không gian bên trong thành trì, cung điện, dinh thự, thánh đường và nhà cổ** |
| **Tổng cộng** | **127** | **0 ảnh thiếu, 0 ảnh mồ côi, 100% khớp chủ thể thực tế** |

---

## Phần I — Danh Sách Lỗi Hình Học, Vật Liệu & Kiến Trúc Cần Sửa Ngay (P0 — 18 Bugs)

Phát hiện trực tiếp từ quá trình đọc code & đối chiếu ảnh thực tế, cần xử lý trước hoặc song song với đợt mở rộng:

| # | Địa danh | File & Dòng | Lỗi phát hiện | Hướng sửa chuẩn |
|---|---|---|---|---|
| **B1** | **Tam Cốc — Bến Đò** | `vietnamReferenceShowBuilder.ts` L2197–2236 | `Bến Đò Tam Cốc` & bậc đá được `push` vào `timberParts`/`strawParts` **sau khi đã merge mesh**, nên bến đò **không hiển thị**; bậc thang push nhầm vào `strawParts`. | Di chuyển khối dựng Bến Đò lên trước bước `mergeGeometries`, dùng vật liệu `stone` cho bậc thang. |
| **B2** | **Ngọ Môn Huế** | `vietnamCentralBuilder.ts` L400–411, L473 | `Đại Hồng Chung` & `Trống Sấm` đặt ở `upperFloorY=11.56m` bị **chôn kín trong khối hộp đặc** tầng 2 của 2 lầu cánh trong, khung chuông đâm xuyên mái `wRoof2`. | Mở 3 mặt tầng 2 lầu cánh (thay hộp đặc bằng cột + lan can con tiện + sàn lộ thiên) để lộ chuông & trống đúng thực tế. |
| **B3** | **Hang Sơn Đoòng** | `vietnamCentralBuilder.ts` L1445–1461 | `Bức Tường Việt Nam` cao `68–75m` đặt ở `r=46m` (nơi vòm hang hạ xuống `38.5m`) nên **đâm thủng vách hang ra ngoài trời**; đèn lều nằm trong bán cầu đặc không thấy sáng. | Mở rộng chiều dài hang thành 2 hố sụt nối tiếp, đẩy vòm trần lên `110–130m`, đặt Bức Tường ở cuối lòng hang; chuyển vải lều sang vật liệu bán trong suốt (`transmissive/emissive`) + cửa lều mở. |
| **B4** | **Cầu Vàng — Bà Nà** | `VietnamHeritageScene.ts` L2365 | Hai trụ mố hai đầu cầu (`6.2×21.8×6.2m`) bị push nhầm vào `deckParts` nên hiển thị thành **gỗ teak** thay vì bê tông/đá. | Tách 2 trụ mố sang `stoneParts` / `graniteParts`, bọc đá rêu phong & thêm bậc thang nối địa hình. |
| **B5** | **Chùa Hương — Suối Yến** | `vietnamNorthBuilder.ts` L1446 | 48 **lá hoa súng** bị push vào `woodParts` nên có màu **nâu gỗ**; hoa súng là hình nón 6 cạnh đơn sơ. | Chuyển lá súng sang vật liệu lá xanh riêng (có khuyết chữ V), nâng cấp hoa súng đa lớp cánh hồng/tím. |
| **B6** | **Vịnh Hạ Long — Thuyền Buồm** | `VietnamHeritageScene.ts` L2747, L2753 | Cánh buồm xoay `rotation.y = Math.PI * 0.5` khiến buồm **nằm ngang vuông góc thân tàu** (sai kiểu buồm dọc cánh dơi); `Hòn Đỉnh Hương (36,-435)` thiếu vùng loại trừ karst. | Xoay buồm dọc theo thân (`fore-and-aft`), thêm thanh tre 3D (*batten*) & dây chằng; bổ sung `exclusion` bán kính `30m` quanh `(36, -435)`. |
| **B7** | **Chùa Một Cột** | `VietnamHeritageScene.ts` L3356 | Khói hương GPU phát ra tại `(-30.5, 1.85, 22.0)` nhưng **không có lư hương/đỉnh đồng** bên dưới nên khói bay lơ lửng giữa không trung. | Đặt bộ *Đỉnh đồng* chạm khắc (`createBronzeIncenseTripodParts`) đúng tọa độ phát khói + hoàn thiện song lan can ban công & thành hồ. |
| **B8** | **Chùa Cầu — Hội An** | `vietnamCentralBuilder.ts` L744–766 | Gian thờ & `voidParts` đặt chính giữa thân cầu **chặn kín lối đi**; mái cầu nằm ngang trong khi sàn cầu cong `1.65m` tạo khe hở `0.9m` giữa cột và mái hai đầu. | Đẩy gian thờ Bắc Đế Trấn Võ nhô lệch hẳn về phía Bắc (mặt bằng chữ T đúng thực tế) và uốn mái `Chùa Cầu` cong theo nhịp cầu. |
| **B9** | **Cầu Rồng — Đà Nẵng** | `vietnamCentralBuilder.ts` L1190, L1214–1223 | Thân rồng lượn sóng `±1.55m` theo trục Z nhưng dây cáp treo & thanh giằng cố định tại `cz ± 0.65m` nên **rời khỏi thân rồng** ở các đỉnh vòm. | Tính tọa độ neo cáp & thanh giằng bám chính xác theo hàm `z(t)` của vòm 5 ống thép. |
| **B10** | **Tháp A1 — Mỹ Sơn** | `vietnamCentralBuilder.ts` L1865–1922 | Tiền sảnh mặc định của `createChamTowerGeometry`, lanh-tô vòng lặp và khối `Tiền Sảnh` tùy biến **chồng lấn 3 lớp** tại cửa Đông Tháp A1. | Thêm cờ `skipBuiltInVestibule` cho `createChamTowerGeometry` để Tháp A1 chỉ dùng duy nhất 1 khối Tiền Sảnh hở chuẩn. |
| **B11** | **Nhà Rông — Biển Hồ T'Nưng** | `vietnamCentralBuilder.ts` L203–234, L2328 | Mái lưỡi rìu cao `12.6m` **không có vách đầu hồi** nên rỗng toác 2 đầu; comment ghi có *Trống Hơgơr* nhưng chưa dựng mesh. | Bổ sung vách phên nứa đan họa tiết ở 2 đầu hồi mái + dựng *Trống Hơgơr* gỗ bọc da đặt trên giá. |
| **B12** | **Làng Cổ Đường Lâm (Macro)** | `vietnamReferenceShowBuilder.ts` L3050–3063 | `Cổng Làng Mông Phụ`: 2 trụ cổng trải theo trục X (`8.6m`) nhưng cánh cửa, then cài, hoành phi và 2 tầng mái lại **xoay lệch 90° dọc theo trục Z**; nhà cổ bản Inner (L1083–1086) cửa sổ không xoay theo `ry`. | Đồng bộ trục X–Z của mái chồng diêm, cửa gỗ, hoành phi; xoay vector offset cửa sổ theo góc `ry` của nhà. |
| **B13** | **Điện Biên Phủ — Hầm De Castries** | `vietnamReferenceShowBuilder.ts` L3801–3806 | Vòm thép lượn sóng xoay dọc trục X nhưng cửa ra vào & tường chắn đặt ở mặt `+Z`, **đâm ngang sườn vòm**. | Xoay cửa ra vào về đúng đầu trục vòm + bọc bao cát chồng tầng và dựng cờ *Quyết Chiến Quyết Thắng*. |
| **B14** | **Nhà Thờ Đức Bà Sài Gòn** | `vietnamSouthBuilder.ts` L958–965 | `createGothicSpireGeometry` đã dựng sẵn quả cầu + thánh giá màu xanh patina chồng khít lên thánh giá đồng vàng dựng riêng. | Tắt thánh giá nội tại trong helper hoặc thay thế hoàn toàn bằng 1 bộ thánh giá đồng vàng cao `3.5m` có họa tiết chóp. |
| **B15** | **Khuê Văn Các / Lũng Cú / Mũi Cà Mau / Đà Lạt** | Nhiều file | Lan can thiếu phần kết nối: ban công gác Khuê Văn Các không có con tiện; thành hồ Chùa Một Cột & sân thượng Mũi Cà Mau & tầng 1 Lũng Cú & sân vọng cảnh Langbiang chỉ có trụ đứng **không có thanh vịn/tường lan can**. | Dùng module `createPiercedBalustrade` khép kín toàn bộ lan can an toàn & đúng hoa văn từng vùng. |
| **B16** | **Địa Đạo Củ Chi — Tháp Bến Dược** | `vietnamSouthBuilder.ts` L1105–1110 | Bệ đá cao `1.85m` **không có bất kỳ bậc thang nào** để bước lên tháp tưởng niệm. | Thêm 4 hướng tam cấp đá granit có lan can đá chạm mây & nâng cấp lên tháp 9 tầng Bến Dược thực tế. |
| **B17** | **Thung Lũng Sơn Mài Long Vân** | `vietnamReferenceShowBuilder.ts` L1147, L3252–3260 | Đường viền vàng trên núi sơn mài tính theo `vViewPosition` nên **trượt theo camera** khi người chơi quay góc nhìn. | Chuyển công thức vân vàng sang không gian tọa độ thế giới (`vWorldPos.y` + triplanar FBM) để đường viền bám cố định lên vách núi. |
| **B18** | **Tam Cốc — Bờ Ruộng & Tháp Rùa** | `vietnamReferenceShowBuilder.ts` L2188; `VietnamHeritageScene.ts` L2159 | 5 đường bờ ruộng Tam Cốc thẳng tắp cắt ngang sông Ngô Đồng; Tháp Rùa đặt hộp đen đặc bên trong làm mất độ **xuyên sáng qua 3 vòm cuốn** tầng 1–2; Đại Tượng Đài Đất Nước (L3587) có hộp chữ nhật dán texture trống đồng thay cho tượng đài. | Cắt bỏ bờ ruộng trong hành lang sông; mở thông lòng tầng 1–2 Tháp Rùa (vòm nhọn Gothic); dựng tượng đài điêu khắc thật + cánh Chim Lạc & Rồng. |

---

## Phần II — Thư Viện Hoa Văn, Họa Tiết & Đồ Vật Dùng Chung (Shared Asset & Shader Library)

Trước khi mở rộng từng địa danh, chuẩn hóa **12 nhóm tài sản chi tiết** trong `vietnamGeometryHelpers.ts` và `vietnamHeritageShader.ts` (giảm lặp khối hộp/trụ thô, tối ưu draw calls bằng `InstancedMesh` & `mergeGeometries`):

1. **Thư viện Khắc Chữ & Họa Tiết Canvas PBR (`createVietnamSignageAtlas`)**: Sinh texture 512–1024px (Albedo + Bump/Normal + Gold Roughness) cho toàn bộ hoành phi, câu đối, biển hiệu thực tế:
   - `"KHUÊ VĂN CÁC"`, `"ĐOAN MÔN (端門)"`, `"NGỌ MÔN (午門)"`, `"ĐIỆN THÁI HÒA"`, `"LAI VIỄN KIỀU (來遠橋)"`, `"NAM THIÊN ĐỆ NHẤT ĐỘNG"`, `"CAO SƠN CẢNH HÀNH"`, `"HÙNG VƯƠNG LĂNG"`, `"QUY SƠN THÁP"`, `"FANSIPAN 3.143m"`, `"CHỢ BẾN THÀNH"`, `"CHỢ NỔI CÁI RĂNG"`, `"MŨI CÀ MAU — 8°37'30"N 104°43'E"`, `"GPS 0001 / KM 2436"`, `"DI TÍCH CẦU TÀU 914"`, tranh sơn mài Dinh Độc Lập, và văn bia Hán-Nôm trên Bia Tiến Sĩ.
2. **Rồng Đá & Đao Mái Điêu Khắc (`createCarvedDragonBalustrade`, `createRoofFinialSet`)**:
   - Rồng bậc thềm thời Lý–Lê–Nguyễn: thân uốn sin 7–9 khúc có vảy nổi, bờm lửa/mây cụm (*đao mây*), đầu rồng có mắt, mũi sư tử, râu xoắn, ngậm ngọc châu, chân có móng vuốt (tham chiếu `39_rong_da_dien_kinh_thien.jpg`, `72_dien_kinh_thien_rong_da.jpg`).
   - Bộ trang trí bờ nóc: *Lưỡng long chầu nguyệt* khảm sành sứ (Huế / Chùa Một Cột / Đền Hùng), *Kìm nóc*, *Đầu đao* uốn cong kèm nghê/phượng, gạch thông gió hoa chanh & ống ngói lưu ly có giọt nước (*ngói câu đầu — trích thủy*) (tham chiếu `40_mai_dao_long_phuong_hue.jpg`, `63b_chua_bich_dong_mai_dau_dao.jpg`).
3. **Tượng Linh Vật & Rùa Đá (`createCarvedTurtleStele`, `createGuardianAnimal`)**:
   - *Rùa đá Văn Miếu*: mai lục giác phân múi, 4 chân có móng bấm đế, đầu rùa vươn cổ rõ mắt mũi, đuôi ngắn; thân bia uốn trán vòng cung chạm *lưỡng long chầu nguyệt* + hoa cúc dây + khắc chữ chìm (`47_bia_tien_si_rua_da_van_mieu.jpg`).
   - *Nghê đá / Kỳ Lân / Tượng Chó & Khỉ Chùa Cầu*: thân ngồi bệ gỗ, chân trước chống, bờm xoáy, tai/mõm rõ khối thay cho khối đá/trụ tròn (`56_tuong_khi_cho_chua_cau_hoi_an.jpg`, `69_nha_co_duong_lam_da_ong.jpg`).
4. **Tượng Phật & Thần Điện (`createSculptedBuddha`, `createDeityStatue`)**:
   - Tượng Phật A Di Đà (Fansipan) & Quan Âm (Chùa Một Cột, Động Hương Tích): tòa sen đa tầng 24–32 cánh nhọn uốn lượn, nếp áo cà sa xếp lớp (`Lathe + Tube`), tay kết ấn *Thiền định / Tiếp dẫn*, nhục kế xoắn ốc, hào quang lá đề có tia lửa (`75_dai_tuong_phat_fansipan.jpg`).
   - Tượng Nữ thần Po Nagar (*Thiên Y A Na*) 10 tay đội mũ *Mukuta* tháp tầng trên đài sen, lá đề chạm hoa văn Chăm (`66_tuong_cham_ponagar_linga_yoni.jpg`).
5. **Hệ Đấu Củng, Cửa Bức Bàn & Mắt Cửa (`createTimberBracketSet`, `createVietnameseDoors`, `createHoiAnDoorEyes`)**:
   - Hệ vì kèo *chồng rường — giá chiêng*, con sơn chạm mây, đấu củng Chùa Một Cột (`50_he_vi_keo_chua_mot_cot.jpg`).
   - *Cửa bức bàn* 4–6 cánh chia 3 ô: lá sách trên, chạm tứ quý giữa, pano kín dưới; bản lề cối gỗ.
   - *Mắt cửa Hội An* (`Môn thần`): hình bát giác/tròn chạm hoa cúc 8 cánh, tâm âm dương sơn son thếp vàng đặt đôi trên lanh-tô (`55_mat_cua_hoi_an.jpg`).
6. **Lan Can Chạm Trổ & Gốm Pháp Lam (`createPiercedBalustrade`)**:
   - 4 biến thể: (a) Lan can chữ Vạn `卍` & gạch hoa gốm xanh Huế; (b) Con tiện gỗ tiện tròn (Khuê Văn Các, Chùa Một Cột, Hội An); (c) Lan can đá chạm hoa sen & *Bình phong*; (d) Rèm hoa đá đốt trúc *brise-soleil* thắt eo khớp đốt thật cho Dinh Độc Lập (`60_rem_dot_truc_dinh_doc_lap.jpg`).
7. **Điêu Khắc Gạch & Sa Thạch Chăm Pa (`createChamReliefPack`)**:
   - Vòm *Kala-Makara* nhiều lớp cung nhọn hình lá đề, phù điêu *Durga Mahishasuramardini* 4 tay múa trên đầu trâu (`66_tuong_cham_ponagar_linga_yoni.jpg`), cửa giả 3 tầng giật cấp, cột áp tường có rãnh dọc & hoa văn dây lá cuốn (`41_cham_khac_thap_cham.jpg`, `86b_my_son_cua_gia_gach.jpg`).
8. **Bộ Đồ Thờ Đồng & Nhạc Cụ Dân Tộc (`createCeremonialBronzePack`)**:
   - Thống nhất tái sử dụng *Đỉnh đồng* chạm rồng + *Đôi Hạc đứng trên lưng Quy* ngậm sen + *Cửu Đỉnh* Huế (3 chân, 2 quai, thân đúc phù điêu nổi núi sông rồng biển — `54_cuu_dinh_dai_noi_hue.jpg`, `83_cuu_dinh_phu_dieu.jpg`) + *Đại Hồng Chung* có quai rồng đôi & 4 núm gõ + dàn *Cồng chiêng* Tây Nguyên núm đồng bóng (`91_cong_chieng_tay_nguyen.jpg`) + *Trống Hơgơr* + *Trống Đồng Ngọc Lũ* thân thắt eo có 4 tượng cóc & quai kép (`38_trong_dong_ngoc_lu_pattern.jpg`) + hệ thống khói hương GPU.
9. **Đội Tàu Thuyền Truyền Thống Chuẩn Thực Tế (`createVietnamWatercraftPack`)**:
   - *Thuyền buồm cánh dơi Hạ Long*: cánh buồm dọc hình cánh dơi có 7 nan tre 3D cong, dây kéo buồm, khoang cửa sổ chớp, bánh lái, mạn gỗ, bọt sóng mũi (`68_thuyen_buom_canh_doi_ha_long.jpg`).
   - *Ghe bầu Cái Răng & Xuồng hủ tiếu*: lòng khoang rỗng, mái tôn/bạt cong có khung sườn, máy đuôi tôm chân vịt, mắt thuyền vẽ tròng trắng-đen-đỏ, lốp xe đệm mạn, *cây bẹo* treo 6 loại nông sản (dưa hấu, khóm, bí đỏ, bắp cải, dừa, chuối) + người bán đội nón lá (`64_ghe_bau_cay_beo_cai_rang.jpg`, `99_cai_rang_cay_beo.jpg`).
   - *Đò nan Suối Yến / Tràng An / Phong Nha*: thân cong hai đầu nhọn, sạp tre, chèo tay/chèo chân, nón lá, mái vòm tre (`80_trang_an_do_thuyen_hang.jpg`, `92_phong_nha_thuyen_dong.jpg`, `107_thuyen_nan_suoi_yen.jpg`).
   - *Chiến thuyền cổ Bạch Đằng*: 2–3 cột buồm, buồm nan tre rách/cháy, khiên gỗ mạn thuyền, bánh lái đuôi, chèo mạn, bè lửa.
10. **Hệ Thực Vật Đặc Hữu Theo Vùng Miền (`createRegionalFloraPack`)**:
    - *Cây Đước Cà Mau* với bộ rễ chống đan chéo cắm xuống bãi bùn (`102_rung_duoc_ca_mau.jpg`); *Thông 3 lá Đà Lạt* thân cao vút tán ô; *Hoa giấy Hội An* tán nhiều tầng sắc hồng/đỏ/cam; *Cúc Lobelia tím* dọc Cầu Vàng (`85_cau_vang_loi_di_hoa.jpg`); *Lá sen/súng khuyết V* + *Hoa sen đa tầng cánh nhọn* (`45_sen_hong_viet_nam.jpg`); *Cò trắng đậu ngọn tràm* Trà Sư; *Cây Bàng cổ thụ* Côn Đảo; *Cây Bồ Đề* Chùa Một Cột; *Hoa mơ trắng* Chùa Hương; *Lúa chín có bông cong + gió lay shader* cho Mù Cang Chải & Tràng An.

---

## Phần III — Danh Sách Mở Rộng Kích Thước & Tăng Độ Chi Tiết Cho Toàn Bộ 35 Địa Danh / Cụm Di Sản

### NHÓM A — MIỀN BẮC & KHU TRUNG TÂM HÀ NỘI (`VietnamHeritageScene.ts` & `vietnamNorthBuilder.ts`)

---

#### 1. Khuê Văn Các & Quần Thể Văn Miếu — Quốc Tử Giám (`(0, 0)` · `VietnamHeritageScene.ts`)
- **Ảnh tham chiếu**: `01_mien_bac/01_khue_van_cac_van_mieu.jpg`, `04_hoa_van_hoa_tiet/47_bia_tien_si_rua_da_van_mieu.jpg`, `04_hoa_van_hoa_tiet/49_cua_so_mat_troi_khue_van_cac.jpg`, `05_chi_tiet_mo_rong/71_gieng_thien_quang_van_mieu.jpg`.
- **Mở rộng kích thước & không gian**:
  - Khuê Văn Các giữ chuẩn tỷ lệ thực (`~9.5m` cao, bệ `8.6×8.6m`), nhưng **mở rộng toàn quần thể Văn Miếu về phía Bắc & Nam**: từ phạm vi hiện tại `±25m × 65m` lên **`68m × 115m`** (cập nhật `exclusion` bao trọn trục `z ∈ [-42, +62]`).
  - **Bổ sung công trình thiếu**: **Giếng Thiên Quang** (hồ vuông chuẩn `26m × 26m` ngay phía sau Khuê Văn Các tại `z = -20`, tường lan can gạch xây ô thoáng hoa chanh 4 mặt), mở rộng **2 Nhà Bia Tiến Sĩ** lên `7.0×26.0m` chứa **32–40 bia đá trên lưng rùa** (thay vì 16 bia hiện tại), bổ sung cổng **Đại Thành Môn** phía Bắc Giếng Thiên Quang & **Văn Miếu Môn** phía Nam lối vào.
- **Hoa văn & Họa tiết**:
  - 4 trụ gạch tầng 1 bổ sung **ô hộc giật cấp chạm hoa văn chữ Thọ/hồi văn**, ốp gờ đá xanh chân trụ.
  - Gác tầng 2: thêm **hệ con tiện gỗ tiện tròn dày khít** cho toàn bộ ban công 4 mặt; 4 cửa sổ mặt trời chạm viền gỗ son 2 tầng, 8 tia gỗ tỏa nắng + **câu đối thếp vàng đọc rõ chữ** hai bên cột; mái 2 tầng 8 mái gắn **đầu đao, kìm nóc, con giống gốm** trên bờ chảy & ngói mũi hài.
  - Bia Tiến Sĩ: thay rùa cầu dẹt bằng **Rùa đá mai lục giác có đầu, 4 chân, đuôi**; bia có trán cong chạm *Lưỡng long chầu nguyệt*, diềm hoa dây và khắc chữ Hán-Nôm chìm.
- **Đồ vật & Đời sống**:
  - Nội thất gác 2: chuông đồng có quai rồng + giá gỗ chạm, trống cái, bức *Hoành Phi* khắc rõ chữ, bàn thờ có bộ tam sự.
  - Sân lát gạch Bát Tràng đỏ sẫm có đường thần đạo đá xanh; chậu cây cảnh bonsai đặt góc Giếng Thiên Quang (`71_gieng_thien_quang_van_mieu.jpg`); bảng giải thích di sản & cờ hội ngũ sắc phấp phới.

---

#### 2. Chùa Một Cột & Hồ Linh Chiểu (`(-48, 22)` · `VietnamHeritageScene.ts`)
- **Ảnh tham chiếu**: `01_mien_bac/02_chua_mot_cot.jpg`, `04_hoa_van_hoa_tiet/50_he_vi_keo_chua_mot_cot.jpg`, `04_hoa_van_hoa_tiet/45_sen_hong_viet_nam.jpg`.
- **Mở rộng kích thước & không gian**:
  - Thu gọn hồ nội khu chuẩn thực tế `24m × 24m` (thay cho hồ quá rộng `34m` hiện tại khiến chùa bị lọt thỏm) và **mở rộng tổng khuôn viên quần thể Chùa Diên Hựu lên `46m × 46m`** (`exclusion r = 28m`).
  - Thay cầu cong `10m` sai lịch sử bằng **bậc thang gạch cổ 13 bậc thẳng có tường hoa hai bên** nối trực tiếp từ bờ Đông lên thẳng Liên Hoa Đài (`50_he_vi_keo_chua_mot_cot.jpg`).
  - **Bổ sung công trình thiếu**: **Cây Bồ Đề cổ thụ** (cây quà tặng Tổng thống Ấn Độ năm 1958) sát góc sân, **cổng Tam Quan Chùa Diên Hựu** và **tiền đường nhà tổ** phía sau.
- **Hoa văn & Họa tiết**:
  - Trụ đá đường kính `1.2m` ghép 2 khối đá có mạch nối & rêu chân nước; thay 12 thanh gỗ hộp bằng **hệ thanh gỗ đấu củng / bệ sen chạm cánh sen xếp tầng tinh xảo** nâng đỡ đài gỗ.
  - Mái 4 đao cong chạm rồng/mây; bờ nóc gắn bộ **Lưỡng long chầu nguyệt** điêu khắc rõ vảy, bờm, móng thay cho ống trụ.
  - Thành hồ xây gạch có **con tiện hoa văn gốm thông gió** nối kín giữa các trụ; ban công đài gỗ đủ con tiện & lan can.
- **Đồ vật & Đời sống**:
  - Đặt **Đỉnh đồng** đúng vị trí phát khói hương (sửa Bug B7) + bình cắm hương & chậu hoa cúc vàng hai bên chân cầu thang.
  - Nội thất Liên Hoa Đài: thay tượng khối trụ bằng **Tượng Phật Bà Quan Âm nghìn mắt nghìn tay** sơn son thếp vàng ngồi tòa sen nhiều lớp cánh, rèm cửa võng vàng, bát hương đồng, đôi đèn dầu/nến lung linh, lá sen khuyết V + nụ sen/đài sen thật nổi dày mặt hồ.

---

#### 3. Tháp Rùa, Hồ Hoàn Kiếm, Cầu Thê Húc & Đền Ngọc Sơn (`(52, 22)` · `VietnamHeritageScene.ts`)
- **Ảnh tham chiếu**: `01_mien_bac/03_thap_rua_ho_hoan_kiem.jpg`, `05_chi_tiet_mo_rong/70_cau_the_huc_den_ngoc_son.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng lòng **Hồ Hoàn Kiếm** từ `64×72m` lên **`92m × 104m`** (`exclusion` bổ sung cho đảo Ngọc & Cầu Thê Húc) để tái hiện đủ trục di sản hồ Gươm.
  - Giữ **Tháp Rùa** 1:1 (`8.8m` cao trên Gò Rùa `r=12m`), nhưng **bổ sung cụm Đảo Ngọc — Cầu Thê Húc — Đền Ngọc Sơn** ở góc Đông Bắc hồ:
    - **Cầu Thê Húc**: dài **`28m`** × rộng `3.2m`, uốn cong duyên dáng 15 nhịp sơn đỏ son trên 32 trụ gỗ đứng dưới nước (`70_cau_the_huc_den_ngoc_son.jpg`).
    - **Đắc Nguyệt Lâu (Cổng Trấn Ba Đình)** & **Đền Ngọc Sơn** 2 tầng mái cong trên đảo cây xanh.
    - **Tháp Bút & Đài Nghiên** trên bờ Đông (bệ đá núi Độc Tôn + ngọn bút đá 5 tầng khắc 3 chữ *"Tả Thanh Thiên"* cao `9m`).
- **Hoa văn & Họa tiết**:
  - **Tháp Rùa**: sửa toàn bộ vòm cửa sang **vòm cuốn nhọn Gothic** chuẩn thực tế; **bỏ khối hộp đen đặc tầng 1–2** để ánh sáng mặt trời và ánh đèn đêm xuyên thấu qua các vòm cửa; sửa tầng 3 chỉ có **1 cửa vòm phía Đông** + tấm bia tròn khắc chữ *"Quy Sơn Tháp"*; thêm đầy đủ răng cưa lan can cả 4 mặt & thay đỉnh bát diện bằng **ngôi sao 5 cánh** đúng dáng; vữa cổ loang rêu xanh tự nhiên.
  - **Cầu Thê Húc**: sàn ván gỗ ghép có khe, lan can con tiện sơn đỏ son, dầm ngang bắt mộng dưới gầm cầu.
- **Đồ vật & Đời sống**:
  - Đèn hắt chân Tháp Rùa & dây đèn vàng ấm hắt xuống mặt hồ lúc hoàng hôn/đêm (`70_cau_the_huc_den_ngoc_son.jpg`); rặng **liễu rủ ven hồ**, ghế đá công viên ven bờ, cụ rùa hồ Gươm thỉnh thoảng nổi nhẹ mặt nước.

---

#### 4. Hoàng Thành Thăng Long — Đoan Môn, Điện Kính Thiên & Cột Cờ Hà Nội (`(0, -68..-105)` · `vietnamNorthBuilder.ts`)
- **Ảnh tham chiếu**: `01_mien_bac/06_hoang_thanh_thang_long_doan_mon.jpg`, `04_hoa_van_hoa_tiet/39_rong_da_dien_kinh_thien.jpg`, `05_chi_tiet_mo_rong/72_dien_kinh_thien_rong_da.jpg`, `05_chi_tiet_mo_rong/73_cot_co_ha_noi.jpg`.
- **Mở rộng kích thước & không gian**:
  - **Đoan Môn**: giữ bề rộng `46.6m`, hạ cửa vòm xuống đúng mặt sân phẳng (bỏ bậc thang rồng mặt Nam không đúng lịch sử — thay bằng sân gạch rộng có bồn hoa và rào thấp).
  - **Nền Điện Kính Thiên**: mở rộng từ `24.0×11.5m` (chỉ 40% thực tế) lên **`46.0m × 28.0m`** (`exclusion r = 34m`) với đủ **2 thềm rồng trước (9 bậc, 4 rồng đá thời Lê Sơ)** và **thềm rồng sau (7 bậc, 2 rồng đá thời Lê Trung Hưng)**.
  - **Bổ sung công trình thiếu**: **Cột Cờ Hà Nội (Kỳ Đài)** bên cạnh trục Đoan Môn (`3 tầng đế tháp gạch đỏ giật cấp + thân tháp bát giác cao 33.4m + 36 lỗ thông hơi hình hoa thị + chòi bát giác đỉnh + cột cờ` — tham chiếu `73_cot_co_ha_noi.jpg`).
- **Hoa văn & Họa tiết**:
  - **4 Rồng đá Điện Kính Thiên**: thay ống trụ bằng **điêu khắc rồng đá Lê Sơ siêu chi tiết** (`39_rong_da_dien_kinh_thien.jpg`, `72_dien_kinh_thien_rong_da.jpg`) — đầu to có bờm vuốt ngược, mắt lồi, râu dài, thân uốn 7 khúc vảy tròn, 2 rồng ngoài chạm mây đao/rồng con & sen/cúc bên thành bậc.
  - Vọng Lâu Đoan Môn tầng 2: mở cửa sổ tròn/con tiện thay khối hộp đặc; tấm bia đá *"ĐOAN MÔN"* khắc chìm rõ nét; cổng vòm ghép gạch vồ cổ có rêu phong.
- **Đồ vật & Đời sống**:
  - Thay bộ *Đỉnh đồng* & *Hạc chầu* bằng asset chi tiết chạm nổi; thêm **cặp sư tử đá / bình gốm men xanh**, **khu hố khai quật khảo cổ 18 Hoàng Diệu** (mái che kính/gỗ nhìn thấy chân tảng hoa sen thời Lý–Trần), cờ đuôi nheo lễ hội.

---

#### 5. Vịnh Hạ Long, Hòn Trống Mái, Hòn Đỉnh Hương & Làng Chài (`z ∈ [-315, -860]` · `VietnamHeritageScene.ts` & `vietnamNorthBuilder.ts`)
- **Ảnh tham chiếu**: `01_mien_bac/04_vinh_ha_long_hon_trong_mai.jpg`, `04_hoa_van_hoa_tiet/51_hon_dinh_huong_ha_long.jpg`, `04_hoa_van_hoa_tiet/68_thuyen_buom_canh_doi_ha_long.jpg`.
- **Mở rộng kích thước & không gian**:
  - Nâng cấp 4 đảo karst xa trong `vietnamNorthBuilder.ts` (hiện trơ đá không rêu, không cây) thêm lớp thực vật nhiệt đới & độ cao lên `70–115m` tạo chiều sâu tầng lớp.
  - Bổ sung **3 điểm nhấn biểu tượng mới trên vịnh**:
    1. **Hang Luồn (Sea Arch Grotto)**: vòm hang đá vôi xuyên biển cao `16m`, rộng `24m` có thuyền kayak chèo qua.
    2. **Làng Chài Nổi Cửa Vạn**: 6–8 nhà bè gỗ lợp mái tôn xanh/đỏ trên phao thùng phuy neo kín trong vụng đá vôi.
    3. **Bãi Cát & Chòi Vọng Cảnh Đảo Ti Tốp**: vạt cát vàng hình vầng trăng ôm chân đảo + đường bậc đá lên chòi lục giác mái ngói đỏ.
- **Hoa văn & Họa tiết**:
  - **Hòn Đỉnh Hương** (`51_hon_dinh_huong_ha_long.jpg`): tăng độ sắc nét của thớ đá vôi phân tầng ngang, vết sóng bào mòn đen bóng ở chân thủy triều (ngấn nước *tidal notch*), hốc hang nhỏ và cụm cây bụi bám vách đá; thêm vùng loại trừ `r = 30m` để đảo khác không đâm trùng.
  - **Thuyền Buồm Cánh Dơi** (`68_thuyen_buom_canh_doi_ha_long.jpg`): sửa hướng buồm dọc thân (Bug B6), tăng lên 6 chiếc đa cỡ (`18–26m`), khoang tàu có cửa sổ nan gỗ, lan can boong thượng, bánh lái, 7 nan tre nổi 3D trên buồm nâu đỏ, đèn lồng mũi tàu.
- **Đồ vật & Đời sống**:
  - Thuyền kayak màu cam/vàng lướt gần Hang Luồn; lưới cá & lồng nuôi hải sản ở làng chài Cửa Vạn; vòng bọt sóng trắng (shader foam ring) ôm chân từng đảo đá và rẽ nước sau đuôi thuyền; đàn chim hải âu/đại bàng biển bay vòng quanh đỉnh núi đá.

---

#### 6. Ruộng Bậc Thang Mù Cang Chải & Bản Làng Tây Bắc (`x ∈ [-310, -112]` · `VietnamHeritageScene.ts` & `vietnamNorthBuilder.ts`)
- **Ảnh tham chiếu**: `01_mien_bac/05_ruong_bac_thang_mu_cang_chai.jpg`, `05_chi_tiet_mo_rong/76_ruong_bac_thang_choi_canh.jpg`, `05_chi_tiet_mo_rong/77_nha_san_thai_tay_bac.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng khu ruộng bậc thang từ `198×120m` lên **`260m × 165m`** (thêm cụm **Đồi Mâm Xôi La Pán Tẩn** hình chóp xoáy đồng tâm đặc trưng với ~15,000 khóm lúa instanced).
  - Mở rộng **2 Nhà Sàn Tây Bắc** thành **bản nhỏ 4 nhà sàn** có sân đất, hàng rào tre, đường mòn đất đỏ uốn theo triền núi.
- **Hoa văn & Họa tiết**:
  - **Lúa bậc thang**: thêm **GPU wind-sway shader** tạo sóng lúa uốn lượn theo gió (hiện đang đứng yên cứng đơ); thêm **mặt nước phản chiếu bầu trời thật** trên các thửa mùa nước đổ & **bờ ruộng đất nặn nổi** giữa mỗi bậc (`76_ruong_bac_thang_choi_canh.jpg`).
  - **Nhà sàn Thái / H'Mông** (`77_nha_san_thai_tay_bac.jpg`): bỏ hộp kín vô hồn — dựng **vách phên tre/ván gỗ ghép khe**, cửa sổ có thanh chắn gỗ, cầu thang gỗ có tay vịn, lan can hàng hiên hoa văn X, **mái lá cọ/tranh dày dặn** gắn biểu tượng **Khau Cút** (hai thanh gỗ bắt chéo chạm hoa văn trên đỉnh đầu hồi mái).
  - **Chòi gác ruộng**: bổ sung cầu thang tre, vách chắn gió 3 phía, mái tranh 2 mái có đòn tay tre.
- **Đồ vật & Đời sống**:
  - **Cọn nước (guồng nước tre)** quay đều bên khe suối + **máng dẫn nước ống tre** chảy qua các bậc ruộng; đống rơm, khung cửi dệt thổ cẩm & bắp ngô vàng phơi dưới gầm sàn; đàn trâu đằm bùn / gặm cỏ trên bờ ruộng; dù lượn bay cao trên Đèo Khau Phạ (tùy chọn).

---

#### 7. Cột Cờ Lũng Cú — Hà Giang (`(-380, -340)` · `vietnamNorthBuilder.ts`)
- **Ảnh tham chiếu**: `01_mien_bac/07_cot_co_lung_cu.jpg`, `04_hoa_van_hoa_tiet/62_phu_dieu_cot_co_lung_cu.jpg`, `04_hoa_van_hoa_tiet/38_trong_dong_ngoc_lu_pattern.jpg`.
- **Mở rộng kích thước & không gian**:
  - Tháp cột cờ giữ chuẩn 1:1 (`34.6m` + lá cờ `54 m²`), mở rộng **sân đỉnh Núi Rồng** bán kính từ `18m` lên **`28m`** (`exclusion r = 30m`) và bổ sung **283 bậc đá uốn lượn** có chòi nghỉ dọc sườn núi.
  - **Bổ sung cảnh quan đặc trưng dưới chân núi**: **Hai Hồ Mắt Rồng** (hai hồ nước xanh lục tròn đối xứng như đôi mắt rồng ở bản Lô Lô Chải & Thèn Pả) + **Nhà Lưu Niệm / Bia Chủ Quyền Cực Bắc** + cụm **3 ngôi nhà trình tường đất vàng mái ngói âm dương** bản Lô Lô Chải.
- **Hoa văn & Họa tiết**:
  - **8 mặt phù điêu đá xanh chân đế**: áp **texture phù điêu lịch sử & mặt trống đồng Đông Sơn nổi khối PBR** (tái sử dụng `createDongSonBronzeTextures` + normal map điêu khắc, thay cho 8 khối đá trống trơn hiện tại — `62_phu_dieu_cot_co_lung_cu.jpg`).
  - **Thân tháp bát giác**: đục **cửa vòm lối vào tầng trệt** có bậc đá + **dãy cửa sổ vòm thông gió** dọc thân tháp; hoàn thiện lan can tường gạch/đá khép kín trên tầng đế 1.
- **Đồ vật & Đời sống**:
  - Ống nhòm du lịch trên đài quan sát `+21m`, bảng khắc *"Cột Cờ Quốc Gia Lũng Cú — Cực Bắc Tổ Quốc"*, khóm hoa **tam giác mạch hồng tím** nở rộ ven bậc thang đá, tường rào xếp đá tai mèo đặc trưng cao nguyên đá Đồng Văn.

---

#### 8. Đỉnh Fansipan — Đại Tượng Phật A Di Đà & Quần Thể Chùa Kim Sơn Bảo Thắng (`(400, -330)` · `vietnamNorthBuilder.ts`)
- **Ảnh tham chiếu**: `01_mien_bac/08_dinh_fansipan.jpg`, `01_mien_bac/08b_fansipan_buddha_pagoda.jpg`, `05_chi_tiet_mo_rong/74_chua_kim_son_bao_thang_fansipan.jpg`, `05_chi_tiet_mo_rong/75_dai_tuong_phat_fansipan.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng **quần thể đỉnh Fansipan** từ `24×24m` lên **tổ hợp bậc thang đa cao trình `64m × 58m`** (`exclusion r = 38m`) chia 3 tầng rõ rệt như ngoài đời (`74_chua_kim_son_bao_thang_fansipan.jpg`):
    1. **Tầng Đỉnh 3.143m**: Sân lát đá rộng, **Cột mốc Inox 3.143m**, **Kỳ Đài Fansipan nâng lên chuẩn 1:1 `25m`** (hiện chỉ `12.8m`).
    2. **Tầng Giữa — Đại Tượng Phật A Di Đà**: **Phóng đại từ `6.78m` lên chuẩn 1:1 `21.5m`** (`~13.5m` thân tượng đồng + `8.0m` đài sen & điện thờ bên dưới — `75_dai_tuong_phat_fansipan.jpg`).
    3. **Tầng Chùa Kim Sơn Bảo Thắng & Bảo Tháp 11 Tầng**: mở rộng thành tổ hợp sân chùa có **Bảo Tháp đá xanh 11 tầng cao `18m`** + **Vọng Lĩnh Cao Đài (Gác Chuông 5 tầng)** + **cầu thang đá 600 bậc** kết nối.
- **Hoa văn & Họa tiết**:
  - **Đại Tượng Phật A Di Đà**: thay chồng trụ/cầu thô bằng tượng điêu khắc đồng tối màu (`#3b352d` ánh đồng ấm) có **nếp áo cà sa rõ rệt**, gương mặt từ bi, tóc xoắn ốc, ấn thiền định, **đài sen đồng chạm nổi 3 lớp cánh hoa + phù điêu hoa văn thời Trần** trên bệ đá 3 cấp, lối cửa vòm bước vào điện thờ bên trong bệ tượng.
  - **Chóp Inox 3.143m**: khắc chữ nổi sắc nét `"FANSIPAN 3.143m — NÓC NHÀ ĐÔNG DƯƠNG"` trên cả 3 mặt đồng.
  - **Chùa Kim Sơn Bảo Thắng**: mở cửa bức bàn chạm tứ linh, lan can đá chạm mây cuộn, đầu đao cong vút thời Trần (`74_chua_kim_son_bao_thang_fansipan.jpg`).
- **Đồ vật & Đời sống**:
  - 4 **lư hương đá/đồng cỡ lớn** kèm khói hương cuộn trong biển mây, hàng tượng La Hán đá nhỏ dọc đường La Hán, cờ ngũ sắc & cờ Tổ quốc bay mạnh trong gió núi, hoa **đỗ quyên đỏ/vàng** bám vách đá granite, nâng cấp biển mây thể tích nhiều tầng mềm mại hơn.

---

#### 9. Chùa Hương — Suối Yến, Chùa Thiên Trù & Động Hương Tích (`(184..226, -152..-202)` · `vietnamNorthBuilder.ts`)
- **Ảnh tham chiếu**: `01_mien_bac/09_chua_huong_suoi_yen.jpg`, `04_hoa_van_hoa_tiet/52_dong_huong_tich_chua_huong.jpg`, `05_chi_tiet_mo_rong/78_chua_thien_tru_tam_bao.jpg`, `05_chi_tiet_mo_rong/107_thuyen_nan_suoi_yen.jpg`.
- **Mở rộng kích thước & không gian**:
  - **Chùa Thiên Trù**: hiện mới có cổng Tam Quan/Gác Chuông; **mở rộng thêm sân chùa `36×28m`** phía sau với **Điện Tam Bảo (Bếp Trời)** 2 tầng mái đao hoành tráng (`22×14×13m`, `78_chua_thien_tru_tam_bao.jpg`) và **Tháp Viên Công** bằng gạch nung chạm nổi.
  - **Động Hương Tích**: mở rộng từ vòm nông `5.8m` thành **lòng động sâu `28m × rộng 26m × cao 18m`** hình hàm rồng mở rộng có lối bậc đá 120 bậc đi xuống lòng động (`52_dong_huong_tich_chua_huong.jpg`).
  - **Suối Yến**: bổ sung **Cầu Hội** (cầu đá vòm sơn đỏ/trắng vắt ngang dòng suối) và mở rộng bến đò Đức Khê.
- **Hoa văn & Họa tiết**:
  - Vách đá cửa động khắc 5 đại tự Hán nổi ánh vàng `"NAM THIÊN ĐỆ NHẤT ĐỘNG"` (bút tích Tĩnh Đô Vương Trịnh Sâm) trực tiếp lên vòm đá thay cho thanh hộp rời.
  - Lòng động bổ sung hệ **nhũ đá hữu cơ ẩm ướt** (*Đụn Gạo* hình tháp lớn rủ rêu xanh ở trung tâm động như ảnh `52_dong_huong_tich_chua_huong.jpg`, *Cây Vàng, Cây Bạc, Bầu Sữa Mẹ*) với shader đá ướt lấp lánh.
  - Sửa Bug B5: lá hoa súng màu xanh lục khuyết V + hoa súng cánh nhọn hồng rực nở dọc hai bờ Suối Yến.
- **Đồ vật & Đời sống**:
  - Nâng cấp 6 chiếc đò nan thành **12 chiếc đò nan hoạt động có chuyển động dập dềnh/trôi nhẹ** trên Suối Yến (tách khỏi static mesh), có mái chèo, sạp tre, ô che nắng nhiều màu & hành khách đội nón lá (`107_thuyen_nan_suoi_yen.jpg`).
  - Trong động & sân chùa: tượng Quan Âm bằng đá xanh điêu khắc chuẩn, bàn thờ lễ vật (oản, hoa cúc, nến đỏ), hòm công đức, đèn lồng đỏ, rặng **cây hoa mơ rừng nở trắng** hai bên bậc đá lên động.

---

#### 10. Đền Hùng — Núi Nghĩa Lĩnh (`(-195, -210)` · `vietnamNorthBuilder.ts`)
- **Ảnh tham chiếu**: `01_mien_bac/10_den_hung_nghia_linh.jpg`, `04_hoa_van_hoa_tiet/65_cong_nghi_mon_den_hung.jpg`, `05_chi_tiet_mo_rong/79_den_thuong_den_hung.jpg`.
- **Mở rộng kích thước & không gian**:
  - Kéo dài tuyến hành hương núi Nghĩa Lĩnh từ `42m` lên **`78m`** (`exclusion` mở rộng dọc trục ĐN), bổ sung **Đền Trung** (sân `18×14m` giữa dốc bậc đá) và **Đền Giếng** (mái đao bên giếng Ngọc phía chân núi) tạo đủ tầng bậc linh thiêng lên tới Đền Thượng & Lăng Vua Hùng.
  - Mở rộng sân Đền Thượng từ `18×14m` lên **`24m × 18m`**.
- **Hoa văn & Họa tiết**:
  - **Cổng Đền Hùng & Nghi Môn** (`65_cong_nghi_mon_den_hung.jpg`): thay nghê đá/kỳ lân khối cục bằng tượng **Nghê chầu & Kỳ Lân điêu khắc sắc nét**; chữ `"Cao Sơn Cảnh Hành"` khắc rõ trên bức đại tự; hàng bậc đá ong có rồng đá chạm mây dẫn lên tiền tế.
  - **Đền Thượng** (`79_den_thuong_den_hung.jpg`): mở ô thoáng chạm chữ Thọ/mây ở tầng cổ diêm (thay hộp kín), cửa bức bàn gỗ lim chạm tứ quý, đỉnh mái gắn rồng chầu mặt trời & đầu đao chạm phượng.
  - **Cột Đá Thề**: tạo đúng dáng trụ đá vát chóp nhọn có bệ đá vuông & hàng rào lan can đá thấp xung quanh.
- **Đồ vật & Đời sống**:
  - Tái sử dụng **Đỉnh đồng** & **Đôi Hạc đồng chầu quy** chi tiết cao + khói hương bay lên từ sân Đền Thượng & Lăng Vua Hùng; thêm **cây vạn tuế / chậu si cổ thụ**, đèn đá sân vườn kiểu cổ (`65_cong_nghi_mon_den_hung.jpg`), kiệu rước sơn son thếp vàng & trống đồng đặt trong tiền tế.

---

### NHÓM B — MIỀN TRUNG & TÂY NGUYÊN (`vietnamCentralBuilder.ts` & `VietnamHeritageScene.ts`)

---

#### 11. Cầu Vàng & Bàn Tay Khổng Lồ — Bà Nà Hills (`x ∈ [-75, +75], z = -145` · `VietnamHeritageScene.ts`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/16_cau_vang_ba_na.jpg`, `04_hoa_van_hoa_tiet/48_ban_tay_cau_vang_detail.jpg`, `05_chi_tiet_mo_rong/85_cau_vang_loi_di_hoa.jpg`.
- **Mở rộng kích thước & không gian**:
  - Giữ chiều dài chuẩn 1:1 `150m`, **mở rộng bề rộng lối đi** từ `4.8m` lên `5.6m` để bố trí đủ **2 dải bồn hoa Cúc Lobelia tím** hai bên.
  - **Bổ sung 2 đầu kết nối thực tế** (hiện đang cụt lủn vào vách núi): Đầu Tây dựng **Ga Cáp Treo Marseille** phong cách lâu đài đá châu Âu mái ngói xanh + 1 trụ cáp treo & 2 cabin treo lơ lửng; Đầu Đông dựng **Cổng Vườn Hoa Le Jardin d'Amour** với bậc thang đá & vòm hoa.
- **Hoa văn & Họa tiết**:
  - **Đôi Bàn Tay Khổng Lồ** (`48_ban_tay_cau_vang_detail.jpg`, `85_cau_vang_loi_di_hoa.jpg`): nâng cấp hoàn toàn giải phẫu điêu khắc — các **đốt ngón tay phân khớp rõ ràng**, **móng tay đá**, **nếp gấp lòng bàn tay & cổ tay**, **vết nứt phong hóa sâu** và rêu xanh mọc ở kẽ đá (thay cho ống trơn hiện tại).
  - **Kết cấu thân cầu chuẩn thực tế**: thay tấm kính mờ bằng **lan can ống thép mạ vàng bóng song mảnh** đúng đời thực + **vỏ ốp sườn cầu thép mạ vàng uốn lượn khoét lỗ** + **8 trụ thép đỡ thanh mảnh** dọc nhịp cầu + sửa Bug B4 (mố cầu bằng đá granit chứ không phải gỗ teak).
- **Đồ vật & Đời sống**:
  - **Dải hoa Cúc Lobelia tím biếc** chạy liên tục `150m` dọc 2 mép sàn gỗ merbau (`85_cau_vang_loi_di_hoa.jpg`); đèn LED hắt gầm lan can vàng ấm; làn mây sương trôi ngang qua kẽ ngón tay đá.

---

#### 12. Cố Đô Huế — Ngọ Môn, Lầu Ngũ Phụng, Cầu Trung Đạo & Kỳ Đài (`(-185, 42)` · `vietnamCentralBuilder.ts`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/17_ngo_mon_hue.jpg`, `04_hoa_van_hoa_tiet/40_mai_dao_long_phuong_hue.jpg`, `05_chi_tiet_mo_rong/82_ngo_mon_lau_ngu_phung.jpg`, `04_hoa_van_hoa_tiet/54_cuu_dinh_dai_noi_hue.jpg`, `05_chi_tiet_mo_rong/83_cuu_dinh_phu_dieu.jpg`.
- **Mở rộng kích thước & không gian**:
  - **Ngọ Môn & Lầu Ngũ Phụng**: giữ bề ngang `58m`, **tăng chiều sâu cánh chữ U** lên `34m` và nâng đỉnh mái lên `21m` (`exclusion r = 46m`).
  - **Kỳ Đài (Phu Văn Lâu & Cột Cờ Huế)**: **nâng cấp từ `24m` lên chuẩn `42m`** (3 tầng đài gạch đồ sộ `17.5m` + kỳ đài gỗ/thép `24.5m` + lá cờ lớn) và dời tách ra phía trước quảng trường đúng trục thần đạo (không nhét sát cánh trái Ngọ Môn).
  - Bổ sung **bậc thang đá có lan can rồng** ở mặt sau hai cánh chữ U để người chơi đi bộ lên thẳng sàn Lầu Ngũ Phụng.
- **Hoa văn & Họa tiết**:
  - **Sửa hình dáng 5 cửa Ngọ Môn chuẩn lịch sử** (`82_ngo_mon_lau_ngu_phung.jpg`): 3 cửa giữa (*Ngọ Môn, Tả/Hữu Giáp Môn*) là **cửa khung vuông/trabeated đá thanh** có cánh gỗ sơn son gắn **đinh đồng nổi hàng lối**, 2 cửa ngoài (*Tả/Hữu Dịch Môn*) mới là **cửa vòm cuốn** thụt vào trong 2 cánh chữ U.
  - **Lầu Ngũ Phụng** (sửa Bug B2): mở 2 tầng lầu cánh trong để lộ hoàn toàn **Đại Hồng Chung** và **Trống Sấm**; chạm khắc **Lưỡng long chầu nguyệt & 9 chim phượng hoàng** khảm sành sứ trên 9 bộ mái hoàng lưu ly (giữa) và thanh lưu ly (cánh) (`40_mai_dao_long_phuong_hue.jpg`); lan can tầng lầu dùng **gạch hoa gốm lưu ly xanh thủng chữ Vạn `卍`** thay tấm đặc.
  - **Cầu Trung Đạo & Tứ Trụ Nghi Môn**: trụ biểu đỉnh gắn **tượng Nghê đồng / búp sen pháp lam**, thân trụ ốp **hoa văn pháp lam xanh-vàng**; mặt hồ Thái Dịch có shader sóng nước sống động.
- **Đồ vật & Đời sống**:
  - Bổ sung **Hàng Cửu Đỉnh thu nhỏ / 4 Vạc Đồng cung đình** chạm phù điêu nổi (`54_cuu_dinh_dai_noi_hue.jpg`, `83_cuu_dinh_phu_dieu.jpg`), **18 Thần Công (khẩu súng thần công thời Nguyễn)** đặt trên giá gỗ 2 bên sân Kỳ Đài, súng lệnh, tán lọng thêu rồng chi tiết (có tua rủ & đỉnh hồ lô), ngai rồng chạm tay vịn rồng, hoa sen nở đầy hồ Thái Dịch, đèn lồng cung đình hình lục giác hắt sáng vàng đêm.

---

#### 13. Phố Cổ Hội An & Chùa Cầu (`(175, 45)` · `vietnamCentralBuilder.ts` & `vietnamReferenceShowBuilder.ts`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/19_chua_cau_hoi_an.jpg`, `02_mien_trung_tay_nguyen/20_pho_co_hoi_an_den_long.jpg`, `04_hoa_van_hoa_tiet/44_den_long_hoi_an_detail.jpg`, `04_hoa_van_hoa_tiet/55_mat_cua_hoi_an.jpg`, `04_hoa_van_hoa_tiet/56_tuong_khi_cho_chua_cau_hoi_an.jpg`, `05_chi_tiet_mo_rong/84_pho_hoi_an_mat_tien.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng khu phố cổ từ `46×70m` (chỉ 8 nhà rời rạc) lên **`76m × 110m`** (`exclusion r = 52m`) với **16–20 ngôi nhà ống mặt tiền hẹp (`4.5–5.5m`) xây sát tường liền kề nhau** đúng đặc trưng đường Trần Phú / Nguyễn Thái Học (`84_pho_hoi_an_mat_tien.jpg`), có thêm **con hẻm nhỏ tường vàng sâu hun hút** và **bến bậc đá xuống sông Hoài**.
- **Hoa văn & Họa tiết**:
  - **Chùa Cầu (Lai Viễn Kiều)** (`19_chua_cau_hoi_an.jpg`, `56_tuong_khi_cho_chua_cau_hoi_an.jpg`): sửa Bug B8 — **đẩy gian thờ Bắc Đế Trấn Võ nhô lệch sang phía Bắc** (mặt bằng chữ T) mở thông hoàn toàn lối đi bộ cong qua cầu; uốn mái ngói âm dương ôm theo độ cong cầu; gắn bảng hoành phi `"LAI VIỄN KIỀU"` chạm nổi; thay 2 cặp tượng hình trụ bằng **tượng Chó & Khỉ gỗ chạm khắc rõ đầu/tai/chân** ngồi trên bệ gỗ đặt hai đầu cầu; thêm **dãy cửa sổ con tiện gỗ** dọc 2 vách hành lang cầu & **đĩa gốm/tượng gốm trang trí bờ nóc**.
  - **Nhà cổ Hội An** (`55_mat_cua_hoi_an.jpg`, `84_pho_hoi_an_mat_tien.jpg`): tường vàng nghệ có **lớp vữa loang rêu mốc cổ kính**; **Mắt cửa Hội An** bát giác chạm khắc treo đôi trên cửa gỗ ván lùa (*cửa bàn khoa*); biển hiệu gỗ nền đen chữ vàng nghệ thuật; mái ngói âm dương rêu phủ có bờ nóc giật cấp kiểu *tường hồi giật bậc*; ban công gỗ con tiện & cửa chớp xanh/nâu.
- **Đồ vật & Đời sống**:
  - Mở rỗng tầng trệt 4–6 căn làm **cửa hiệu đèn lồng lụa** (treo kín 20–30 kiểu đèn tròn, tỏi, kim cương, lục giác đa họa tiết — `44_den_long_hoi_an_detail.jpg`), **tiệm may áo dài**, **quán trà Mót / quán cà phê vỉa hè** (bàn ghế gỗ thấp, phin cà phê, chậu sen); **giàn hoa giấy đa tầng cánh mịn** leo mái hiên (thay khối `Dodecahedron` thô); **4–6 chiếc thuyền gỗ chèo hoa đăng** có mũi treo đèn lồng lướt trên sông Hoài.

---

#### 14. Cầu Rồng — Đà Nẵng (`(335, -35)` · `vietnamCentralBuilder.ts`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/21_cau_rong_da_nang.jpg`, `04_hoa_van_hoa_tiet/57_dau_rong_cau_rong_da_nang.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng chiều dài cầu từ `214m` lên **`310m`** (tỷ lệ gần 1:2 với thực tế `666m`), bề rộng mặt cầu từ `18m` lên **`26m`** (đủ 4 làn xe + dải phân cách giữa + 2 lề đi bộ rộng `2.5m`), đỉnh vòm rồng nâng từ `26m` lên **`32m`**.
  - Bổ sung **Công viên bờ Đông Sông Hàn** sát đầu rồng: **Tượng Cá Chép Hóa Rồng** bằng đá trắng phun nước & **Cầu Tình Yêu** treo hàng trăm đèn lồng hình trái tim đỏ.
- **Hoa văn & Họa tiết**:
  - **Thân Rồng kết cấu 5 ống thép không gian**: thay 1 ống đơn điệu bằng **hệ dàn 5 ống thép mạ vàng** (1 ống đỉnh + 2 ống giữa + 2 ống bụng) liên kết bằng **thanh giằng tam giác không gian** chạy suốt 5 nhịp vòm; sửa Bug B9 để toàn bộ dây cáp treo bám khít đáy vòm.
  - **Đầu Rồng thời Lý cách điệu** (`57_dau_rong_cau_rong_da_nang.jpg`): thay hộp khối vuông bằng **các tấm thép cắt uốn lượn xếp vảy**, bờm lửa nhọn tỏa tròn quanh đầu, sống mũi lượn, răng nanh, **đôi mắt LED hình trái tim** phát sáng chuyển màu.
  - **Đuôi Rồng hình Búp Sen cách điệu**: dựng cụm cánh hoa sen thép vàng tỏa nở ở đuôi cầu phía Tây (thay đuôi côn trơn).
- **Đồ vật & Đời sống**:
  - **Hệ thống 2.500 đèn LED đổi màu** theo chu kỳ (Vàng hoàng kim -> Xanh ngọc -> Đỏ rực -> Tím) bằng shader dọc thân rồng; **chu kỳ phun Lửa & phun Nước xen kẽ** (tự động đổi giữa tia lửa cam rực và luồng sương nước trắng cầu vồng); mặt cầu nhựa đường kẻ vạch phân làn + hàng cột đèn đường cong hiện đại.

---

#### 15. Hang Sơn Đoòng — Quảng Bình (`(365, -205)` · `vietnamCentralBuilder.ts`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/22_hang_son_doong.jpg`, `04_hoa_van_hoa_tiet/58_hang_son_doong_hand_of_dog_doline.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng từ 1 buồng tròn `115m` (đang bị chật & đâm thủng vách — Bug B3) thành **đại hành lang hang động kéo dài `220m × rộng 130m × cao 105m`** (`exclusion r = 82m`) chia đúng 2 hố sụt:
    - **Hố sụt 1 (*Watch Out for Dinosaurs*)**: giếng trời đường kính `45m`, khối thạch nhũ **Bàn Tay Của Chàng (*Hand of Dog*) cao `68m`** vươn lên trong tia nắng.
    - **Hố sụt 2 (*Vườn Địa Đàng — Garden of Edam*)**: giếng trời rộng `58m`, khu rừng nguyên sinh tán cây cao `22–30m` mọc dày đặc trên sườn đá sụp (`58_hang_son_doong_hand_of_dog_doline.jpg`).
    - **Cuối hang**: **Bức Tường Việt Nam (*Great Wall of Vietnam*) cao `80m`** nằm gọn bên trong vòm trần `105m`, có thang dây & dây thừng leo núi chuẩn thám hiểm Oxalis.
- **Hoa văn & Họa tiết**:
  - Đa dạng hóa địa chất hang (bỏ vật liệu `granite` xám đồng nhất): thêm **vân đá vôi chảy canxit màu kem/vàng đất ẩm bóng**, **hệ thống ruộng bậc thang hồ nhũ (*gour pools / rimstone pools*)** chứa nước xanh ngọc, **nhũ đá rủ trần (*stalactites*) 80–120 trụ** dài `6–18m` có rãnh chảy dọc, rêu xanh & dương xỉ phủ kín miệng hố sụt.
- **Đồ vật & Đời sống**:
  - **Trại thám hiểm bãi cát tự nhiên** (bỏ hình hộp cát vuông): 6 lều vòm có tấm phủ mưa (*rainfly*) mở cửa để thấy đèn pin vàng ấm hắt sáng ra ngoài (sửa Bug B3), lều bếp ăn bạt dã chiến, bàn gấp, thùng thiết bị nhôm, mũ bảo hộ có đèn trán, dây leo núi; **ngọc động (*cave pearls*)** trắng tròn trong hồ canxit; **dòng sông ngầm Rào Thương** chảy róc rách + **mây mù cuộn bay** xuyên qua 5 cột nắng thể tích khổng lồ.

---

#### 16. Động Phong Nha — Kẻ Bàng (`(275, -255)` · `vietnamCentralBuilder.ts`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/23_dong_phong_nha.jpg`, `05_chi_tiet_mo_rong/92_phong_nha_thuyen_dong.jpg`.
- **Mở rộng kích thước & không gian**:
  - Kéo dài lòng động sông ngầm từ `42m` lên **`95m`** (uốn cong nhẹ chữ S để không nhìn thấy bức tường đen chặn cụt), nâng khối núi đá vôi mặt tiền từ `29m` lên **`55m`** phủ rừng xanh & dây leo rủ xuống cửa động (`23_dong_phong_nha.jpg`, `92_phong_nha_thuyen_dong.jpg`).
  - Mở rộng bên trong thành **2 buồng hang nổi tiếng (Hang Bi Ký & Hang Cung Đình)** có bãi cát ngầm bên bờ để du khách đi bộ tham quan.
- **Hoa văn & Họa tiết**:
  - Thay toàn bộ 62 hình nón 6 cạnh trơ lì bằng **nhũ đá điêu khắc hữu cơ** (màn rèm đá vôi *curtains*, cột nhũ tầng *stalagnates*, nhũ rủ rãnh nhỏ giọt) có **vật liệu ướt ánh tinh thể** phản chiếu đèn rọi đa sắc (vàng hổ phách, xanh ngọc, cam ấm) chiếu từ dưới lên.
- **Đồ vật & Đời sống**:
  - Thay thuyền hộp gỗ đặc thành **3 chiếc thuyền du lịch Phong Nha đặc trưng** (thân dài `11m` sơn xanh dương-trắng, mái vòm bạt che nắng có khung ống, hàng ghế gỗ 2 bên, áo phao cam treo mạn, đèn rọi mũi, dây thừng neo bến); lối đi cầu gỗ có đèn hắt sát vách hang Bi Ký; bến thuyền có mái che & biển hiệu *"ĐỘNG PHONG NHA"*.

---

#### 17. Thánh Địa Mỹ Sơn — Quảng Nam (`(-320, -135)` · `vietnamCentralBuilder.ts`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/24_thanh_dia_my_son.jpg`, `04_hoa_van_hoa_tiet/41_cham_khac_thap_cham.jpg`, `05_chi_tiet_mo_rong/86_my_son_thap_cham_chi_tiet.jpg`, `05_chi_tiet_mo_rong/86b_my_son_cua_gia_gach.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng khu đền tháp từ sân `38×38m` (3 tháp) lên **quần thể Khu B–C–D rộng `68m × 62m`** (`exclusion r = 42m`), bao quanh bởi **tường thành gạch Chăm cổ đổ nát** và **suối Khe Thẻ** uốn lượn.
  - **Bổ sung công trình thiếu đặc trưng Mỹ Sơn**: **Tháp Kho (Kosa / B5)** mái cong hình thuyền yên ngựa độc đáo (`86_my_son_thap_cham_chi_tiet.jpg`), **1 tháp phụ bị tàn phá nửa phần** lộ lõi gạch để tôn vẻ phế tích di sản, và **2 nhà trưng bày bia ký sa thạch** có mái ngói.
- **Hoa văn & Họa tiết**:
  - Sửa Bug B10 (3 cổng chồng lấn Tháp A1).
  - Bổ sung **texture gạch Chăm mài chập** nâu đỏ thẫm có mảng rêu đen/xanh & dương xỉ mọc từ khe gạch (`86b_my_son_cua_gia_gach.jpg`); chạm khắc **vòm cuốn lá đề Kala-Makara nhiều lớp**, **cột ốp tường khía rãnh**, **tượng vũ nữ Apsara & nhạc công Gandharva** chạm nổi trên bệ đá sa thạch (`41_cham_khac_thap_cham.jpg`); thay cục đá Dvarapala bằng **tượng Hộ pháp Dvarapala** cầm chùy rõ hình khối.
- **Đồ vật & Đời sống**:
  - Kích hoạt **khói hương GPU** từ lư đồng trong Tiền Sảnh Tháp A1; bổ sung **phế tích đá sa thạch** (đầu tượng Makara, bệ Yoni vỡ, bia chữ Phạn cổ) bày dọc sân gạch; **bó hoa sứ trắng & nhang trầm** đặt trên bệ Linga-Yoni; đèn hắt vàng ấm chiếu lên mặt gạch đỏ lúc hoàng hôn.

---

#### 18. Tháp Chàm Poshanư — Phan Thiết (`(435, 95)` · `vietnamCentralBuilder.ts`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/25_thap_cham_poshanu.jpg`, `05_chi_tiet_mo_rong/87_thap_poshanu_chi_tiet.jpg`.
- **Mở rộng kích thước & không gian**:
  - Nâng cấp từ landmark đơn giản nhất file (66 dòng code) thành **khu đồi Bà Nài rộng `48m × 52m`** (`exclusion r = 32m`) với lối đường lát gạch đỏ uốn lên đồi, tường chắn đất đá chẻ & khoảng sân lễ hội Katê phía trước.
- **Hoa văn & Họa tiết**:
  - Tạo riêng hình khối **phong cách kiến trúc Hòa Lai đặc trưng** (`87_thap_poshanu_chi_tiet.jpg`): cửa giả vòm rộng uốn nhiều lớp hình cung nhọn, tầng mái vuông giật cấp mềm mại (không dùng chóp nhọn `kalasa` sắc như bản generic), **đục thông cửa vòm phía Đông Tháp A** đi vào lòng tháp rỗng.
  - Bổ sung lanh-tô sa thạch, rêu phong gạch đỏ nung gió biển Bình Thuận.
- **Đồ vật & Đời sống**:
  - Trong lòng Tháp A đặt **Bệ thờ Linga-Yoni đá đen nguyên khối**, mâm lễ vật hoa cúc/trầu cau, lư hương có khói & đèn dầu; ngoài sân bổ sung **cây hoa sứ (đại) dáng cổ thụ**, **xương rồng thanh long / dứa dại ven biển**, trống Paranưng & kèn Saranai trưng bày lễ hội Katê, hệ thống đèn hắt đá chân tháp.

---

#### 19. Đà Lạt — Đỉnh Langbiang & Thung Lũng Tình Yêu (`(-375, 165)` · `vietnamCentralBuilder.ts`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/26_da_lat_langbiang.jpg`, `05_chi_tiet_mo_rong/88_thung_lung_tinh_yeu_langbiang.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng từ 1 sân tròn `30m` trơ trọi thành **khu cao nguyên rộng `72m × 68m`** (`exclusion r = 40m`) gồm 2 vùng liên kết:
    1. **Đỉnh Radar Langbiang**: sân ngắm cảnh bậc đá có lan can nối kín, **Tượng đôi tình nhân K'Lang & H'Biang cao `5.5m`** trên bệ đá, **cổng biển chữ `"LANGBIANG 1.929m"`** và bãi đỗ **2 chiếc xe Jeep mui trần cổ màu xanh rêu** đặc trưng (`88_thung_lung_tinh_yeu_langbiang.jpg`).
    2. **Góc Thung Lũng Tình Yêu & Hồ Đa Thiện**: hồ nước nhỏ `30×22m` có bến gỗ, **cầu gỗ vòm hoa trái tim**, **biệt thự gỗ kiểu Pháp cổ mái ngói ống khói đá**.
- **Hoa văn & Họa tiết**:
  - Thay 2 hình nón thô của chòi lục giác thành **chòi gỗ mái ngói cong có vì kèo & hoa văn chạm đầu cột**; thay thông hình nón Giáng Sinh thành **Thông Ba Lá Đà Lạt (*Pinus kesiya*)** thân cao vút thẳng tắp, cành tán ô thưa đặc trưng cao nguyên; hoa cẩm tú cầu nhiều chùm cánh xanh-tím-hồng thay hình cầu trơn.
- **Đồ vật & Đời sống**:
  - **2–3 chiếc thuyền đạp vịt thiên nga trắng** trên hồ Đa Thiện; **cổng hoa hình trái tim** kết hoa hồng/cẩm tú cầu; hàng **cây Mai Anh Đào nở hoa hồng phấn** & **bụi Hoa Dã Quỳ vàng rực** ven đường đất đỏ; đèn lồng/đèn cột kiểu Pháp cổ chiếu sáng ấm trong làn sương lạnh Đà Lạt.

---

#### 20. Biển Hồ T'Nưng — Pleiku & Làng Nhà Rông Tây Nguyên (`(-404..-455, 42)` · `vietnamCentralBuilder.ts`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/27_bien_ho_tnung.jpg`, `04_hoa_van_hoa_tiet/42_tho_cam_tay_nguyen.jpg`, `04_hoa_van_hoa_tiet/43_nha_rong_tay_nguyen.jpg`, `05_chi_tiet_mo_rong/89_nha_rong_kon_tum.jpg`, `05_chi_tiet_mo_rong/90_tuong_nha_mo_tay_nguyen.jpg`, `05_chi_tiet_mo_rong/91_cong_chieng_tay_nguyen.jpg`.
- **Mở rộng kích thước & không gian**:
  - **Biển Hồ T'Nưng**: mở rộng đường kính miệng núi lửa từ `85m` lên **`125m`** với **hàng thông cổ thụ chạy dọc con đường đá dẫn thẳng ra hồ** và **Nhà Lồng Biển Hồ (lầu lục giác trắng mái ngói đỏ + tượng Phật Quan Âm trắng)** vươn ra mặt nước xanh ngọc (`27_bien_ho_tnung.jpg`).
  - **Làng Nhà Rông**: nâng mái Nhà Rông lên **cao `23m`** (chuẩn Nhà Rông Kon Klor — `89_nha_rong_kon_tum.jpg`), mở rộng sân sinh hoạt cộng đồng `42×36m` (`exclusion r = 28m`), bổ sung **2 nhà sàn dài Ê-đê/Ba Na nhỏ** và **1 khu Nhà Mồ với hàng rào tượng gỗ Tây Nguyên** (`90_tuong_nha_mo_tay_nguyen.jpg`).
- **Hoa văn & Họa tiết**:
  - **Sửa Bug B11**: bịt kín 2 đầu hồi mái lưỡi rìu cao `12.6m` bằng **phên tre đan họa tiết hình thoi thổ cẩm đen-đỏ-trắng**, tăng độ nhám & thớ sợi lá tranh (`thatch normal/roughness map`); gắn **diềm gỗ chạm sừng trâu & mặt trời** trên sống mái.
  - **Cầu thang độc mộc Ba Na/Ê-đê**: thay cầu thang bậc hộp thành **2 thân gỗ nguyên khối đẽo bậc** có chạm nổi **đôi bầu sữa mẹ & trăng khuyết** ở đầu thang.
  - **Cây Nêu lễ hội**: bổ sung chùm **chim thần/mặt trời gỗ sơn đỏ-trắng**, tua rua đan bằng tre cạo mỏng (*bông nêu*) rủ bay trong gió.
- **Đồ vật & Đời sống**:
  - Bổ sung **Trống Hơgơr** (trống da trâu lớn đặt trên giá — đang thiếu dù có comment), bộ **10–12 cồng chiêng đồng có núm sáng** treo trên giá gỗ (`91_cong_chieng_tay_nguyen.jpg`), **chóe rượu cần gốm men nâu chạm rồng** có cần trúc uốn cong, **ngọn lửa & khói bếp nhà rông** chuyển động, **tượng gỗ nhà mồ** (tượng người chống cằm suy tư, vợ chồng, khỉ — `90_tuong_nha_mo_tay_nguyen.jpg`), **2 chiếc thuyền độc mộc** neo bờ Biển Hồ T'Nưng.

---

### NHÓM C — MIỀN NAM & HẢI ĐẢO (`vietnamSouthBuilder.ts`)

---

#### 21. Chợ Bến Thành — TP. Hồ Chí Minh (`(-108, 190)` · `vietnamSouthBuilder.ts`)
- **Ảnh tham chiếu**: `03_mien_nam_hai_dao/28_cho_ben_thanh.jpg`, `04_hoa_van_hoa_tiet/59_phu_dieu_gom_cho_ben_thanh.jpg`, `05_chi_tiet_mo_rong/93_cho_ben_thanh_ben_trong.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng diện tích chợ từ `76×43m` (~28% thực tế) lên **`104m × 72m`** (`~7.500 m²`, gần 60% thực tế `130×100m`, `exclusion r = 64m`), giữ tháp đồng hồ cao `28.5m`.
  - **Mở thông cả 4 cửa Đông – Tây – Nam – Bắc** với **2 trục hành lang chữ thập đi xuyên lòng chợ** (bỏ tường hộp đen chặn cửa Đông/Tây/Nam).
  - Bổ sung **dãy vòm hành lang & mái che xanh lục** dọc đầy đủ mặt Đông & Tây (hiện đang trơ bức tường vàng phẳng lì) + **tiểu đảo công trường Quách Thị Trang** phía trước cửa tháp đồng hồ có đèn đường cổ & bồn hoa.
- **Hoa văn & Họa tiết**:
  - **Biển chữ `"CHỢ BẾN THÀNH"`** nổi 3D chuẩn phông chữ thực tế (`59_phu_dieu_gom_cho_ben_thanh.jpg`) ngay dưới mặt đồng hồ.
  - **4 Bộ Phù Điêu Gốm Biên Hòa nổi tiếng** (tác phẩm điêu khắc gia Lê Văn Mậu) ở 4 cửa: nải chuối & cá đuối (Cửa Nam), bò & vịt (Cửa Bắc), cà phê & lúa (Cửa Đông), hoa sen & cá (Cửa Tây) — dựng khung nổi + texture gốm men xanh-vàng-nâu bóng.
  - **Tháp Đồng Hồ**: thay ô vuông đen bằng **cửa chớp lá sách thông gió thật** & lan can con tiện quanh tháp, đồng hồ chạy giờ động hoặc kim nổi sắc nét.
- **Đồ vật & Đời sống**:
  - **Nội thất sầm uất chuẩn thực tế** (`93_cho_ben_thanh_ben_trong.jpg`): sàn gạch bông ô vuông xám-trắng; khung vì kèo thép mái lộ thiên; **24–32 sạp hàng chi tiết** (sạp vải & áo dài treo móc, sạp nón lá xếp chồng, sạp trái cây nhiệt đới/sầu riêng/thanh long, sạp cà phê rang xay với bao tải đay & phin nhôm, quầy phở/bún bò có nồi nước lèo bốc khói, ghế nhựa đỏ-xanh, biển hiệu sạp hàng nhiều màu, đèn huỳnh quang & đèn vàng ấm).

---

#### 22. Dinh Độc Lập — TP. Hồ Chí Minh (`(0, 250)` & `(0, 195)` · `vietnamSouthBuilder.ts`)
- **Ảnh tham chiếu**: `03_mien_nam_hai_dao/29_dinh_doc_lap.jpg`, `04_hoa_van_hoa_tiet/60_rem_dot_truc_dinh_doc_lap.jpg`, `05_chi_tiet_mo_rong/94_dinh_doc_lap_xe_tang.jpg`, `05_chi_tiet_mo_rong/95_dinh_doc_lap_truc_thang.jpg`.
- **Mở rộng kích thước & không gian**:
  - Giữ khối dinh chính 1:1 (`92×36×26m`), **mở rộng công viên bãi cỏ phía trước** từ `100×70m` lên **`136m × 105m`** (kéo về phía Bắc tới `local z = -118m`, `exclusion` cập nhật bao trọn cổng sắt) và thêm **khối hậu cung chữ T** phía sau.
  - **Đường xe vào vòng cung bán nguyệt** ôm quanh đài phun nước hình bầu dục (sửa đường hộp thẳng đâm xuyên hồ).
  - **Bổ sung hàng rào sắt rèn di sản + Cổng Chính Dinh Độc Lập** (nơi xe tăng húc đổ ngày 30/4/1975) cùng 2 nhà gác trắng mái bằng.
- **Hoa văn & Họa tiết**:
  - **Rèm hoa đá đốt trúc (*Brise-soleil*)** (`60_rem_dot_truc_dinh_doc_lap.jpg`): thay 41 thanh hộp phẳng bằng **các thanh bê tông đúc uốn eo tạo đốt trúc & đầu vát cong thanh thoát** theo đúng thiết kế kiến trúc sư Ngô Viết Thụ.
  - **Tranh Sơn Mài đại sảnh**: áp tranh sơn mài vẽ phong cảnh làng quê/Sơn Hà Xã Tắc (thay hộp đỏ trơn); gắn quốc huy/hoa văn nổi trên mái đón; thêm khung cửa kính chia ô nhôm ở các cánh bên & sân thượng trồng bồn cây cảnh (`60_rem_dot_truc_dinh_doc_lap.jpg`).
- **Đồ vật & Đời sống**:
  - **2 Xe Tăng lịch sử T-54B số hiệu `843` & Type-59 số hiệu `390`** đỗ trên bãi cỏ rợp bóng cổ thụ (`94_dinh_doc_lap_xe_tang.jpg`): đầy đủ bánh xích 5 bánh đỡ, tháp pháo vòm đúc, nòng pháo 100mm, súng máy nóc, thùng nhiên liệu phụ & số hiệu trắng sắc nét.
  - **Trực thăng UH-1 Iroquois (Huey)** đỗ trên sân thượng đáp trực thăng (`95_dinh_doc_lap_truc_thang.jpg`): thân rằn ri/xanh ô-liu, buồng lái kính, 2 càng đáp trượt, cánh quạt chính 2 lá & cánh quạt đuôi + **2 vòng tròn đỏ đánh dấu vị trí bom 8/4/1975** trên sân thượng.
  - **Tia nước phun động** tung bọt trắng tại hồ bán nguyệt trước dinh; hàng cây dầu cổ thụ tỏa bóng dọc cổng sắt.

---

#### 23. Nhà Thờ Đức Bà — Sài Gòn (`(108, 190)` & `(108, 144)` · `vietnamSouthBuilder.ts`)
- **Ảnh tham chiếu**: `03_mien_nam_hai_dao/30_nha_tho_duc_ba_saigon.jpg`, `04_hoa_van_hoa_tiet/61_nha_tho_duc_ba_rose_window_statue.jpg`, `05_chi_tiet_mo_rong/96_nha_tho_duc_ba_cua_chinh.jpg`.
- **Mở rộng kích thước & không gian**:
  - Kéo dài chiều dài tổng thể nhà thờ từ `80.8m` lên đúng **1:1 `93.0m`** (`exclusion r = 54m`), giữ bề rộng `35.5m` & chiều cao 2 tháp chuông `60.5m`.
  - Mở rộng **Công viên Công Xã Paris** phía trước bao quanh Tượng Đức Mẹ Hòa Bình thành **quảng trường gạch đỏ hình bầu dục** có 4 vườn hoa hình quạt & đường đi dạo.
- **Hoa văn & Họa tiết**:
  - **Sửa Bug B14**: loại bỏ thánh giá trùng trên 2 chóp nhọn; bổ sung **cổ tháp lưới sắt đúc hoa văn Gothic**, **cửa sổ mái nhỏ (*dormer lucarnes*)** trên chóp bát giác và **tháp nhọn giữa mái giao nhau (*flèche*)**.
  - **Mặt tiền gạch đỏ Marseille** (`96_nha_tho_duc_ba_cua_chinh.jpg`): bổ sung **cửa sổ vòm đôi Romanesque (*bifora*)** ở 2 tầng tháp chuông (thay hình chữ nhật đen), **phù điêu tam giác (tympanum)** trên 3 cửa chính, **cửa sổ vòm tròn có gờ đá trắng & chóp tam giác** chạy dọc toàn bộ 2 hông nhà thờ (thay hình chữ nhật phẳng).
  - **Nội thất giáo đường**: chuyển trần phẳng thành **hệ vòm cuốn gân giao nhau (*ribbed groin vault*)** đúng phong cách Roman–Gothic, bổ sung **cửa sổ kính màu họa tiết các Thánh** phát sáng rực rỡ.
- **Đồ vật & Đời sống**:
  - **Tượng Đức Mẹ Hòa Bình bằng đá cẩm thạch trắng** (`61_nha_tho_duc_ba_rose_window_statue.jpg`): điêu khắc lại chuẩn dáng — áo choàng rủ nếp mềm mại, **tay nâng Quả Địa Cầu có thánh giá** trên bệ đá hoa cương vuông có khắc dòng chữ Latinh *"REGINA PACIS ORA PRO NOBIS"*.
  - Đàn **chim bồ câu trắng** tụ tập & bay quanh quảng trường; **đèn đường gang kiểu Paris cổ**, ghế gỗ công viên, chậu hoa giấy & cây sao đen ven quảng trường.

---

#### 24. Địa Đạo Củ Chi & Đền Tưởng Niệm Bến Dược (`(-255, 270)` · `vietnamSouthBuilder.ts`)
- **Ảnh tham chiếu**: `03_mien_nam_hai_dao/31_dia_dao_cu_chi.jpg`, `04_hoa_van_hoa_tiet/67_ham_bi_mat_cu_chi_detail.jpg`, `05_chi_tiet_mo_rong/97_den_ben_duoc_cu_chi.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng khu di tích từ vòng tre `54m` lên **`96m × 88m`** (`exclusion r = 52m`) chia 2 khu tách bạch:
    1. **Khu Rừng Chiến Khu Địa Đạo**: đường hào giao thông đào âm đất `1.2m` dài `45m`, **1 hầm họp chỉ huy mặt cắt mở** có thể bước xuống xem bên trong (mái lợp gỗ-đất-bao cát), **hố bom B-52** đường kính `12m`.
    2. **Khu Đền Tưởng Niệm Liệt Sĩ Bến Dược** (`97_den_ben_duoc_cu_chi.jpg`): **nâng tháp tưởng niệm từ 3 tầng `22m` lên đúng chuẩn 9 tầng cao `39m`** trên bệ có **4 cầu thang đá bậc tam cấp** (sửa Bug B16) + **Cổng Tam Quan Bến Dược** + **Điện Thờ chính mái đao cong**.
- **Hoa văn & Họa tiết**:
  - **Nắp hầm bí mật ngụy trang** (`67_ham_bi_mat_cu_chi_detail.jpg`): thu nhỏ về đúng kích thước thật **`0.45m × 0.50m`** (hiện đang to gấp 2.5 lần), mép khoét gọn trong lớp lá khô rải tự nhiên; các ụ mối thông hơi đắp hữu cơ sần sùi (thay hình nón đều); lũy tre dùng tán lá tre mảnh mềm (thay hình nón 6 cạnh).
  - Tháp 9 tầng Bến Dược: chạm khắc hoa văn hoa sen trên bệ đá, ngói lưu ly xanh/vàng & câu đối đỏ trên cột.
- **Đồ vật & Đời sống**:
  - **Bếp Hoàng Cầm**: bổ sung **làn khói trắng mỏng là là mặt đất** thoát ra từ ống dẫn khói (đặc sản kỹ thuật quân sự Việt Nam!), **nồi hấp khoai mì (sắn) bốc hơi** + mâm muối mè + ấm nước chè xanh.
  - **Hiện vật chiến tranh thực tế**: **xác xe tăng M41 Mỹ cháy rụi** nằm giữa rừng, **nhà trưng bày bẫy chông tre xoay** có mái lá, **xưởng làm dép cao su (dép râu)** từ lốp xe, võng dù xanh mắc giữa 2 thân cây, lư hương đồng lớn & cờ đỏ sao vàng trước Đền Bến Dược.

---

#### 25. Tháp Bà Ponagar — Nha Trang (`(265, 275)` & `(250, 255)` · `vietnamSouthBuilder.ts`)
- **Ảnh tham chiếu**: `03_mien_nam_hai_dao/32_thap_ba_ponagar.jpg`, `04_hoa_van_hoa_tiet/66_tuong_cham_ponagar_linga_yoni.jpg`, `05_chi_tiet_mo_rong/98_ponagar_mandapa_cot.jpg`.
- **Mở rộng kích thước & không gian**:
  - Giữ Tháp Chính (*Tháp Bắc*) 1:1 `23.0m`, mở rộng sân đồi Cù Lao thêm `10m` về phía Tây Bắc để **bổ sung Tháp Thứ 4 (Tháp Tây Bắc mái cong hình yên ngựa cao `9.5m`)** cho đủ 4 tháp hiện hữu ngoài đời; thêm `exclusion r = 24m` tại `(250, 255)` bao trọn Mandapa & chân cầu thang dưới (hiện đang thiếu nên cỏ/cây mọc đâm vào thang).
  - Bổ sung **tường bao gạch Chăm cổ** quanh khu tháp trên và **nhà trưng bày di sản Chăm** bên hông đồi.
- **Hoa văn & Họa tiết**:
  - **Phù điêu Nữ thần Durga trên vòm cửa Tháp Chính** (`66_tuong_cham_ponagar_linga_yoni.jpg`): nâng cấp thành phù điêu sa thạch lá đề sắc nét diễn tả **Nữ thần 4 tay cầm vũ khí múa trên đầu trâu giữa 2 nhạc công** (thay 3 hộp xếp chồng).
  - **Tượng Bà Thiên Y A Na (Po Nagar)** trong lòng tháp: nâng cấp điêu khắc **10 tay đội mũ Mukuta** trên đài sen chạm cánh chi tiết + áo choàng gấm đỏ thêu chỉ vàng.
  - **Khu Tiền Đình Mandapa** (`98_ponagar_mandapa_cot.jpg`): điều chỉnh đúng bố cục thực tế gồm **10 cột bát giác lớn cao `6.2m` ở giữa** (2 hàng × 5 cột) + **12 cột nhỏ thấp hơn `4.0m` ở vòng ngoài** (tổng 22 cột, thay cho 20 cột bằng nhau hiện tại), đầu cột có lỗ mộng gỗ & vết gạch phong hóa.
- **Đồ vật & Đời sống**:
  - Kết nối **hệ thống khói hương GPU** cho cả 4 đỉnh đồng (hiện chưa bật); đặt **tượng Bò Thần Nandi & chim thần Garuda** bằng đá sa thạch trên bệ sân; **vũ cụ múa Chăm** (quạt, trống Ginăng, bình gốm đội đầu) đặt ở sân biểu diễn Mandapa; **rặng cây hoa sứ trắng-đỏ cổ thụ & cọ cảnh** ôm quanh chân đồi (`98_ponagar_mandapa_cot.jpg`).

---

#### 26. Chợ Nổi Cái Răng — Cần Thơ (`(-72, 365)` & `(-72, 336)` · `vietnamSouthBuilder.ts`)
- **Ảnh tham chiếu**: `03_mien_nam_hai_dao/33_cho_noi_cai_rang.jpg`, `04_hoa_van_hoa_tiet/64_ghe_bau_cay_beo_cai_rang.jpg`, `05_chi_tiet_mo_rong/99_cai_rang_cay_beo.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng khu vực sông chợ nổi từ `80m` lên **`140m` dài × `55m` rộng**, tăng đội ghe thương hồ từ `16` lên **`28–32` chiếc ghe lớn nhỏ** tụm thành cụm bán buôn đông đúc (`99_cai_rang_cay_beo.jpg`).
  - Mở rộng bờ Bắc (`z = 325..338`): dựng **dãy 8 ngôi nhà sàn mái tôn ven sông miền Tây** có cầu khỉ/bến gỗ nhỏ & xa xa thoáng bóng **Cầu Cái Răng** bắc ngang kênh.
- **Hoa văn & Họa tiết**:
  - **Thân ghe bầu & xuồng hủ tiếu**: sửa 2 xuồng hủ tiếu từ hình hộp đặc thành **xuồng tam bản mũi nhọn cong**; khoét **lòng khoang rỗng** cho ghe bầu để lộ hàng trăm trái dưa hấu, khóm (dứa), bí đỏ, bắp cải chất cao có ngọn (`99_cai_rang_cay_beo.jpg`); vẽ **đôi mắt thuyền tròn đỏ-trắng-đen** & **số đăng kiểm ghe `"CT-xxxx"`** ở mũi; mái che uốn lượn có gân tôn sóng & khung tre.
  - **Bến tàu Cái Răng**: thay mái tấm phẳng bằng **mái tôn lợp chữ A có vì kèo** + biển cổng viết rõ chữ `"CHỢ NỔI CÁI RĂNG — CẦN THƠ"`.
- **Đồ vật & Đời sống**:
  - **Cây bẹo đa dạng 6 loại nông sản** (`64_ghe_bau_cay_beo_cai_rang.jpg`): treo khóm, dưa hấu, bí đỏ, bắp cải, nải chuối, bó rau; gắn **máy đuôi tôm** có trục chân vịt dài sau lái; **lốp xe cao su đen** treo dọc mạn chống va đập; **gánh hủ tiếu bốc khói** (tủ kính nhỏ, nồi nước dùng inox, tô, đũa, ghế đẩu đỏ, dù che nắng 7 màu); **đèn măng-xông / bóng đèn dây tóc** thắp sáng trên ghe lúc bình minh & chiều tối.

---

#### 27. Rừng Tràm Trà Sư — An Giang (`(-245, 395)` · `vietnamSouthBuilder.ts`)
- **Ảnh tham chiếu**: `03_mien_nam_hai_dao/34_rung_tram_tra_su.jpg`, `05_chi_tiet_mo_rong/100_tra_su_cau_tre_rung_tram.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng đầm bèo cám từ `88×73m` lên **`126m × 104m`** (`exclusion` bổ sung cho đài quan sát & cổng), tăng số cây tràm trắng từ `240` lên **`360` cây** (`14–19m` cao) tạo mái vòm xanh khép kín dọc kênh rạch (`100_tra_su_cau_tre_rung_tram.jpg`).
  - Kéo dài **Cầu Tre Vạn Bước** uốn lượn từ `55m` lên **`92m`** với **2 chòi nghỉ lục giác mái lá** nằm giữa cầu và **Cổng Tre uốn vòm** khắc chữ `"RỪNG TRÀM TRÀ SƯ"` ở lối vào.
  - **Bổ sung công trình biểu tượng thiếu**: **Đài Quan Sát cao `23m`** (tháp thép/gỗ 4 tầng có cầu thang xoắn & mái che trên đỉnh nhô cao hẳn trên tán rừng tràm).
- **Hoa văn & Họa tiết**:
  - **Cầu Tre**: đan **lan can tre hình chữ X / quả trám** liên tục dọc cầu, lát từng thanh tre ghép có khớp đốt (thay thanh hộp đơn).
  - **Tán cây tràm**: thay 3 tấm phẳng hình chữ X bằng **cụm cành tán hữu cơ đa lớp** + vỏ tràm trắng bong tróc đặc trưng (`100_tra_su_cau_tre_rung_tram.jpg`); thêm **rãnh nước mở sau đuôi xuồng rẽ thảm bèo cám xanh mướt**.
- **Đồ vật & Đời sống**:
  - **4 chiếc Xuồng Ba Lá** + **1 chiếc Tắc Ráng** gắn máy chạy trên kênh chính; **đàn cò trắng / diệc đậu kín trên ngọn cây tràm** kèm tổ chim & 8–12 cánh cò bay vòng trên đầm; **bụi lục bình nở hoa tím**, **bông điên điển vàng**, **hoa súng đỏ** & **rễ tràm / bụi sậy** dọc mép nước; ống nhòm ngắm chim trên Đài Quan Sát 23m.

---

#### 28. Mũi Cà Mau — Cực Nam Tổ Quốc (`(0, 485)` · `vietnamSouthBuilder.ts`)
- **Ảnh tham chiếu**: `03_mien_nam_hai_dao/35_mui_ca_mau.jpg`, `05_chi_tiet_mo_rong/101_mui_ca_mau_con_tau_gps0001.jpg`, `05_chi_tiet_mo_rong/102_rung_duoc_ca_mau.jpg`, `05_chi_tiet_mo_rong/73_cot_co_ha_noi.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng mũi đất Đất Mũi từ `36×65m` lên **`95m × 115m`** (`exclusion r = 46m`) để tách bạch đủ **3 công trình biểu tượng đời thực** (hiện đang gộp sai vào 1 cột lục giác):
    1. **Biểu tượng Con Tàu Mũi Cà Mau** (`101_mui_ca_mau_con_tau_gps0001.jpg`): vươn mũi ra biển phía Nam (`24m` dài × `22m` cao).
    2. **Cột Mốc Tọa Độ Quốc Gia GPS 0001** (dáng **ngôi sao 4 cánh đá hoa cương cao `3.2m`** nằm giữa sân tròn lát gạch) + **Cổng Biểu Tượng Điểm Cuối Đường Hồ Chí Minh Km 2436**.
    3. **Cột Cờ Hà Nội tại Mũi Cà Mau** (bản sao cao **`36–41m`** có 3 tầng đế gạch + thân bát giác + cờ đỏ sao vàng bay lộng gió biển — `73_cot_co_ha_noi.jpg`).
  - **Rừng Đước nguyên sinh ven bờ**: trồng mới **80–120 cây Đước (*Rhizophora*) cao `6–12m`** ôm kín 2 bên cầu gỗ & bãi bồi phù sa (hiện tại = **0 cây**!).
- **Hoa văn & Họa tiết**:
  - **Con Tàu Mũi Cà Mau** (`101_mui_ca_mau_con_tau_gps0001.jpg`): đổi cánh buồm sang **màu trắng bê tông chạm sóng**, in rõ chữ đỏ `"MŨI CÀ MAU — 8°37'30" Bắc, 104°43' Đông"`, đỉnh buồm cắm **lá cờ Tổ quốc waving shader** (bỏ đĩa ngũ giác 5 cạnh sai hình ở thân buồm), thêm cầu thang bước lên boong tàu & bệ sóng bê tông uốn lượn.
  - **Cây Đước** (`102_rung_duoc_ca_mau.jpg`): dựng bộ **rễ chống (stilt roots) 6–10 nhánh vòng cung** cắm xuống bãi bùn thủy triều, lá xanh dày bóng.
  - Hoàn thiện **lan can gỗ ngang khép kín** quanh sân ngắm biển `22×22m` (sửa Bug B15).
- **Đồ vật & Đời sống**:
  - **Kè bê tông ly tâm chắn sóng** ngoài khơi bảo vệ mũi đất; **biểu tượng Cua Cà Mau** đá/composite ở quảng trường check-in; bảng chỉ dẫn tọa độ cực Nam; cột đèn năng lượng mặt trời dọc cầu xuyên rừng đước; vài chiếc **vỏ lãi (xuồng máy thon dài miền Tây)** chạy ngoài cửa biển.

---

#### 29. Đảo Ngọc Phú Quốc — Dinh Cậu & Cầu Cảng Hoàng Hôn (`(-335, 515)` · `vietnamSouthBuilder.ts`)
- **Ảnh tham chiếu**: `03_mien_nam_hai_dao/36_dao_phu_quoc.jpg`, `05_chi_tiet_mo_rong/103_dinh_cau_phu_quoc.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng đảo Phú Quốc bán kính địa hình từ `56m` lên **`78m`** (`~156m` đường kính, `exclusion r = 56m`), giữ cầu cảng gỗ hoàng hôn `60m` (mở rộng đầu chữ T lên `12×9m` và gắn đầy đủ lan can an toàn).
  - **Bổ sung biểu tượng văn hóa số 1 Phú Quốc — Mũi Dinh Cậu & Hải Đăng Dương Đông** (`103_dinh_cau_phu_quoc.jpg`): dựng trên ghềnh đá granit nhô ra biển ở phía Tây Bắc đảo gồm **29 bậc đá leo lên ghềnh**, **Miếu Dinh Cậu mái ngói đỏ có lưỡng long chầu nguyệt xanh-đỏ & 4 cột trụ vàng chạm rồng**, và **Ngọn Hải Đăng Dương Đông sơn sọc trắng-xanh cao `18m`** có đèn xoay quét sáng về đêm!
- **Hoa văn & Họa tiết**:
  - **Tán lá dừa biển**: nâng cấp từ dải phẳng liền khối sang **tàu lá dừa xẻ răng lược lông chim** (alpha cutout + cong tự nhiên).
  - **Miếu Dinh Cậu**: chữ Hán đỏ trên cổng, rồng sứ uốn lượn trên bờ nóc, bàn thờ Chúa Ngọc Nương Nương & nhang đèn bên trong, cây sộp cổ thụ mọc ôm ghềnh đá.
- **Đồ vật & Đời sống**:
  - **Trang bị đầy đủ cho 3 chòi bãi biển** (hiện đang trống trơn): ghế tắm nắng gỗ nệm trắng, bàn thấp đặt trái dừa tươi cắm ống hút, dù lá cọ, **võng lưới mắc giữa 2 thân dừa nghiêng**, **xích đu gỗ đặt ngay mép sóng biển** (góc sống ảo đặc trưng Phú Quốc).
  - **3–4 tàu đánh cá gỗ sơn xanh dương — đỏ** mũi cao đặc trưng Phú Quốc neo đậu bên cầu cảng + **3 chiếc thuyền thúng** úp trên cát + **rạn san hô nhiều màu** ẩn hiện dưới làn nước trong xanh quanh cầu gỗ.

---

#### 30. Côn Đảo — Vịnh Côn Sơn, Nghĩa Trang Hàng Dương & Cầu Tàu 914 (`(335, 510)` · `vietnamSouthBuilder.ts`)
- **Ảnh tham chiếu**: `03_mien_nam_hai_dao/37_con_dao_vinh_con_son.jpg`, `05_chi_tiet_mo_rong/104_nghia_trang_hang_duong.jpg`, `05_chi_tiet_mo_rong/105_cau_tau_914_con_dao.jpg`.
- **Mở rộng kích thước & không gian**:
  - Mở rộng đảo bán kính từ `56m` lên **`78m`** (`exclusion r = 56m`), biến khu di tích từ 4 mesh đơn sơ thành quần thể trang nghiêm và giàu cảm xúc:
    1. **Nghĩa Trang & Đài Tưởng Niệm Hàng Dương** (`104_nghia_trang_hang_duong.jpg`): nâng đài tưởng niệm lên **1:1 `21.6m`**, mở rộng quảng trường có **4 trụ biểu đá khắc hoa văn**, **Cổng Tam Quan đá trắng**, **Đền Thờ Liệt Sĩ mái ngói đỏ 2 tầng** và **khu mộ liệt sĩ + Mộ Chị Võ Thị Sáu** rợp bóng cây xanh.
    2. **Cầu Tàu 914 & Phố Cổ Kiến Trúc Pháp Côn Đảo** (`105_cau_tau_914_con_dao.jpg`): giữ cầu đá `40m`, mở rộng nhà đón đầu cầu thành **dãy hành lang vòm vàng kem kiến trúc Pháp cổ** (`Dinh Chúa Đảo / Trại Giam lịch sử`) với cửa chớp xanh lá, cột vuông, mái ngói đỏ.
- **Hoa văn & Họa tiết**:
  - **Đài Tưởng Niệm Hàng Dương**: bổ sung **phù điêu đồng chạm nổi quanh bệ**, **ngọn lửa / ngôi sao vàng rực trên đỉnh tháp**, bia đá khắc chữ vàng trang trọng.
  - **Cầu Tàu 914**: mặt đá hộc ghép thô lịch sử, **tấm bia di tích `"DI TÍCH LỊCH SỬ CẦU TÀU 914"`**, cột bích neo tàu bằng gang rỉ sét nối xích sắt, tường cổng có gờ phào chỉ & cửa chớp gỗ.
- **Đồ vật & Đời sống**:
  - **Ánh nến & hương hoa đêm Hàng Dương**: lư hương đồng lớn có khói hương GPU, hàng chục **ngọn nến vàng lung linh & hoa trắng** thắp sáng trang nghiêm bên khu mộ liệt sĩ lúc về đêm; **rặng cây Bàng cổ thụ di sản Côn Đảo** (tán rộng ngang, thân xù xì) tỏa bóng ven biển & sân nghĩa trang; đèn đường kiểu Pháp cổ; **2 chiếc tàu gỗ neo dọc Cầu Tàu 914**; rùa biển / san hô nhỏ quanh vòm đá biển Côn Sơn.

---

### NHÓM D — VÒNG ĐẠI QUẦN THỂ VĂN HÓA MACRO (4800m × 4800m · `vietnamReferenceShowBuilder.ts`)

---

#### 31. Quần Thể Ninh Bình: Thung Lũng Tràng An `(120, -110)` & Tam Cốc — Bích Động `(680, -320)`
- **Ảnh tham chiếu**: `01_mien_bac/11_trang_an_ninh_binh.jpg`, `01_mien_bac/12_tam_coc_bich_dong.jpg`, `04_hoa_van_hoa_tiet/63_chua_bich_dong_ninh_binh.jpg`, `05_chi_tiet_mo_rong/63b_chua_bich_dong_mai_dau_dao.jpg`, `05_chi_tiet_mo_rong/80_trang_an_do_thuyen_hang.jpg`.
- **Mở rộng kích thước & sửa lỗi**:
  - Sửa Bug B1 (hiển thị lại **Bến Đò Tam Cốc**) & Bug B18 (cắt bỏ bờ ruộng xuyên sông Ngô Đồng).
  - Nâng chiều cao núi đá vôi Tràng An từ `35–60m` lên **`75–115m`** & Tam Cốc lên **`85–165m`**; bổ sung **dòng sông Sào Khê** & **Đền Trình / Thủy Đình Tràng An** (lầu 2 tầng mái cong nằm trên mặt nước) cho khu Tràng An.
  - **Bổ sung Chùa Bích Động (Chùa Hạ — Chùa Trung — Chùa Thượng)** (`63_chua_bich_dong_ninh_binh.jpg`, `63b_chua_bich_dong_mai_dau_dao.jpg`): dựng ngay sườn vách đá phía Đông Tam Cốc gồm **cầu đá 3 nhịp bắc qua hồ sen**, **Cổng Tam Quan cổ rêu phong**, **Chùa Trung nép mình trong hang đá vôi** với mái ngói cong chạm rồng uốn lượn.
- **Hoa văn, Họa tiết & Đồ vật**:
  - Thay **Hang Cả** 5 hộp vuông bằng **vòm hang đá vôi hữu cơ dài `55m`** có nhũ đá rủ và ánh sáng xuyên hầm; cho **4–6 chiếc đò Tam Cốc** di chuyển tuần hoàn dọc dòng Ngô Đồng có **người lái đò chèo bằng chân** đội nón lá + hành khách mặc áo phao cam (`80_trang_an_do_thuyen_hang.jpg`); bổ sung bông lúa trĩu hạt trên khóm lúa & đường mòn đất ôm theo sông.

---

#### 32. Đại Nội Huế Macro — Điện Thái Hòa (`(-660, 80)` & `(-235, 42)`)
- **Ảnh tham chiếu**: `02_mien_trung_tay_nguyen/18_dien_thai_hoa_hue.jpg`, `04_hoa_van_hoa_tiet/40_mai_dao_long_phuong_hue.jpg`, `04_hoa_van_hoa_tiet/53_ngai_vang_dien_thai_hoa_hue.jpg`, `05_chi_tiet_mo_rong/106_dien_thai_hoa_mai_rong.jpg`, `05_chi_tiet_mo_rong/106b_dien_thai_hoa_noi_that.jpg`.
- **Mở rộng kích thước & kiến trúc**:
  - Chuyển hệ mái Điện Thái Hòa Macro từ mái chồng 2 tầng dọc sang **đúng kiến trúc *Trùng Thiềm Điệp Ốc*** (`106_dien_thai_hoa_mai_rong.jpg`: 2 mái liền kề song song nối bằng máng thừa lưu, mái tiền điện cao rộng liền khối với chính điện); tăng số cột sơn son thếp vàng lên **64–80 cột gỗ lim** vẽ rồng ẩn mây; mở rộng **Sân Đại Triều Nghi 2 tầng** (thêm **bậc tam cấp đá thanh chạm rồng 3 lối** bước lên thềm điện & lan can đá thanh viền quanh sân).
- **Hoa văn, Họa tiết & Đồ vật**:
  - **Bờ nóc mái Hoàng Lưu Ly**: thay thanh hộp vàng bằng **Lưỡng long chầu mặt trời khảm sành sứ tinh xảo** + **cổ diêm chia ô hộc vẽ thơ chữ Hán & tranh tứ quý (*Nhất thi nhất họa*)** (`106_dien_thai_hoa_mai_rong.jpg`).
  - **Nội thất Ngai Vàng** (`53_ngai_vang_dien_thai_hoa_hue.jpg`, `106b_dien_thai_hoa_noi_that.jpg`): **Ngai Vàng triều Nguyễn** chạm nổi 9 rồng có tay vịn đầu rồng, đệm gấm vàng, **Bửu Tán** chạm lộng 9 rồng mây nhiều tầng lớp rủ tua vàng, **Cửa Võng** chạm thủng hoa văn rồng phượng (`106b_dien_thai_hoa_noi_that.jpg`), hệ cửa bức bàn mở rộng phía Đông, **2 con Kỳ Lân đồng mạ vàng** & **2 vạc đồng** đặt trước thềm điện.

---

#### 33. Làng Cổ Đường Lâm Macro (`(-640, -180)` & `(-60, 132)`)
- **Ảnh tham chiếu**: `01_mien_bac/13_lang_co_duong_lam.jpg`, `04_hoa_van_hoa_tiet/69_nha_co_duong_lam_da_ong.jpg`.
- **Mở rộng kích thước & sửa lỗi**:
  - Sửa Bug B12 (xoay chuẩn 90° mái, cửa, hoành phi **Cổng Làng Mông Phụ** & cửa sổ bản Inner).
  - **Bổ sung công trình trung tâm còn thiếu — Đình Mông Phụ (1684)** (`69_nha_co_duong_lam_da_ong.jpg`): đặt uy nghi đối diện sân gạch bát tràng (`28m × 16m × 11m` cao), kiến trúc 5 gian 2 chái sàn gỗ cao kiểu nhà sàn Việt cổ, mái đao 4 góc uốn cong dày dặn, trước sân có **Nghi Môn 4 trụ biểu đỉnh gắn tượng Nghê**.
  - Bổ sung **Ao Làng hình bán nguyệt** trước cổng làng + **rặng tre xanh** & **ngõ đá ong quanh co**.
- **Hoa văn, Họa tiết & Đồ vật**:
  - Texture **đá ong tổ ong lỗ rỗ** (albedo + normal map lỗ xốp đỏ nâu đặc trưng xứ Đoài); bậc đá gốc cây đa cổ thụ rêu phủ; đom đóm có **shader bay lượn & chớp tắt tự nhiên** (thay bóng tĩnh); nâng cấp **chum tương Bần** nắp đan nứa, **nông phơi thóc/rơm rạ**, **gàu sòng & dây thừng bên giếng cổ**, **quán nước chè xanh chõng tre** dưới tán cây đa nghìn năm.

---

#### 34. Khu Lịch Sử Hào Hùng: Điện Biên Phủ Đồi A1 `(-820, -520)` & Thủy Chiến Bạch Đằng `(-240, -760)`
- **Ảnh tham chiếu**: `01_mien_bac/14_dien_bien_phu_doi_a1.jpg`, `05_chi_tiet_mo_rong/81_dien_bien_phu_ham_de_castries.jpg`, `01_mien_bac/15_bai_coc_bach_dang.jpg`.
- **Mở rộng kích thước & sửa lỗi**:
  - **Điện Biên Phủ — Đồi A1**: sửa Bug B13 (xoay cửa Hầm De Castries đúng đầu vòm — `81_dien_bien_phu_ham_de_castries.jpg`), mở rộng **Hố bộc phá 960kg** từ `18.4m` lên **`34m`** đường kính; bổ sung **mạng lưới hào giao thông zích-zắc dài `160m`**, **hàng rào dây thép gai kẽm xoắn**, **Cây Đa Cụt** lịch sử, và **Cờ `"QUYẾT CHIẾN QUYẾT THẮNG"` đỏ sao vàng** tung bay rực rỡ trên nóc hầm De Castries; nâng cấp xe tăng M24 Chaffee Bazeille (bánh xích, lỗ thủng đạn pháo, tháp pháo chi tiết) & pháo cao xạ 37mm có kính ngắm + hòm đạn.
  - **Thủy Chiến Sông Bạch Đằng**: nâng cấp 11 chiến thuyền lên **2–3 cột buồm có buồm nan tre, dây thừng, chèo mạn & đầu rồng mũi thuyền**; dựng **2 chiến thuyền giặc đang nghiêng vỡ, bốc cháy & mắc cạn trên bãi cọc gỗ lim** bịt sắt nhọn; bổ sung **4 bè lửa hỏa công** đang trôi rực lửa + **vách đá phục binh Tràng Kênh** bên bờ; nâng cấp mây sương sông sang billboard trôi mềm.

---

#### 35. Các Đại Quảng Trường Nghệ Thuật Văn Hóa Macro (`Liên Hoa Đài`, `Long Vân Sơn Mài`, `Thổ Cẩm Tây Nguyên`, `Trống Đồng`, `Đất Nước`, `Ký Ức 35mm`, `Hẻm Trường Sơn`)
- **Ảnh tham chiếu**: `vietnamreference/05..13_*.jpg` + `04_hoa_van_hoa_tiet/38`, `42`, `43`, `45`, `46`.
- **Mở rộng & tăng chi tiết trọng điểm**:
  1. **Liên Hoa Bạch Ngọc Đài `(0, -560)`**: dựng lại Đại Sen Hồng cao đủ **`10.5m`** bằng **32 cánh sen nhọn điêu khắc nhiều tầng có gân lá & nhị vàng** (thay 11 cầu dẹt); bổ sung **cầu đá cẩm thạch trắng uốn lượn** nối cổng Tam Quan ra tận đài sen + thành hồ đá chạm hoa sen + lá sen khuyết V.
  2. **Thung Lũng Sơn Mài Long Vân `(820, -80)`**: sửa Bug B17 (vân vàng không trượt theo camera); nâng cấp **Rồng Đại Việt 35m** thêm **4 chân có móng vuốt, bờm lửa, vây sống lưng, râu rồng uốn lượn, mắt phát sáng & quả Châu Lửa**; bổ sung **hồ sơn mài phản chiếu gương** + cầu ngắm cảnh uốn lượn.
  3. **Không Gian Thổ Cẩm Tây Nguyên `(-860, 120)`**: dựng **1 Nhà Rông chính cao `22m`**, **vòng lửa trại & dàn cồng chiêng**, cột trụ đỡ kín đáo cho mái Nón Lá 14m (không lơ lửng vô lý), trang trí **Cột Nêu** đầy đủ tua tre & chim thần, bổ sung hoa văn thổ cẩm dệt nổi normal map.
  4. **Quảng Trường Trống Đồng `(-680, 420)`**: thay mặt trống phẳng `Ø22m` bằng **thân Trống Đồng Ngọc Lũ thắt eo 3D đầy đủ có 4 tượng cóc trên vành & quai trống kép** (`38_trong_dong_ngoc_lu_pattern.jpg`); nâng cấp 4 chòi lá lên kết cấu 8 cột + ghế tre & đèn lồng; bổ sung gân lá & vết xé tự nhiên cho lá chuối.
  5. **Đại Tượng Đài Đất Nước `(-560, -640)` & Ký Ức 35mm `(0, -315)`**: thay khối hộp dán texture trống đồng (Bug B18) bằng **tượng đài điêu khắc thật + đôi cánh Chim Lạc & Rồng vươn rộng `36m`** + quảng trường đá granit bậc thang; tạo **4–6 biến thể ảnh phim lịch sử 35mm khác nhau** cho 16 bia phim (không lặp 1 ảnh duy nhất) + bệ đá chân bia + cột nâng đỡ đĩa mặt trời & vòm nón lá.
  6. **Hẻm Núi Trường Sơn Mùa Mưa Bão `(740, -560)`**: nâng cấp 4 thác nước bằng **animated UV waterfall flow shader + bọt trắng chân thác + bậc đá tầng**; bổ sung **cầu treo dây cáp Trường Sơn bắc qua khe suối**, đường mòn Hồ Chí Minh đất đỏ, dương xỉ/dây leo, sương mù alpha mềm & vùng mưa cục bộ trong hẻm núi.

---

## Phần IV — Lộ Trình Triển Khai Chia Phase & Kiểm Soát Hiệu Năng

Để đảm bảo mượt mà FPS (mục tiêu `< 250 draw calls` toàn cảnh, tận dụng `mergeGeometries`, `InstancedMesh` và `LOD` theo khoảng cách), đề xuất triển khai theo **6 Sprint**:

| Sprint | Trọng tâm | Nội dung thực hiện | File chính tác động |
|---|---|---|---|
| **Sprint 1 (P0)** | **Sửa sạch 18 Bugs + Thư viện Hoa văn & Signage dùng chung** | Fix toàn bộ B1–B18; xây dựng `createVietnamSignageAtlas`, `createCarvedDragonBalustrade`, `createRoofFinialSet`, `createCarvedTurtleStele`, `createPiercedBalustrade`, `createSculptedBuddha`. | `vietnamGeometryHelpers.ts`, `vietnamHeritageShader.ts` + vá 5 builder |
| **Sprint 2** | **Cụm Trung Tâm Hà Nội & Miền Bắc (I)** | Mở rộng **Văn Miếu** (+ Giếng Thiên Quang, 32 bia rùa), **Chùa Một Cột** (+ cầu thang 13 bậc, Cây Bồ Đề, đấu củng), **Hồ Hoàn Kiếm** (+ Cầu Thê Húc, Đền Ngọc Sơn, Tháp Bút), **Hoàng Thành Thăng Long** (+ nền Điện Kính Thiên 46m, Rồng đá Lê Sơ, Cột Cờ Hà Nội). | `VietnamHeritageScene.ts`, `vietnamNorthBuilder.ts` |
| **Sprint 3** | **Miền Bắc (II): Tây Bắc, Hạ Long, Chùa Hương, Đền Hùng** | **Fansipan** (Đại Tượng Phật 21.5m, Bảo Tháp 11 tầng, Kỳ Đài 25m), **Lũng Cú** (phù điêu trống đồng, Hồ Mắt Rồng, nhà trình tường), **Hạ Long** (buồm cánh dơi chuẩn, Hang Luồn, Làng chài Cửa Vạn), **Mù Cang Chải** (gió lúa, nhà sàn Khau Cút, cọn nước), **Chùa Hương** (Điện Tam Bảo, lòng động 28m), **Đền Hùng** (+ Đền Trung, Đền Giếng). | `VietnamHeritageScene.ts`, `vietnamNorthBuilder.ts` |
| **Sprint 4** | **Miền Trung & Tây Nguyên** | **Ngọ Môn & Điện Thái Hòa** (Trùng Thiềm Điệp Ốc, 5 cửa chuẩn, Cửu Đỉnh, Kỳ Đài 42m), **Hội An** (Chùa Cầu chữ T, 16+ nhà ống, Mắt cửa, cửa hiệu), **Cầu Vàng** (bàn tay giải phẫu, hoa Lobelia, ga cáp treo), **Cầu Rồng** (5 ống thép, đầu rồng vảy, LED & phun lửa/nước), **Sơn Đoòng** (2 hố sụt 220m), **Phong Nha**, **Mỹ Sơn** (+ Tháp kho B5), **Poshanư**, **Đà Lạt** (Jeep, K'Lang–H'Biang, thông ba lá), **T'Nưng & Nhà Rông** (+ Nhà Lồng, Nhà Mồ). | `vietnamCentralBuilder.ts`, `VietnamHeritageScene.ts` |
| **Sprint 5** | **Miền Nam & Hải Đảo** | **Chợ Bến Thành** (104×72m, 4 cửa thông, phù điêu Biên Hòa, 28 sạp hàng), **Dinh Độc Lập** (xe tăng 390/843, trực thăng UH-1, cổng sắt, rèm đốt trúc), **Nhà Thờ Đức Bà** (93m, tượng Đức Mẹ chuẩn, vòm trần, bồ câu), **Củ Chi** (Tháp 9 tầng Bến Dược 39m, khói Hoàng Cầm, hầm cắt mở), **Ponagar** (tháp thứ 4, 22 cột Mandapa, Durga), **Cái Răng** (30 ghe rỗng lòng, 6 nông sản, nhà sàn), **Trà Sư** (Đài 23m, cầu tre 92m, cò trắng), **Mũi Cà Mau** (Rừng Đước, GPS 0001, Cột Cờ HN, Con Tàu trắng), **Phú Quốc** (+ Dinh Cậu & Hải đăng), **Côn Đảo** (Hàng Dương 21.6m, nến đêm, phố Pháp, cây bàng). | `vietnamSouthBuilder.ts` |
| **Sprint 6** | **Vòng Macro Văn Hóa & QC Thị Giác Cuối** | Nâng cấp **Tam Cốc — Bích Động** (+ Chùa Bích Động), **Đường Lâm** (+ Đình Mông Phụ), **Điện Biên Phủ** (cờ Quyết Chiến, hào), **Bạch Đằng** (thuyền cháy trên cọc), **Liên Hoa Đài**, **Rồng Sơn Mài**, **Trống Đồng 3D**, **Đất Nước**, **Ký Ức 35mm**, **Thác Trường Sơn** + chụp ảnh QC từng địa danh trên trình duyệt. | `vietnamReferenceShowBuilder.ts` |

---

## Phần V — Đợt Mở Rộng Kích Thước & Không Gian Nội Thất Thành Trì, Tòa Nhà (`06_noi_that_thanh_tri_toa_nha/`, Ảnh `108`–`123`)

Bộ 16 ảnh tham chiếu chuyên sâu tại `vietnamreference/real_life_refs/06_noi_that_thanh_tri_toa_nha/` và các hạng mục mở rộng không gian nội thất 3D đã triển khai trực tiếp vào 5 builder:

| Mã ảnh | Tệp ảnh tham chiếu | Công trình & Không gian nội thất 3D đã mở rộng | File triển khai |
|---|---|---|---|
| `108` | `108_hoang_thanh_doan_mon_vom_trong.jpg` | **Lòng 5 cổng vòm cuốn Đoan Môn**: gân vòm gạch cổ, vệt bánh xe ngựa đá thanh xuyên hầm, ghế canh vệ binh, giá binh khí bát bửu & đèn lồng treo vòm. | `vietnamNorthBuilder.ts` |
| `109` | `109_hoang_thanh_hau_lau_tinh_bac_lau.jpg` | **Phòng Giao Ban Tổng Hành Dinh Cục Tác Chiến & Hậu Lâu (Tĩnh Bắc Lâu)**: mở thông tầng trệt Nhà Con Rồng với bàn sa bàn chiến dịch, 10 ghế, 4 điện thoại tác chiến, cửa thép dẫn xuống **Hầm D67** & lầu **Hậu Lâu 3 tầng mái cong** phía Tây Bắc. | `vietnamNorthBuilder.ts` |
| `110` | `110_van_mieu_dai_thanh_noi_that.jpg` | **Sân Bái Đường & Điện Đại Thành (`21.4m × 10.6m`)**: mở rộng về phía Bắc Đại Thành Môn với 12 cột sơn son thếp vàng, khám thờ & tượng Khổng Tử — Chu Văn An, đỉnh đồng, đôi hạc chầu quy & biển `"萬 世 師 表 — VẠN THẾ SƯ BIỂU"`. | `VietnamHeritageScene.ts` |
| `111` | `111_dai_noi_hue_the_mieu_noi_that.jpg` | **Nội thất Thế Miếu (Đại Nội Huế)**: 9 gian khám thờ & ngai thờ Liệt Đế triều Nguyễn sơn son thếp vàng, cửa võng chạm rồng, 20 cột lim đỏ và hàng chậu sứ bonsai trước sân. | `vietnamReferenceShowBuilder.ts` |
| `112` | `112_dai_noi_hue_truong_lang_tu_cam_thanh.jpg` | **Hệ hành lang Trường Lang Tử Cấm Thành**: 2 dãy hành lang có mái ngói lưu ly, cột sơn đỏ và cửa sổ chữ Thọ nối từ hậu điện Thái Hòa sang Thế Miếu. | `vietnamReferenceShowBuilder.ts` |
| `113` | `113_dai_noi_hue_hien_lam_cac.jpg` | **Hiển Lâm Các 3 tầng (`17m`) & Nội thất Lầu Ngũ Phụng**: dựng lầu kỷ niệm công thần 3 tầng mái Hoàng Lưu Ly phía sau Cửu Đỉnh, bổ sung dầm đá thanh trong lòng cổng Ngọ Môn & **Kiệu Bát Cống** thếp vàng trên Lầu Ngũ Phụng. | `vietnamCentralBuilder.ts` |
| `114` | `114_hoi_an_nha_co_tan_ky_noi_that.jpg` | **Nội thất Nhà Cổ Tấn Ký / Quân Thắng**: bộ bàn ghế gỗ lim khảm xà cừ, cột gỗ & vì kèo chồng rường, câu đối chữ Hán thếp vàng, bình gốm hoa cúc trên đôn gỗ. | `vietnamCentralBuilder.ts` |
| `115` | `115_hoi_an_hoi_quan_phuc_kien_noi_that.jpg` | **Chính điện Hội Quán Phúc Kiến**: khám thờ Thiên Hậu Thánh Mẫu cùng Thiên Lý Nhãn — Thuận Phong Nhĩ, mô hình thuyền buồm thương gia Phúc Kiến & 6 vòng nhang xoắn ốc treo trần. | `vietnamReferenceShowBuilder.ts` |
| `116` | `116_dinh_co_bac_bo_ket_cau_vi_keo.jpg` | **Nội thất Đình Mông Phụ & Nhà cổ Đường Lâm**: hệ vì kèo *câu đầu — trụ trốn — đầu dư chạm rồng*, 2 sập gỗ đình làng, Kiệu Bát Cống, đôi hạc thờ, trống đình; mở cửa giữa 8 nhà cổ đá ong lộ bàn thờ gia tiên & sập gụ. | `vietnamReferenceShowBuilder.ts` |
| `117` | `117_dien_bien_phu_ham_de_castries_ben_trong.jpg` | **Bên trong Hầm Chỉ Huy Tướng De Castries (`20m`)**: sàn hầm đi bộ, 3 vách ngăn chia 4 khoang thông nhau, bàn bản đồ chiến dịch Mường Thanh, 6 ghế sắt, tủ điện đài/mật mã & bức tường phù điêu di tích bên lối vào hào. | `vietnamReferenceShowBuilder.ts` |
| `118` | `118_dinh_doc_lap_phong_dai_yen.jpg` | **Phòng Đại Yến (Cánh Đông Dinh Độc Lập)**: mở rỗng tầng trệt cánh Đông với thảm vàng, bàn đại tiệc gỗ gõ đỏ `12.8m` kèm 22 ghế bọc nệm, rèm nhung vàng & 2 đèn chùm hình học hiện đại. | `vietnamSouthBuilder.ts` |
| `119` | `119_dinh_doc_lap_phong_trinh_quoc_thu.jpg` | **Phòng Trình Quốc Thư (Cánh Tây) & Cửa Hầm Chỉ Huy Dinh Độc Lập**: tranh sơn mài *Bình Ngô Đại Cáo* 40 tấm ghép vàng rực, bàn & ghế trình quốc thư, 4 bình đồng cao, bộ sofa ngoại giao & cửa thép hầm ngầm tổng thống. | `vietnamSouthBuilder.ts` |
| `120` | `120_nha_tho_duc_ba_long_giao_duong.jpg` | **Lòng Giáo Đường Nhà Thờ Đức Bà Sài Gòn (`50.0m`, 10 nhịp vòm)**: mở rộng gấp đôi chiều sâu lòng nhà thờ từ 6 lên 10 nhịp, thêm tầng hành lang vòm *Triforium* hai bên, cột bó nâng vòm, thảm gạch hoa hình khối 3D, 16 dãy ghế gỗ sồi, bục giảng & bàn thờ phụ. | `vietnamSouthBuilder.ts` |
| `121` | `121_chua_viet_nam_chinh_dien_tam_bao.jpg` | **Thượng Điện Tam Bảo (Chùa Kim Sơn Bảo Thắng & Chùa Thiên Trù)**: bổ sung *Tòa Cửu Long* (9 rồng phun nước đỡ Đức Phật Đản Sinh), bàn *Hương Án*, *Cửa Võng* thếp vàng & đệm quỳ *bồ đoàn*. | `vietnamNorthBuilder.ts` |
| `122` | `122_nha_rong_tay_nguyen_ket_cau.jpg` | **Kết cấu bên trong Nhà Rông Tây Nguyên**: hệ kèo gỗ chữ A đan chéo vươn lên đỉnh mái lưỡi rìu, 2 sạp gỗ sinh hoạt dài hai đầu hồi & *Cột Thần* trung tâm gắn cặp sừng trâu và khiên mây. | `vietnamCentralBuilder.ts` |
| `123` | `123_thanh_co_ha_noi_bac_mon.jpg` | **Chính Bắc Môn — Thành Cổ Hà Nội**: dựng tường thành gạch Vauban cánh Đông Bắc Hoàng Thành với góc đá xanh giật bậc, vết đạn đại bác lịch sử 1882 & lầu vọng lâu trên thành. | `vietnamNorthBuilder.ts` |

