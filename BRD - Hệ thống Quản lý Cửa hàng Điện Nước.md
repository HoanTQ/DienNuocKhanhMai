# BRD - Hệ thống Quản lý Cửa hàng Điện Nước

## 1. Giới thiệu tổng quan

### 1.1 Mục đích tài liệu

Tài liệu BRD (Business Requirements Document) này mô tả chi tiết các yêu cầu nghiệp vụ cho việc xây dựng **Hệ thống Quản lý Cửa hàng Điện Nước**. Tài liệu được xây dựng dựa trên kết quả phỏng vấn và khảo sát trực tiếp với chủ cửa hàng, nhằm số hóa và tối ưu hóa các quy trình vận hành hiện tại.

### 1.2 Phạm vi dự án

Hệ thống bao gồm các module chính:

- Quản lý nhập hàng & đặt hàng
- Quản lý tồn kho & sản phẩm
- Quản lý bán hàng & giá bán
- Quản lý khách hàng
- Quản lý công nợ (khách hàng & nhà cung cấp)
- Quản lý trả hàng & bảo hành
- Quản lý người dùng & phân quyền
- Thông báo & cảnh báo
- Báo cáo & thống kê

### 1.3 Đối tượng sử dụng

| **Vai trò** | **Mô tả** | **Quyền hạn chính** |
| --- | --- | --- |
| Chủ cửa hàng | Người quản lý toàn bộ hoạt động kinh doanh | Toàn quyền: đặt hàng, định giá, xem báo cáo, quản lý công nợ |
| Nhân viên bán hàng | Người trực tiếp bán hàng và kiểm hàng | Bán hàng, kiểm hàng nhập, báo tồn kho thấp, tra cứu giá |

### 1.4 Thuật ngữ & viết tắt

| **Thuật ngữ** | **Giải thích** |
| --- | --- |
| SKU | Stock Keeping Unit – Đơn vị quản lý tồn kho, phân biệt sản phẩm theo thương hiệu, quy cách |
| Giá vốn trung bình | Giá nhập trung bình có trọng số qua các lần nhập hàng |
| Giá vốn cuối cùng | Giá nhập của lần nhập hàng gần nhất |
| Nợ gối đầu | Hình thức thanh toán: bán hết đơn cũ → nhập đơn mới → trả tiền đơn cũ |
| NCC | Nhà cung cấp / Nhà phân phối |

---

## 2. Hiện trạng & Vấn đề (As-Is Analysis)

### 2.1 Quy trình hiện tại

<aside>
🔍

Cửa hàng hiện đang vận hành phần lớn thủ công, sử dụng gọi điện/Zalo để đặt hàng, ghi sổ tay và nhập liệu cuối ngày. Chưa có hệ thống quản lý tập trung.

</aside>

- **Đặt hàng:** Chủ cửa hàng đặt qua điện thoại hoặc Zalo. Không có hệ thống ghi chép đơn đặt hàng chính thức. Hai chủ cửa hàng dùng nhóm chat chung để tránh đặt trùng.
- **Nhập hàng:** Nhân viên kiểm số lượng theo phiếu giao hàng, kiểm tra chất lượng nếu được. Hàng điện tử (máy khoan, …) không test được khi nhập.
- **Bán hàng:** Chủ cửa hàng tính tiền, nhân viên không tự tính. Giá hàng biến động liên tục (đặc biệt ống nước, dây điện), nhân viên phải hỏi chủ hàng ngày.
- **Tồn kho:** Không có kiểm soát tồn kho định kỳ. Nhân viên tự báo khi hàng sắp hết.
- **Công nợ:** Ghi tay song song với nhập máy tính. Cuối ngày tổng hợp lại.

### 2.2 Pain Points chính

1. **Quên hàng tồn kho** → Trôi vốn, không biết hàng hư hỏng cho đến khi bán
2. **Không nhớ đã đặt hàng gì** → Đặt trùng hoặc thiếu hàng
3. **Giá biến động liên tục** → Khó kiểm soát lợi nhuận thực tế
4. **Nhập liệu thủ công cuối ngày** → Tốn thời gian, dễ sai sót
5. **Không có báo cáo tức thời** → Không nắm được tình hình kinh doanh realtime
6. **Không nhớ giá tất cả mặt hàng** → Nhân viên/chủ cửa hàng không thể nhớ giá của hàng nghìn SKU, cần tra cứu nhanh qua quét mã vạch hoặc tìm theo tên để hiển thị giá bán chính xác

## 3. Yêu cầu nghiệp vụ chi tiết (To-Be)

### 3.1 Module Quản lý Sản phẩm (Product Management)

#### 3.1.1 Phân loại sản phẩm

| **Nhóm chính** | **Ví dụ** |
| --- | --- |
| Điện | Dây điện, cáp điện, ổ cắm, công tắc, máy khoan… |
| Nước | Ống nước, phụ kiện ống, van, vòi… |
| Sơn | Sơn tường, sơn gỗ, phụ kiện sơn… |

#### 3.1.2 Thuộc tính sản phẩm (SKU)

- **Bắt buộc:** Tên sản phẩm, Nhóm hàng, Thương hiệu, Quy cách, Đơn vị tính cơ bản
- **Tùy chọn:** Mã vạch, Hình ảnh đại diện (1 ảnh/nhóm sản phẩm), Mô tả
- **Lưu ý:** Ngành có khoảng 80,000–90,000 SKU theo kích cỡ. Cửa hàng hiện chưa đến 1,000 SKU → hệ thống cần khả năng mở rộng.

#### 3.1.3 Đơn vị tính & Quy đổi

- Hỗ trợ tối đa 3 **cấp quy đổi**: Đơn vị cấp 1 → Đơn vị cấp 2 → Đơn vị cấp 3
- Ví dụ:
- 1 cuộn = X mét (dây điện, cáp)
- 1 bao = X kg (kẽm); 1 bao → bịch 1kg / 0.5kg
- Đơn vị thường gặp: cm, m, kg, gam, cái, cuộn, bao, bịch, bộ
- Hỗ trợ bán lẻ theo đơn vị nhỏ (ví dụ: bán theo mét từ cuộn cáp)

#### 3.1.4 Mã vạch & Nhập liệu nhanh

- Hỗ trợ quét mã vạch cho sản phẩm có sẵn mã
- **Phương án thay thế cho hàng không có mã vạch:**
    - Dán mã vạch nội bộ lên kệ hàng (không dán lên từng sản phẩm)
    - Tìm kiếm nhanh theo tên/thương hiệu/quy cách
- Không yêu cầu quản lý vị trí kho chi tiết (nhân viên tự nhớ vị trí)

---

### 3.2 Module Đặt hàng & Nhập hàng (Purchasing)

#### 3.2.1 Quản lý Nhà cung cấp

- Danh sách NCC quen thuộc với thông tin liên hệ
- Lưu trữ bảng giá NCC trong hệ thống. Có thể cập nhật số lượng lớn bằng chức năng import (file Excel)
- So sánh giá từ nhiều NCC cho cùng một sản phẩm

#### 3.2.2 Đặt hàng

- Tạo đơn đặt hàng trên hệ thống (thay thế gọi điện/Zalo)
- Hiển thị tồn kho hiện tại khi đặt hàng
- **Cảnh báo tồn kho thấp:** Tự động thông báo khi hàng sắp hết để chủ đặt bổ sung.
- Có thể cài đặt định mức tồn kho thấp theo số lượng hoặc tỉ lệ
- Kiểm tra đơn đặt hàng đang chờ → tránh đặt trùng
- Hỗ trợ nhiều người đặt hàng (anh chủ, chị chủ) với khả năng xem chung

#### 3.2.3 Nhập hàng

- Tạo phiếu nhập kho dựa trên phiếu giao hàng NCC
- Kiểm tra số lượng nhận vs. số lượng đặt
- Ghi nhận hàng khuyến mãi kèm theo (ví dụ: mua 10 tặng 1–2)
- Tự động cập nhật tồn kho và giá vốn sau khi nhập
- Ghi nhận hàng lỗi để trả NCC trong đợt giao tiếp theo

---

### 3.3 Module Quản lý Tồn kho (Inventory)

#### 3.3.1 Theo dõi tồn kho

- Tồn kho realtime theo từng SKU
- Cảnh báo tồn kho tối thiểu
- Theo dõi tuổi lưu kho (hàng không có HSD nhưng cần biết hàng nằm lâu)

#### 3.3.2 Cập nhật giá

- Cập nhật giá nhập mới khi NCC gửi bảng giá
- Tự động tính lại giá vốn trung bình khi nhập hàng mới
- Lưu lịch sử giá nhập theo thời gian

#### 3.3.3 Báo cáo tồn kho

- Báo cáo tồn kho theo nhóm hàng / thương hiệu
- Báo cáo hàng tồn lâu (trôi vốn)
- Báo cáo giá trị tồn kho

---

### 3.4 Module Bán hàng (Sales)

#### 3.4.1 Tạo đơn bán hàng

- Tạo đơn bán hàng tại quầy (bán trực tiếp)
- Quét mã vạch hoặc tìm kiếm nhanh sản phẩm
- Hỗ trợ bán lẻ theo đơn vị nhỏ (mét, kg…)
- Tự động tính thành tiền theo đơn giá × số lượng

#### 3.4.2 Quản lý Giá bán

<aside>
⚡

Đây là yêu cầu phức tạp nhất do đặc thù ngành: giá ống nước và dây điện thay đổi theo ngày, thậm chí theo giờ.

</aside>

- **Hai loại giá:**

| **Loại** | **Đặc điểm** | **Ví dụ** |
| --- | --- | --- |
| Giá cố định | Giá ghi trên sản phẩm, ít thay đổi | Ổ cắm, tua vít, kéo |
| Giá biến động | Thay đổi liên tục theo giá NCC | Ống nước, dây điện, cáp |
- **Giá vốn:**
    - Giá vốn trung bình: Tính tự động qua các lần nhập → dùng để đánh giá lãi/lỗ
    - Giá vốn cuối cùng (giá nhập gần nhất) → dùng để định giá bán
    - Ví dụ: Giá nhập cuối 7,000đ; giá vốn TB 6,800đ; giá bán 10,000đ
- **Logic giá bán:** Nhập cao → bán cao; nhập thấp → hạ giá bán
- Chủ cửa hàng là người quyết định giá, nhân viên tra cứu trên hệ thống

#### 3.4.3 Chiết khấu & Giảm giá

- **Không** cài đặt bảng giá sỉ cố định. Nhân viên tự điều chỉnh theo từng khách ( tham khảo concept nhập giá giảm trên đơn hàng, tự động ghi nhận giảm giá và doanh thu của đơn hàng đó)
- Giảm giá áp dụng **trên tổng đơn hàng**, không giảm từng sản phẩm.
- Hỗ trợ giảm giá theo:
    - Số tiền cố định (ví dụ: giảm 50,000đ)
    - Phần trăm (ví dụ: giảm 5%)
- Chiết khấu có thể áp dụng theo: phần trăm cố định, số lượng mua, hoặc chủ động nhập tay

#### 3.4.4 Thanh toán

- Thanh toán khi giao hàng (đa số)
- Ghi nhận công nợ nếu khách mua nợ
- Hỗ trợ thanh toán tiền mặt & chuyển khoản

---

### 3.5 Module Trả hàng & Bảo hành (Returns & Warranty)

#### 3.5.1 Trả hàng

- **Trả hàng dư:** Khách mua X, dùng Y, trả lại (X-Y). Ví dụ: mua 100m dây, dùng 70m, trả 30m.
- Cách xử lý:
    - Đối với hàng dư nhân viên nhận lại hàng và chủ động trừ trực tiếp trên đơn bán.
- Tự động cập nhật lại tồn kho khi trả hàng

#### 3.5.2 Bảo hành / Đổi hàng

- Khách mang hàng lỗi đến → Cửa hàng đổi sản phẩm mới hoặc trả lại tiền.
- Ghi nhận lý do trả/đổi
- Trừ doanh thu của khách hàng tương ứng
- Hàng lỗi được gom để trả NCC trong đợt giao tiếp theo

#### 3.5.3 Giao hàng qua bên thứ 3

- Cửa hàng **không quản lý trạng thái giao hàng** (không theo dõi đang giao, đã giao, v.v.). Chủ cửa hàng tự gửi hàng cho bên vận chuyển và xử lý ngoài hệ thống.
- Hệ thống chỉ cần **gắn cờ (flag)** vào đơn hàng để ghi nhận đơn đó được giao qua bên thứ 3.
- **Danh mục Người vận chuyển (Transporter Master):**
    - Quản lý danh sách bên vận chuyển quen thuộc (xe ôm, xe ba gác, shipper…) với thông tin liên hệ cơ bản (tên, SĐT).
    - Khi đơn hàng cần giao, chủ/nhân viên chọn người vận chuyển từ danh mục và gắn vào đơn hàng.
- **Thông tin ghi nhận trên đơn hàng:**
    - Người vận chuyển (chọn từ Transporter Master)
    - Thời điểm giao cho bên vận chuyển
- Mục đích: chỉ để biết đơn nào đã đưa cho ai đi giao, phục vụ tra cứu khi cần, không yêu cầu xác nhận giao thành công từ hệ thống.

---

### 3.6 Module Công nợ (Accounts Receivable & Payable)

#### 3.6.1 Công nợ Khách hàng

- Theo dõi số tiền nợ và thời hạn nợ từng khách
- **Phân loại theo tuổi nợ:**

| **Nhóm nợ** | **Thời gian** |
| --- | --- |
| Nợ ngắn hạn | 1–3 ngày |
| Nợ trung hạn | 5 ngày |
| Nợ dài hạn | 1 tháng |
| Nợ lớn | Theo giá trị |
- Báo cáo tổng hợp công nợ
- Hỗ trợ nhập liệu nhanh cuối ngày

#### 3.6.2 Công nợ Nhà cung cấp

- Theo dõi hóa đơn đã trả / chưa trả
- Hỗ trợ hình thức **nợ gối đầu**: bán hết đơn cũ → nhập đơn mới → trả tiền đơn cũ
- Ghi nhận lịch sử thanh toán

---

### 3.7 Module Báo cáo (Reporting)

#### 3.7.1 Báo cáo hàng ngày

- Tổng doanh thu ngày
- Số đơn bán
- Tổng hợp công nợ phát sinh trong ngày
- Khi doanh thu ≥ 1 tỷ/tháng → xuất báo cáo chi tiết hàng ngày

#### 3.7.2 Báo cáo lợi nhuận

- Lợi nhuận gộp theo sản phẩm / nhóm hàng
- So sánh giá bán vs. giá vốn trung bình → đánh giá lãi/lỗ thực tế
- Biên lợi nhuận theo thời gian

#### 3.7.3 Báo cáo tồn kho

- Tồn kho hiện tại theo nhóm / thương hiệu
- Hàng tồn lâu (trôi vốn)
- Giá trị tồn kho tổng

#### 3.7.4 Báo cáo công nợ

- Công nợ khách hàng theo tuổi nợ
- Công nợ NCC và tình trạng thanh toán

#### 3.7.5 Form Báo giá

- Tạo báo giá cho khách hàng
- Hỗ trợ **in ra giấy** để giao cho khách hoặc xuất ra text để copy gửi tin nhắn cho khách hàng
- Bao gồm: danh sách sản phẩm, đơn giá, thành tiền, tổng cộng

---

### 3.8 Module Quản lý Khách hàng (Customer Management)

#### 3.8.1 Danh mục khách hàng

- Quản lý danh sách khách hàng với thông tin cơ bản: Tên, Số điện thoại, Địa chỉ giao hàng

#### 3.8.2 Lịch sử giao dịch

- Xem lịch sử mua hàng theo từng khách
- Tổng giá trị đã mua, số lần mua
- Tra cứu nhanh đơn hàng cũ của khách (hữu ích khi khách quay lại hỏi "lần trước mua gì")

#### 3.8.3 Ghi chú & Quản lý quan hệ

- Ghi chú riêng cho từng khách (ví dụ: "khách hay trả chậm", "thợ điện khu vực X")
- Hiển thị tình trạng công nợ hiện tại khi mở hồ sơ khách
- Tìm kiếm khách hàng nhanh theo tên hoặc SĐT

---

### 3.9 Module Quản lý Người dùng & Phân quyền (User Management)

#### 3.9.1 Đăng nhập & Xác thực

- Đăng nhập bằng **số điện thoại + mật khẩu** (phù hợp với người dùng ít quen công nghệ)
- Hỗ trợ ghi nhớ đăng nhập trên thiết bị tin cậy
- Tự động đăng xuất sau **8 giờ** không hoạt động
- Cho phép đăng nhập đồng thời trên nhiều thiết bị (ví dụ: chủ cửa hàng dùng cả điện thoại và máy tính)

#### 3.9.2 Phân quyền chi tiết

| **Chức năng** | **Chủ cửa hàng** | **Nhân viên bán hàng** |
| --- | --- | --- |
| Xem/cập nhật giá vốn | ✅ | ❌ |
| Cài đặt giá bán | ✅ | ❌ |
| Tra cứu giá bán | ✅ | ✅ |
| Tạo đơn bán hàng | ✅ | ✅ |
| Áp dụng giảm giá | ✅ | ✅ (trong giới hạn) |
| Xem báo cáo lợi nhuận | ✅ | ❌ |
| Xem báo cáo doanh thu | ✅ | ❌ |
| Quản lý công nợ | ✅ | ❌ |
| Quản lý NCC & đặt hàng | ✅ | ❌ |
| Nhập hàng / kiểm hàng | ✅ | ✅ |
| Quản lý khách hàng | ✅ | ✅ (chỉ xem) |
| Quản lý người dùng | ✅ | ❌ |
| Xem lịch sử thao tác | ✅ | ❌ |

#### 3.9.3 Nhật ký hoạt động (Audit Log)

- Ghi nhận mọi thao tác quan trọng: ai làm gì, lúc nào
- Các thao tác cần ghi log: tạo/sửa/xóa đơn hàng, thay đổi giá, điều chỉnh tồn kho, xóa sản phẩm
- Chỉ chủ cửa hàng được xem nhật ký
- Lưu trữ tối thiểu 12 tháng

---

### 3.10 Module Thông báo & Cảnh báo (Notifications)

#### 3.10.1 Các loại thông báo

| **Loại thông báo** | **Người nhận** | **Kênh** |
| --- | --- | --- |
| Tồn kho thấp (đạt mức tối thiểu) | Chủ cửa hàng | Trong app (badge/bell icon) |
| Công nợ khách hàng quá hạn | Chủ cửa hàng | Trong app |
| Đơn đặt hàng NCC đã đến (nhân viên xác nhận nhập) | Chủ cửa hàng | Trong app |
| Giá NCC thay đổi (khi cập nhật bảng giá mới) | Chủ cửa hàng | Trong app |
| Hàng tồn lâu (vượt ngưỡng cài đặt) | Chủ cửa hàng | Trong app |

#### 3.10.2 Cơ chế thông báo

- **Kênh chính:** Thông báo trong ứng dụng (notification bell) — hiển thị số thông báo chưa đọc
- **Tùy chọn mở rộng (Phase sau):** Push notification trên điện thoại khi có cảnh báo quan trọng
- Cho phép chủ cửa hàng bật/tắt từng loại thông báo
- Thông báo tồn kho thấp chỉ gửi **1 lần** cho mỗi SKU cho đến khi hàng được nhập bổ sung

#### 3.10.3 Trang tổng hợp thông báo

- Danh sách tất cả thông báo, sắp xếp theo thời gian
- Đánh dấu đã đọc / chưa đọc
- Lọc theo loại thông báo
- Nhấn vào thông báo → điều hướng đến màn hình liên quan (ví dụ: nhấn "tồn kho thấp" → mở trang đặt hàng)

---

## 4. Yêu cầu phi chức năng

### 4.1 Nền tảng & Thiết bị

- **Loại ứng dụng:** Web application (responsive)
- **Thiết bị hỗ trợ:**

| **Thiết bị** | **Vai trò sử dụng chính** | **Yêu cầu** |
| --- | --- | --- |
| Điện thoại (Android/iOS) | Nhân viên tra cứu giá, quét mã vạch, tạo đơn nhanh | Giao diện tối ưu cho màn hình nhỏ, hỗ trợ camera quét mã vạch |
| Tablet | Bán hàng tại quầy | Giao diện thoải mái, dễ thao tác |
| Máy tính (Desktop/Laptop) | Chủ cửa hàng xem báo cáo, quản lý giá, nhập liệu hàng loạt | Giao diện đầy đủ chức năng |

- **Trình duyệt hỗ trợ:** Chrome, Safari, Firefox (phiên bản mới nhất và 2 phiên bản trước)
- **Responsive design:** Giao diện tự động điều chỉnh theo kích thước màn hình, ưu tiên mobile-first cho các chức năng bán hàng & tra cứu giá
- **Kết nối mạng:** Yêu cầu kết nối internet. Không yêu cầu offline mode ở giai đoạn MVP (có thể xem xét ở phase sau nếu cần)

### 4.2 Hiệu suất

- Tìm kiếm sản phẩm nhanh (< 2 giây)
- Hỗ trợ xử lý đồng thời nhiều đơn bán
- Tải trang ban đầu < 3 giây trên mạng 4G
- Quét mã vạch và hiển thị kết quả < 1 giây

### 4.3 Khả năng sử dụng

- Giao diện đơn giản, dễ dùng cho nhân viên không quen công nghệ
- Ưu tiên luồng thao tác ngắn, ít bước nhấn
- Hỗ trợ nhập liệu nhanh cho cuối ngày
- Kích thước nút bấm và font chữ đủ lớn trên điện thoại
- Hỗ trợ thao tác một tay trên điện thoại cho các chức năng thường dùng (tra giá, quét mã)

### 4.4 Khả năng mở rộng

- Hỗ trợ mở rộng số lượng SKU từ < 1,000 lên hàng chục nghìn
- Có thể thêm module mới trong tương lai

### 4.5 Bảo mật

- Phân quyền theo vai trò (Chủ / Nhân viên) — chi tiết tại mục 3.9.2
- Nhân viên không được truy cập: giá vốn, báo cáo lợi nhuận, cài đặt giá
- Mã hóa mật khẩu, truyền dữ liệu qua HTTPS
- Không dễ dàng bị hack hoặc phá
- Khóa tài khoản sau 5 lần đăng nhập sai liên tiếp

---

## 5. Ưu tiên triển khai (Phased Approach)

### Phase 1 – MVP (Ưu tiên cao)

- [ ]  Quản lý tồn kho (theo dõi realtime, cảnh báo tồn kho tối thiểu, báo cáo tồn kho)
- [ ]  Mã vạch & tra cứu giá (quét mã vạch / dán mã nội bộ lên kệ để hiển thị giá bán nhanh)
- [ ]  Đơn bán hàng (tạo đơn tại quầy, tìm kiếm nhanh sản phẩm, tính tiền, hỗ trợ bán lẻ theo đơn vị nhỏ)
- [ ]  Đăng nhập & phân quyền cơ bản (Chủ / Nhân viên)
- [ ]  Responsive web app (chạy tốt trên điện thoại, tablet, máy tính)

### Phase 2 – Mở rộng

- [ ]  Quản lý danh mục sản phẩm (phân loại, SKU, đơn vị quy đổi)
- [ ]  Nhập hàng & cập nhật tồn kho
- [ ]  Quản lý giá vốn (trung bình + cuối cùng) & giá bán
- [ ]  Quản lý khách hàng (danh mục, phân loại, lịch sử giao dịch)
- [ ]  Công nợ khách hàng cơ bản
- [ ]  Chiết khấu / giảm giá trên đơn hàng
- [ ]  Trả hàng & bảo hành
- [ ]  Thông báo trong app (tồn kho thấp, công nợ quá hạn)
- [ ]  Nhật ký hoạt động (Audit Log)

### Phase 3 – Nâng cao

- [ ]  Quản lý NCC & đơn đặt hàng
- [ ]  Công nợ NCC & nợ gối đầu
- [ ]  Báo cáo hàng ngày & lợi nhuận
- [ ]  Báo cáo nâng cao (tuổi nợ, hàng tồn lâu, biên lợi nhuận)
- [ ]  Form báo giá có thể in
- [ ]  Push notification trên điện thoại
- [ ]  OCR đọc sổ nợ tay (nếu khả thi)

---

## 6. Phụ lục

### 6.1 Tham chiếu

- Nội dung từ buổi phỏng vấn yêu cầu hệ thống quản lý cửa hàng điện nước ngày 11/05/2026

### 6.2 Lịch sử thay đổi

| **Phiên bản** | **Ngày** | **Người thực hiện** | **Nội dung thay đổi** |
| --- | --- | --- | --- |
| 1.0 | 16/05/2026 | BA | Tạo mới tài liệu BRD |
| 1.1 | 16/05/2026 | BA | Bổ sung: Nền tảng web responsive, Module Quản lý Khách hàng, Module Quản lý Người dùng & Phân quyền, Module Thông báo & Cảnh báo |