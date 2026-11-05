# Hiệu ứng thao tác trong trận

## Tập trung vào đồng xu đầu tư — 6/11/2026

Theo yêu cầu chủ dự án, đầu tư có hiệu ứng riêng dài **2,6 giây**: xu Green Coin gốc lớn khoảng 3 lần, lật rõ ở giữa màn hình rồi bay vào thẻ dự án. Nền xung quanh mờ 7 px và tối nhẹ; thẻ đích giữ rõ với viền sáng khi xu chạm vào. Mốc chuyển động dùng easing tuyến tính để thời gian lật không bị rút ngắn bởi easing chung.

Nếu thẻ đang nằm ngoài màn hình, hiển thị tạm đúng ảnh `currentSrc` của dự án trong lớp hiệu ứng thay vì tự cuộn trang hoặc mở Hội đồng. Không sửa/vẽ lại artwork. Lớp nhấn mạnh nằm ngoài `#app`, không nhận pointer, không chuyển focus, không khấu trừ xu dự đoán và chỉ xuất hiện sau khóa hành động được server xác nhận. Kiểm chứng/góp xu vẫn dùng hiệu ứng riêng hiện tại.

Xu tới thẻ khoảng 1,9 giây; viền/nền tan dần hết ở 2,6 giây. Khi chuyển cảnh giai đoạn bắt đầu, lớp đầu tư được dọn ngay để không che chuyển cảnh; server vẫn giải quyết lượt và đồng hồ ngay như trước, kể cả người đầu tư là người chốt cuối. Đổi kích thước, ẩn trang, thoát trang hoặc mất phiên cũng dọn lớp nền. Riêng đầu tư được chủ dự án yêu cầu thấy rõ trong Codex nên chạy đủ hoạt ảnh kể cả khi trình duyệt báo giảm chuyển động; hiệu ứng phụ khác vẫn tuân theo chế độ giảm chuyển động.

Kiểm tra tập trung: 8/8 qua, không bỏ qua, gồm đầu tư trên PC/điện thoại, 3 xu kiểm chứng đi kèm, lỗi gửi/thiếu xu, không phát lại, giảm chuyển động, người chốt cuối và đồng hồ cháy hai giây. Video/ảnh QA mới nằm ngoài Git trong `../outputs/investment-focus-qa/`; video hướng dẫn đã duyệt không đổi.

Kiểm tra toàn bộ ở bản đầu của hiệu ứng: **156/156 đạt, 0 bỏ qua**, gồm Chrome và PGlite, tại `../outputs/INVESTMENT_FOCUS_FULL_TESTS.txt`. Đã xem bản quay thật 1440×900 và 390×844, đóng gói lại runtime, kiểm tra repository/static build và xác nhận localhost:3141 trả đúng JS/CSS mới. Các sửa mobile và Codex bên dưới được kiểm tra bổ sung sau bản này.

Sửa tiếp theo phản hồi mobile: ở màn hình thấp hoặc khi cuộn trong lúc gửi, cả thẻ và khung chốt có thể nằm ngoài viewport. Điều kiện cũ yêu cầu một điểm đích DOM đang nhìn thấy nên bỏ qua toàn bộ đầu tư, dù lớp xem thẻ vốn hỗ trợ đích ngoài màn hình. Đầu tư nay dùng đích/điểm xuất phát dự phòng độc lập với phần tử đang nhìn thấy; các khoản kiểm chứng/trục xuất vẫn giữ yêu cầu đích như trước. Đã tái hiện bằng Chrome `isMobile` + `hasTouch`, viewport 390×360, trễ gửi 700 ms và cuộn ra khỏi cả hai vùng: trước sửa không có xu/nền mờ, sau sửa có đúng một hiệu ứng, không tự cuộn và không mở Hội đồng. Test resize đợi đúng sự kiện trình duyệt, rồi kiểm tra việc che vai trò/dọn nền ngay trong lần phát sự kiện đó.

Kiểm tra sau sửa mobile: **7/7 bài liên quan đạt**, không bỏ qua, tại `../outputs/MOBILE_INVESTMENT_FIX_TESTS.txt`. Đã thử chạm qua luồng tạo phòng và chốt thật trên localhost:3141, 390×844/DPR3; ghi nhận `invest: true`, một xu và một lớp focus, rồi dọn đúng phòng QA đã tạo. Bằng chứng ở `../outputs/mobile-investment-live-qa/` và `../outputs/mobile-investment-diagnostic/`.

Sửa theo phản hồi trực tiếp từ trình duyệt trong Codex: tab thật báo `prefers-reduced-motion: reduce = true`, trong khi kiểm tra Chrome thông thường dùng `no-preference`. Có hai chỗ làm mất hiệu ứng: JavaScript bỏ qua xu và CSS ẩn toàn bộ layer. Đầu tư nay là phản hồi rõ ràng đã được chủ dự án yêu cầu: chỉ nhóm đầu tư được phép giữ chuyển động 2,6 giây và hiện layer trong chế độ này; các hiệu ứng khác vẫn giảm như trước. Không đổi thiết lập trình duyệt/Windows hoặc trạng thái server. **9/9 kiểm tra liên quan đạt**, gồm viewport Codex 1040×871/reduce và mobile 390×844/reduce/touch, tại `../outputs/CODEX_INVESTMENT_FIX_TESTS.txt`. Đã nhận bằng chứng từ chính Codex: focus hiển thị `block`, animation 2600 ms, tiến độ và transform thay đổi giữa hai mẫu, sau đó layer dọn sạch; xem `../outputs/codex-investment-qa/in-app-events.ndjson`. Chẩn đoán tạm chỉ dùng localhost, nằm ngoài Git và đã gỡ khỏi bản local bình thường sau khi xác định nguyên nhân.

Bằng chứng trực tiếp bao gồm cả khung rộng 1040×871 và khung mobile 390×844 trong cùng trình duyệt Codex, đều báo `reduced: true` và đều phát/thu dọn đầy đủ. Phòng xem thử dùng tiến trình riêng, lưu trong RAM; không thay phiên hay dữ liệu phòng đang chơi trên 3141. Đã trả trình duyệt về bản local 3141 với URL phiên bản mới để tránh dùng JavaScript còn nằm trong tab cũ.

Kiểm tra trước khi merge bản hoàn chỉnh: **157/157 đạt, 0 thất bại, 0 bỏ qua**, với Chrome và PGlite, tại `../outputs/INVESTMENT_MERGE_FULL_TESTS.txt`. Repository check, static build, runtime parity và kiểm tra whitespace đều qua. Các file thử nghiệm/chẩn đoán localhost được giữ ngoài repository.

Chủ dự án yêu cầu ngày 5/11/2026: làm sinh động phần góp xu trục xuất/kick, xem vai trò và đầu tư.

- Chọn đầu tư, mục tiêu kiểm chứng/trục xuất hoặc số xu: phản hồi sáng nhẹ ngay tại điều khiển và ô mục tiêu trên trình duyệt của người chọn. Trường tổng chi báo thiếu xu bằng màu riêng; vẫn dùng kiểm tra chi phí và nút chốt hiện tại.
- Sau khi snapshot xác nhận chính người xem đã chốt: xu Green Coin gốc bay từ ví đến dự án và/hoặc mục tiêu, kèm vòng sáng/dấu kiểm chứng hay trục xuất. Điện thoại giữ nguyên trạng thái ngăn Hội đồng; điểm đến dự phòng là ô hành động nếu mục tiêu không nằm trên màn hình.
- Kết quả kiểm chứng mới: làm nổi dòng kết quả riêng và quét sáng sau chuyển cảnh, khi dòng đó thực sự hiện trên màn hình. Tải lại không phát lại kết quả cũ.
- Nhấn giữ mắt xem vai trò của mình: thẻ vào bằng hiệu ứng lật nhẹ. Thả tay, rời nút, mất focus hoặc ẩn trang vẫn che vai trò ngay; không có hiệu ứng thoát làm lộ thẻ thêm.
- Xác nhận kick vào nhẹ trong đúng ô người chơi, giữ hai biểu tượng nhỏ ở hai góc. Lúc gửi có gradient chuyển động; hiệu ứng bút chì vẫn chỉ chạy sau xác nhận từ server. Hiệu ứng vote-out hiện tại giữ nguyên.

Triển khai `ui/action-fx.js`/`ui/action-fx.css`, nối qua các hook renderer trong `public/app.js`. Không dựng lại giao diện bằng MutationObserver, không thêm dependency, không sửa asset gốc. Chỉ dùng lựa chọn cục bộ và `game.myPlayer.lockedAction/inspections`; không suy ra vai trò/mục tiêu của người khác. Không đổi API, xu thực tế, ngưỡng 5 xu, khóa cuối, đồng hồ, phase hay quyền host. Xu bay biểu thị lựa chọn đã chốt; số dư vẫn đợi kết quả thật của engine.

Hiệu ứng nằm ngoài luồng bố cục, không nhận pointer, không giữ bước chuyển giai đoạn. Lặp snapshot không phát lại khoản đã chốt. Chế độ giảm chuyển động dùng phản hồi opacity ngắn, không bay xu hoặc lật/quét không gian, trừ nhóm đầu tư theo điều chỉnh ngày 6/11 ở trên. Hủy trang/ẩn tab/đổi kích thước dọn hiệu ứng đang chạy. Trạng thái game vẫn được cập nhật bình thường.

## Kiểm tra ngày 5/11/2026

- Toàn bộ bộ kiểm tra: 153/153 đạt, không bỏ qua, gồm browser Chrome và PGlite. Hai kiểm tra mới đi qua hành động thật, lỗi HTTP khi gửi, thiếu xu, giữ bí mật giữa hai người chơi, không phát lại và giảm chuyển động.
- Xem lại chuyển động trên desktop 1440×900 và mobile 390×844: xu đến đúng vị trí, không làm mở ngăn Hội đồng hoặc tràn ngang; kết quả kiểm chứng hiện sau chuyển cảnh; thả nút mắt che vai trò ngay.
- Sửa bộ đo trong `test/action-burn.test.cjs` để xử lý MutationObserver theo thứ tự bản ghi và xác nhận lửa kết thúc trước khi chuyển cảnh. Không đổi thời lượng hay logic đồng hồ trong game.
- Đã đóng gói lại compatibility runtime và xác nhận localhost:3141 trả đúng nội dung mới của `/app.js`, `/action-fx.js`, `/action-fx.css`. Bằng chứng QA và video ngắn nằm ngoài repo trong `outputs/action-effects-qa/`; video hướng dẫn đã duyệt không đổi.
