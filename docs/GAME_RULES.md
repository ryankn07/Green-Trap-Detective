# Bảng luật chơi đầy đủ

Yêu cầu của chủ dự án ngày 5/11/2026: thêm nút **Xem toàn bộ luật chơi** ngay trong ô **Cách chơi** ở phòng chờ, phía trên Rời phòng.

Nội dung nằm trong `#rules-dialog` ở `ui/index.html`, có 8 mục: chuẩn bị/chia phe, ba giai đoạn, đầu tư/tính xu, kiểm chứng, góp xu trục xuất, bị loại/mất kết nối, quyền chủ phòng, thắng/thua/kết thúc. Mục lục chuyển đến từng phần trong khung; tiêu đề/nút đóng luôn nằm ngoài vùng cuộn. Giữ phông chữ, giấy sáng và màu xanh của giao diện hiện tại.

Nguồn đối chiếu:

- `engine/dist/setup.js`: số vai và bộ 10 dự án ngẫu nhiên, không trùng.
- `engine/dist/engine.js`: xu ban đầu, các chi phí, ngưỡng thông qua làm tròn lên, thưởng đầu tư cùng phe ngay cả khi dự án không được duyệt, giới hạn một hành động bổ sung, cộng góp trục xuất trong cùng lượt, kiểm tra hết xu sau thưởng, điều kiện kết thúc.
- `server/rooms.cjs`: tối thiểu 3 người, mọi người online khi bắt đầu, mốc 120/60/25 giây, mặc định khi hết giờ, Skip đồng thuận, quyền quản lý của host, chặn người mới vào giữa trận.
- `engine/dist/view.js`: thông tin riêng trong trận, vai trò và người góp trục xuất được công bố ở kết thúc; không công bố số xu từng người góp.

`ui/rules-ui.js` dùng sự kiện ủy quyền vì phòng chờ được dựng lại khi có người kết nối. Dialog nằm ngoài `#app`, giữ nội dung/vị trí cuộn qua cập nhật. Escape, nút đóng hoặc bấm ngoài đều đóng được; focus trả về nút hiện tại sau rerender, hoặc một điều khiển trận đấu nếu phòng chờ đã kết thúc. Đọc luật không dừng đồng hồ.

Nút mới là yêu cầu giao diện rõ ràng của chủ dự án. Không đổi luật, backend, giới hạn phòng, dữ liệu riêng, video hướng dẫn hoặc artwork. CSS/JS được phục vụ bằng đường dẫn allowlist và chép trong static build. Các thay đổi hiện chỉ ở local; không có commit/push/deploy trong yêu cầu này.

Kiểm tra: **7/7 qua, không bỏ qua**, gồm reader, video hướng dẫn, chuyển giai đoạn, static build và gói runtime. Reader được kiểm tra ở 320/390/768/844/1440/1920 px, cuộn đến mục cuối, điều hướng mục lục, Escape/nút đóng/nền ngoài, giữ vị trí khi phòng cập nhật và tiếp tục đọc khi chủ phòng bắt đầu. QA riêng còn xác nhận Escape đóng luật khi phía sau đang có xác nhận kick. Repository check và runtime parity qua; các đường dẫn đang chạy trên localhost:3141 khớp source. Log ở `../outputs/FULL_RULES_TESTS.txt`, ảnh và kết quả ở `../outputs/full-rules-qa/`.
