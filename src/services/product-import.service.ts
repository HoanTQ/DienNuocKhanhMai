import type { ProductImportRow } from '@/lib/validations/product-import.schema';
import { validateImportRow } from '@/lib/validations/product-import.schema';

/**
 * Service xử lý import sản phẩm từ file Excel.
 *
 * Chứa các hàm THUẦN (pure) để dễ test:
 *  - tách mã Nhóm/Loại từ ô dropdown ("A - Đồ điện" -> "A")
 *  - chuẩn hóa giá (giá < 1000 hiểu là nghìn đồng)
 *  - chuẩn hóa đơn vị tính
 *  - sinh SKU dạng AA001 theo bộ đếm từng loại
 *  - map một dòng thô -> dòng đã validate
 *
 * Phần đọc file .xlsx và ghi Supabase nằm ở API route (cần I/O).
 */

// === Bản đồ chuẩn hóa đơn vị tính ===
// Khóa là dạng viết-thường CÓ DẤU. Không bỏ dấu để tránh gộp nhầm các đơn vị
// khác nghĩa nhưng cùng dạng không dấu (VD "bó" bundle vs "bộ" set -> đều "bo").
const UNIT_CANON: Record<string, string> = {
  cái: 'Cái', cây: 'Cây', bộ: 'Bộ', bó: 'Bó', lon: 'Lon', cuộn: 'Cuộn',
  chai: 'Chai', can: 'Can', hộp: 'Hộp', kg: 'Kg', dây: 'Dây',
  sợi: 'Sợi', tuýp: 'Tuýp', m: 'Mét', mét: 'Mét', bịch: 'Bịch', bao: 'Bao',
};

/** Bỏ dấu tiếng Việt + lowercase để so khớp không phân biệt dấu. */
export function stripAccents(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Chuẩn hóa khoảng trắng: gộp nhiều space, bỏ xuống dòng, trim. */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

/**
 * Tách mã từ giá trị dropdown dạng "A - Đồ điện" hoặc "AA - Dây điện".
 * Trả về phần trước " - " đã trim. Nếu không có " - " thì trả nguyên chuỗi đã trim.
 */
export function extractCode(value: unknown): string {
  const text = cleanText(value);
  const idx = text.indexOf(' - ');
  return (idx >= 0 ? text.slice(0, idx) : text).trim().toUpperCase();
}

/**
 * Chuẩn hóa giá về ĐỒNG.
 * Quy tắc: giá trị > 0 và < 1000 được hiểu là "nghìn đồng" -> nhân 1000.
 * Giá <= 0 hoặc không phải số -> null.
 */
export function normalizePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return null;
  const result = num < 1000 ? num * 1000 : num;
  return Math.round(result);
}

/** Chuẩn hóa số lượng về số nguyên >= 0. */
export function normalizeQty(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

/** Chuẩn hóa đơn vị tính về dạng chuẩn (Cái, Cây, ...). Giữ nguyên nếu không có trong map. */
export function canonUnit(value: unknown): string {
  const text = cleanText(value);
  if (!text) return '';
  const key = text.toLowerCase();
  return UNIT_CANON[key] ?? text;
}

/**
 * Bộ sinh SKU theo mã ghép (prefix 2 ký tự) + số thứ tự.
 * Khởi tạo với số thứ tự lớn nhất hiện có trong DB cho từng prefix (để không phá mã cũ).
 * Định dạng: 3 chữ số (AA001); tự mở rộng khi vượt 999 (AA1000).
 */
export class SkuGenerator {
  private counters: Map<string, number>;

  constructor(existingMaxByPrefix: Record<string, number> = {}) {
    this.counters = new Map(Object.entries(existingMaxByPrefix));
  }

  next(prefix: string): string {
    const current = this.counters.get(prefix) ?? 0;
    const nextNum = current + 1;
    this.counters.set(prefix, nextNum);
    const padded = String(nextNum).padStart(3, '0');
    return `${prefix}${padded}`;
  }
}

/**
 * Trích số thứ tự lớn nhất theo prefix từ danh sách SKU đã có.
 * VD: ["AA001","AA005","BB002"] -> { AA: 5, BB: 2 }
 * Bỏ qua SKU không đúng định dạng <2 chữ><số>.
 */
export function maxSeqByPrefix(existingSkus: Array<string | null | undefined>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const sku of existingSkus) {
    if (!sku) continue;
    const m = /^([A-Z]{2})(\d+)$/.exec(sku.trim().toUpperCase());
    if (!m) continue;
    const prefix = m[1];
    const seq = Number(m[2]);
    if (!result[prefix] || seq > result[prefix]) {
      result[prefix] = seq;
    }
  }
  return result;
}

// === Kiểu dữ liệu kết quả xử lý một dòng ===
export interface ParsedRowOk {
  ok: true;
  rowNumber: number;
  data: ProductImportRow;
}
export interface ParsedRowError {
  ok: false;
  rowNumber: number;
  errors: string[];
  ten_san_pham: string;
}
export type ParsedRow = ParsedRowOk | ParsedRowError;

/** Kiểu dòng thô đọc từ Excel (theo thứ tự cột template). */
export interface RawRow {
  rowNumber: number;
  nhom: unknown;
  loai: unknown;
  ten_san_pham: unknown;
  thuong_hieu: unknown;
  quy_cach: unknown;
  dvt_co_ban: unknown;
  gia_nhap: unknown;
  gia_ban_le: unknown;
  gia_tho_thau: unknown; // bỏ qua, chỉ để giữ vị trí cột
  so_luong: unknown;
  nha_cung_cap: unknown;
  hinh_anh: unknown;
  // Đơn vị quy đổi 1 & 2
  dvt_qd1: unknown;
  ty_le_qd1: unknown;
  gia_ban_qd1: unknown;
  dvt_qd2: unknown;
  ty_le_qd2: unknown;
  gia_ban_qd2: unknown;
}

/** Ép giá trị về number, trả undefined nếu không hợp lệ/để trống. */
function toNumberOrUndef(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Chuẩn hóa + validate một dòng thô.
 * `validCodes` là tập mã ghép hợp lệ (VD Set{"AA","BB",...}) để chặn Loại sai Nhóm.
 */
/**
 * Build danh sách đơn vị quy đổi từ các cặp cột trong dòng thô.
 * Bỏ qua cặp trống (không có tên ĐVT quy đổi).
 * from_unit = ĐVT quy đổi, to_unit = ĐVT cơ bản, rate = tỷ lệ, gia_ban tùy chọn.
 */
export function buildConversions(raw: RawRow): Array<{
  ten_dvt: string;
  ty_le: number;
  gia_ban?: number;
}> {
  const pairs = [
    { name: raw.dvt_qd1, rate: raw.ty_le_qd1, price: raw.gia_ban_qd1 },
    { name: raw.dvt_qd2, rate: raw.ty_le_qd2, price: raw.gia_ban_qd2 },
  ];
  const out: Array<{ ten_dvt: string; ty_le: number; gia_ban?: number }> = [];
  for (const p of pairs) {
    const ten = canonUnit(p.name);
    const rate = toNumberOrUndef(p.rate);
    // Bỏ qua cặp hoàn toàn trống
    if (!ten && rate === undefined) continue;
    out.push({
      ten_dvt: ten,
      ty_le: rate ?? 0, // 0 sẽ bị schema bắt lỗi (phải > 0)
      gia_ban: normalizePrice(p.price) ?? undefined,
    });
  }
  return out;
}

export function parseRow(raw: RawRow, validCodes: Set<string>): ParsedRow {
  const maNhom = extractCode(raw.nhom);
  const maLoai = extractCode(raw.loai);
  const name = cleanText(raw.ten_san_pham);

  const candidate = {
    ma_nhom: maNhom,
    ma_loai: maLoai,
    ten_san_pham: name,
    thuong_hieu: cleanText(raw.thuong_hieu),
    quy_cach: cleanText(raw.quy_cach),
    dvt_co_ban: canonUnit(raw.dvt_co_ban),
    gia_nhap: normalizePrice(raw.gia_nhap) ?? undefined,
    gia_ban_le: normalizePrice(raw.gia_ban_le) ?? undefined,
    gia_tho_thau: normalizePrice(raw.gia_tho_thau) ?? undefined,
    so_luong: normalizeQty(raw.so_luong),
    nha_cung_cap: cleanText(raw.nha_cung_cap),
    hinh_anh: cleanText(raw.hinh_anh),
    unit_conversions: buildConversions(raw),
  };

  const parsed = validateImportRow(candidate);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => i.message);
    return { ok: false, rowNumber: raw.rowNumber, errors, ten_san_pham: name };
  }

  // Kiểm tra mã ghép hợp lệ + Loại thuộc đúng Nhóm
  const combined = parsed.data.ma_loai;
  if (!validCodes.has(combined)) {
    return {
      ok: false,
      rowNumber: raw.rowNumber,
      errors: [`Loại "${maLoai}" không có trong danh mục`],
      ten_san_pham: name,
    };
  }
  if (combined[0] !== parsed.data.ma_nhom) {
    return {
      ok: false,
      rowNumber: raw.rowNumber,
      errors: [`Loại "${combined}" không thuộc Nhóm "${parsed.data.ma_nhom}"`],
      ten_san_pham: name,
    };
  }

  // Kiểm tra đơn vị quy đổi: không trùng ĐVT cơ bản, không trùng nhau
  const conv = parsed.data.unit_conversions ?? [];
  const seen = new Set<string>([parsed.data.dvt_co_ban.toLowerCase()]);
  for (const c of conv) {
    const key = c.ten_dvt.toLowerCase();
    if (seen.has(key)) {
      return {
        ok: false,
        rowNumber: raw.rowNumber,
        errors: [`Đơn vị quy đổi "${c.ten_dvt}" trùng với đơn vị khác của sản phẩm`],
        ten_san_pham: name,
      };
    }
    seen.add(key);
  }

  return { ok: true, rowNumber: raw.rowNumber, data: parsed.data };
}

/** Kiểm tra một dòng thô có hoàn toàn trống không (bỏ qua khi import). */
export function isEmptyRow(raw: RawRow): boolean {
  return (
    !cleanText(raw.nhom) &&
    !cleanText(raw.loai) &&
    !cleanText(raw.ten_san_pham) &&
    !cleanText(raw.thuong_hieu) &&
    !cleanText(raw.quy_cach)
  );
}
