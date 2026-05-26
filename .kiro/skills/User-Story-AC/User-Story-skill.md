---
name: user-story-ac-writer
inclusion: auto
description: >
  Sinh User Story và Acceptance Criteria chuẩn INVEST + Given-When-Then
  cho BA/PO. Skill enforce 6 tiêu chí INVEST (Independent, Negotiable,
  Valuable, Estimable, Small, Testable) và format AC theo Gherkin syntax.
  Hỗ trợ 3 mode: viết mới từ feature description, refine US đang có,
  bổ sung AC cho US đã viết.
  Kích hoạt khi user nói: "viết user story", "viết US", "tạo user story",
  "viết AC", "viết acceptance criteria", "tạo AC cho story",
  "user story chuẩn INVEST", "AC theo Given-When-Then", "AC Gherkin",
  "refine user story", "review US này", "US này đã chuẩn chưa",
  "bổ sung AC", "viết tiêu chí nghiệm thu", "story cho feature này",
  "split user story", "story quá to cần tách", kể cả khi paste
  feature description + nói "viết story đi" hoặc upload PRD +
  "tạo US list".
  KHÔNG dùng cho: viết PRD/URD/SRS toàn bộ, viết test case kỹ thuật chi tiết,
  viết Use Case formal, business rules.
---

# User Story & Acceptance Criteria Writer

Skill giúp BA/PO viết User Story và Acceptance Criteria đạt chuẩn chất lượng cao,
sẵn sàng cho dev estimate và QA viết test case.

---

## Workflow chuẩn

### Bước 1: Xác định mode

Hỏi user 1 trong 3 mode:
- **Mode A - Viết mới**: User cung cấp feature description, skill sinh US + AC từ đầu
- **Mode B - Refine**: User có US/AC sẵn, skill review và đề xuất sửa
- **Mode C - Bổ sung AC**: User có US, cần thêm AC chi tiết

Nếu user paste content rõ ràng, tự suy luận mode và xác nhận lại 1 lần.

### Bước 2: Thu thập input bắt buộc

Cần đủ 4 thông tin trước khi sinh, hỏi nếu thiếu:
1. **Persona/User type**: Ai sẽ dùng tính năng?
2. **Goal**: User muốn làm gì?
3. **Business value**: Tại sao cần tính năng này?
4. **Context/Scope**: Tính năng nằm trong feature/module nào?

KHÔNG được tự bịa nếu user không cung cấp — phải hỏi.

### Bước 3: Sinh User Story theo template

```
**US-[ID]**: [Tiêu đề ngắn gọn]

**As a** [persona cụ thể, không generic như "user"]
**I want to** [hành động cụ thể, đo lường được]
**So that** [business value rõ ràng, không lặp lại I want]
```

### Bước 4: Apply checklist INVEST

Trước khi xuất, tự kiểm tra US theo 6 tiêu chí:

| Tiêu chí | Câu hỏi kiểm tra | Nếu fail thì làm gì |
|----------|------------------|---------------------|
| **I**ndependent | Story có phụ thuộc story khác không? | Tách dependency hoặc gộp |
| **N**egotiable | Có để chỗ cho thảo luận không? | Bỏ chi tiết kỹ thuật cứng |
| **V**aluable | Mang lại giá trị gì cho user/business? | Viết lại phần "So that" |
| **E**stimable | Dev có ước lượng được effort không? | Bổ sung context/constraint |
| **S**mall | Hoàn thành trong 1 sprint không? | Split thành nhiều story |
| **T**estable | QA viết được test case không? | Bổ sung AC cụ thể |

### Bước 5: Sinh Acceptance Criteria

Mỗi US cần **tối thiểu 3 AC**, format Given-When-Then:

```
**AC1: [Tên scenario - happy path]**
- **Given** [tiền điều kiện cụ thể]
- **When** [hành động user thực hiện]
- **Then** [kết quả mong đợi đo lường được]
- **And** [kết quả phụ nếu có]

**AC2: [Tên scenario - edge case/validation]**
...

**AC3: [Tên scenario - error/negative path]**
...
```

**Quy tắc viết AC tốt:**
- Bao quát đủ 3 loại: happy path, edge case, negative path
- Mỗi điều kiện trong Given/When/Then phải đo lường được
- Tránh từ mơ hồ: "nhanh", "hợp lý", "user-friendly"
- Không viết logic implementation (đó là việc của dev)
- 1 AC = 1 scenario duy nhất, không gộp nhiều case

### Bước 6: Output cuối cùng

Trình bày theo format:

1. User Story (3 dòng As a / I want / So that)
2. INVEST Self-check (bảng đánh giá 6 tiêu chí với ✅/⚠️)
3. Acceptance Criteria (đánh số AC1, AC2, AC3...)
4. Notes (dependency, assumption, hoặc câu hỏi cần PO làm rõ)
5. Hỏi user xác nhận format tài liệu trước khi xuất

---

## Anti-patterns — KHÔNG làm những điều sau

❌ **Persona generic**: "As a user" → ✅ "As a học viên đã đăng ký và xác thực email"

❌ **Goal vague**: "I want to manage profile" → ✅ "I want to update my email address"

❌ **Value lặp lại goal**: "So that I can manage profile" → ✅ "So that I receive notifications at correct address"

❌ **AC mô tả UI**: "Then button turns blue" → ✅ "Then system displays confirmation message"

❌ **AC chứa logic kỹ thuật**: "Then call API /v1/users/update" → ✅ "Then user data is updated and persisted"

❌ **AC quá ít**: chỉ có 1 happy path → ✅ tối thiểu 3 AC bao quát các nhánh

❌ **Story quá lớn**: 1 story cover cả CRUD → ✅ tách thành Create, Read, Update, Delete riêng

---

## Khi nào cần split User Story?

Đề xuất split khi gặp các dấu hiệu:
- Story chứa từ "AND" trong tiêu đề
- Có nhiều persona khác nhau trong 1 story
- Story cover nhiều CRUD operation
- AC vượt quá 7-8 scenarios
- Dev ước lượng > 5 ngày làm việc

Pattern split phổ biến:
- Theo **CRUD**: tách Create / Read / Update / Delete
- Theo **persona**: tách theo từng role
- Theo **business rule**: tách Happy path / Validation / Permission
- Theo **data type**: tách theo loại data xử lý

---

## INVEST Criteria — Chi tiết

### I - Independent (Độc lập)

Story phải có thể được phát triển, test, và deploy độc lập với các story khác.

**Dấu hiệu vi phạm:**
- Story B chỉ làm được sau khi story A xong
- Phải merge cùng lúc 2-3 story mới deploy được
- Test một story phải có data từ story khác

**Cách fix:**
- Gộp các story phụ thuộc thành 1 story lớn hơn (nếu nhỏ)
- Tách dependency ra thành story riêng + đặt ưu tiên trước
- Dùng mock data / stub để test độc lập

### N - Negotiable (Có thể thương lượng)

Story là "lời mời thảo luận", không phải hợp đồng cứng.

**Dấu hiệu vi phạm:**
- Story dài 3 trang mô tả từng pixel UI
- Chỉ định công nghệ cụ thể (phải dùng React, phải dùng Redis)
- Mô tả thuật toán chi tiết trong story

**Cách fix:**
- Giữ story ngắn gọn, focus vào "what" và "why"
- Đẩy chi tiết "how" sang AC hoặc tech design doc

### V - Valuable (Có giá trị)

Mỗi story phải mang lại giá trị rõ ràng cho user, business, hoặc cả hai.

**Dấu hiệu vi phạm:**
- Phần "So that" rỗng hoặc lặp lại "I want"
- Story chỉ có giá trị cho dev (refactor, upgrade lib)
- Không trả lời được câu "Nếu không làm thì sao?"

**Cách fix:**
- Viết "So that" theo công thức: business outcome + measurable
- Tech debt nên đóng gói thành story có giá trị business

### E - Estimable (Có thể ước lượng)

Dev team phải có khả năng ước lượng effort để hoàn thành story.

**Dấu hiệu vi phạm:**
- Dev nói "không biết bao lâu, phải research thêm"
- Effort ước lượng chênh nhau quá lớn giữa các thành viên

**Cách fix:**
- Tạo Spike story riêng để research
- Bổ sung context, constraint, tham khảo

### S - Small (Nhỏ)

Story đủ nhỏ để hoàn thành trong 1 sprint (thường 1-3 ngày).

**Dấu hiệu vi phạm:**
- Story ước lượng > 5 ngày work
- AC vượt quá 7-8 scenarios
- Tiêu đề có chữ "AND"

**Pattern split:**
1. Theo CRUD
2. Theo persona
3. Theo data type
4. Theo business rule
5. Theo workflow step
6. Theo platform

### T - Testable (Có thể test)

Story phải có AC rõ ràng, đo lường được.

**Dấu hiệu vi phạm:**
- AC dùng từ mơ hồ: "nhanh", "đẹp", "user-friendly"
- AC không có điều kiện đo lường được
- Không có AC

**Cách fix:**
- Mỗi AC phải có Given/When/Then cụ thể
- Đo lường: số liệu, trạng thái, message text cụ thể

---

## Quality Checklist — Self Review trước khi xuất

### Phần 1: User Story Quality

**Persona (As a...):**
- [ ] Persona cụ thể, không dùng "user" chung
- [ ] Có mô tả trạng thái/điều kiện kèm theo
- [ ] Phân biệt được với các persona khác trong sản phẩm

**Goal (I want to...):**
- [ ] Mô tả hành động cụ thể, không mơ hồ
- [ ] Dùng động từ rõ ràng
- [ ] Có thể đo lường khi nào "đã làm xong"
- [ ] Không chứa từ "manage", "handle" chung chung

**Business Value (So that...):**
- [ ] Khác biệt rõ với phần "I want to"
- [ ] Mô tả outcome cho user/business, không phải feature
- [ ] Trả lời được câu "Nếu không làm thì mất gì?"

### Phần 2: INVEST Compliance

| Tiêu chí | Đã check? | Notes |
|----------|-----------|-------|
| Independent - Story chạy độc lập | [ ] | |
| Negotiable - Có chỗ thảo luận | [ ] | |
| Valuable - Giá trị rõ ràng | [ ] | |
| Estimable - Dev ước lượng được | [ ] | |
| Small - ≤ 5 ngày dev work | [ ] | |
| Testable - QA viết được test case | [ ] | |

### Phần 3: Acceptance Criteria Quality

**Số lượng:**
- [ ] Tối thiểu 3 AC (1 happy + 1 edge + 1 negative)
- [ ] Tối đa 7-8 AC (nếu nhiều hơn → split story)

**Format Given-When-Then:**
- [ ] Mỗi AC có đủ 3 phần Given/When/Then
- [ ] Given mô tả tiền điều kiện cụ thể
- [ ] When mô tả 1 hành động duy nhất
- [ ] Then mô tả kết quả đo lường được

**Coverage scenarios:**
- [ ] Có ít nhất 1 happy path
- [ ] Có ít nhất 1 edge case
- [ ] Có ít nhất 1 negative path

**Tránh anti-patterns:**
- [ ] Không chứa từ mơ hồ
- [ ] Không chứa logic implementation
- [ ] Không mô tả UI cụ thể
- [ ] Không gộp nhiều scenario vào 1 AC

### Phần 4: Sanity Check

1. Stakeholder hiểu được không?
2. Dev estimate được không?
3. QA test được không?
4. Có bị trùng story khác không?
5. "So that" có thật sự valuable không?

### 🚨 Red flags — Phải fix ngay

❌ Story description dài hơn 200 từ → mất tính Negotiable
❌ AC dài hơn 10 dòng → quá phức tạp, nên split
❌ Không có AC nào → không Testable
❌ "So that" rỗng hoặc copy "I want to" → không Valuable
❌ Persona là "user" hoặc "everyone" → quá generic
❌ Có chữ "AND" trong tiêu đề → đang gộp 2 story
❌ AC dùng từ "etc.", "v.v." → không cụ thể, không testable

---

## Ví dụ mẫu

### Ví dụ 1: Đăng ký và thanh toán

**US-ENROLL-001: Đăng ký khóa học và thanh toán qua ví điện tử**

**As a** học viên đã có tài khoản và liên kết ví điện tử
**I want to** mua khóa học và thanh toán bằng ví
**So that** có thể truy cập ngay nội dung học mà không cần chờ xác nhận thủ công

**AC1: Thanh toán và enroll thành công - happy path**
- **Given** học viên chọn khóa giá 1.500.000 VND
- **And** số dư ví ≥ 1.500.000 VND và khóa học còn slot
- **When** học viên ấn "Đăng ký ngay" → xác nhận thanh toán → nhập PIN ví
- **Then** hệ thống trừ 1.500.000 VND từ ví trong vòng 5 giây
- **And** tự động enroll học viên vào khóa học
- **And** gửi email xác nhận kèm link truy cập

**AC2: Số dư ví không đủ**
- **Given** số dư ví là 800.000 VND, giá khóa học 1.500.000 VND
- **When** học viên ấn "Đăng ký ngay"
- **Then** hệ thống hiển thị "Số dư không đủ. Bạn cần thêm 700.000 VND"
- **And** cung cấp 2 lựa chọn: "Nạp tiền vào ví" và "Chọn phương thức khác"
- **And** không trừ tiền và không tạo enrollment

**AC3: Mất kết nối trong khi xử lý thanh toán**
- **Given** học viên đã xác nhận thanh toán và hệ thống đang xử lý
- **When** mạng bị ngắt trong vòng 30 giây
- **Then** hệ thống hiển thị "Đang xác thực giao dịch..."
- **And** sau khi có mạng lại, tự động kiểm tra trạng thái giao dịch
- **And** hiển thị kết quả cuối cùng mà không trừ tiền 2 lần

---

### Ví dụ 2: Đặt lịch 1-on-1 với Mentor

**US-MENTOR-BOOK-001: Đặt lịch tư vấn 1-on-1 với Mentor**

**As a** học viên đang theo học chương trình Advanced
**I want to** đặt lịch tư vấn 1-on-1 với mentor có chuyên môn phù hợp
**So that** nhận được hướng dẫn cụ thể cho bài tập mà không cần chờ buổi học chung

**AC1: Đặt lịch thành công**
- **Given** học viên chọn mentor, slot trống ngày 15/06 lúc 20:00
- **And** học viên còn 1 session 1-on-1 trong gói tháng
- **When** học viên xác nhận đặt lịch và nhập chủ đề cần tư vấn
- **Then** hệ thống tạo booking và gửi link Meet cho cả 2 bên
- **And** trừ 1 session khỏi quota tháng
- **And** gửi reminder 1 giờ trước buổi tư vấn

**AC2: Race condition - slot bị người khác đặt trước**
- **Given** học viên đang ở màn hình xác nhận slot 20:00
- **When** học viên ấn "Đặt lịch" nhưng slot vừa được người khác đặt 3 giây trước
- **Then** hệ thống hiển thị "Slot này vừa được đặt. Vui lòng chọn slot khác"
- **And** cập nhật lịch trống trong thời gian thực
- **And** không trừ session quota

**AC3: Mentor hủy buổi tư vấn**
- **Given** học viên đã đặt lịch thành công
- **When** mentor hủy buổi tư vấn ít nhất 6 tiếng trước giờ hẹn
- **Then** hệ thống hoàn lại 1 session vào quota tháng
- **And** gửi thông báo lý do hủy và đề xuất 3 slot thay thế trong 7 ngày tới

---

## Patterns rút ra từ ví dụ

1. **Persona luôn cụ thể**: không bao giờ "user" chung, luôn có context
2. **Goal đo lường được**: có số liệu cụ thể
3. **So that focus business outcome**: không lặp lại goal
4. **AC luôn có 3 path**: Happy + Edge case + Negative/Error
5. **Edge case mang tính domain**: race condition, license không đủ, kết nối gián đoạn
6. **Số liệu trong AC**: thời gian phản hồi, ngưỡng điểm, số lượng
7. **Tránh implementation detail**: không nói API name, DB schema, framework

---
