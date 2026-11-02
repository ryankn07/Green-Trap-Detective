# Green Trap Detective

Trò chơi suy luận xã hội trực tuyến về các dự án môi trường. Người chơi thảo luận, đưa ra nhận định công khai và khóa lệnh bí mật trước khi xem kết quả từng lượt.

**Chơi tại:** [greentrap.vercel.app](https://greentrap.vercel.app)

## Chơi

- Tạo phòng, chia sẻ mã phòng và bắt đầu khi có ít nhất 3 người. Trò chơi hỗ trợ nhóm trên 10 người và không đặt mức tối đa cố định; nhà vận hành có thể đặt `ROOM_MAX_PLAYERS`.
- Chủ phòng có thể mời người chơi ra khỏi phòng chờ hoặc phòng đang chơi.
- Mỗi ván chọn 10 trong 25 dự án. Các giai đoạn là thảo luận (`DEBATE`), khóa lệnh bí mật (`BLIND_ACTION`), công bố (`REVEAL`) và kết thúc (`GAME_OVER`).

## Chạy trên máy

Cần Node.js 20 trở lên. Trong thư mục dự án, chạy:

```bash
npm start
```

Mở `http://localhost:3000`; biến `PORT` có thể đổi cổng. Ứng dụng dùng Node HTTP server, HTML/CSS/JavaScript thuần và Server-Sent Events để cập nhật phòng.

Trước khi chạy, `prestart` khôi phục các tệp runtime còn thiếu từ `runtime.bundle.part01`–`03`, không ghi đè tệp hiện có. Kiểm tra bộ khôi phục mà không ghi tệp bằng `node scripts/restore-runtime-bundle.cjs --check`. Sau khi sửa nguồn nằm trong bộ này hoặc danh mục dự án, chạy `npm run bundle:pack` để cập nhật bundle.

## Kiểm thử

```bash
npm test
```

Các kiểm thử Node chạy không cần cài thêm dependency. Kiểm thử trình duyệt cần Playwright đã cài riêng: đặt `PLAYWRIGHT_MODULE_PATH` tới module đó trước khi chạy; `BROWSER_CHANNEL` tùy chọn, mặc định là `msedge`. Nếu thiếu đường dẫn Playwright, các kiểm thử trình duyệt sẽ được báo là **skipped**. Có thể đặt `BROWSER_ARTIFACT_DIR` để lưu ảnh kiểm thử.

## Triển khai và dữ liệu

Frontend hiện dùng Vercel và chuyển các yêu cầu API tới backend Render. Bộ nhớ tệp của Render miễn phí là tạm thời: dữ liệu phòng có thể mất khi dịch vụ khởi động lại hoặc triển khai lại. Tích hợp Supabase đang được thực hiện, chưa được xem là giải pháp lưu trữ đã hoàn thành.

Mặc định `npm start` lưu ảnh chụp phòng tại `data/rooms.json`; có thể đặt `ROOM_STORE_PATH` thành đường dẫn tuyệt đối khác. Ảnh chụp chứa thông tin phiên và dữ liệu trò chơi riêng tư, vì vậy không đưa vào Git hoặc thư mục công khai. Lưu trữ tệp hiện chỉ hỗ trợ một tiến trình; để giữ dữ liệu cần ổ đĩa bền vững và cấu hình phù hợp.

Giới hạn tài nguyên, tốc độ yêu cầu và các quota theo nguồn giúp giảm lạm dụng nhưng không phải là bảo vệ DDoS hay giới hạn sức chứa đã được đo trên mọi máy chủ. Mã phòng là lời mời, không phải bí mật kiểm soát truy cập. Xem [quy mô và bảo mật](docs/SCALE_AND_SECURITY.md) để biết chi tiết và cấu hình proxy.

## Cấu trúc và quyền sử dụng

- `engine/dist/`: luật chơi, thiết lập và dữ liệu dự án.
- `server/`: phòng, phiên, bộ đếm thời gian và API.
- `public/`, `ui/`: giao diện và hình ảnh thẻ gốc.
- `test/`: kiểm thử Node và trình duyệt.

Tác phẩm thẻ Canva và các tài sản thương hiệu thuộc về chủ sở hữu tương ứng; việc có trong kho không tự cấp quyền sử dụng lại. Các phông chữ đi kèm có điều khoản riêng trong tệp OFL tương ứng. Kho chưa công bố giấy phép phần mềm tổng thể; hãy liên hệ chủ sở hữu trước khi sử dụng lại mã hoặc tài sản.
