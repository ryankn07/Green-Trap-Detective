# Video hướng dẫn chơi

## Mốc thời gian theo trận — 6/11/2026

Chủ dự án yêu cầu thêm ký hiệu mốc thời gian và mở video đúng giai đoạn đang chơi. Đã xác nhận: khi trận chuyển từ thảo luận sang bình chọn, hướng dẫn đang mở **tự chuyển đến đoạn bình chọn và phát tiếp**.

- Dưới video có vạch chia chương và 16 mốc bấm được, có nhãn thời gian, trạng thái mốc hiện tại và thanh cuộn ngang. Nhãn dùng đồng hồ của nguồn video; tốc độ mặc định vẫn 1.25×.
- Trong trận, bấm biểu tượng phát mở và phát phần tương ứng. Thảo luận gồm đọc/gửi ý kiến và Skip, từ 37,130 đến trước 57,478 giây. Video tự dừng ngay trước phần bình chọn và hiện “Chờ bình chọn”. Khi server xác nhận `BLIND_ACTION`, video tua đến 57,478 giây rồi phát tiếp; cuối phần này dừng trước 68,485 giây để chờ công bố. `REVEAL` dùng đoạn 146,597–155,290 giây; `GAME_OVER` dùng đoạn kết từ 155,290 giây.
- Cập nhật người chơi/nhận định không tua lại. Đổi lượt vẫn theo giai đoạn mới. Đồng hồ, Skip, cháy thanh thời gian và engine chạy độc lập; xem hướng dẫn không giữ hoặc đổi giai đoạn trận.
- Chọn bất kỳ mốc nào hoặc “Xem toàn bộ video” chuyển sang xem tự do; trận đổi giai đoạn không giành lại vị trí xem. Có thể bấm “Theo giai đoạn hiện tại” để đồng bộ lại. Tự dừng ở ranh giới sẽ phát tiếp khi sang giai đoạn; người xem chủ động Pause thì vẫn giữ Pause. Đóng hoặc ẩn tab luôn dừng tiếng, không tự mở/phát lại khi trận cập nhật.
- Trang đầu/phòng chờ vẫn mở video ở trạng thái dừng, giữ vị trí cũ và tải lười như trước. Điện thoại có biểu tượng phát 44 px trong thanh ví/vai trò/lượt, vì masthead chung được ẩn trong trận; đóng trả focus về nút đang tồn tại dù renderer đã thay nó.
- Khung giữ nguyên video 16:9 và tính thêm chiều cao các mốc khi vừa trình duyệt. Màn hình ngang thấp có tiêu đề/mục lục gọn để tránh vòng lặp đo kích thước. File MP4, lời dẫn, phụ đề và hash `4815cfd5…` không đổi.

`window.GreenTrapTutorial.receive` nhận projection qua hook sau kiểm tra revision trong `public/app.js`, không đọc vai trò hay lựa chọn của người khác. Các mốc là timestamp đã xác nhận trong `timeline.json` của bản xuất được duyệt; khi thay video phải cập nhật các mốc tương ứng. Không thêm dependency hoặc API game.

Kiểm tra cập nhật này: **154/154 đạt, 0 bỏ qua**, gồm Chrome và PGlite, ghi tại `../outputs/TUTORIAL_CHAPTER_FULL_TESTS.txt`. Bài mới đi qua các giai đoạn thật, dừng ranh giới, Skip đủ người, cập nhật nhận định, xem tự do, Pause chủ động, tốc độ đã chọn, đóng/mở lại và kết thúc ván trên PC/điện thoại. Đã xem ảnh QA tại 1440×900, 320×700, 390×844 và 844×390: khung hiện đầy đủ, video đúng 16:9, nút điện thoại không chồng nhau và không tràn ngang; xem `../outputs/tutorial-chapter-qa/phase-checks.json`. Repository, static build, runtime parity đều qua; localhost:3141 trả đúng JS/CSS mới và hash video không đổi.

Rà giao diện bổ sung ngày 6/11: tìm thấy hàng mốc bị cắt ở 568×320 do chiều rộng tối thiểu 280 px làm khung cao hơn màn hình. Với cửa sổ cao tối đa 350 px, chiều rộng tối thiểu giảm còn 180 px và vẫn tính theo chiều cao thực, để video 16:9, tiêu đề, nút đóng và các mốc cùng hiện trọn. Kiểm tra browser bổ sung 568×320 và 390×300, xác nhận dialog không cuộn/cắt footer; **5/5 kiểm tra tutorial/static build đạt**, không bỏ qua, tại `../outputs/UI_AUDIT_TESTS.txt`. Nguồn video không đổi.

## Trình phát và video đã duyệt

Yêu cầu mới nhất của chủ dự án ngày 5/11/2026: đặt nút **Xem video hướng dẫn** ở **bên phải** thanh đầu trang, trả logo/tên game về mép trái ban đầu. Đây là điều chỉnh thay cho yêu cầu đặt nút bên trái trước đó. Nút mở trình phát ngay trong trang. Trên màn hình nhỏ và thanh trò chơi PC, nút thu gọn thành biểu tượng phát, giữ tên truy cập và vùng bấm 44 px. Thanh riêng của trò chơi trên điện thoại giữ bố cục hiện tại.

`ui/tutorials/how-to-play-fast.mp4` là bản H.264/AAC 1080p nhịp nhanh, nguồn dài khoảng **2 phút 58 giây**, thời gian xem khoảng **2 phút 22 giây ở mặc định 1.25×**. Video có lời dẫn và phụ đề tiếng Việt nằm trong hình. Hai đoạn Skip và đủ người chốt giữ câu đã sửa, không đọc/phụ đề nhắc “cháy hai giây”. Poster lấy từ chính video. Không thay thế bằng bản hướng dẫn cũ dài 4 phút 32 giây; không thêm luồng quét QR.

Yêu cầu bổ sung mới nhất: ba chương dưới đây trình chiếu video thao tác thật, có con trỏ và hiệu ứng của giao diện:

- **Kiểm chứng:** ví dụ người chơi có 4 xu kiếm được qua hai lượt đầu tư hợp lệ; chọn Kiểm chứng vai trò (phí 3 xu), chọn Quân rồi chốt. Video có đoạn chuyển kết quả và phóng vào **Kết quả kiểm chứng**: Quân — Người Phá Hoại. Ví còn 1 xu; kết quả chỉ thuộc về người kiểm chứng.
- **Góp xu trục xuất:** quay ví dụ độc lập có ví 4 xu, chọn Quân và góp 3 xu. Một khoản góp hợp lệ khác là 2 xu, tạo tổng 5 xu cùng mục tiêu. Video có thao tác chọn/góp, chuyển sang công bố, rồi phóng gần ô Quân để thấy nhấp sáng/rung, gạch ngang tên và thông báo bị trục xuất. Server thực sự xử lý lý do `EXPELLED`; khoản góp và danh tính người đóng góp vẫn tuân theo giới hạn riêng tư của game.
- **Chủ phòng kick người AFK:** An rời kết nối và hiện Offline. Chủ phòng mở Kick trong ô của An, thử mũi tên xanh để hủy, mở lại rồi xác nhận bằng X đỏ. Video phóng gần ô thành viên để thấy hiệu ứng bút chì đang xóa và trạng thái bị kick. Đây là thao tác chủ phòng quyết định/xác nhận; phần góp xu trục xuất được giải thích trong chương trước.

Các ví dụ được quay từ server/renderer thật trong phòng QA riêng với người chơi giả lập. Xác nhận ví xu, kết quả kiểm chứng riêng tư và việc server đã loại An được lưu cùng bản quay. Không đổi luật, phí, thời lượng hiệu ứng hay trạng thái người chơi thật để quay video.

`ui/tutorial-ui.js` quản lý dialog nằm ngoài `#app`, nên cập nhật phòng/giai đoạn không tạo lại video. Video và poster chỉ tải khi bấm mở. Ở trang đầu/phòng chờ không tự phát âm thanh và mở lại giữ vị trí xem; trong trận áp dụng phần hướng dẫn theo giai đoạn ở trên. Nút đóng, Escape và bấm nền ngoài đều đóng và dừng phát, trả focus về nút hướng dẫn. Việc xem không dừng đồng hồ trận đấu.

Điều chỉnh tiếp theo của chủ dự án: phụ đề và lời mở đầu là **Green Trap Detective: Hướng dẫn chơi**. Trình phát hướng dẫn khởi đầu ở **1.25×** (chủ dự án đã sửa yêu cầu 1.5× thành 1.25×). `defaultPlaybackRate` và tốc độ thực tế được đặt lúc nạp video lần đầu; người xem vẫn chỉnh tốc độ bằng điều khiển video. Tốc độ này áp dụng cho toàn bộ hướng dẫn, giữ nguyên nguồn video để tránh tăng tốc hai lần; không thay đổi tốc độ các phim ending.

Theo yêu cầu giảm nhẹ kích thước và bỏ blackbar, khung xem hiện ôm đúng tỷ lệ video 16:9, không ép cả chiều rộng và chiều cao theo cửa sổ. PC chừa ít nhất khoảng 32 px ở ngoài, điện thoại khoảng 12 px. Chiều rộng tự giới hạn theo cả viewport và chiều cao phần tiêu đề/nút đóng, nên toàn bộ khung nằm trong màn hình và không có dải đen thừa bên cạnh. Video giữ toàn bộ hình, không crop để lấp khung. URL media có mã phiên bản mới để trình duyệt không dùng lại video cũ.

Node dùng allowlist chính xác trong `server/ending-media.cjs`, với cùng xử lý streaming, HEAD và byte ranges của video ending. Bản static build cũng chép video, poster, CSS và JS sang đầu ra. Không có dịch vụ video bên ngoài hay dependency mới.

Phần thêm này là tính năng giao diện theo yêu cầu của chủ dự án; không phải nút thử nghiệm local. Không thay đổi luật chơi, dữ liệu riêng hay hình thẻ gốc. Triển khai local không đồng nghĩa đã đẩy lên GitHub hoặc phát hành online.

Kiểm tra sau điều chỉnh: kiểm tra tải lười, phát/tua video thật, Escape/nút đóng/nền ngoài, dừng tiếng ngay khi đóng và khôi phục focus. Kiểm tra mobile 320/390 px, tablet 768 px, màn hình ngang 844×390, PC đến 2560 px và màn rộng 2560×1080: phần video đúng 16:9, phủ đủ chiều rộng khung, không có ô trống bên dưới hoặc dải đen thừa. Nút bên phải không đè lên đồng hồ; trình phát giữ nguyên qua cập nhật giai đoạn. Build static giữ nguyên byte video; kiểm tra repository và runtime bundle đều qua. Ảnh QA nằm ngoài checkout tại `../outputs/tutorial-live-demos-qa/`.

Kiểm tra mới nhất: **6/6 qua**, không bỏ qua bài nào, trong `../outputs/TUTORIAL_EXPEL_SCOPED_TESTS.txt`. Bao gồm tốc độ mặc định/thực tế 1.25×, player và tỷ lệ PC/mobile, static build, giới hạn riêng tư của trục xuất và hiệu ứng vote-out thực tế. QA trên chính localhost:3141 xác nhận source/hash mới, phát/tua được, giữ đúng 1.25× và không có lỗi JavaScript; xem `../outputs/tutorial-expel-qa/checks.json`.

Lịch sử kiểm tra bản trước: `../outputs/TUTORIAL_LIVE_DEMOS_SCOPED_TESTS.txt` có **5/5 qua** sau sửa khung, gồm video/player, bố cục giai đoạn, kick và static build. Toàn bộ suite khi đó đạt **149/150**: một assertion dấu thời gian “the chapter follows the completed burn” thất bại khi chạy đồng thời. Chạy riêng toàn bộ `action-burn.test.cjs` đạt **5/5**, gồm cả trường hợp PC/điện thoại vừa thất bại; không sửa gameplay hoặc bài kiểm tra đó để vượt qua. Hai log tương ứng là `../outputs/TUTORIAL_LIVE_DEMOS_TESTS.txt` và `../outputs/TUTORIAL_DEMOS_BURN_RECHECK.txt`.

Video hiện tại dài **177,68 giây**, 16 chương, H.264 1920×1080/AAC; giải mã toàn bộ không có lỗi. SHA-256: `4815cfd51203315214fea0624ffdb7f23b4b752ea6b37bcc9ddeb245a3fbc521`. Đoạn kiểm chứng khoảng **1:32**, góp xu trục xuất **1:46** (hiệu ứng khoảng **1:55**), chủ phòng kick AFK **2:03**, theo đồng hồ nguồn trên video. Đã trích khung hình từ bản xuất cuối để xác nhận phụ đề mở đầu chính xác và hiệu ứng trục xuất thay đổi qua các frame; bản quay xác nhận engine thực sự cộng 3 + 2 xu và loại mục tiêu. Bản trước được giữ ngoài checkout; báo cáo, nguyên liệu và ảnh trích mới nằm trong `../outputs/huong-dan-choi-demo-truc-xuat/`.
