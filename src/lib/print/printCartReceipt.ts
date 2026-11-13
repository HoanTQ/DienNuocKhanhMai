import type { CartItem } from '@/services/pos.service';
import type { Customer } from '@/lib/types';

/**
 * In toa tạm (bill xem trước) khổ A5 từ giỏ hàng POS.
 *
 * Đây là toa CHƯA THANH TOÁN — dùng để khách xem lại danh sách hàng + tổng tiền
 * trước khi chốt đơn. Mở một cửa sổ in riêng với HTML tự chứa (inline CSS khổ A5)
 * nên không ảnh hưởng tới layout của trang POS và không cần thư viện ngoài.
 */

const STORE_INFO = {
  name: 'ĐIỆN NƯỚC KHÁNH MAI',
  address: 'Km15 Quốc Lộ 14, buôn Kroa B, xã Cuôr Đăng, tỉnh Đắk Lắk',
  phone: '0335.884.998 - 0347.981.271',
} as const;

export interface PrintCartReceiptParams {
  items: CartItem[];
  customer?: Customer | null;
  subtotal: number;
  discountAmount: number;
  total: number;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value);
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Escape để tránh HTML injection từ tên sản phẩm / khách hàng. */
function esc(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Dựng chuỗi HTML hoàn chỉnh của toa A5. */
function buildReceiptHtml(params: PrintCartReceiptParams): string {
  const { items, customer, subtotal, discountAmount, total } = params;
  const now = new Date();

  const rows = items
    .map((item, index) => {
      return `
        <tr>
          <td class="c-idx">${index + 1}</td>
          <td class="c-name">
            <div class="p-name">${esc(item.product_name)}</div>
          </td>
          <td class="c-qty">${formatQty(item.quantity)} ${esc(item.unit)}</td>
          <td class="c-price">${formatPrice(item.unit_price)}</td>
          <td class="c-total">${formatPrice(item.line_total)}</td>
        </tr>`;
    })
    .join('');

  const discountRow =
    discountAmount > 0
      ? `<tr><td class="s-label">Giảm giá</td><td class="s-value discount">-${formatPrice(
          discountAmount
        )}</td></tr>`
      : '';

  const customerBlock = customer
    ? `
      <div class="info">
        <div><span class="info-label">Khách hàng:</span> ${esc(customer.name)}</div>
        ${customer.phone ? `<div><span class="info-label">Điện thoại:</span> ${esc(customer.phone)}</div>` : ''}
        ${customer.address ? `<div><span class="info-label">Địa chỉ:</span> ${esc(customer.address)}</div>` : ''}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Toa tạm - ${esc(STORE_INFO.name)}</title>
  <style>
    @page { size: A5; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      font-size: 12px;
      line-height: 1.4;
    }
    /* Chừa chỗ ở đáy cho khối footer cố định, tránh nội dung đè lên */
    .sheet { width: 100%; padding-bottom: 46mm; }
    .header { text-align: center; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 10px; }
    .store-name { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; }
    .store-sub { font-size: 11px; color: #475569; margin-top: 2px; }
    .doc-title { font-size: 15px; font-weight: 700; margin-top: 8px; text-transform: uppercase; }
    .meta { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin: 8px 0; }
    .info { font-size: 12px; margin-bottom: 8px; }
    .info-label { color: #475569; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.items th {
      text-align: left; font-size: 11px; color: #475569; font-weight: 600;
      border-bottom: 1px solid #CBD5E1; padding: 4px 4px;
    }
    table.items td { padding: 5px 4px; border-bottom: 1px dashed #E2E8F0; vertical-align: top; }
    /* Không cắt ngang một dòng sản phẩm giữa hai trang */
    table.items tr { break-inside: avoid; page-break-inside: avoid; }
    table.items thead { display: table-header-group; }
    .c-idx { width: 24px; text-align: center; color: #64748B; }
    .c-qty { width: 72px; text-align: center; white-space: nowrap; }
    .c-price { width: 78px; text-align: right; white-space: nowrap; }
    .c-total { width: 82px; text-align: right; white-space: nowrap; font-weight: 600; }
    th.c-qty { text-align: center; }
    th.c-price, th.c-total { text-align: right; }
    .p-name { font-weight: 600; }
    /* Khối cuối trang: luôn bám đáy mỗi trang in (fixed lặp ở mọi trang) */
    .page-footer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      background: #fff;
    }
    .summary { width: 100%; }
    .summary table { width: 55%; margin-left: auto; border-collapse: collapse; }
    .summary td { padding: 3px 4px; font-size: 12px; }
    .s-label { color: #475569; }
    .s-value { text-align: right; font-weight: 600; }
    .s-value.discount { color: #16A34A; }
    .total-row td { border-top: 2px solid #0F172A; padding-top: 6px; font-size: 15px; font-weight: 700; }
    .thanks { margin-top: 10px; text-align: center; font-size: 11px; color: #64748B; }
    .signatures { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; text-align: center; }
    .signatures div { width: 45%; }
    .sig-line { margin-top: 28px; border-top: 1px dotted #94A3B8; padding-top: 4px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="store-name">${esc(STORE_INFO.name)}</div>
      ${STORE_INFO.address ? `<div class="store-sub">${esc(STORE_INFO.address)}</div>` : ''}
      ${STORE_INFO.phone ? `<div class="store-sub">SĐT/Zalo: ${esc(STORE_INFO.phone)}</div>` : ''}
      <div class="doc-title">Đơn hàng (Chưa thanh toán)</div>
    </div>

    <div class="meta">
      <span>Ngày: ${formatDateTime(now)}</span>
    </div>

    ${customerBlock}

    <table class="items">
      <thead>
        <tr>
          <th class="c-idx">#</th>
          <th>Sản phẩm</th>
          <th class="c-qty">SL</th>
          <th class="c-price">Đơn giá</th>
          <th class="c-total">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

  </div>

  <div class="page-footer">
    <div class="summary">
      <table>
        <tr><td class="s-label">Tạm tính</td><td class="s-value">${formatPrice(subtotal)}</td></tr>
        ${discountRow}
        <tr class="total-row"><td class="s-label">Tổng cộng</td><td class="s-value">${formatPrice(total)}</td></tr>
      </table>
    </div>

    <div class="signatures">
      <div><div class="sig-line">Người mua</div></div>
      <div><div class="sig-line">Người bán</div></div>
    </div>

    <div class="thanks">Cảm ơn quý khách! Vui lòng kiểm tra lại hàng hóa trước khi thanh toán.</div>
  </div>
</body>
</html>`;
}

/**
 * Mở cửa sổ in và in toa A5. Trả về false nếu giỏ trống hoặc trình duyệt chặn popup.
 */
export function printCartReceipt(params: PrintCartReceiptParams): boolean {
  if (typeof window === 'undefined') return false;
  if (!params.items || params.items.length === 0) return false;

  const html = buildReceiptHtml(params);
  const printWindow = window.open('', '_blank', 'width=800,height=900');

  if (!printWindow) {
    // Popup bị chặn — fallback dùng iframe ẩn
    return printViaIframe(html);
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Chờ layout/render xong rồi mới in
  printWindow.focus();
  const triggerPrint = () => {
    printWindow.print();
  };

  if (printWindow.document.readyState === 'complete') {
    setTimeout(triggerPrint, 150);
  } else {
    printWindow.onload = () => setTimeout(triggerPrint, 150);
  }

  return true;
}

/** Fallback khi popup bị chặn: in bằng iframe ẩn trong trang hiện tại. */
function printViaIframe(html: string): boolean {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      cleanup();
    }, 150);
  };

  return true;
}
