# Requirements Document

## Introduction

Tài liệu yêu cầu cho **Hệ thống Quản lý Cửa hàng Điện Nước** — một ứng dụng web responsive giúp số hóa và tối ưu hóa toàn bộ quy trình vận hành cửa hàng kinh doanh vật tư điện nước, bao gồm: quản lý tồn kho, bán hàng, nhập hàng, công nợ, khách hàng, và báo cáo. Hệ thống hướng đến người dùng là chủ cửa hàng và nhân viên bán hàng, với giao diện tiếng Việt, thiết kế mobile-first cho các chức năng bán hàng và tra cứu giá.

## Glossary

- **Hệ_thống**: Hệ thống Quản lý Cửa hàng Điện Nước (toàn bộ ứng dụng web)
- **Module_Tồn_Kho**: Thành phần quản lý tồn kho realtime, cảnh báo, và báo cáo tồn kho
- **Module_Bán_Hàng**: Thành phần xử lý đơn bán hàng tại quầy (POS)
- **Module_Sản_Phẩm**: Thành phần quản lý danh mục sản phẩm, SKU, đơn vị quy đổi
- **Module_Nhập_Hàng**: Thành phần quản lý đặt hàng và nhập hàng từ nhà cung cấp
- **Module_Khách_Hàng**: Thành phần quản lý thông tin và lịch sử giao dịch khách hàng
- **Module_Công_Nợ**: Thành phần theo dõi công nợ khách hàng và nhà cung cấp
- **Module_Xác_Thực**: Thành phần đăng nhập, phân quyền, và quản lý người dùng
- **Module_Thông_Báo**: Thành phần gửi và hiển thị thông báo, cảnh báo trong ứng dụng
- **Module_Báo_Cáo**: Thành phần tạo báo cáo doanh thu, lợi nhuận, tồn kho, công nợ
- **Module_Trả_Hàng**: Thành phần xử lý trả hàng dư, bảo hành, đổi hàng
- **Module_Giao_Hàng**: Thành phần gắn cờ giao hàng qua bên thứ 3 và quản lý danh mục người vận chuyển
- **SKU**: Stock Keeping Unit — đơn vị quản lý tồn kho, phân biệt sản phẩm theo thương hiệu và quy cách
- **Giá_vốn_trung_bình**: Giá nhập trung bình có trọng số qua các lần nhập hàng
- **Giá_vốn_cuối_cùng**: Giá nhập của lần nhập hàng gần nhất
- **NCC**: Nhà cung cấp / Nhà phân phối
- **Chủ_cửa_hàng**: Người quản lý toàn bộ hoạt động kinh doanh, có toàn quyền trên hệ thống
- **Nhân_viên**: Nhân viên bán hàng, có quyền hạn chế theo phân quyền
- **Đơn_vị_quy_đổi**: Hệ thống quy đổi tối đa 3 cấp đơn vị tính cho một sản phẩm
- **Nợ_gối_đầu**: Hình thức thanh toán NCC: bán hết đơn cũ → nhập đơn mới → trả tiền đơn cũ

## Requirements

### Requirement 1: Quản lý Tồn kho Realtime

**User Story:** Là Chủ_cửa_hàng, tôi muốn theo dõi tồn kho theo thời gian thực cho từng SKU, để biết chính xác số lượng hàng hiện có và phát hiện hàng sắp hết.

#### Acceptance Criteria

1. THE Module_Tồn_Kho SHALL hiển thị số lượng tồn kho hiện tại cho từng SKU theo đơn vị tính cơ bản
2. WHEN một đơn bán hàng được xác nhận, THE Module_Tồn_Kho SHALL trừ số lượng tương ứng khỏi tồn kho của SKU trong đơn đó
3. WHEN một phiếu nhập kho được xác nhận, THE Module_Tồn_Kho SHALL cộng số lượng tương ứng vào tồn kho của SKU trong phiếu đó
4. WHEN số lượng tồn kho của một SKU đạt hoặc thấp hơn mức tồn kho tối thiểu đã cài đặt, THE Module_Tồn_Kho SHALL tạo một cảnh báo tồn kho thấp cho SKU đó
5. THE Module_Tồn_Kho SHALL cho phép Chủ_cửa_hàng cài đặt mức tồn kho tối thiểu cho từng SKU theo số lượng hoặc tỉ lệ
6. WHEN một cảnh báo tồn kho thấp đã được gửi cho một SKU, THE Module_Tồn_Kho SHALL không gửi cảnh báo lặp lại cho SKU đó cho đến khi hàng được nhập bổ sung
7. THE Module_Tồn_Kho SHALL theo dõi tuổi lưu kho (thời gian kể từ lần nhập gần nhất) cho từng SKU

---

### Requirement 2: Quét Mã vạch và Tra cứu Giá

**User Story:** Là Nhân_viên, tôi muốn quét mã vạch hoặc tìm kiếm nhanh sản phẩm để hiển thị giá bán chính xác, vì cửa hàng có hàng nghìn SKU mà không thể nhớ hết giá.

#### Acceptance Criteria

1. WHEN người dùng quét mã vạch bằng camera thiết bị, THE Hệ_thống SHALL hiển thị thông tin sản phẩm và giá bán trong thời gian dưới 1 giây
2. WHEN người dùng nhập từ khóa tìm kiếm (tên, thương hiệu, hoặc quy cách), THE Hệ_thống SHALL hiển thị danh sách sản phẩm phù hợp trong thời gian dưới 2 giây
3. THE Hệ_thống SHALL hỗ trợ quét mã vạch có sẵn trên sản phẩm và mã vạch nội bộ dán trên kệ hàng
4. WHEN kết quả tra cứu được hiển thị, THE Hệ_thống SHALL hiển thị: tên sản phẩm, quy cách, đơn vị tính, giá bán hiện tại, và số lượng tồn kho

---

### Requirement 3: Đơn Bán hàng (POS)

**User Story:** Là Nhân_viên, tôi muốn tạo đơn bán hàng nhanh trực tiếp trên web với thao tác đơn giản, để phục vụ khách hàng hiệu quả mà không cần chờ chủ cửa hàng tính tiền.

#### Acceptance Criteria

1. THE Module_Bán_Hàng SHALL cho phép tạo đơn bán hàng bằng cách quét mã vạch hoặc tìm kiếm sản phẩm
2. THE Module_Bán_Hàng SHALL hỗ trợ bán lẻ theo đơn vị nhỏ (mét, kg) từ đơn vị lớn (cuộn, bao) dựa trên Đơn_vị_quy_đổi
3. WHEN sản phẩm được thêm vào đơn hàng, THE Module_Bán_Hàng SHALL tự động tính thành tiền theo công thức: đơn giá × số lượng
4. THE Module_Bán_Hàng SHALL hiển thị tổng tiền đơn hàng được cập nhật theo thời gian thực khi thêm hoặc xóa sản phẩm
5. THE Module_Bán_Hàng SHALL hỗ trợ thanh toán bằng tiền mặt và chuyển khoản ngân hàng
6. WHEN khách hàng mua nợ, THE Module_Bán_Hàng SHALL ghi nhận công nợ và liên kết đơn hàng với hồ sơ khách hàng
7. WHEN đơn bán hàng được xác nhận, THE Module_Bán_Hàng SHALL tự động cập nhật tồn kho tương ứng


---

### Requirement 4: Đăng nhập và Phân quyền

**User Story:** Là Chủ_cửa_hàng, tôi muốn kiểm soát quyền truy cập của nhân viên vào các chức năng nhạy cảm (giá vốn, báo cáo lợi nhuận), để bảo vệ thông tin kinh doanh.

#### Acceptance Criteria

1. THE Module_Xác_Thực SHALL cho phép đăng nhập bằng số điện thoại và mật khẩu
2. THE Module_Xác_Thực SHALL mã hóa mật khẩu trước khi lưu trữ
3. THE Module_Xác_Thực SHALL truyền toàn bộ dữ liệu qua giao thức HTTPS
4. WHEN người dùng đăng nhập thành công, THE Module_Xác_Thực SHALL cấp quyền truy cập theo vai trò (Chủ_cửa_hàng hoặc Nhân_viên)
5. IF người dùng nhập sai mật khẩu 5 lần liên tiếp, THEN THE Module_Xác_Thực SHALL khóa tài khoản đó
6. WHILE người dùng không thao tác trong 8 giờ liên tục, THE Module_Xác_Thực SHALL tự động đăng xuất phiên làm việc đó
7. THE Module_Xác_Thực SHALL cho phép đăng nhập đồng thời trên nhiều thiết bị cho cùng một tài khoản
8. THE Module_Xác_Thực SHALL hỗ trợ ghi nhớ đăng nhập trên thiết bị tin cậy
9. WHILE Nhân_viên đang đăng nhập, THE Module_Xác_Thực SHALL chặn truy cập vào: giá vốn, cài đặt giá bán, báo cáo lợi nhuận, báo cáo doanh thu, quản lý công nợ, quản lý NCC, quản lý người dùng, và nhật ký hoạt động

---

### Requirement 5: Giao diện Responsive Web

**User Story:** Là Nhân_viên, tôi muốn sử dụng hệ thống trên điện thoại để tra cứu giá và tạo đơn nhanh ngay tại kệ hàng, mà không cần quay lại quầy máy tính.

#### Acceptance Criteria

1. THE Hệ_thống SHALL hiển thị giao diện tự động điều chỉnh theo kích thước màn hình của điện thoại, tablet, và máy tính
2. THE Hệ_thống SHALL thiết kế theo nguyên tắc mobile-first cho các chức năng bán hàng và tra cứu giá
3. THE Hệ_thống SHALL hiển thị nút bấm và font chữ đủ lớn để thao tác dễ dàng trên màn hình điện thoại
4. THE Hệ_thống SHALL hỗ trợ thao tác một tay trên điện thoại cho các chức năng tra cứu giá và quét mã vạch
5. THE Hệ_thống SHALL tải trang ban đầu trong thời gian dưới 3 giây trên kết nối mạng 4G
6. THE Hệ_thống SHALL hỗ trợ các trình duyệt Chrome, Safari, và Firefox (phiên bản mới nhất và 2 phiên bản trước đó)
7. THE Hệ_thống SHALL hiển thị toàn bộ giao diện bằng tiếng Việt

---

### Requirement 6: Quản lý Danh mục Sản phẩm

**User Story:** Là Chủ_cửa_hàng, tôi muốn tổ chức sản phẩm theo nhóm hàng, thương hiệu, và quy cách với hệ thống đơn vị quy đổi linh hoạt, để quản lý hàng nghìn SKU một cách có hệ thống.

#### Acceptance Criteria

1. THE Module_Sản_Phẩm SHALL lưu trữ các thuộc tính bắt buộc cho mỗi SKU: tên sản phẩm, nhóm hàng, thương hiệu, quy cách, và đơn vị tính cơ bản
2. THE Module_Sản_Phẩm SHALL hỗ trợ các thuộc tính tùy chọn: mã vạch, hình ảnh đại diện (1 ảnh cho mỗi nhóm sản phẩm), và mô tả
3. THE Module_Sản_Phẩm SHALL hỗ trợ phân loại sản phẩm theo nhóm chính (Điện, Nước, Sơn) và nhóm phụ
4. THE Module_Sản_Phẩm SHALL hỗ trợ tối đa 3 cấp Đơn_vị_quy_đổi cho mỗi sản phẩm (ví dụ: 1 cuộn = X mét, 1 bao = Y kg)
5. THE Module_Sản_Phẩm SHALL hỗ trợ mở rộng từ dưới 1,000 SKU lên hàng chục nghìn SKU mà không giảm hiệu suất tìm kiếm


---

### Requirement 7: Nhập hàng và Cập nhật Tồn kho

**User Story:** Là Chủ_cửa_hàng, tôi muốn tạo phiếu nhập kho dựa trên phiếu giao hàng của NCC và tự động cập nhật tồn kho cùng giá vốn, để giảm nhập liệu thủ công và đảm bảo dữ liệu chính xác.

#### Acceptance Criteria

1. THE Module_Nhập_Hàng SHALL cho phép tạo phiếu nhập kho với thông tin: NCC, danh sách sản phẩm, số lượng, và đơn giá nhập
2. WHEN phiếu nhập kho được xác nhận, THE Module_Nhập_Hàng SHALL tự động cộng số lượng vào tồn kho và tính lại Giá_vốn_trung_bình
3. THE Module_Nhập_Hàng SHALL hiển thị so sánh giữa số lượng đặt và số lượng thực nhận
4. THE Module_Nhập_Hàng SHALL cho phép ghi nhận hàng khuyến mãi kèm theo (ví dụ: mua 10 tặng 1)
5. THE Module_Nhập_Hàng SHALL cho phép ghi nhận hàng lỗi để trả NCC trong đợt giao tiếp theo
6. WHEN phiếu nhập kho được xác nhận, THE Module_Nhập_Hàng SHALL cập nhật Giá_vốn_cuối_cùng bằng đơn giá nhập của phiếu đó

---

### Requirement 8: Quản lý Giá vốn và Giá bán

**User Story:** Là Chủ_cửa_hàng, tôi muốn hệ thống tự động tính giá vốn và cho phép tôi cài đặt giá bán linh hoạt theo biến động thị trường, để kiểm soát lợi nhuận thực tế.

#### Acceptance Criteria

1. THE Module_Sản_Phẩm SHALL lưu trữ hai loại giá vốn cho mỗi SKU: Giá_vốn_trung_bình và Giá_vốn_cuối_cùng
2. WHEN hàng được nhập mới, THE Module_Sản_Phẩm SHALL tự động tính lại Giá_vốn_trung_bình theo công thức trung bình có trọng số
3. THE Module_Sản_Phẩm SHALL cho phép Chủ_cửa_hàng cài đặt giá bán cho từng SKU
4. THE Module_Sản_Phẩm SHALL phân biệt hai loại giá bán: giá cố định (ít thay đổi) và giá biến động (thay đổi theo giá NCC)
5. THE Module_Sản_Phẩm SHALL lưu lịch sử giá nhập theo thời gian cho từng SKU
6. WHILE Nhân_viên đang đăng nhập, THE Module_Sản_Phẩm SHALL chỉ hiển thị giá bán và ẩn toàn bộ thông tin giá vốn

---

### Requirement 9: Quản lý Khách hàng

**User Story:** Là Chủ_cửa_hàng, tôi muốn lưu trữ thông tin khách hàng và lịch sử giao dịch, để phục vụ khách tốt hơn khi họ quay lại (ví dụ: tra cứu "lần trước mua gì").

#### Acceptance Criteria

1. THE Module_Khách_Hàng SHALL lưu trữ thông tin khách hàng: tên, số điện thoại, và địa chỉ giao hàng
2. THE Module_Khách_Hàng SHALL hiển thị lịch sử mua hàng theo từng khách bao gồm: danh sách đơn hàng, tổng giá trị đã mua, và số lần mua
3. THE Module_Khách_Hàng SHALL cho phép tìm kiếm khách hàng theo tên hoặc số điện thoại
4. THE Module_Khách_Hàng SHALL cho phép ghi chú riêng cho từng khách hàng (ví dụ: đặc điểm, thói quen thanh toán)
5. WHEN hồ sơ khách hàng được mở, THE Module_Khách_Hàng SHALL hiển thị tình trạng công nợ hiện tại của khách đó
6. WHILE Nhân_viên đang đăng nhập, THE Module_Khách_Hàng SHALL chỉ cho phép xem thông tin khách hàng mà không cho phép chỉnh sửa


---

### Requirement 10: Công nợ Khách hàng

**User Story:** Là Chủ_cửa_hàng, tôi muốn theo dõi công nợ từng khách hàng theo tuổi nợ, để biết ai nợ bao nhiêu, nợ bao lâu, và đòi nợ kịp thời.

#### Acceptance Criteria

1. THE Module_Công_Nợ SHALL theo dõi số tiền nợ và thời hạn nợ cho từng khách hàng
2. THE Module_Công_Nợ SHALL phân loại công nợ theo tuổi nợ: ngắn hạn (1-3 ngày), trung hạn (5 ngày), dài hạn (1 tháng), và nợ lớn (theo giá trị)
3. THE Module_Công_Nợ SHALL cung cấp báo cáo tổng hợp công nợ khách hàng
4. WHEN khách hàng thanh toán một phần hoặc toàn bộ nợ, THE Module_Công_Nợ SHALL cập nhật số dư nợ tương ứng
5. THE Module_Công_Nợ SHALL hỗ trợ nhập liệu nhanh công nợ cuối ngày

---

### Requirement 11: Chiết khấu và Giảm giá

**User Story:** Là Nhân_viên, tôi muốn áp dụng giảm giá linh hoạt trên tổng đơn hàng theo chỉ đạo của chủ cửa hàng hoặc trong giới hạn được phép, để phục vụ khách hàng quen thuộc.

#### Acceptance Criteria

1. THE Module_Bán_Hàng SHALL hỗ trợ giảm giá trên tổng đơn hàng theo số tiền cố định (ví dụ: giảm 50,000đ)
2. THE Module_Bán_Hàng SHALL hỗ trợ giảm giá trên tổng đơn hàng theo phần trăm (ví dụ: giảm 5%)
3. THE Module_Bán_Hàng SHALL ghi nhận số tiền giảm giá và doanh thu thực tế cho mỗi đơn hàng
4. WHILE Nhân_viên đang tạo đơn hàng, THE Module_Bán_Hàng SHALL giới hạn mức giảm giá tối đa mà Nhân_viên được phép áp dụng (theo cài đặt của Chủ_cửa_hàng)

---

### Requirement 12: Trả hàng và Bảo hành

**User Story:** Là Chủ_cửa_hàng, tôi muốn xử lý trả hàng dư và đổi hàng lỗi một cách có hệ thống, để cập nhật chính xác tồn kho và doanh thu.

#### Acceptance Criteria

1. WHEN khách hàng trả hàng dư, THE Module_Trả_Hàng SHALL cho phép trừ số lượng trả trực tiếp trên đơn bán hàng gốc
2. WHEN hàng trả được xác nhận, THE Module_Trả_Hàng SHALL tự động cộng số lượng trả vào tồn kho
3. WHEN khách hàng đổi hàng lỗi, THE Module_Trả_Hàng SHALL ghi nhận lý do trả/đổi
4. WHEN hàng lỗi được đổi hoặc hoàn tiền, THE Module_Trả_Hàng SHALL trừ doanh thu tương ứng khỏi hồ sơ khách hàng
5. THE Module_Trả_Hàng SHALL gom hàng lỗi vào danh sách chờ trả NCC trong đợt giao tiếp theo

---

### Requirement 13: Giao hàng qua Bên thứ 3

**User Story:** Là Chủ_cửa_hàng, tôi muốn gắn cờ đơn hàng giao qua bên vận chuyển và ghi nhận ai đang giao, để tra cứu khi cần mà không cần quản lý trạng thái giao hàng phức tạp.

#### Acceptance Criteria

1. THE Module_Giao_Hàng SHALL quản lý danh mục người vận chuyển với thông tin: tên và số điện thoại
2. WHEN đơn hàng cần giao qua bên thứ 3, THE Module_Giao_Hàng SHALL cho phép chọn người vận chuyển từ danh mục và gắn cờ vào đơn hàng
3. WHEN đơn hàng được gắn cờ giao hàng, THE Module_Giao_Hàng SHALL ghi nhận thời điểm giao cho bên vận chuyển
4. THE Module_Giao_Hàng SHALL cho phép tra cứu đơn hàng theo người vận chuyển


---

### Requirement 14: Quản lý Nhà cung cấp và Đặt hàng

**User Story:** Là Chủ_cửa_hàng, tôi muốn quản lý danh sách NCC, so sánh giá, và tạo đơn đặt hàng trên hệ thống, để thay thế việc đặt hàng qua điện thoại/Zalo và tránh đặt trùng.

#### Acceptance Criteria

1. THE Module_Nhập_Hàng SHALL quản lý danh sách NCC với thông tin liên hệ
2. THE Module_Nhập_Hàng SHALL lưu trữ bảng giá NCC và hỗ trợ cập nhật hàng loạt bằng import file Excel
3. THE Module_Nhập_Hàng SHALL cho phép so sánh giá từ nhiều NCC cho cùng một sản phẩm
4. THE Module_Nhập_Hàng SHALL cho phép tạo đơn đặt hàng trên hệ thống với thông tin: NCC, danh sách sản phẩm, số lượng, và ghi chú
5. WHEN người dùng tạo đơn đặt hàng, THE Module_Nhập_Hàng SHALL hiển thị tồn kho hiện tại của từng sản phẩm trong đơn
6. WHEN người dùng tạo đơn đặt hàng, THE Module_Nhập_Hàng SHALL cảnh báo nếu có đơn đặt hàng đang chờ cho cùng sản phẩm đó
7. THE Module_Nhập_Hàng SHALL cho phép nhiều người dùng (Chủ_cửa_hàng) xem chung danh sách đơn đặt hàng

---

### Requirement 15: Công nợ Nhà cung cấp

**User Story:** Là Chủ_cửa_hàng, tôi muốn theo dõi hóa đơn đã trả và chưa trả cho từng NCC, bao gồm hình thức Nợ_gối_đầu, để quản lý dòng tiền hiệu quả.

#### Acceptance Criteria

1. THE Module_Công_Nợ SHALL theo dõi trạng thái thanh toán (đã trả / chưa trả) cho từng hóa đơn nhập hàng từ NCC
2. THE Module_Công_Nợ SHALL hỗ trợ ghi nhận hình thức Nợ_gối_đầu: liên kết đơn hàng cũ với đơn hàng mới để theo dõi chu kỳ thanh toán
3. THE Module_Công_Nợ SHALL ghi nhận lịch sử thanh toán cho từng NCC
4. THE Module_Công_Nợ SHALL cung cấp báo cáo tổng hợp công nợ NCC và tình trạng thanh toán

---

### Requirement 16: Thông báo và Cảnh báo trong Ứng dụng

**User Story:** Là Chủ_cửa_hàng, tôi muốn nhận thông báo tự động khi có sự kiện quan trọng (tồn kho thấp, công nợ quá hạn, giá NCC thay đổi), để xử lý kịp thời mà không cần kiểm tra thủ công.

#### Acceptance Criteria

1. THE Module_Thông_Báo SHALL hiển thị biểu tượng chuông (bell icon) với số lượng thông báo chưa đọc
2. THE Module_Thông_Báo SHALL gửi thông báo cho Chủ_cửa_hàng khi: tồn kho đạt mức tối thiểu, công nợ khách hàng quá hạn, đơn đặt hàng NCC đã đến, giá NCC thay đổi, và hàng tồn lâu vượt ngưỡng
3. THE Module_Thông_Báo SHALL hiển thị trang tổng hợp thông báo sắp xếp theo thời gian với khả năng đánh dấu đã đọc/chưa đọc
4. THE Module_Thông_Báo SHALL cho phép lọc thông báo theo loại
5. WHEN người dùng nhấn vào một thông báo, THE Module_Thông_Báo SHALL điều hướng đến màn hình liên quan (ví dụ: nhấn "tồn kho thấp" mở trang đặt hàng)
6. THE Module_Thông_Báo SHALL cho phép Chủ_cửa_hàng bật/tắt từng loại thông báo

---

### Requirement 17: Nhật ký Hoạt động (Audit Log)

**User Story:** Là Chủ_cửa_hàng, tôi muốn xem lịch sử mọi thao tác quan trọng trên hệ thống (ai làm gì, lúc nào), để kiểm soát hoạt động của nhân viên và phát hiện sai sót.

#### Acceptance Criteria

1. THE Hệ_thống SHALL ghi nhận nhật ký cho các thao tác: tạo/sửa/xóa đơn hàng, thay đổi giá, điều chỉnh tồn kho, và xóa sản phẩm
2. THE Hệ_thống SHALL lưu trữ trong mỗi bản ghi nhật ký: người thực hiện, thời điểm, loại thao tác, và chi tiết thay đổi
3. WHILE Chủ_cửa_hàng đang đăng nhập, THE Hệ_thống SHALL cho phép xem và tìm kiếm nhật ký hoạt động
4. WHILE Nhân_viên đang đăng nhập, THE Hệ_thống SHALL chặn truy cập vào nhật ký hoạt động
5. THE Hệ_thống SHALL lưu trữ nhật ký hoạt động tối thiểu 12 tháng


---

### Requirement 18: Báo cáo Doanh thu và Lợi nhuận

**User Story:** Là Chủ_cửa_hàng, tôi muốn xem báo cáo doanh thu hàng ngày và lợi nhuận theo sản phẩm/nhóm hàng, để nắm được tình hình kinh doanh realtime và ra quyết định giá bán phù hợp.

#### Acceptance Criteria

1. THE Module_Báo_Cáo SHALL hiển thị báo cáo doanh thu hàng ngày bao gồm: tổng doanh thu, số đơn bán, và tổng công nợ phát sinh trong ngày
2. THE Module_Báo_Cáo SHALL hiển thị báo cáo lợi nhuận gộp theo sản phẩm và nhóm hàng (so sánh giá bán với Giá_vốn_trung_bình)
3. THE Module_Báo_Cáo SHALL hiển thị biên lợi nhuận theo thời gian
4. WHILE Nhân_viên đang đăng nhập, THE Module_Báo_Cáo SHALL chặn truy cập vào báo cáo doanh thu và lợi nhuận

---

### Requirement 19: Báo cáo Tồn kho và Công nợ

**User Story:** Là Chủ_cửa_hàng, tôi muốn xem báo cáo tồn kho (theo nhóm, hàng tồn lâu, giá trị) và báo cáo công nợ (theo tuổi nợ), để phát hiện hàng trôi vốn và đòi nợ kịp thời.

#### Acceptance Criteria

1. THE Module_Báo_Cáo SHALL hiển thị báo cáo tồn kho theo nhóm hàng và thương hiệu
2. THE Module_Báo_Cáo SHALL hiển thị báo cáo hàng tồn lâu (vượt ngưỡng thời gian cài đặt)
3. THE Module_Báo_Cáo SHALL hiển thị tổng giá trị tồn kho
4. THE Module_Báo_Cáo SHALL hiển thị báo cáo công nợ khách hàng phân loại theo tuổi nợ
5. THE Module_Báo_Cáo SHALL hiển thị báo cáo công nợ NCC và tình trạng thanh toán

---

### Requirement 20: Form Báo giá

**User Story:** Là Chủ_cửa_hàng, tôi muốn tạo báo giá cho khách hàng và in ra giấy hoặc gửi qua tin nhắn, để phục vụ khách hàng chuyên nghiệp hơn.

#### Acceptance Criteria

1. THE Module_Báo_Cáo SHALL cho phép tạo báo giá với thông tin: danh sách sản phẩm, đơn giá, số lượng, thành tiền, và tổng cộng
2. THE Module_Báo_Cáo SHALL hỗ trợ in báo giá ra giấy
3. THE Module_Báo_Cáo SHALL hỗ trợ xuất báo giá dạng text để copy gửi qua tin nhắn cho khách hàng

---

### Requirement 21: Push Notification trên Điện thoại

**User Story:** Là Chủ_cửa_hàng, tôi muốn nhận push notification trên điện thoại khi có cảnh báo quan trọng, để xử lý kịp thời ngay cả khi không mở ứng dụng.

#### Acceptance Criteria

1. WHERE tính năng push notification được bật, THE Module_Thông_Báo SHALL gửi push notification đến điện thoại của Chủ_cửa_hàng cho các cảnh báo quan trọng (tồn kho thấp, công nợ quá hạn)
2. THE Module_Thông_Báo SHALL cho phép Chủ_cửa_hàng bật/tắt push notification cho từng loại cảnh báo

---

### Requirement 22: Khả năng Sử dụng (Usability)

**User Story:** Là Nhân_viên không quen công nghệ, tôi muốn giao diện đơn giản với ít bước thao tác, để sử dụng hệ thống hiệu quả mà không cần đào tạo nhiều.

#### Acceptance Criteria

1. THE Hệ_thống SHALL thiết kế luồng thao tác ngắn gọn, tối thiểu số bước nhấn cho các chức năng thường dùng (tạo đơn, tra giá)
2. THE Hệ_thống SHALL hỗ trợ nhập liệu nhanh cho việc tổng hợp cuối ngày
3. THE Hệ_thống SHALL xử lý đồng thời nhiều đơn bán hàng mà không gây xung đột dữ liệu

---

## Phase Mapping

| Requirement | Phase |
|---|---|
| 1. Quản lý Tồn kho Realtime | Phase 1 (MVP) |
| 2. Quét Mã vạch và Tra cứu Giá | Phase 1 (MVP) |
| 3. Đơn Bán hàng (POS) | Phase 1 (MVP) |
| 4. Đăng nhập và Phân quyền | Phase 1 (MVP) |
| 5. Giao diện Responsive Web | Phase 1 (MVP) |
| 6. Quản lý Danh mục Sản phẩm | Phase 2 |
| 7. Nhập hàng và Cập nhật Tồn kho | Phase 2 |
| 8. Quản lý Giá vốn và Giá bán | Phase 2 |
| 9. Quản lý Khách hàng | Phase 2 |
| 10. Công nợ Khách hàng | Phase 2 |
| 11. Chiết khấu và Giảm giá | Phase 2 |
| 12. Trả hàng và Bảo hành | Phase 2 |
| 13. Giao hàng qua Bên thứ 3 | Phase 2 |
| 14. Quản lý NCC và Đặt hàng | Phase 3 |
| 15. Công nợ Nhà cung cấp | Phase 3 |
| 16. Thông báo và Cảnh báo | Phase 2 (in-app) / Phase 3 (push) |
| 17. Nhật ký Hoạt động | Phase 2 |
| 18. Báo cáo Doanh thu và Lợi nhuận | Phase 3 |
| 19. Báo cáo Tồn kho và Công nợ | Phase 3 |
| 20. Form Báo giá | Phase 3 |
| 21. Push Notification | Phase 3 |
| 22. Khả năng Sử dụng | Phase 1 (MVP) |
