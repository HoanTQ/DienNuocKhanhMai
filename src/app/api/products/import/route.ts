import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';
import {
  parseRow,
  isEmptyRow,
  maxSeqByPrefix,
  SkuGenerator,
  stripAccents,
  cleanText,
  type RawRow,
  type ParsedRowError,
} from '@/services/product-import.service';

export const runtime = 'nodejs';

const SHEET_NAME = 'San pham';
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

// Ánh xạ header (đã bỏ dấu + lowercase, gộp space) -> field trong RawRow.
// Nhờ đọc theo header nên không phụ thuộc thứ tự cột.
const HEADER_MAP: Record<string, keyof RawRow> = {
  'nhom': 'nhom',
  'loai': 'loai',
  'ten san pham': 'ten_san_pham',
  'thuong hieu': 'thuong_hieu',
  'quy cach': 'quy_cach',
  'dvt co ban': 'dvt_co_ban',
  'dvt': 'dvt_co_ban', // phòng khi template chỉ ghi "ĐVT"
  'gia nhap': 'gia_nhap',
  'gia ban le': 'gia_ban_le',
  'gia tho thau': 'gia_tho_thau',
  'gia tho/thau': 'gia_tho_thau',
  'so luong': 'so_luong',
  'ton kho': 'so_luong',
  'nha cung cap': 'nha_cung_cap',
  'hinh anh': 'hinh_anh',
  'hinh anh (url)': 'hinh_anh',
  // Đơn vị quy đổi 1
  'dvt quy doi 1': 'dvt_qd1',
  'don vi quy doi 1': 'dvt_qd1',
  'ty le quy doi 1': 'ty_le_qd1',
  'gia ban quy doi 1': 'gia_ban_qd1',
  // Đơn vị quy đổi 2
  'dvt quy doi 2': 'dvt_qd2',
  'don vi quy doi 2': 'dvt_qd2',
  'ty le quy doi 2': 'ty_le_qd2',
  'gia ban quy doi 2': 'gia_ban_qd2',
};

/** Chuẩn hóa tên sản phẩm để so trùng: gộp khoảng trắng + lowercase. */
function normName(raw: unknown): string {
  return cleanText(raw).toLowerCase();
}

function headerKey(raw: string): string {
  return stripAccents(cleanText(raw))
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  // exceljs có thể trả object cho rich text / formula / hyperlink
  if (typeof v === 'object') {
    const anyV = v as Record<string, unknown>;
    if ('text' in anyV) return anyV.text;
    if ('result' in anyV) return anyV.result;
    if ('richText' in anyV && Array.isArray(anyV.richText)) {
      return (anyV.richText as Array<{ text: string }>).map((t) => t.text).join('');
    }
    if ('hyperlink' in anyV) return anyV.hyperlink;
    return '';
  }
  return v;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Xác thực + kiểm tra quyền owner (RLS chỉ cho owner ghi products)
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', auth.user.id)
    .single();
  if (profile?.role !== 'owner') {
    return NextResponse.json(
      { error: 'Chỉ chủ cửa hàng (owner) mới được import sản phẩm' },
      { status: 403 }
    );
  }

  // 2. Nhận file
  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: 'Không đọc được dữ liệu upload' }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: 'Thiếu file (field "file")' }, { status: 400 });
  }
  if (!/\.xlsx$/i.test(file.name)) {
    return NextResponse.json({ error: 'Chỉ chấp nhận file .xlsx' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File quá lớn (tối đa 5MB)' }, { status: 400 });
  }

  // 3. Đọc workbook
  const workbook = new ExcelJS.Workbook();
  try {
    const buf = await file.arrayBuffer();
    await workbook.xlsx.load(buf);
  } catch {
    return NextResponse.json({ error: 'File Excel không hợp lệ hoặc hỏng' }, { status: 400 });
  }
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    return NextResponse.json(
      { error: `Không tìm thấy sheet "${SHEET_NAME}" trong file` },
      { status: 400 }
    );
  }

  // 4. Đọc header -> vị trí cột
  const colToField = new Map<number, keyof RawRow>();
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const key = headerKey(String(cellValue(cell)));
    const field = HEADER_MAP[key];
    if (field) colToField.set(colNumber, field);
  });
  const required: Array<keyof RawRow> = [
    'nhom', 'loai', 'ten_san_pham', 'thuong_hieu', 'quy_cach', 'dvt_co_ban', 'gia_ban_le',
  ];
  const mappedFields = new Set(colToField.values());
  const missingCols = required.filter((f) => !mappedFields.has(f));
  if (missingCols.length > 0) {
    return NextResponse.json(
      {
        error: 'Template thiếu cột bắt buộc',
        missing_columns: missingCols,
        hint: 'Cần các cột: Nhóm, Loại, Tên sản phẩm, Thương hiệu, Quy cách, ĐVT cơ bản, Giá bán lẻ',
      },
      { status: 400 }
    );
  }

  // 5. Đọc danh mục hợp lệ từ DB (categories cấp 2, description = mã ghép)
  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .select('id, description, parent_id')
    .not('parent_id', 'is', null);
  if (catErr) {
    return NextResponse.json({ error: 'Không tải được danh mục: ' + catErr.message }, { status: 500 });
  }
  const codeToCategoryId = new Map<string, string>();
  for (const c of cats ?? []) {
    if (c.description) codeToCategoryId.set(String(c.description).toUpperCase(), c.id);
  }
  const validCodes = new Set(codeToCategoryId.keys());

  // 6. Chuẩn bị bộ sinh SKU: lấy max seq hiện có từ products
  const { data: existing } = await supabase.from('products').select('sku').not('sku', 'is', null);
  const gen = new SkuGenerator(maxSeqByPrefix((existing ?? []).map((r) => r.sku)));

  // 6b. Tải tên sản phẩm đã có trong DB để chống trùng (so theo tên chuẩn hóa)
  const { data: existingNames } = await supabase.from('products').select('name');
  const existingNameSet = new Set((existingNames ?? []).map((p) => normName(p.name)));
  // Theo dõi tên đã gặp trong chính file này (chống trùng nội bộ file)
  const seenNames = new Set<string>();

  // 7. Duyệt từng dòng
  const okRows: Array<{
    rowNumber: number;
    data: ReturnType<typeof buildInsert>;
    conversions: Array<{ ten_dvt: string; ty_le: number; gia_ban?: number }>;
    baseUnit: string;
  }> = [];
  const errors: ParsedRowError[] = [];
  let skipped = 0;

  const lastRow = sheet.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const raw: RawRow = {
      rowNumber: r,
      nhom: '', loai: '', ten_san_pham: '', thuong_hieu: '', quy_cach: '',
      dvt_co_ban: '', gia_nhap: '', gia_ban_le: '', gia_tho_thau: '',
      so_luong: '', nha_cung_cap: '', hinh_anh: '',
      dvt_qd1: '', ty_le_qd1: '', gia_ban_qd1: '',
      dvt_qd2: '', ty_le_qd2: '', gia_ban_qd2: '',
    };
    colToField.forEach((field, colNumber) => {
      (raw as Record<string, unknown>)[field] = cellValue(row.getCell(colNumber));
    });

    if (isEmptyRow(raw)) {
      skipped++;
      continue;
    }

    const parsed = parseRow(raw, validCodes);
    if (!parsed.ok) {
      errors.push(parsed);
      continue;
    }

    // Chống trùng theo TÊN sản phẩm (chuẩn hóa). Trùng -> không import.
    const key = normName(parsed.data.ten_san_pham);
    if (existingNameSet.has(key)) {
      errors.push({
        ok: false,
        rowNumber: r,
        ten_san_pham: parsed.data.ten_san_pham,
        errors: ['Tên sản phẩm đã tồn tại trong hệ thống'],
      });
      continue;
    }
    if (seenNames.has(key)) {
      errors.push({
        ok: false,
        rowNumber: r,
        ten_san_pham: parsed.data.ten_san_pham,
        errors: ['Tên sản phẩm bị lặp trong file (đã xuất hiện ở dòng trên)'],
      });
      continue;
    }
    seenNames.add(key);

    const sku = gen.next(parsed.data.ma_loai);
    const categoryId = codeToCategoryId.get(parsed.data.ma_loai)!;
    okRows.push({
      rowNumber: r,
      data: buildInsert(parsed.data, sku, categoryId),
      conversions: parsed.data.unit_conversions ?? [],
      baseUnit: parsed.data.dvt_co_ban,
    });
  }

  // 8. Tạo/tra suppliers cần thiết (theo tên)
  const supplierNames = Array.from(
    new Set(okRows.map((r) => r.data._supplier).filter((s): s is string => !!s))
  );
  const supplierIdByName = await resolveSuppliers(supabase, supplierNames);

  // 9. Insert products theo lô, kèm supplier_prices
  let inserted = 0;
  const insertErrors: Array<{ sku: string; message: string }> = [];

  for (const { data, conversions, baseUnit } of okRows) {
    const { _supplier, _giaNhap, ...productRow } = data;
    const { data: newProduct, error: insErr } = await supabase
      .from('products')
      .insert(productRow)
      .select('id')
      .single();

    if (insErr || !newProduct) {
      insertErrors.push({ sku: productRow.sku, message: insErr?.message ?? 'insert lỗi' });
      continue;
    }
    inserted++;

    // Đơn vị quy đổi: from = ĐVT quy đổi, to = ĐVT cơ bản
    if (conversions.length > 0) {
      const convRows = conversions.map((c, idx) => ({
        product_id: newProduct.id,
        from_unit: c.ten_dvt,
        to_unit: baseUnit,
        conversion_rate: c.ty_le,
        selling_price: c.gia_ban ?? null,
        level: (idx + 1) as 1 | 2 | 3,
      }));
      const { error: convErr } = await supabase.from('unit_conversions').insert(convRows);
      if (convErr) {
        insertErrors.push({
          sku: productRow.sku,
          message: 'Lỗi lưu đơn vị quy đổi: ' + convErr.message,
        });
      }
    }

    // Liên kết nhà cung cấp + giá nhập (nếu có)
    if (_supplier && _giaNhap && supplierIdByName.get(_supplier)) {
      await supabase.from('supplier_prices').insert({
        supplier_id: supplierIdByName.get(_supplier),
        product_id: newProduct.id,
        unit_price: _giaNhap,
      });
    }
  }

  return NextResponse.json({
    success: true,
    total_rows: okRows.length + errors.length,
    inserted,
    skipped_empty: skipped,
    row_errors: errors.map((e) => ({
      row: e.rowNumber,
      ten_san_pham: e.ten_san_pham,
      errors: e.errors,
    })),
    insert_errors: insertErrors,
  });
}

// === Helpers ===

function buildInsert(
  d: {
    ten_san_pham: string;
    thuong_hieu: string;
    quy_cach: string;
    dvt_co_ban: string;
    gia_nhap?: number;
    gia_ban_le?: number;
    gia_tho_thau?: number;
    so_luong?: number;
    nha_cung_cap?: string;
    hinh_anh?: string;
  },
  sku: string,
  categoryId: string
) {
  const giaNhap = d.gia_nhap ?? 0;
  return {
    sku,
    name: d.ten_san_pham,
    category_id: categoryId,
    brand: d.thuong_hieu,
    specification: d.quy_cach,
    base_unit: d.dvt_co_ban,
    image_url: d.hinh_anh || null,
    selling_price: d.gia_ban_le ?? 0,
    trade_price: d.gia_tho_thau ?? null, // giá sỉ / giá thợ thầu
    price_type: 'fixed' as const,
    weighted_avg_cost: giaNhap,
    last_cost: giaNhap,
    current_stock: d.so_luong ?? 0,
    min_stock_level: 0,
    is_active: true,
    // các field phụ (không thuộc bảng products) — bóc ra trước khi insert
    _supplier: d.nha_cung_cap || '',
    _giaNhap: giaNhap,
  };
}

/**
 * Tra suppliers theo tên; tạo mới nếu chưa có. Trả về map name -> id.
 */
async function resolveSuppliers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  names: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (names.length === 0) return map;

  const { data: found } = await supabase
    .from('suppliers')
    .select('id, name')
    .in('name', names);
  for (const s of found ?? []) map.set(s.name, s.id);

  const toCreate = names.filter((n) => !map.has(n));
  if (toCreate.length > 0) {
    const { data: created } = await supabase
      .from('suppliers')
      .insert(toCreate.map((name) => ({ name })))
      .select('id, name');
    for (const s of created ?? []) map.set(s.name, s.id);
  }
  return map;
}
