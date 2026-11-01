import { z } from 'zod';

/**
 * Zod schema cho một DÒNG dữ liệu sản phẩm import từ Excel.
 *
 * Nguồn dữ liệu: sheet "San pham" trong file template.
 * Các cột Nhóm/Loại người dùng chọn dạng "A - Đồ điện" / "AA - Dây điện";
 * phần mã (trước " - ") đã được tách ra trước khi validate ở service.
 *
 * Bắt buộc: nhom, loai, ten_san_pham, thuong_hieu, quy_cach, dvt_co_ban, gia_ban_le
 * (theo ràng buộc NOT NULL của bảng products).
 */

const requiredText = (label: string, max = 500) =>
  z
    .string({ error: `${label} là bắt buộc` })
    .trim()
    .min(1, `${label} không được để trống`)
    .max(max, `${label} tối đa ${max} ký tự`);

const optionalText = (max = 500) =>
  z.string().trim().max(max).optional().or(z.literal(''));

// Giá: chấp nhận number hoặc string số; chuẩn hóa về number ở service.
// Ở đây chỉ ràng buộc >= 0 sau khi ép kiểu.
const priceField = (label: string, required = false) => {
  // Khi bắt buộc mà thiếu/không phải số -> báo "Không có {label}".
  const base = z
    .number({ error: required ? `Không có ${label}` : `${label} phải là số` })
    .min(0, `${label} không được âm`);
  return required ? base : base.optional();
};

// Một đơn vị quy đổi khai báo trong template.
// ty_le: 1 [đơn vị quy đổi] = ty_le [đơn vị cơ bản], phải > 0.
export const importUnitConversionSchema = z.object({
  ten_dvt: z.string().trim().min(1, 'Tên đơn vị quy đổi không được trống').max(50),
  ty_le: z
    .number({ error: 'Tỷ lệ quy đổi phải là số' })
    .positive('Tỷ lệ quy đổi phải lớn hơn 0'),
  gia_ban: z.number().min(0, 'Giá bán quy đổi không được âm').optional(),
});

export type ImportUnitConversion = z.infer<typeof importUnitConversionSchema>;

export const productImportRowSchema = z.object({
  // Danh mục (đã tách mã ở service, đây là mã ghép + tên gốc)
  ma_nhom: z
    .string()
    .trim()
    .regex(/^[A-Z]$/, 'Mã nhóm không hợp lệ (1 ký tự chữ hoa)'),
  ma_loai: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, 'Mã loại không hợp lệ (2 ký tự chữ hoa)'),

  ten_san_pham: requiredText('Tên sản phẩm', 500),
  thuong_hieu: requiredText('Thương hiệu', 100),
  quy_cach: requiredText('Quy cách', 500),
  dvt_co_ban: requiredText('ĐVT cơ bản', 50),

  gia_nhap: priceField('Giá nhập'),
  gia_ban_le: priceField('Giá bán lẻ', true),
  gia_tho_thau: priceField('Giá thợ/thầu'),

  so_luong: z
    .number({ error: 'Số lượng phải là số' })
    .min(0, 'Số lượng không được âm')
    .optional(),

  nha_cung_cap: optionalText(255),
  hinh_anh: z
    .string()
    .trim()
    .url('URL hình ảnh không hợp lệ')
    .optional()
    .or(z.literal('')),

  // Tối đa 2 đơn vị quy đổi (DB hỗ trợ 3 cấp, template dùng 2)
  unit_conversions: z
    .array(importUnitConversionSchema)
    .max(2, 'Tối đa 2 đơn vị quy đổi')
    .optional()
    .default([]),
});

export type ProductImportRow = z.infer<typeof productImportRowSchema>;

export function validateImportRow(data: unknown) {
  return productImportRowSchema.safeParse(data);
}
