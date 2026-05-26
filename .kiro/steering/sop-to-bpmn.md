---
inclusion: manual
---

# SOP to BPMN 2.0 Conversion Workflow

Quy trình chuyển đổi từ tài liệu SOP/Context thành sơ đồ BPMN 2.0 XML.

## Tài liệu tham khảo

- BPMN Notation Reference: #[[file:BPMN.md]]

## Output Directory

Tất cả file `.bpmn` sinh ra từ quy trình này sẽ được lưu vào folder: `SOP-to-BPMN/`

## NGUYÊN TẮC BẮT BUỘC

> ⚠️ **KHÔNG ĐƯỢC SÁNG TẠO HAY BỚT BẤT KỲ NỘI DUNG NÀO**
> 
> - PHẢI giữ nguyên văn mô tả từ context/SOP gốc
> - KHÔNG ĐƯỢC thêm bước, bớt bước, hoặc suy diễn thêm logic
> - KHÔNG ĐƯỢC đổi tên, paraphrase, hoặc tóm tắt nội dung
> - Nếu context không rõ ràng → HỎI LẠI user, KHÔNG tự suy luận
> - Diagram BPMN phải phản ánh CHÍNH XÁC 100% nội dung user cung cấp

## ⚠️ QUY TẮC LỌC BỎ THAO TÁC THỦ CÔNG VẬT LÝ

> **CHỈ GIỮ LẠI các bước liên quan đến luồng dữ liệu vào/ra (data flow). BỎ QUA các thao tác thuần thủ công vật lý không phản ánh lên phần mềm.**

### Tiêu chí BỎ (không đưa vào BPMN):

| Loại thao tác | Ví dụ | Lý do bỏ |
|---------------|-------|----------|
| Thao tác vật lý thuần túy | Thu gom, vận chuyển, dọn dẹp, bốc xếp | Không tạo/thay đổi dữ liệu |
| Sắp xếp nhân lực tại hiện trường | Sắp xếp công nhân vào chuồng/đến trại | Không phản ánh lên hệ thống |
| Giám sát vật lý | Theo dõi quá trình bán hàng, giám sát dọn hàng | Không tạo output dữ liệu |
| Di chuyển vật lý | Khách hàng rời trại, trả lại vật tư | Không liên quan phần mềm |
| Kiểm đếm thủ công tại hiện trường | Đếm hàng trước khi giao (không ghi nhận hệ thống) | Không tạo chứng từ/dữ liệu |

### Tiêu chí GIỮ (đưa vào BPMN):

| Loại thao tác | Ví dụ | Lý do giữ |
|---------------|-------|----------|
| Nhập/ghi nhận dữ liệu vào hệ thống | Ghi nhận số lượng, lập chứng từ | Tạo dữ liệu mới |
| Tạo/ký/phê duyệt chứng từ | Lập BSS, ký xác nhận, phê duyệt | Thay đổi trạng thái dữ liệu |
| Gửi/nhận chứng từ/dữ liệu | Gửi hợp đồng, nhận DO, gửi BSS | Luồng dữ liệu giữa các bộ phận |
| Quyết định nghiệp vụ (Gateway) | Phê duyệt Y/N, chọn phương thức | Ảnh hưởng luồng xử lý |
| Thao tác trên hệ thống | Lập RV, lập DO, hạch toán | Tương tác phần mềm |
| Thông báo có dữ liệu đi kèm | Thông báo số lượng, thông báo lịch | Truyền thông tin cần thiết |

### Quy tắc áp dụng:

1. Khi phân tích SOP, **tự động lọc bỏ** các bước thuần vật lý
2. **Không cần hỏi user** về việc bỏ các bước vật lý (đã là quy tắc mặc định)
3. Nếu một bước vừa có phần vật lý vừa có phần dữ liệu → **chỉ giữ phần dữ liệu**
4. Lane/Role chỉ tạo cho các actor có thao tác dữ liệu. Bỏ lane nếu actor chỉ làm việc vật lý (VD: Công nhân chỉ thu gom, Bảo vệ chỉ giám sát)

## ⚠️ QUY TẮC GIỚI HẠN TEXT TRONG ELEMENT

> **Text hiển thị trong các BPMN element (task name, event name, gateway label) phải tuân thủ:**
> 
> - **Tối đa 5 từ** cho mỗi element name
> - Chỉ giữ lại các **keyword chính**, lược bỏ từ phụ
> - Nội dung đầy đủ nguyên văn từ SOP được ghi trong cột **Notes** của bảng cấu trúc
> 
> **Nguyên tắc rút gọn:**
> - Ưu tiên giữ lại **danh từ cụ thể** (tên chứng từ, tên hệ thống, tên đối tượng...)
> - Lược bỏ **từ phụ, từ nối, mệnh đề phụ** ("liên quan", "trên hệ thống", "cho bộ phận liên quan"...)
> - KHÔNG dùng từ chung chung thay thế cho danh từ cụ thể
> 
> **Ví dụ:**
> 
> | SOP gốc | Element Name (tối đa 5 từ) |
> |---------|---------------------------|
> | "Thu thập tài liệu liên quan như Giấy phép kinh doanh, hợp đồng, v.v." | "Thu thập GPKD, Hợp đồng" |
> | "Kiểm tra và xác nhận thông tin nhà cung cấp trên hệ thống" | "Xác nhận thông tin NCC" |
> | "Gửi email thông báo kết quả phê duyệt cho bộ phận liên quan" | "Gửi email kết quả phê duyệt" |

## Quy trình làm việc

### Step 1: Nhận Context/SOP từ User

User cung cấp tài liệu SOP hoặc mô tả quy trình bằng ngôn ngữ tự nhiên.

### Step 2: Phân tích và tạo Bảng cấu trúc BPMN

Output bảng với format mới:

| Step No | BPMN Element | Type | Activity Name (nguyên văn) | Lane / Role | Input Data | Output Data | Business Rule | Notes |
|---------|--------------|------|----------------------------|-------------|------------|-------------|---------------|-------|
| 1 | startEvent | none / message / timer | "Tên sự kiện" | - | - | - | - | |
| 2 | userTask | userTask | "Mô tả công việc nguyên văn" | Tên role | Tài liệu đầu vào | Tài liệu đầu ra | Quy tắc nghiệp vụ | |
| 3 | exclusiveGateway | exclusive | "Điều kiện?" | - | - | - | Logic rẽ nhánh | |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

**Giải thích các cột:**

| Cột | Mô tả | Ví dụ |
|-----|-------|-------|
| **Step No** | Số thứ tự bước | 1, 2, 3, 3.1, 3.2... |
| **BPMN Element** | Loại element BPMN | startEvent, userTask, serviceTask, exclusiveGateway, endEvent... |
| **Type** | Loại chi tiết của element | none, message, timer (cho event); userTask, serviceTask (cho task); exclusive, parallel, inclusive (cho gateway) |
| **Activity Name** | Tên rút gọn tối đa 5 từ (keyword chính) | "Thu thập tài liệu liên quan" |
| **Lane / Role** | Người/phòng ban thực hiện | Nhân viên thu mua, Procurement Manager, Phần mềm |
| **Input Data** | Dữ liệu/tài liệu đầu vào | Giấy phép kinh doanh, VMD chưa ký |
| **Output Data** | Dữ liệu/tài liệu đầu ra | VMD đã ký, VMD đã phê duyệt |
| **Business Rule** | Quy tắc nghiệp vụ áp dụng | "Nếu không phê duyệt → quay lại Bước 1" |
| **Notes** | Ghi chú thêm | Bước 1, Nhánh Cập nhật... |

**Quy tắc phân tích:**
- Xác định các Actors → tạo Lanes (điền vào cột Lane / Role)
- Xác định điểm bắt đầu → Start Event (chọn Type phù hợp: none, message, timer)
- Xác định các bước thực hiện → Tasks (chọn Type: userTask, serviceTask, sendTask, receiveTask...)
- Xác định điều kiện rẽ nhánh → Gateways (chọn Type: exclusive, parallel, inclusive...)
- Xác định điểm kết thúc → End Event
- Xác định các sự kiện trung gian → Intermediate Events
- **Xác định các chứng từ/form/tài liệu → điền vào Input Data / Output Data**
- **Xác định các quy tắc nghiệp vụ → điền vào Business Rule**

**Bổ sung thêm:**
- Bảng Sequence Flows: From → To, Condition, Ghi chú
- Bảng Data Objects: Tên, Mô tả, Liên kết với Task nào
- Bảng Business Rules: Rule No, Business Rule, Áp dụng tại Step
- ~~Sơ đồ luồng dạng text (ASCII art)~~ - KHÔNG CẦN

### Step 3: User Validate

Chờ user review và xác nhận bảng cấu trúc BPMN.
- Nếu cần chỉnh sửa → quay lại Step 2
- Nếu OK → tiếp tục Step 4

### Step 4: Sinh BPMN 2.0 XML

Tạo file `.bpmn` trong folder `SOP-to-BPMN/` với:
- **Tên file**: Sử dụng tên của Process (ví dụ: `ChickenTransferProcess.bpmn`, `QuanLyNCC_NhaCungCapMoi.bpmn`)
- **Cấu trúc**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  id="Definitions_[ID]"
                  targetNamespace="http://bpmn.io/schema/bpmn">

  <!-- COLLABORATION & PROCESS -->
  <bpmn:collaboration>...</bpmn:collaboration>
  <bpmn:process>
    <!-- LANES -->
    <!-- EVENTS -->
    <!-- TASKS -->
    <!-- GATEWAYS -->
    <!-- SEQUENCE FLOWS -->
  </bpmn:process>

  <!-- DIAGRAM INFORMATION (BPMNDI) -->
  <bpmndi:BPMNDiagram>...</bpmndi:BPMNDiagram>

</bpmn:definitions>
```

**Yêu cầu XML:**
- Tuân thủ BPMN 2.0 Schema
- Bao gồm BPMNDI để hiển thị diagram
- Tính toán coordinates hợp lý cho layout
- Có thể import vào Camunda Modeler, bpmn.io, Bizagi

## ⚠️ QUY TẮC BẮT BUỘC VỀ DATA OBJECTS

> **QUAN TRỌNG: Để Data Objects hiển thị trên diagram, PHẢI có đủ 2 phần:**

### 1. Khai báo trong `<bpmn:process>`

```xml
<!-- Định nghĩa Data Object -->
<bpmn:dataObject id="DataObject_MCN" name="Phiếu điều chuyển gà (MCN)" />

<!-- Data Object Reference - BẮT BUỘC để hiển thị -->
<bpmn:dataObjectReference id="DataObjectRef_MCN" name="Phiếu điều chuyển gà (MCN)" dataObjectRef="DataObject_MCN" />
```

### 2. Khai báo BPMNDI Shape trong `<bpmndi:BPMNPlane>`

```xml
<bpmndi:BPMNShape id="DataObjectRef_MCN_di" bpmnElement="DataObjectRef_MCN">
  <dc:Bounds x="672" y="385" width="36" height="50" />
  <bpmndi:BPMNLabel>
    <dc:Bounds x="650" y="442" width="80" height="40" />
  </bpmndi:BPMNLabel>
</bpmndi:BPMNShape>
```

### Kích thước chuẩn Data Object

| Element | Width | Height | Ghi chú |
|---------|-------|--------|---------|
| Data Object | 36px | 50px | Kích thước chuẩn |
| Label | 80-100px | 27-40px | Tùy độ dài text |

### Vị trí đặt Data Object

- Đặt **gần Task** liên quan (Input/Output)
- Khoảng cách từ Task: 20-50px
- Không đè lên các elements khác
- Label đặt phía dưới hoặc bên cạnh

### Checklist Data Objects

- [ ] Mỗi Data Object có `<bpmn:dataObject>` 
- [ ] Mỗi Data Object có `<bpmn:dataObjectReference>` tương ứng
- [ ] Mỗi DataObjectReference có `<bpmndi:BPMNShape>` trong BPMNDI
- [ ] Coordinates không trùng với elements khác

## BPMN Layout Standards

> ⚠️ **TIÊU CHUẨN BẮT BUỘC KHI VẼ BPMN DIAGRAM**

### Khổ giấy & Hướng trang

> **Tự động chọn khổ giấy và hướng trang phù hợp với quy trình:**
> - Không bắt buộc landscape hay portrait — chọn hướng nào gọn gàng, đẹp nhất
> - Quy trình ít lanes, nhiều bước ngang → landscape
> - Quy trình nhiều lanes, ít bước → portrait
> - Mặc định A3 trừ khi user yêu cầu khác
> - Ưu tiên: gọn gàng, dễ đọc, không bị chật

### Kích thước Elements

| Element | Width | Height | Ghi chú |
|---------|-------|--------|---------|
| Pool | 1600-2000px | Tùy số lanes | Đủ rộng để chứa tất cả elements |
| Lane | Full width | 150-200px mỗi lane | Cao hơn nếu có nhiều rows |
| Task | 150px | 80px | Đủ rộng để hiển thị text |
| Gateway | 50px | 50px | Chuẩn |
| Event | 36px | 36px | Chuẩn |
| Data Object | 36px | 50px | Kích thước chuẩn |
| Data Object Label | 80-100px | 27-40px | Tùy độ dài text |
| Text Annotation | 250-300px | Tùy nội dung | Đủ rộng để đọc |

### Khoảng cách giữa Elements

| Loại khoảng cách | Giá trị | Ghi chú |
|------------------|---------|---------|
| Giữa 2 tasks liên tiếp | 50px | Horizontal spacing |
| Giữa task và gateway | 50px | |
| Giữa các rows | 100-120px | Vertical spacing |
| Margin từ lane edge | 30-50px | Không đặt sát mép |

### Nguyên tắc sắp xếp Layout

1. **Sắp xếp theo hàng ngang (Rows)**
   - Mỗi nhánh/luồng riêng biệt nên nằm trên 1 row riêng
   - Các tasks trong cùng 1 luồng xếp theo chiều ngang từ trái → phải
   - Tránh xếp chồng các elements lên nhau

2. **Tránh đường nối chéo nhau**
   - Ưu tiên đường nối đi theo đường thẳng (horizontal hoặc vertical)
   - Nếu cần đổi hướng, dùng waypoints vuông góc
   - Đường loop back nên đi phía trên hoặc dưới diagram, không cắt ngang

3. **Phân bổ không gian hợp lý**
   - Lanes có nhiều elements → tăng chiều cao
   - Nhánh phức tạp → tăng chiều rộng pool
   - Để khoảng trống giữa các nhóm logic

4. **Labels và Text**
   - Label của gateway đặt bên cạnh (không đè lên)
   - Condition labels đặt gần sequence flow
   - Task names phải hiển thị đầy đủ trong box

### Ví dụ Layout tốt

```
Pool (1800 x 900)
├── Lane: System (height: 140)
│   └── Row 0: Start → Gateway
│
├── Lane: User (height: 480)
│   ├── Row 1: [Task] → [Task] → [Task] ────────────────┐
│   ├── Row 2: [Gateway] → [Task] → [Task] → [Task] ───┤→ [Merge Gateway]
│   ├── Row 3: [Task] ─────────────────────────────────┤
│   └── Row 4: [Task] → [Task] ────────────────────────┘
│
└── Lane: Manager (height: 280)
    └── Row 5: [Task] → [Gateway] → [Task] / [Task] → [Task]
```

### Checklist trước khi xuất file

- [ ] Không có elements bị chồng chéo
- [ ] Tất cả text đều đọc được (không bị cắt)
- [ ] Đường nối không cắt qua elements khác
- [ ] Labels không đè lên nhau
- [ ] Khoảng cách đều đặn, dễ nhìn
- [ ] Pool đủ rộng để chứa tất cả nội dung
- [ ] **Data Objects có đủ: dataObject + dataObjectReference + BPMNShape**
- [ ] **Tất cả elements đều có BPMNDI shapes tương ứng**

## ⚠️ QUY TẮC PHÂN BIỆT TASK TYPES

> **QUAN TRỌNG: Phân biệt rõ Manual Task vs User Task vs Service Task**

### Manual Task (Ký hiệu: bàn tay ✋)

Công việc **hoàn toàn thủ công**, không có workflow engine/hệ thống theo dõi.

| Ví dụ công việc | Giải thích |
|-----------------|------------|
| Đếm gà, kiểm tra chất lượng | Công việc tay chân |
| Vận chuyển, di chuyển hàng hóa | Công việc vật lý |
| Ghi chép vào phiếu/sổ giấy | Viết tay trên giấy |
| Ký tên trên chứng từ giấy | Ký tay |
| Gửi email thủ công (Outlook/Gmail) | Người dùng soạn và gửi, máy tính chỉ là công cụ |
| Gọi điện thoại thông báo | Giao tiếp thủ công |
| Scan tài liệu | Thao tác thủ công với máy scan |

### User Task (Ký hiệu: người 👤)

Công việc do người thực hiện **với sự hỗ trợ của workflow engine/hệ thống**.

| Ví dụ công việc | Giải thích |
|-----------------|------------|
| Nhập dữ liệu vào hệ thống ERP/phần mềm | Tương tác với form trên hệ thống |
| Phê duyệt trên hệ thống workflow | Hệ thống assign task, track trạng thái |
| Xem và xác nhận thông tin trên màn hình | Hệ thống hiển thị và chờ xác nhận |
| Chọn options trong phần mềm | Tương tác với UI của hệ thống |

### Service Task (Ký hiệu: bánh răng ⚙️)

Công việc **hệ thống tự động thực hiện**, không cần người can thiệp.

| Ví dụ công việc | Giải thích |
|-----------------|------------|
| Hệ thống tự động gửi email thông báo | Trigger tự động, không cần người soạn |
| SAP tự động tạo chứng từ | Hệ thống xử lý logic |
| API call đến hệ thống khác | Tích hợp tự động |
| Tính toán, validate dữ liệu | Xử lý backend |

### Send Task vs Manual Task (Gửi email)

| Trường hợp | Task Type | Giải thích |
|------------|-----------|------------|
| Người dùng mở Outlook, soạn email, nhấn Send | **Manual Task** | Máy tính chỉ là công cụ |
| Hệ thống workflow tự động gửi email khi task hoàn thành | **Send Task** | Hệ thống trigger |
| Người dùng click nút "Gửi thông báo" trên hệ thống | **User Task** | Người trigger, hệ thống gửi |

## Mapping Rules: SOP → BPMN

| Pattern trong SOP | BPMN Notation |
|-------------------|---------------|
| "Bắt đầu khi...", "Khi nhận được..." | `startEvent` hoặc `startEvent (message/timer)` |
| "Hàng ngày", "Định kỳ hàng ngày" | `startEvent (timer)` |
| "Hàng tuần", "Định kỳ hàng tuần" | `startEvent (timer)` |
| "Định kỳ", "Theo lịch" | `startEvent (timer)` |
| "Kết thúc", "Hoàn tất", "Xong" | `endEvent` |
| "[Người] thực hiện thủ công...", "viết/ghi/ký trên giấy" | `lane` + `manualTask` |
| "[Người] nhập/thao tác trên hệ thống..." | `lane` + `userTask` |
| "Hệ thống tự động...", "SAP sẽ..." | `serviceTask` |
| "Gửi email (thủ công qua Outlook/Gmail)" | `manualTask` |
| "Hệ thống tự động gửi email/thông báo" | `sendTask` |
| "Chờ phản hồi...", "Đợi xác nhận..." | `receiveTask` hoặc `intermediateEvent (message catch)` |
| "Nếu...thì...", "Trường hợp..." | `exclusiveGateway` |

## ⚠️ QUY TẮC LABEL CHO EXCLUSIVE GATEWAY

> **Khi tạo sequence flow từ Exclusive Gateway:**

| Nhánh | Label | Ghi chú |
|-------|-------|---------|
| Nhánh Yes/Đúng/Có/Đồng ý/Phê duyệt | **Y** | Viết tắt của Yes |
| Nhánh No/Sai/Không/Từ chối | **N** | Viết tắt của No |

**Ví dụ XML:**
```xml
<bpmn:sequenceFlow id="Flow_Yes" name="Y" sourceRef="Gateway_1" targetRef="Task_Approved" />
<bpmn:sequenceFlow id="Flow_No" name="N" sourceRef="Gateway_1" targetRef="Task_Rejected" />
```

**Lưu ý:**
- Chỉ áp dụng cho các nhánh Yes/No đơn giản
- Nếu có nhiều hơn 2 nhánh hoặc điều kiện phức tạp → dùng text mô tả ngắn gọn
| "Đồng thời", "Song song" | `parallelGateway` |
| "Có thể...và/hoặc..." | `inclusiveGateway` |
| "Chờ X ngày", "Sau Y giờ" | `intermediateEvent (timer)` |
| "Lặp lại cho đến khi..." | `task` với `loop` marker |
| "Với mỗi [item]..." | `task` với `multiInstance` marker |
| "Nếu có lỗi..." | `boundaryEvent (error)` |
| "Timeout sau..." | `boundaryEvent (timer)` |
