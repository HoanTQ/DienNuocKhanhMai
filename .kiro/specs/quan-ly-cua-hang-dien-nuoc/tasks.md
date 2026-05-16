# Implementation Plan: Hệ thống Quản lý Cửa hàng Điện Nước

## Overview

Kế hoạch triển khai hệ thống quản lý cửa hàng điện nước theo 3 phase. Sử dụng Next.js 14+ (App Router), Supabase (PostgreSQL + Auth + Realtime + Storage), Tailwind CSS + shadcn/ui, Zustand, Vitest + fast-check. Mỗi task xây dựng tăng dần trên các task trước đó, đảm bảo không có code orphan.

## Tasks

- [x] 1. Khởi tạo Project và Cấu trúc cơ bản
  - [x] 1.1 Khởi tạo Next.js project với App Router, cài đặt dependencies
    - Tạo Next.js 14+ project với TypeScript
    - Cài đặt: tailwindcss, shadcn/ui, @supabase/supabase-js, @supabase/ssr, zustand, @ericblade/quagga2, zod, fast-check, vitest
    - Cấu hình tailwind.config.ts với mobile-first breakpoints
    - Cấu hình vitest.config.ts
    - _Requirements: 5.1, 5.2, 5.6_

  - [x] 1.2 Thiết lập cấu trúc thư mục và TypeScript types
    - Tạo cấu trúc: src/app, src/components, src/lib, src/services theo design
    - Định nghĩa tất cả TypeScript interfaces: Product, UnitConversion, SalesOrder, SalesOrderItem, StockMovement, PurchaseOrder, GoodsReceipt, Customer, DebtRecord, UserProfile, Notification, AuditLog
    - Tạo file src/lib/types/index.ts chứa toàn bộ interfaces
    - _Requirements: 6.1, 3.1, 9.1, 10.1_

  - [x] 1.3 Cấu hình Supabase client và environment
    - Tạo src/lib/supabase/client.ts (browser client)
    - Tạo src/lib/supabase/server.ts (server component client)
    - Tạo src/lib/supabase/middleware.ts (middleware client)
    - Cấu hình environment variables (.env.local.example)
    - _Requirements: 4.3_

  - [x] 1.4 Tạo Database schema và migrations
    - Tạo SQL migrations cho tất cả 17 tables theo design
    - Tạo indexes cho performance (barcode, name trigram, FTS tiếng Việt, composite search)
    - Tạo RLS policies cho owner và staff roles
    - Tạo database triggers cho stock updates và audit logging
    - Tạo view products_staff_view (ẩn giá vốn cho staff)
    - _Requirements: 4.9, 8.6, 17.1, 6.5_


- [x] 2. Module Xác thực và Phân quyền (Phase 1)
  - [x] 2.1 Implement Auth service và login page
    - Tạo src/services/auth.service.ts với logic: login bằng phone + password, session management, failed login tracking
    - Tạo src/app/(auth)/login/page.tsx với form đăng nhập (số điện thoại + mật khẩu)
    - Implement khóa tài khoản sau 5 lần sai mật khẩu
    - Implement ghi nhớ đăng nhập trên thiết bị tin cậy
    - Giao diện tiếng Việt, mobile-first
    - _Requirements: 4.1, 4.2, 4.5, 4.7, 4.8_

  - [x] 2.2 Implement Next.js Middleware cho auth và RBAC
    - Tạo src/middleware.ts kiểm tra JWT token trên mọi request
    - Implement auto-logout sau 8 giờ không hoạt động
    - Implement route protection: chặn staff truy cập routes nhạy cảm (giá vốn, báo cáo lợi nhuận, audit log, quản lý NCC, quản lý user)
    - Hỗ trợ đăng nhập đồng thời nhiều thiết bị
    - _Requirements: 4.4, 4.6, 4.7, 4.9_

  - [x] 2.3 Write property test cho RBAC (Property 9)
    - **Property 9: Role-Based Access Control**
    - Test: với mọi user role 'staff', access vào cost prices, profit reports, revenue reports, debt management, supplier management, user management, audit logs đều bị denied
    - Test: với mọi user role 'owner', access vào tất cả resources đều được granted
    - **Validates: Requirements 4.4, 4.9, 8.6, 17.3, 17.4**

  - [x] 2.4 Write property test cho Password Hashing (Property 18)
    - **Property 18: Password Hashing**
    - Test: với mọi plaintext password, stored value không bao giờ bằng plaintext
    - Test: stored value là valid hash có thể verify lại password gốc
    - **Validates: Requirements 4.2**

- [x] 3. Checkpoint - Auth hoạt động
  - Ensure all tests pass, ask the user if questions arise.


- [x] 4. Module Sản phẩm và Tồn kho cơ bản (Phase 1)
  - [x] 4.1 Implement Pricing Service
    - Tạo src/services/pricing.service.ts với các hàm:
      - calculateWeightedAvgCost(currentStock, currentAvgCost, newQuantity, newUnitCost)
      - convertUnit(quantity, fromUnit, toUnit, conversions)
      - calculateDiscount(subtotal, discountType, discountValue)
      - calculateLineTotal(quantity, unitPrice)
    - Implement validation cho tất cả inputs (không cho phép số âm, division by zero)
    - _Requirements: 8.2, 3.2, 11.1, 11.2, 3.3_

  - [x] 4.2 Write property test cho Weighted Average Cost (Property 2)
    - **Property 2: Weighted Average Cost Calculation**
    - Test: WAC mới = (S × C + Q × P) / (S + Q) cho mọi valid inputs
    - Test: khi current_stock = 0, WAC mới = new unit cost
    - Test: WAC luôn nằm giữa min và max của old cost và new cost
    - **Validates: Requirements 7.2, 8.2**

  - [x] 4.3 Write property test cho Unit Conversion (Property 3)
    - **Property 3: Unit Conversion Transitivity**
    - Test: chuyển đổi L1→L3 trực tiếp = L1→L2→L3 tuần tự
    - Test: round-trip conversion (L1→base→L1) trả về giá trị ban đầu
    - **Validates: Requirements 3.2, 6.4**

  - [x] 4.4 Implement Inventory Service
    - Tạo src/services/inventory.service.ts với logic:
      - updateStock(productId, quantity, movementType, referenceId)
      - checkLowStock(productId) → tạo alert nếu <= min_stock_level
      - getStockAge(productId) → tính tuổi lưu kho
    - Implement deduplication: không gửi alert lặp lại cho cùng SKU cho đến khi nhập bổ sung
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7_

  - [x] 4.5 Write property test cho Stock Movement (Property 1)
    - **Property 1: Stock Movement Invariant**
    - Test: sau sale quantity Q → new_stock = old_stock - Q
    - Test: sau receipt quantity Q → new_stock = old_stock + Q
    - Test: sau return quantity Q → new_stock = old_stock + Q
    - Test: stock không bao giờ âm
    - **Validates: Requirements 1.2, 1.3, 3.7, 12.2**

  - [x] 4.6 Write property test cho Low Stock Alert (Property 7)
    - **Property 7: Low Stock Alert Threshold**
    - Test: alert được tạo khi và chỉ khi current_stock <= min_stock_level
    - Test: không có duplicate alert cho cùng SKU cho đến khi stock được replenish
    - **Validates: Requirements 1.4, 1.6**

  - [x] 4.7 Implement trang Quản lý Tồn kho UI
    - Tạo src/app/(dashboard)/inventory/page.tsx
    - Hiển thị danh sách SKU với: tên, tồn kho hiện tại, đơn vị, mức tối thiểu, tuổi lưu kho
    - Cho phép cài đặt mức tồn kho tối thiểu cho từng SKU
    - Hiển thị cảnh báo tồn kho thấp
    - Subscribe Supabase Realtime cho cập nhật tồn kho realtime
    - Responsive: mobile-first layout
    - _Requirements: 1.1, 1.4, 1.5, 1.7, 5.1, 5.2, 5.7_


- [x] 5. Module Quét Mã vạch và Tra cứu Giá (Phase 1)
  - [x] 5.1 Implement Barcode Scanner component
    - Tạo src/components/barcode/BarcodeScanner.tsx sử dụng @ericblade/quagga2
    - Implement useBarcodeScanner hook: startScanning, stopScanning, isScanning, lastScannedCode, error
    - Hỗ trợ formats: EAN-13, CODE-128, UPC-A
    - Hỗ trợ mã vạch có sẵn trên sản phẩm và mã vạch nội bộ
    - Target: hiển thị kết quả < 1 giây sau quét
    - _Requirements: 2.1, 2.3_

  - [x] 5.2 Implement Product Search và Price Lookup
    - Tạo src/components/shared/ProductSearch.tsx
    - Implement full-text search tiếng Việt (tên, thương hiệu, quy cách)
    - Hiển thị kết quả: tên sản phẩm, quy cách, đơn vị tính, giá bán, tồn kho
    - Target: kết quả hiển thị < 2 giây
    - Tích hợp với barcode scanner: quét → lookup → hiển thị
    - Responsive, mobile-first, thao tác một tay
    - _Requirements: 2.1, 2.2, 2.4, 5.3, 5.4_

  - [x] 5.3 Write property test cho Search Results (Property 13)
    - **Property 13: Search Results Relevance**
    - Test: mọi kết quả trả về đều chứa query (hoặc substring) trong name, brand, hoặc specification
    - Test: không có product matching query bị loại khỏi kết quả
    - **Validates: Requirements 2.2**

- [x] 6. Module POS - Bán hàng (Phase 1)
  - [x] 6.1 Implement POS Service
    - Tạo src/services/pos.service.ts với logic:
      - createOrder(items, customer, paymentMethod, discount)
      - addItemToCart(product, quantity, unit)
      - removeItemFromCart(itemId)
      - applyDiscount(subtotal, discountType, discountValue, userMaxDiscount)
    - Tích hợp với inventory service: auto-update stock khi confirm order
    - Tích hợp với debt service: tạo debt record khi mua nợ
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 6.2 Write property test cho Order Total (Property 4)
    - **Property 4: Order Total Calculation**
    - Test: line_total = unit_price × quantity cho mọi line item
    - Test: subtotal = sum of all line_totals
    - Test: total = subtotal - discount_amount
    - **Validates: Requirements 3.3, 3.4**

  - [x] 6.3 Write property test cho Discount Calculation (Property 5)
    - **Property 5: Discount Calculation Invariant**
    - Test: fixed discount → discount_amount = fixed value
    - Test: percentage discount → discount_amount = subtotal × percentage / 100
    - Test: invariant discount_amount + total = subtotal luôn đúng
    - **Validates: Requirements 11.1, 11.2, 11.3**

  - [x] 6.4 Write property test cho Staff Discount Limit (Property 6)
    - **Property 6: Staff Discount Limit Enforcement**
    - Test: discount vượt max_discount_percent → bị reject
    - Test: discount <= max_discount_percent → được accept
    - **Validates: Requirements 11.4**

  - [x] 6.5 Write property test cho Credit Sale (Property 8)
    - **Property 8: Credit Sale Creates Debt**
    - Test: mọi order is_credit=true với customer → tạo debt record với amount = order total
    - Test: debt record liên kết đúng customer_id và order_id
    - **Validates: Requirements 3.6**

  - [x] 6.6 Implement POS UI page
    - Tạo src/app/(dashboard)/pos/page.tsx
    - Tạo Zustand store cho POS state (cart items, customer, discount)
    - UI components: cart list, product search/scan, payment selection, discount input
    - Hỗ trợ bán lẻ theo đơn vị nhỏ (mét, kg) từ đơn vị lớn (cuộn, bao)
    - Hiển thị tổng tiền realtime khi thêm/xóa sản phẩm
    - Hỗ trợ thanh toán: tiền mặt và chuyển khoản
    - Hỗ trợ mua nợ: chọn khách hàng, ghi nhận công nợ
    - Mobile-first, thao tác đơn giản, ít bước nhấn
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.2, 5.3, 22.1_

- [x] 7. Checkpoint - Phase 1 MVP Core hoạt động
  - Ensure all tests pass, ask the user if questions arise.


- [x] 8. Module Quản lý Danh mục Sản phẩm (Phase 2)
  - [x] 8.1 Implement Product CRUD và Validation
    - Tạo src/app/(dashboard)/products/page.tsx - danh sách sản phẩm
    - Tạo src/app/(dashboard)/products/new/page.tsx - thêm sản phẩm
    - Tạo src/app/(dashboard)/products/[id]/edit/page.tsx - sửa sản phẩm
    - Implement Zod validation schema cho Product (required fields: name, category, brand, specification, base_unit)
    - Hỗ trợ phân loại: nhóm chính (Điện, Nước, Sơn) và nhóm phụ
    - Hỗ trợ thuộc tính tùy chọn: mã vạch, hình ảnh (1 ảnh/nhóm), mô tả
    - Implement đơn vị quy đổi tối đa 3 cấp
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.2 Write property test cho Product Validation (Property 14)
    - **Property 14: Product Validation**
    - Test: tạo product thiếu required fields → bị reject với validation error
    - Test: tạo product đủ required fields → được accept
    - **Validates: Requirements 6.1**

  - [x] 8.3 Implement Quản lý Giá vốn và Giá bán
    - Tạo UI cho cài đặt giá bán từng SKU (chỉ Owner)
    - Hiển thị 2 loại giá vốn: WAC và Last Cost
    - Phân biệt giá cố định vs giá biến động
    - Lưu lịch sử giá nhập theo thời gian
    - Staff chỉ thấy giá bán, ẩn giá vốn (sử dụng products_staff_view)
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6_

- [x] 9. Module Nhập hàng (Phase 2)
  - [x] 9.1 Implement Goods Receipt (Phiếu nhập kho)
    - Tạo src/app/(dashboard)/purchasing/receipts/page.tsx
    - Tạo form nhập kho: chọn NCC, danh sách sản phẩm, số lượng, đơn giá nhập
    - Hiển thị so sánh số lượng đặt vs thực nhận
    - Hỗ trợ ghi nhận hàng khuyến mãi kèm theo
    - Hỗ trợ ghi nhận hàng lỗi để trả NCC
    - Khi xác nhận: auto cộng tồn kho, tính lại WAC, cập nhật last_cost
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 9.2 Write property test cho Last Cost Update (Property 16)
    - **Property 16: Last Cost Update on Receipt**
    - Test: sau khi xác nhận phiếu nhập, last_cost = unit price từ phiếu đó
    - Test: price history record được tạo với giá mới và timestamp
    - **Validates: Requirements 7.6, 8.5**

- [x] 10. Module Khách hàng và Công nợ (Phase 2)
  - [x] 10.1 Implement Customer Management
    - Tạo src/app/(dashboard)/customers/page.tsx - danh sách khách hàng
    - Tạo form thêm/sửa khách hàng: tên, SĐT, địa chỉ, ghi chú
    - Hiển thị lịch sử mua hàng: danh sách đơn, tổng giá trị, số lần mua
    - Tìm kiếm khách hàng theo tên hoặc SĐT
    - Hiển thị tình trạng công nợ hiện tại
    - Staff chỉ xem, không chỉnh sửa
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 10.2 Implement Debt Management (Công nợ khách hàng)
    - Tạo src/app/(dashboard)/debts/page.tsx
    - Theo dõi số tiền nợ và thời hạn cho từng khách
    - Phân loại theo tuổi nợ: ngắn hạn (1-3 ngày), trung hạn (5 ngày), dài hạn (1 tháng), nợ lớn
    - Hỗ trợ thanh toán một phần hoặc toàn bộ
    - Hỗ trợ nhập liệu nhanh công nợ cuối ngày
    - Báo cáo tổng hợp công nợ
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 10.3 Write property test cho Debt Payment (Property 10)
    - **Property 10: Debt Payment Reduces Balance**
    - Test: payment P (P <= R) → new remaining = R - P
    - Test: P = R → status = 'paid'
    - Test: 0 < P < R → status = 'partial'
    - **Validates: Requirements 10.4**

  - [x] 10.4 Write property test cho Debt Age Classification (Property 11)
    - **Property 11: Debt Age Classification**
    - Test: 1-3 ngày → 'short-term'
    - Test: 4-5 ngày → 'medium-term'
    - Test: 6-30 ngày → 'long-term'
    - Test: vượt ngưỡng giá trị → 'large' bất kể tuổi nợ
    - **Validates: Requirements 10.2**


- [x] 11. Module Chiết khấu, Trả hàng, Giao hàng (Phase 2)
  - [x] 11.1 Implement Discount Logic trong POS
    - Cập nhật POS UI: thêm input giảm giá (số tiền cố định hoặc %)
    - Implement giới hạn giảm giá cho staff theo max_discount_percent
    - Ghi nhận số tiền giảm giá và doanh thu thực tế cho mỗi đơn
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 11.2 Implement Returns Module (Trả hàng)
    - Tạo src/app/(dashboard)/returns/page.tsx
    - Cho phép trừ số lượng trả trên đơn bán hàng gốc
    - Auto cộng số lượng trả vào tồn kho
    - Ghi nhận lý do trả/đổi
    - Trừ doanh thu tương ứng khỏi hồ sơ khách hàng
    - Gom hàng lỗi vào danh sách chờ trả NCC
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 11.3 Write property test cho Return Adjusts Revenue (Property 17)
    - **Property 17: Return Adjusts Customer Revenue**
    - Test: sau return, customer total_purchased giảm đúng returned amount
    - Test: effective order total được tính lại chính xác
    - **Validates: Requirements 12.4**

  - [x] 11.4 Implement Delivery Module (Giao hàng bên thứ 3)
    - Tạo UI quản lý danh mục người vận chuyển (tên, SĐT)
    - Cho phép gắn cờ đơn hàng giao qua bên thứ 3
    - Ghi nhận thời điểm giao cho bên vận chuyển
    - Tra cứu đơn hàng theo người vận chuyển
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 12. Module Thông báo và Audit Log (Phase 2)
  - [x] 12.1 Implement Notification Service
    - Tạo src/services/notification.service.ts
    - Tạo src/app/(dashboard)/notifications/page.tsx
    - Implement bell icon với badge số thông báo chưa đọc
    - Gửi thông báo khi: tồn kho thấp, công nợ quá hạn, đơn NCC đến, giá NCC đổi, hàng tồn lâu
    - Trang tổng hợp: sắp xếp theo thời gian, đánh dấu đã đọc/chưa đọc, lọc theo loại
    - Click thông báo → điều hướng đến màn hình liên quan
    - Cho phép Owner bật/tắt từng loại thông báo
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 12.2 Implement Audit Log
    - Tạo src/app/(dashboard)/audit-log/page.tsx
    - Ghi nhận: tạo/sửa/xóa đơn hàng, thay đổi giá, điều chỉnh tồn kho, xóa sản phẩm
    - Lưu: người thực hiện, thời điểm, loại thao tác, chi tiết thay đổi
    - Chỉ Owner xem được, Staff bị chặn
    - Hỗ trợ tìm kiếm nhật ký
    - Lưu trữ tối thiểu 12 tháng
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 12.3 Write property test cho Audit Log Completeness (Property 12)
    - **Property 12: Audit Log Completeness**
    - Test: mọi important operation đều tạo audit log entry
    - Test: entry chứa đủ: user_id, timestamp, operation type, change details
    - Test: audit log entry là immutable sau khi tạo
    - **Validates: Requirements 17.1, 17.2**

- [x] 13. Checkpoint - Phase 2 hoàn thành
  - Ensure all tests pass, ask the user if questions arise.


- [x] 14. Module Nhà cung cấp và Đặt hàng (Phase 3)
  - [x] 14.1 Implement Supplier Management
    - Tạo src/app/(dashboard)/purchasing/suppliers/page.tsx
    - CRUD nhà cung cấp: tên, SĐT, email, địa chỉ, ghi chú
    - Lưu trữ bảng giá NCC
    - Hỗ trợ import bảng giá từ file Excel
    - So sánh giá từ nhiều NCC cho cùng sản phẩm
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 14.2 Implement Purchase Order (Đơn đặt hàng)
    - Tạo src/app/(dashboard)/purchasing/orders/page.tsx
    - Tạo đơn đặt hàng: chọn NCC, danh sách sản phẩm, số lượng, ghi chú
    - Hiển thị tồn kho hiện tại của từng sản phẩm trong đơn
    - Cảnh báo nếu có đơn đặt hàng đang chờ cho cùng sản phẩm
    - Nhiều Owner xem chung danh sách đơn đặt hàng
    - _Requirements: 14.4, 14.5, 14.6, 14.7_

  - [x] 14.3 Implement Supplier Debt (Công nợ NCC)
    - Theo dõi trạng thái thanh toán (đã trả/chưa trả) cho từng hóa đơn nhập
    - Hỗ trợ ghi nhận Nợ gối đầu: liên kết đơn cũ với đơn mới
    - Ghi nhận lịch sử thanh toán cho từng NCC
    - Báo cáo tổng hợp công nợ NCC
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 15. Module Báo cáo (Phase 3)
  - [x] 15.1 Implement Revenue & Profit Reports
    - Tạo src/app/(dashboard)/reports/page.tsx
    - Báo cáo doanh thu hàng ngày: tổng doanh thu, số đơn, công nợ phát sinh
    - Báo cáo lợi nhuận gộp theo sản phẩm và nhóm hàng
    - Biên lợi nhuận theo thời gian
    - Chỉ Owner truy cập được
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 15.2 Write property test cho Gross Profit (Property 15)
    - **Property 15: Gross Profit Calculation**
    - Test: gross_profit = (selling_price - weighted_avg_cost) × quantity_sold
    - Test: gross_profit_margin = gross_profit / revenue × 100
    - **Validates: Requirements 18.2**

  - [x] 15.3 Implement Inventory & Debt Reports
    - Báo cáo tồn kho theo nhóm hàng và thương hiệu
    - Báo cáo hàng tồn lâu (vượt ngưỡng thời gian)
    - Tổng giá trị tồn kho
    - Báo cáo công nợ khách hàng theo tuổi nợ
    - Báo cáo công nợ NCC và tình trạng thanh toán
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [x] 15.4 Implement Quotation Form (Báo giá)
    - Tạo form báo giá: danh sách sản phẩm, đơn giá, số lượng, thành tiền, tổng cộng
    - Hỗ trợ in báo giá ra giấy
    - Hỗ trợ xuất dạng text để copy gửi qua tin nhắn
    - _Requirements: 20.1, 20.2, 20.3_

- [x] 16. Push Notification và Hoàn thiện (Phase 3)
  - [x] 16.1 Implement Push Notification
    - Tạo Service Worker cho Web Push API
    - Gửi push notification cho Owner khi có cảnh báo quan trọng (tồn kho thấp, công nợ quá hạn)
    - Cho phép Owner bật/tắt push notification cho từng loại cảnh báo
    - _Requirements: 21.1, 21.2_

  - [x] 16.2 Implement Usability Enhancements
    - Tối ưu luồng thao tác: tối thiểu số bước nhấn cho tạo đơn, tra giá
    - Hỗ trợ nhập liệu nhanh tổng hợp cuối ngày
    - Xử lý đồng thời nhiều đơn bán hàng (optimistic locking, Supabase Realtime)
    - Đảm bảo nút bấm và font chữ đủ lớn trên mobile
    - _Requirements: 22.1, 22.2, 22.3, 5.3_

- [x] 17. Final Checkpoint - Toàn bộ hệ thống hoạt động
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (18 properties from design)
- Unit tests validate specific examples and edge cases
- Phase 1 (Tasks 1-7): MVP core - Auth, Inventory, Barcode, POS, Responsive
- Phase 2 (Tasks 8-13): Product management, Purchasing, Customers, Debts, Discounts, Returns, Delivery, Notifications, Audit
- Phase 3 (Tasks 14-17): Suppliers, Reports, Push Notifications, Quotations, Usability polish
- Tech stack: Next.js 14+ (App Router), Supabase, Tailwind CSS + shadcn/ui, Zustand, Vitest + fast-check
- Giao diện toàn bộ tiếng Việt, mobile-first design

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["2.1", "4.1"] },
    { "id": 4, "tasks": ["2.2", "4.2", "4.3"] },
    { "id": 5, "tasks": ["2.3", "2.4", "4.4"] },
    { "id": 6, "tasks": ["4.5", "4.6", "4.7", "5.1"] },
    { "id": 7, "tasks": ["5.2", "6.1"] },
    { "id": 8, "tasks": ["5.3", "6.2", "6.3", "6.4", "6.5"] },
    { "id": 9, "tasks": ["6.6"] },
    { "id": 10, "tasks": ["8.1", "9.1", "10.1"] },
    { "id": 11, "tasks": ["8.2", "8.3", "9.2", "10.2"] },
    { "id": 12, "tasks": ["10.3", "10.4", "11.1", "11.2"] },
    { "id": 13, "tasks": ["11.3", "11.4", "12.1"] },
    { "id": 14, "tasks": ["12.2", "12.3"] },
    { "id": 15, "tasks": ["14.1", "15.1"] },
    { "id": 16, "tasks": ["14.2", "14.3", "15.2", "15.3"] },
    { "id": 17, "tasks": ["15.4", "16.1"] },
    { "id": 18, "tasks": ["16.2"] }
  ]
}
```
