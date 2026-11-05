# Hiệu ứng thao tác trong trận

Chủ dự án yêu cầu ngày 5/11/2026: làm sinh động phần góp xu trục xuất/kick, xem vai trò và đầu tư.

- Chọn đầu tư, mục tiêu kiểm chứng/trục xuất hoặc số xu: phản hồi sáng nhẹ ngay tại điều khiển và ô mục tiêu trên trình duyệt của người chọn. Trường tổng chi báo thiếu xu bằng màu riêng; vẫn dùng kiểm tra chi phí và nút chốt hiện tại.
- Sau khi snapshot xác nhận chính người xem đã chốt: xu Green Coin gốc bay từ ví đến dự án và/hoặc mục tiêu, kèm vòng sáng/dấu kiểm chứng hay trục xuất. Điện thoại giữ nguyên trạng thái ngăn Hội đồng; điểm đến dự phòng là ô hành động nếu mục tiêu không nằm trên màn hình.
- Kết quả kiểm chứng mới: làm nổi dòng kết quả riêng và quét sáng sau chuyển cảnh, khi dòng đó thực sự hiện trên màn hình. Tải lại không phát lại kết quả cũ.
- Nhấn giữ mắt xem vai trò của mình: thẻ vào bằng hiệu ứng lật nhẹ. Thả tay, rời nút, mất focus hoặc ẩn trang vẫn che vai trò ngay; không có hiệu ứng thoát làm lộ thẻ thêm.
- Xác nhận kick vào nhẹ trong đúng ô người chơi, giữ hai biểu tượng nhỏ ở hai góc. Lúc gửi có gradient chuyển động; hiệu ứng bút chì vẫn chỉ chạy sau xác nhận từ server. Hiệu ứng vote-out hiện tại giữ nguyên.

Triển khai `ui/action-fx.js`/`ui/action-fx.css`, nối qua các hook renderer trong `public/app.js`. Không dựng lại giao diện bằng MutationObserver, không thêm dependency, không sửa asset gốc. Chỉ dùng lựa chọn cục bộ và `game.myPlayer.lockedAction/inspections`; không suy ra vai trò/mục tiêu của người khác. Không đổi API, xu thực tế, ngưỡng 5 xu, khóa cuối, đồng hồ, phase hay quyền host. Xu bay biểu thị lựa chọn đã chốt; số dư vẫn đợi kết quả thật của engine.

Hiệu ứng nằm ngoài luồng bố cục, không nhận pointer, không giữ bước chuyển giai đoạn. Lặp snapshot không phát lại khoản đã chốt. Chế độ giảm chuyển động dùng phản hồi opacity ngắn, không bay xu hoặc lật/quét không gian. Hủy trang/ẩn tab/đổi kích thước dọn hiệu ứng đang chạy. Trạng thái game vẫn được cập nhật bình thường.

## Kiểm tra ngày 5/11/2026

- Toàn bộ bộ kiểm tra: 153/153 đạt, không bỏ qua, gồm browser Chrome và PGlite. Hai kiểm tra mới đi qua hành động thật, lỗi HTTP khi gửi, thiếu xu, giữ bí mật giữa hai người chơi, không phát lại và giảm chuyển động.
- Xem lại chuyển động trên desktop 1440×900 và mobile 390×844: xu đến đúng vị trí, không làm mở ngăn Hội đồng hoặc tràn ngang; kết quả kiểm chứng hiện sau chuyển cảnh; thả nút mắt che vai trò ngay.
- Sửa bộ đo trong `test/action-burn.test.cjs` để xử lý MutationObserver theo thứ tự bản ghi và xác nhận lửa kết thúc trước khi chuyển cảnh. Không đổi thời lượng hay logic đồng hồ trong game.
- Đã đóng gói lại compatibility runtime và xác nhận localhost:3141 trả đúng nội dung mới của `/app.js`, `/action-fx.js`, `/action-fx.css`. Bằng chứng QA và video ngắn nằm ngoài repo trong `outputs/action-effects-qa/`; video hướng dẫn đã duyệt không đổi.
