> SUPERSEDED CAPACITY ASSUMPTION: the owner clarified that 10 is the minimum group scale to support, not a maximum of 12. The 12-player target and reject-player-13 criteria below are historical planning errors. Implementation removes hardcoded 8/12 caps, with optional operator room policy and separate process safety budgets. See SCALE_AND_SECURITY.md for completed work and evidence.

# Kế hoạch lượt reset: phòng 12 người, danh sách cuộn, bảo mật cơ bản

Trạng thái: đã kiểm tra code và lập kế hoạch; CHƯA triển khai các thay đổi dưới đây.
Yêu cầu: hơn 8 người, không dưới 10; PC cuộn ngang trong một box; điện thoại giữ box cuộn dọc; tối ưu và bảo mật thực dụng. Không triển khai tiếp trong lượt lập kế hoạch để tiết kiệm usage.

## Baseline và ranh giới

- Repo: C:/Users/Alveris/Documents/Codex/2026-10-27/c/ee.
- HEAD kiểm tra: 4b7eb19f3402cfbec7b14ede1a7ed92453f32b6d. Worktree đã có nhiều sửa đổi UI/branding/ảnh HD chưa commit; giữ nguyên, không reset/clean/restore --force.
- Chọn mục tiêu 12 người/phòng vì engine hiện hỗ trợ 3–12. Đây là lựa chọn triển khai đáp ứng ít nhất 10, không phải tuyên bố người dùng yêu cầu đúng 12. Giữ mức tối thiểu 3 để không tự đổi luật bắt đầu ván. Nếu chủ dự án cần hơn 12, phải mở riêng phạm vi engine/cân bằng rồi kiểm thử lại.
- Yêu cầu mới cho phép đổi capacity/backend; quy định cũ trong AGENTS cấm đổi capacity trong UI-only task không ngăn công việc này. Cập nhật tài liệu mâu thuẫn sau khi triển khai.
- Giữ Green Trap Detective, Taste Skill/Hallmark, ảnh Canva HD trên cả hai thiết bị; không thêm note trang trí, không thiết kế lại mobile hay đổi kinh tế/luật.
- Không thêm framework/dependency, gói hosting trả phí, DB hay hệ thống đăng nhập nếu chưa cần. Không commit/push/deploy trong lượt tiếp theo nếu chưa được yêu cầu cho thay đổi mới.

## Bằng chứng đã đọc từ code

1. server/rooms.cjs join() từ chối khi players.length >= 8.
2. server/room-store.cjs load() từ chối snapshot có hơn 8 người. Chỉ sửa join sẽ làm phòng lớn không khôi phục được.
3. engine/dist/setup.js saboteurCount() nhận 3–12, số phá hoại = floor((n-1)/2). 10 người: 6 bảo vệ/4 phá hoại; 11: 6/5; 12: 7/5. Không sửa công thức này chỉ để tăng capacity.
4. public/app.js hardcode 3–8 và /8 ở lobby/gameplay. ui/style.css phần PC dùng repeat(8,minmax(0,1fr)), overflow:visible; chưa phải box cuộn ngang. Mobile đã có panel cố định/cuộn dọc.
5. server/server.cjs có bearer token, header CSP, whitelist asset, body limit; rooms.cjs dùng randomBytes(32), timingSafeEqual; view() chiếu dữ liệu theo người chơi. Đây là lớp bảo vệ sẵn có, không được làm mất.
6. Server chưa thấy rate limiter, tổng trần phòng/SSE hay xử lý backpressure. readBody cộng chuỗi và destroy request khi quá 8000 ký tự; cần kiểm tra byte limit và phản hồi lỗi ổn định. Catch hiện trả err.message cho mọi lỗi.
7. changed() gọi persist() và broadcast; store save() ghi/fsync đồng bộ toàn bộ phòng. Cần đo độ trễ khi nhiều người cùng thao tác, không phỏng đoán hay đổi kiến trúc trước khi đo.

## Thứ tự triển khai (8 việc)

1. Chụp baseline mới: git status/diff và HEAD; đọc ask-matt, grill-with-docs cùng references, tdd, code-review và tài liệu repo. Đọc NEXT_RESET_PLAN này và CARD_HD_FIX trước khi chỉnh. Chạy test hiện có; phân biệt test browser bị skip. Dùng Antigravity CLI cho một lượt rà rủi ro read-only ngắn; không API trực tiếp, không để viết code, không gửi secret. Có thể dùng ChatGPT web bằng Computer Use cho checklist độc lập. Không dùng Dot vì chủ dự án đã yêu cầu bỏ Dot.

2. Nâng capacity đồng bộ: tạo nguồn cấu hình giới hạn chung cho room manager và snapshot validator; đưa maxPlayers trong public room projection để client hiển thị, tránh lặp số 12 ở nhiều nơi. Không nhận capacity từ client. Viết test đỏ tại RoomManager/HTTP và persistence trước: người thứ 10/11/12 vào được, người thứ 13 bị từ chối, phòng cũ 8 người vẫn load, phòng 12 người restart/reconnect được. Kiểm tra join đồng thời không vượt trần, full-room không làm thay đổi state. Không giới hạn hiển thị bằng slice bỏ người.

3. Đổi box người chơi PC: dùng một hàng không wrap, chiều rộng tile đọc được, overflow-x:auto bên trong box, min-width:0 trên cha để toàn trang không tràn. Giữ tên dài, trạng thái, chủ phòng/người hiện tại và trạng thái bị loại rõ ràng. Cuộn được bằng trackpad, thanh cuộn và bàn phím; không cần thêm nút trang trí. Áp dụng lobby và màn chơi theo cấu trúc hiện có. Điện thoại giữ panel cuộn dọc, đóng/mở/focus và vùng bấm hiện tại; chỉ nhận đủ 12 mục.

4. Rà và khóa quyền ở server: kiểm thử người lạ, token sai/phòng khác, giả playerId/role/coins/host; host-only start/next; payload null/array/sai kiểu; target không tồn tại/đã bị loại; đầu tư và ngân hàng vượt tiền; submit trùng/replay sau đổi lượt. Xác minh các lệnh đã được engine chặn trước khi sửa; chỉ vá lỗi chứng minh được. Tiền/role/đáp án/locked action của người khác tuyệt đối không xuất hiện trong JSON/SSE trước thời điểm luật cho phép. Kiểm tra bằng raw response, không chỉ nhìn UI.

5. Chống spam và cạn tài nguyên: thêm rate limit có bộ nhớ và dọn TTL, tách create/join khỏi action/state/reconnect; kết hợp IP và session/phòng, không chỉ IP vì nhiều điện thoại chung Wi-Fi. Trả 429 + Retry-After, lỗi tiếng Việt dễ hiểu. Xác minh proxy Render trước khi tin forwarded IP; client tự gửi X-Forwarded-For không được đổi danh tính rate limit. Đặt trần phòng, kết nối, request timeout và hàng đợi ghi phù hợp phép đo; dọn room/SSE/map/limiter khi hết hạn. Xử lý res.write(false)/client chậm và reconnect storm mà không leak người chơi online hay làm treo server. Không chọn con số trần tùy tiện rồi gọi là đã tối ưu.

6. Cứng hóa HTTP/dữ liệu: xác thực JSON object và kiểu từng trường; tính kích thước body bằng byte, malformed/oversize trả 400/413 ổn định, không crash hay log secret. Áp origin policy cho request có Origin trên route ghi, vẫn cho client cùng origin và test hợp lệ; Origin chỉ là lớp phụ, bearer auth luôn bắt buộc. Không thêm CORS wildcard. Lỗi nội bộ trả thông báo chung/500, lỗi luật giữ mã thích hợp; log server đã che token. Thử XSS tên/nhận định qua raw HTTP và browser, giữ escapeHTML/textContent. Thử đọc .env, data/rooms.json, .git, traversal, asset sai tên; chỉ whitelist được phục vụ. Giữ file snapshot ngoài public và không log/upload. Không hứa chống DDoS lớn bằng rate limiter trong process.

7. Đo tải rồi tối ưu chỗ thực sự chậm: chạy 1 phòng 12 người qua 10 lượt, 5 phòng x12 người làm mức thăm dò ban đầu; ghi cấu hình máy/process, Node, thời lượng, p50/p95 hành động→snapshot, CPU/RSS, event-loop lag, bytes/SSE. Tăng tải dần để tìm ngưỡng thực thay vì coi 60 người là cam kết hosting. Theo dõi đồng thời download ảnh HD, refresh/reconnect, người offline. Nếu persistence đồng bộ hoặc render cả app gây lag, sửa nhỏ có test giữ draft/focus/scroll, thứ tự ghi và an toàn restart. Không giảm ảnh về thumbnail để lấy kết quả nhanh; cân nhắc cache/định dạng lossless hoặc chất lượng nhìn đã kiểm chứng khi cần. Không tuyên bố tối ưu khi chỉ có test unit xanh.

8. Kiểm chứng, review và bàn giao: chạy matrix dưới đây; review standards/spec trên phạm vi thay đổi với helper thực tế đang dùng, Codex tự xác minh. Chạy npm run bundle:pack nếu sửa public/app.js, sau đó bundle --check và npm test. Cập nhật README/AGENTS capacity và security notes/giới hạn đã đo. Lưu báo cáo kết quả + ảnh PC/mobile, diff nhỏ và danh sách tồn đọng; chỉ chuẩn bị bản reviewable, chưa phát hành.

## Matrix nghiệm thu bắt buộc

| Phạm vi | Bằng chứng cần đạt |
|---|---|
| Capacity | Phòng thật đủ 10, 11, 12; chặn 13; tên/số lượng/host đúng; 12 người khôi phục sau restart |
| Ván | 12 session riêng qua DEBATE, BLIND_ACTION, REVEAL, GAME_OVER và hết 10 lượt khi điều kiện cho phép; không lẫn token/draft; deadline, ngưỡng ceil(alive/2), payout, loại người đúng luật |
| PC | 1200/1440/1920px; danh sách một box cuộn ngang, đủ cả 12 người, không tràn toàn trang; cuộn giữ được khi SSE cập nhật; bàn phím tiếp cận được |
| Mobile | 320/390/430px; đủ 12 trong panel cuộn dọc, đóng/mở/focus được, không tràn ngang, không đổi bố cục; tên dài tiếng Việt và trạng thái không chồng nhau |
| Thẻ | Cả PC/mobile nhận 1414x2000; mở phóng to nét, HD lỗi có fallback; không bỏ ảnh HD hay thay artwork để tối ưu |
| Quyền/riêng tư | Raw JSON/SSE không lộ thông tin ngoài quyền; forged token/host/payload bị chặn và không mutate state; role/đáp án chỉ mở đúng phase |
| Abuse | Create/join/action spam bị hạn chế; 12 máy chung NAT vẫn chơi bình thường; malformed/oversize/slow/reconnect không crash, không tích tài nguyên vô hạn |
| Tải | Báo số đo thật cho mức 12 và 60 concurrent thử nghiệm; mục tiêu ban đầu p95 action→snapshot <1 giây tại local, không mất lệnh hợp lệ; nếu không đạt thì báo và sửa, không đổi benchmark để che lỗi |
| Hồi quy | Syntax, npm test, bundle parity đạt; test browser phải thực chạy hoặc báo rõ phần còn thiếu; giữ nguyên diff sẵn có và dữ liệu nguồn |

## Ưu tiên nếu usage tiếp tục hạn chế

- P0: capacity + snapshot restore + private projection/authorization tests.
- P1: box cuộn đúng thiết bị + rate limit/HTTP bounds/resource cleanup.
- P2: đo tải và tối ưu theo số đo + matrix/review/tài liệu.
- Không coi xong P0 là xong toàn bộ yêu cầu. Chưa có kết quả audit hoặc benchmark bảo mật/tải trong lượt lập kế hoạch này.

## Lệnh bắt đầu lượt reset

Đọc docs/NEXT_RESET_PLAN.md, kiểm tra git diff hiện tại, rồi làm việc 1–2. Không chạy lại export Canva hay thiết kế lại trang. Không publish tự động. Các giới hạn/ngưỡng vận hành được chọn sau khi quan sát host và phép đo, không cần hỏi lại những quyết định đã được chủ dự án chốt ở trên.
