# Requirements Document

## Introduction

Tài liệu yêu cầu cho **Quản lý Giá nâng cao** — mở rộng hệ thống nhập kho hiện có để hỗ trợ chiết khấu theo dòng sản phẩm và tự động tính giá vốn từ thông tin thanh toán. Đồng thời hiển thị thông tin giá NCC (giá niêm yết hãng) trên trang chi tiết sản phẩm để owner có cái nhìn tổng quan về giá.

## Glossary

- **Giá_NCC**: Giá nhà cung cấp niêm yết cho sản phẩm (chưa chiết khấu) — lưu trong bảng `supplier_prices`
- **Giá_vốn**: Giá thực tế nhập hàng SAU chiết khấu, tính trên từng đơn vị sản phẩm = Thanh toán / Số lượng
- **WAC**: Weighted Average Cost — Giá vốn trung bình có trọng số, tính tự động qua trigger
- **Chiết_khấu**: Khoản giảm giá NCC áp dụng khi nhập hàng, có thể là % hoặc số tiền cố định, áp dụng theo từng dòng sản phẩm
- **Thanh_toán**: Số tiền thực tế phải trả cho một dòng sản phẩm (sau chiết khấu)
- **Giá_bán**: Giá bán cho khách hàng — owner tự cài đặt

## Requirements

### Requirement 1: Chiết khấu trên phiếu nhập kho

**User Story:** Là Chủ_cửa_hàng, tôi muốn nhập chiết khấu (% hoặc số tiền) cho từng dòng sản phẩm khi nhập hàng, để hệ thống tự động tính giá vốn chính xác mà tôi không cần tính tay.

#### Acceptance Criteria

1. THE hệ_thống SHALL cho phép nhập chiết khấu theo 2 dạng cho từng dòng sản phẩm trong phiếu nhập kho: phần trăm (%) HOẶC số tiền cố định (VNĐ)
2. WHEN chiết khấu là phần trăm, THE hệ_thống SHALL hiển thị số tiền chiết khấu tương ứng dựa trên thành tiền (Số lượng × Giá NCC) để owner xác nhận
3. WHEN chiết khấu là số tiền cố định, THE hệ_thống SHALL trừ trực tiếp số tiền đó khỏi thành tiền
4. THE hệ_thống SHALL cho phép mỗi dòng sản phẩm có chiết khấu khác nhau (không bắt buộc đồng nhất cả phiếu)
5. THE hệ_thống SHALL cho phép chiết khấu = 0 (không có chiết khấu)

---

### Requirement 2: Tự động tính giá vốn từ thanh toán

**User Story:** Là Chủ_cửa_hàng, tôi muốn chỉ cần nhập Số lượng + Thanh toán + Chiết khấu, và hệ thống tự tính giá vốn cho từng sản phẩm, để tiết kiệm thời gian và giảm sai sót.

#### Acceptance Criteria

1. THE hệ_thống SHALL tự động tính `unit_price` (giá vốn/sp) = `total_payment / quantity` khi người dùng nhập đủ Số lượng và Thanh toán
2. THE hệ_thống SHALL hiển thị giá vốn/sp đã tính ngay trên form nhập kho để owner xác nhận trước khi lưu
3. WHEN phiếu nhập kho được xác nhận (confirmed), THE hệ_thống SHALL sử dụng `unit_price` đã tính để cập nhật WAC theo công thức hiện tại: `New WAC = (Current Stock × Current WAC + New Qty × unit_price) / (Current Stock + New Qty)`
4. THE hệ_thống SHALL lưu `total_payment`, `discount_type`, `discount_value` vào `goods_receipt_items` để truy xuất lại thông tin gốc
5. THE hệ_thống SHALL validate: `total_payment > 0`, `quantity > 0`, và `unit_price` tính ra phải ≥ 0

---

### Requirement 3: Hiển thị thông tin giá trên trang sản phẩm

**User Story:** Là Chủ_cửa_hàng, tôi muốn xem tổng quan giá (Giá NCC, Giá vốn TB, Giá bán, Lợi nhuận) ngay trên trang chi tiết sản phẩm, để nhanh chóng đánh giá hiệu quả kinh doanh.

#### Acceptance Criteria

1. THE trang_chi_tiết_sản_phẩm SHALL hiển thị cho Owner: Giá NCC (từ `supplier_prices`), Giá vốn TB (`weighted_avg_cost`), Giá nhập gần nhất (`last_cost`), Giá bán (`selling_price`), và Lợi nhuận dự kiến (Giá bán - WAC)
2. WHEN một sản phẩm có nhiều NCC, THE hệ_thống SHALL hiển thị giá NCC gần nhất (theo `effective_date`) hoặc giá thấp nhất
3. THE trang_chi_tiết_sản_phẩm SHALL hiển thị phần trăm lợi nhuận = `(Giá bán - WAC) / WAC × 100%`
4. WHEN Giá vốn = 0 (chưa nhập hàng lần nào), THE hệ_thống SHALL hiển thị "Chưa có giá vốn" thay vì tính lợi nhuận
5. THE hệ_thống SHALL ẩn Giá NCC và Giá vốn đối với Nhân_viên (chỉ Owner mới thấy)

---

### Requirement 4: Flow nhập kho tối giản

**User Story:** Là Chủ_cửa_hàng, tôi muốn thao tác nhập kho nhanh nhất có thể (ít field nhập nhất), để không mất thời gian khi hàng về nhiều.

#### Acceptance Criteria

1. THE form_nhập_kho SHALL chỉ yêu cầu nhập tối thiểu: Sản phẩm, Số lượng, Thanh toán. Chiết khấu là optional (mặc định = 0)
2. THE form_nhập_kho SHALL tự động điền Giá NCC (từ `supplier_prices`) làm giá tham khảo khi chọn sản phẩm, NHƯNG không bắt buộc dùng giá này để tính
3. WHEN người dùng nhập Thanh toán, THE hệ_thống SHALL real-time tính và hiển thị: Giá vốn/sp, và nếu có Giá NCC thì hiển thị % chiết khấu thực tế
4. THE form_nhập_kho SHALL hỗ trợ nhập nhiều dòng sản phẩm cùng lúc (dạng bảng) và hiển thị tổng thanh toán cuối phiếu
5. THE hệ_thống SHALL cho phép tạo phiếu nhập kho trực tiếp (không bắt buộc từ đơn đặt hàng)
