import { z } from 'zod';

/**
 * Zod validation schema cho Product
 *
 * Required fields: name, category_id, brand, specification, base_unit
 * Optional fields: barcode, image_url, description
 * Hỗ trợ phân loại nhóm chính (Điện, Nước, Sơn) và nhóm phụ
 * Hỗ trợ đơn vị quy đổi tối đa 3 cấp
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

// === Unit Conversion Schema (tối đa 3 cấp) ===
export const unitConversionSchema = z.object({
  from_unit: z.string().min(1, 'Đơn vị nguồn không được để trống'),
  to_unit: z.string().min(1, 'Đơn vị đích không được để trống'),
  conversion_rate: z
    .number({ error: 'Tỷ lệ quy đổi là bắt buộc' })
    .positive('Tỷ lệ quy đổi phải lớn hơn 0'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export type UnitConversionInput = z.infer<typeof unitConversionSchema>;

// === Product Create Schema ===
export const productCreateSchema = z.object({
  // Required fields
  name: z
    .string({ error: 'Tên sản phẩm là bắt buộc' })
    .min(1, 'Tên sản phẩm không được để trống')
    .max(255, 'Tên sản phẩm tối đa 255 ký tự'),
  category_id: z
    .string({ error: 'Nhóm hàng là bắt buộc' })
    .min(1, 'Vui lòng chọn nhóm hàng'),
  brand: z
    .string({ error: 'Thương hiệu là bắt buộc' })
    .min(1, 'Thương hiệu không được để trống')
    .max(100, 'Thương hiệu tối đa 100 ký tự'),
  specification: z
    .string({ error: 'Quy cách là bắt buộc' })
    .min(1, 'Quy cách không được để trống')
    .max(255, 'Quy cách tối đa 255 ký tự'),
  base_unit: z
    .string({ error: 'Đơn vị tính cơ bản là bắt buộc' })
    .min(1, 'Đơn vị tính cơ bản không được để trống')
    .max(50, 'Đơn vị tính tối đa 50 ký tự'),

  // Optional fields
  barcode: z
    .string()
    .max(50, 'Mã vạch tối đa 50 ký tự')
    .optional()
    .or(z.literal('')),
  image_url: z
    .string()
    .url('URL hình ảnh không hợp lệ')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .max(1000, 'Mô tả tối đa 1000 ký tự')
    .optional()
    .or(z.literal('')),

  // Pricing
  selling_price: z
    .number({ error: 'Giá bán là bắt buộc' })
    .min(0, 'Giá bán không được âm'),
  price_type: z.enum(['fixed', 'variable'], {
    error: 'Loại giá là bắt buộc',
  }),

  // Stock
  min_stock_level: z
    .number()
    .min(0, 'Mức tồn kho tối thiểu không được âm')
    .default(0),

  // Unit conversions (tối đa 3 cấp)
  unit_conversions: z
    .array(unitConversionSchema)
    .max(3, 'Tối đa 3 cấp đơn vị quy đổi')
    .optional()
    .default([]),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

// === Product Update Schema (same as create, all fields optional except id) ===
export const productUpdateSchema = productCreateSchema.partial();

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// === Category Schema ===
export const categorySchema = z.object({
  name: z
    .string({ error: 'Tên nhóm hàng là bắt buộc' })
    .min(1, 'Tên nhóm hàng không được để trống')
    .max(100, 'Tên nhóm hàng tối đa 100 ký tự'),
  parent_id: z.string().optional().or(z.literal('')),
  description: z
    .string()
    .max(500, 'Mô tả tối đa 500 ký tự')
    .optional()
    .or(z.literal('')),
  image_url: z
    .string()
    .url('URL hình ảnh không hợp lệ')
    .optional()
    .or(z.literal('')),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// === Nhóm hàng chính (Main Categories) ===
export const MAIN_CATEGORIES = ['Điện', 'Nước', 'Sơn'] as const;
export type MainCategory = (typeof MAIN_CATEGORIES)[number];

// === Helper: validate product form data ===
export function validateProductForm(data: unknown) {
  return productCreateSchema.safeParse(data);
}

// === Helper: validate unit conversions ===
export function validateUnitConversions(conversions: unknown[]) {
  if (conversions.length > 3) {
    return {
      success: false as const,
      error: { message: 'Tối đa 3 cấp đơn vị quy đổi' },
    };
  }

  const results = conversions.map((c, index) => ({
    index,
    result: unitConversionSchema.safeParse(c),
  }));

  const errors = results.filter((r) => !r.result.success);
  if (errors.length > 0) {
    return {
      success: false as const,
      error: { message: 'Đơn vị quy đổi không hợp lệ', details: errors },
    };
  }

  return { success: true as const, data: conversions };
}
