QUICKQUIZ 2.0 — MINI GAME ONLINE

Chạy trên máy: cài Node.js 22 trở lên, mở START.bat hoặc chạy npm start.
Mở http://localhost:3000.

Tùy chỉnh: Tạo phòng > Chỉnh sửa câu hỏi > sửa nội dung và 4 đáp án,
chọn đáp án đúng bằng nút tròn, thêm/xóa câu (1–30), thời gian 5–120 giây.
Nhấn Lưu câu hỏi trước khi bắt đầu. Mỗi phòng có bộ câu hỏi riêng.
Nút Dùng bộ đã lưu lấy bộ cuối cùng đã lưu ở trình duyệt này (localStorage).
Xuất JSON để sao lưu hoặc chuyển máy, Nhập JSON để sử dụng lại.
File JSON có dạng {"seconds":15,"questions":[{"question":"...","options":["A","B","C","D"],"correct":0}]}.
correct: 0=A, 1=B, 2=C, 3=D. Có sẵn 10 câu mẫu.

ĐƯA LÊN INTERNET (Render):
1. Tạo repository mới tại https://github.com/new.
2. Tải toàn bộ file BÊN TRONG thư mục QuickQuiz-v2 lên repository (package.json, server.js, public/ ... phải ở root).
3. Đăng nhập https://dashboard.render.com/ bằng GitHub, chọn New > Web Service, chọn repository.
4. Language: Node; Build Command: npm install; Start Command: npm start; Instance Type: Free (nếu có).
   Root Directory: để trống nếu file ở root. Health Check Path: /health (tùy chọn).
5. Deploy. Mở URL HTTPS do Render cung cấp, tạo phòng, gửi link phòng cho người chơi.
   Có thể dùng New > Blueprint với render.yaml thay cho cấu hình thủ công.

Lưu ý: Không dùng GitHub Pages / Static Site cho backend Node.js.
Free Render ngủ sau 15 phút không có truy cập; lần truy cập đầu có thể chậm.
Phòng và điểm chỉ lưu RAM; mất khi server khởi động lại, phòng hết hạn sau 12 giờ.
Bộ câu hỏi lưu trên trình duyệt chủ phòng, không đồng bộ giữa các máy; nên xuất JSON.
Tốc độ tính theo thứ tự server nhận câu trả lời đúng (có thể bị ảnh hưởng bởi độ trễ mạng).
Không có tài khoản hoặc cơ sở dữ liệu. Chạy một instance; không scale nhiều instance.
