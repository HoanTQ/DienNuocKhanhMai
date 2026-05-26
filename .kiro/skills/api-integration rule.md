---
name: api-integration-rule
inclusion: auto
description: >
  Quy tắc thiết kế API integration giữa các hệ thống có database riêng biệt.
  Kích hoạt khi user đề cập đến: "API integration", "tích hợp API", "idempotency",
  "saga pattern", "outbox pattern", "retry", "reconciliation", "compensating API",
  "kết nối hệ thống", "sync dữ liệu", hoặc bất kỳ thiết kế nào liên quan đến
  giao tiếp giữa 2+ hệ thống qua REST API.
---

# API Integration Design Spec

> Tài liệu chuẩn thiết kế tích hợp API giữa các hệ thống có database riêng biệt.
> Dùng làm skill cho AI (Kiro, Claude…) hoặc làm checklist cho đội dev khi thiết kế API integration.

---

## 1. Nguyên tắc nền tảng

Khi hai hệ thống tích hợp qua API, mỗi bên quản lý database riêng. Không thể dùng database-level transaction (XA/2PC) xuyên suốt hai bên. Vì vậy, mọi thiết kế phải tuân thủ nguyên tắc:

- **Assume failure**: Luôn giả định mạng có thể lỗi bất cứ lúc nào — timeout, mất gói, connection reset.
- **Design for recovery**: Mỗi API phải có khả năng tự phục hồi khi gặp lỗi, không phụ thuộc vào hạ tầng mạng.
- **Eventual consistency over strong consistency**: Chấp nhận dữ liệu có thể chưa đồng bộ tức thì, nhưng đảm bảo cuối cùng sẽ nhất quán.

---

## 2. Các pattern bắt buộc

### 2.1. Idempotency (Tính bất biến)

Mỗi API **phải** hỗ trợ idempotency — gọi cùng một request nhiều lần cho ra cùng một kết quả.

**Cách triển khai:**

- Client gửi kèm header `Idempotency-Key` (UUID v4) trong mỗi request tạo/cập nhật dữ liệu.
- Server lưu `Idempotency-Key` + kết quả vào bảng riêng (hoặc cache).
- Nếu nhận lại key đã xử lý → trả về kết quả cũ, không xử lý lại.
- TTL của idempotency key: tối thiểu 24 giờ, khuyến nghị 72 giờ.

**Ví dụ request:**

```
POST /api/v1/orders
Headers:
  Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
  Content-Type: application/json
Body:
  { "product_id": "P001", "quantity": 2 }
```

**Ví dụ bảng lưu trữ:**

```sql
CREATE TABLE idempotency_keys (
    idempotency_key  VARCHAR(64) PRIMARY KEY,
    request_hash     VARCHAR(256) NOT NULL,
    response_code    INT NOT NULL,
    response_body    TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at       TIMESTAMP NOT NULL
);
```

**Áp dụng cho method:**

| Method | Idempotent mặc định? | Cần Idempotency-Key? |
|--------|----------------------|----------------------|
| GET    | Có                   | Không                |
| PUT    | Có                   | Không (nếu dùng đúng semantic) |
| DELETE | Có                   | Không                |
| POST   | **Không**            | **Bắt buộc**        |
| PATCH  | Không                | Khuyến nghị          |

---

### 2.2. Saga Pattern + Compensating API

Khi một luồng nghiệp vụ cần ghi dữ liệu vào cả hai hệ thống, sử dụng Saga Pattern.

**Nguyên tắc:**

- Mỗi bước (step) trong saga là một local transaction ở một hệ thống.
- Mỗi bước **phải** có một compensating action (hành động hoàn tác) tương ứng.
- Nếu bước N lỗi → gọi compensating action của bước N-1, N-2… cho đến bước 1.

**Ví dụ luồng tạo đơn hàng:**

```
Bước 1: Hệ thống A — Tạo đơn hàng (status: pending)
  ↓ thành công
Bước 2: Hệ thống B — Trừ tồn kho (POST /api/v1/inventory/reserve)
  ↓ thành công
Bước 3: Hệ thống A — Cập nhật đơn hàng (status: confirmed)

Nếu Bước 2 lỗi:
  → Compensate Bước 1: Huỷ đơn hàng ở A (status: cancelled)

Nếu Bước 3 lỗi:
  → Compensate Bước 2: Hoàn tồn kho ở B (POST /api/v1/inventory/release)
  → Compensate Bước 1: Huỷ đơn hàng ở A
```

**Yêu cầu thiết kế API:**

| API chính                 | Compensating API              |
|--------------------------|-------------------------------|
| POST /orders             | POST /orders/{id}/cancel      |
| POST /inventory/reserve  | POST /inventory/release       |
| POST /payments/charge    | POST /payments/refund         |

- Compensating API **phải** idempotent.
- Compensating API **phải** hoạt động ngay cả khi bước chính chỉ thành công một phần.

---

### 2.3. Retry với Exponential Backoff

Khi gọi API bị lỗi tạm thời (timeout, 5xx, connection reset), client phải tự động retry.

**Cấu hình retry:**

```
max_retries: 5
initial_delay: 1s
backoff_multiplier: 2
max_delay: 30s
jitter: random(0, 0.5 * current_delay)
```

**Thời gian retry thực tế:**

| Lần | Delay (giây) | Delay + Jitter (ước lượng) |
|-----|-------------|---------------------------|
| 1   | 1           | 1.0 – 1.5                 |
| 2   | 2           | 2.0 – 3.0                 |
| 3   | 4           | 4.0 – 6.0                 |
| 4   | 8           | 8.0 – 12.0                |
| 5   | 16          | 16.0 – 24.0               |

**Retry chỉ khi:**

- HTTP 408 (Request Timeout)
- HTTP 429 (Too Many Requests) — retry sau `Retry-After` header
- HTTP 500, 502, 503, 504
- Connection timeout / reset

**KHÔNG retry khi:**

- HTTP 400 (Bad Request) — lỗi dữ liệu, retry cũng lỗi
- HTTP 401, 403 — lỗi xác thực/phân quyền
- HTTP 404 — resource không tồn tại
- HTTP 409 (Conflict) — cần xử lý logic, không phải retry
- HTTP 422 (Unprocessable Entity) — lỗi validation

---

### 2.4. Outbox Pattern

Đảm bảo không mất request ngay cả khi API bên ngoài không khả dụng tại thời điểm gọi.

**Cách hoạt động:**

```
1. Trong CÙNG MỘT local transaction:
   - Ghi dữ liệu nghiệp vụ vào bảng chính
   - Ghi một record vào bảng outbox

2. Background worker (chạy riêng):
   - Poll bảng outbox mỗi N giây
   - Lấy các record chưa gửi
   - Gọi API bên ngoài
   - Nếu thành công → đánh dấu đã gửi
   - Nếu lỗi → giữ nguyên, retry lần sau
```

**Schema bảng outbox:**

```sql
CREATE TABLE outbox (
    id              BIGSERIAL PRIMARY KEY,
    aggregate_type  VARCHAR(100) NOT NULL,   -- vd: 'Order', 'Payment'
    aggregate_id    VARCHAR(100) NOT NULL,   -- vd: order_id
    event_type      VARCHAR(100) NOT NULL,   -- vd: 'OrderCreated'
    payload         JSONB NOT NULL,
    idempotency_key VARCHAR(64) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending | sent | failed
    retry_count     INT DEFAULT 0,
    max_retries     INT DEFAULT 5,
    next_retry_at   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at         TIMESTAMP
);

CREATE INDEX idx_outbox_pending ON outbox (status, next_retry_at)
    WHERE status = 'pending';
```

---

### 2.5. Reconciliation (Đối soát)

Dù thiết kế tốt đến đâu, vẫn có khả năng dữ liệu bị lệch. Reconciliation là tuyến phòng thủ cuối cùng.

**Yêu cầu:**

- Chạy định kỳ (mỗi 5 phút, mỗi giờ, hoặc mỗi ngày tuỳ mức độ quan trọng).
- So sánh dữ liệu giữa hai hệ thống dựa trên ID chung hoặc idempotency key.
- Phát hiện các trường hợp: có ở A nhưng không có ở B (hoặc ngược lại), có ở cả hai nhưng trạng thái khác nhau.
- Tạo báo cáo hoặc tự động sửa tuỳ theo business rule.

**API hỗ trợ reconciliation:**

Mỗi hệ thống nên cung cấp API cho đối soát:

```
GET /api/v1/reconciliation/records
  ?from=2025-01-01T00:00:00Z
  &to=2025-01-01T23:59:59Z
  &status=confirmed
  &page=1
  &page_size=100

Response:
{
  "records": [
    {
      "id": "ORD-001",
      "external_ref": "EXT-ABC",
      "status": "confirmed",
      "amount": 500000,
      "created_at": "2025-01-01T10:30:00Z",
      "checksum": "sha256:abc123..."
    }
  ],
  "pagination": { "page": 1, "total_pages": 5 }
}
```

---

## 3. Xử lý lỗi chuẩn

### 3.1. Response format thống nhất

Mọi API phải trả về cùng một cấu trúc lỗi:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Không đủ tồn kho cho sản phẩm P001",
    "details": {
      "product_id": "P001",
      "requested": 10,
      "available": 3
    },
    "trace_id": "req-550e8400-e29b-41d4",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### 3.2. Phân loại lỗi

| Loại lỗi          | HTTP Code | Retry? | Hành động                       |
|-------------------|-----------|--------|---------------------------------|
| Validation        | 400       | Không  | Sửa dữ liệu đầu vào           |
| Authentication    | 401       | Không  | Làm mới token rồi thử lại      |
| Authorization     | 403       | Không  | Kiểm tra quyền                 |
| Not Found         | 404       | Không  | Kiểm tra ID/resource            |
| Conflict          | 409       | Không  | Xử lý conflict (merge/override) |
| Rate Limit        | 429       | Có     | Chờ theo Retry-After header     |
| Server Error      | 500       | Có     | Retry với backoff               |
| Service Down      | 503       | Có     | Retry với backoff               |
| Gateway Timeout   | 504       | Có     | Retry với backoff + kiểm tra idempotency |

### 3.3. Timeout configuration

```
connect_timeout: 5s      # Thời gian tối đa để thiết lập kết nối
read_timeout: 30s        # Thời gian tối đa chờ response
write_timeout: 30s       # Thời gian tối đa để gửi request body
total_timeout: 60s       # Tổng thời gian tối đa cho toàn bộ request
```

Với các API xử lý nặng (báo cáo, export dữ liệu lớn), sử dụng pattern **Async Request-Reply**:

```
1. Client gửi: POST /api/v1/reports/generate → 202 Accepted
   Response: { "job_id": "JOB-001", "status_url": "/api/v1/jobs/JOB-001" }

2. Client poll: GET /api/v1/jobs/JOB-001
   Response: { "status": "processing", "progress": 60 }

3. Khi hoàn thành: GET /api/v1/jobs/JOB-001
   Response: { "status": "completed", "result_url": "/api/v1/reports/RPT-001" }
```

---

## 4. Observability (Giám sát)

### 4.1. Distributed Tracing

Mỗi request phải mang theo trace context xuyên suốt cả hai hệ thống:

```
Headers:
  X-Trace-Id: trace-550e8400-e29b-41d4
  X-Span-Id: span-001
  X-Parent-Span-Id: span-000
```

### 4.2. Logging chuẩn

Mỗi API call phải log đủ các thông tin:

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "trace_id": "trace-550e8400",
  "direction": "outbound",
  "method": "POST",
  "url": "/api/v1/inventory/reserve",
  "request_body_hash": "sha256:def456",
  "idempotency_key": "550e8400-e29b-41d4",
  "response_code": 200,
  "latency_ms": 245,
  "retry_attempt": 0
}
```

### 4.3. Health Check API

Mỗi hệ thống phải cung cấp health check endpoint:

```
GET /api/v1/health

Response:
{
  "status": "healthy",
  "version": "2.1.0",
  "database": "connected",
  "dependencies": {
    "system_b_api": { "status": "healthy", "latency_ms": 45 },
    "message_queue": { "status": "healthy", "queue_depth": 12 }
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### 4.4. Alerting rules

| Metric                              | Ngưỡng cảnh báo      | Mức độ   |
|--------------------------------------|-----------------------|----------|
| API error rate (5xx)                 | > 5% trong 5 phút    | Critical |
| API latency P99                      | > 5s trong 5 phút    | Warning  |
| Outbox pending records               | > 100 records         | Warning  |
| Outbox record age                    | > 1 giờ chưa gửi     | Critical |
| Reconciliation mismatch rate         | > 1%                  | Critical |
| Retry exhausted (hết retry vẫn lỗi) | > 0                   | Critical |

---

## 5. Versioning & Contract

### 5.1. API Versioning

Sử dụng URL path versioning:

```
/api/v1/orders
/api/v2/orders
```

- Khi thay đổi breaking change → tạo version mới.
- Duy trì version cũ tối thiểu 6 tháng với deprecation notice.
- Trả header `Sunset: Sat, 01 Jul 2026 00:00:00 GMT` cho version sắp ngừng.

### 5.2. Contract-first design

- Mỗi API phải có OpenAPI (Swagger) spec trước khi code.
- Hai bên ký nhận (agree) contract trước khi triển khai.
- Mọi thay đổi contract phải có changelog và thông báo trước tối thiểu 30 ngày.

---

## 6. Security

### 6.1. Authentication

- Sử dụng OAuth 2.0 Client Credentials cho server-to-server.
- Token có TTL ngắn (15–30 phút), tự động refresh.
- Không truyền credential qua query parameter.

### 6.2. Transport

- Bắt buộc HTTPS/TLS 1.2+.
- Mutual TLS (mTLS) cho các API nhạy cảm.

### 6.3. Rate Limiting

- Mỗi API phải có rate limit.
- Trả headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Khi bị limit → HTTP 429 + header `Retry-After`.

### 6.4. Input Validation

- Validate tất cả input ở server, không tin client.
- Giới hạn payload size (khuyến nghị max 1MB cho API thông thường).
- Sanitize để chống injection.

---

## 7. Checklist thiết kế API Integration

Sử dụng checklist này khi thiết kế hoặc review bất kỳ API integration nào:

### Trước khi code

- [ ] Đã có OpenAPI spec và hai bên đồng ý contract
- [ ] Đã xác định luồng Saga và compensating action cho mỗi bước
- [ ] Đã thiết kế Idempotency-Key cho mọi POST/PATCH API
- [ ] Đã xác định timeout cho từng API endpoint
- [ ] Đã thiết kế error response format thống nhất

### Trong khi code

- [ ] Retry với exponential backoff + jitter đã implement
- [ ] Outbox pattern cho các API call quan trọng
- [ ] Distributed tracing (trace_id) xuyên suốt các hệ thống
- [ ] Logging đủ thông tin cho mỗi API call (request, response, latency, retry)
- [ ] Circuit breaker khi hệ thống bên kia liên tục lỗi

### Trước khi go-live

- [ ] Health check API đã hoạt động
- [ ] Reconciliation job đã chạy và kiểm thử
- [ ] Alerting rules đã cấu hình (error rate, latency, outbox depth)
- [ ] Load test đã chạy với kịch bản failure (kill connection giữa chừng, timeout)
- [ ] Runbook xử lý sự cố đã viết cho đội vận hành

### Vận hành

- [ ] Reconciliation report được review định kỳ
- [ ] Outbox dead-letter queue được xử lý
- [ ] API deprecation timeline được theo dõi

---

## 8. Lưu ý về hạ tầng mạng

Các giải pháp SD-WAN (như Fortinet SD-WAN) giúp giảm xác suất gián đoạn mạng bằng cách tự động failover multi-link và ưu tiên traffic theo SLA. Tuy nhiên, thiết kế API **không được phụ thuộc** vào tính ổn định của mạng. SD-WAN là lớp bảo vệ bổ sung, không phải thay thế cho các pattern ở tầng ứng dụng (idempotency, retry, outbox, saga, reconciliation).

**Nguyên tắc: Network is unreliable — design accordingly.**
