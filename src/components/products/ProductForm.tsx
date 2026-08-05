'use client';

import { useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarcodeScanner } from '@/components/barcode/BarcodeScanner';
import { UnitCombobox } from '@/components/shared/UnitCombobox';
import {
  productCreateSchema,
  type ProductCreateInput,
  type UnitConversionInput,
} from '@/lib/validations/product.schema';
import type { Product, UnitConversion } from '@/lib/types';

interface ProductFormProps {
  /** Sản phẩm hiện tại (cho edit mode) */
  product?: Product;
  /** Đơn vị quy đổi hiện tại (cho edit mode) */
  existingConversions?: UnitConversion[];
  /** Callback khi submit thành công */
  onSuccess?: () => void;
}

/**
 * Form thêm/sửa sản phẩm
 *
 * Hỗ trợ:
 * - Required fields: name, brand, specification, base_unit
 * - Optional: barcode, image_url, description
 * - Đơn vị quy đổi tối đa 3 cấp
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */
export default function ProductForm({ product, existingConversions, onSuccess }: ProductFormProps) {
  const isEdit = !!product;
  const supabase = useMemo(() => createClient(), []);

  // Form state
  const [formData, setFormData] = useState<Partial<ProductCreateInput>>({
    name: product?.name || '',
    brand: product?.brand || '',
    specification: product?.specification || '',
    base_unit: product?.base_unit || '',
    barcode: product?.barcode || '',
    image_url: product?.image_url || '',
    description: product?.description || '',
    selling_price: product?.selling_price || 0,
    price_type: product?.price_type || 'fixed',
    min_stock_level: product?.min_stock_level || 0,
    unit_conversions: [],
  });

  // Unit conversions state
  const [unitConversions, setUnitConversions] = useState<UnitConversionInput[]>(
    existingConversions?.map((c) => ({
      from_unit: c.from_unit,
      to_unit: c.to_unit,
      conversion_rate: c.conversion_rate,
      selling_price: c.selling_price ?? null,
      level: c.level,
    })) || []
  );

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Update form field
   */
  const updateField = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  /**
   * Thêm đơn vị quy đổi
   */
  const addUnitConversion = () => {
    if (unitConversions.length >= 3) return;
    const newLevel = (unitConversions.length + 1) as 1 | 2 | 3;
    setUnitConversions((prev) => [
      ...prev,
      { from_unit: '', to_unit: formData.base_unit || '', conversion_rate: 1, selling_price: null, level: newLevel },
    ]);
  };

  /**
   * Xóa đơn vị quy đổi
   */
  const removeUnitConversion = (index: number) => {
    setUnitConversions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Re-assign levels
      return next.map((c, i) => ({ ...c, level: (i + 1) as 1 | 2 | 3 }));
    });
  };

  /**
   * Cập nhật đơn vị quy đổi
   */
  const updateUnitConversion = (index: number, field: keyof UnitConversionInput, value: string | number) => {
    setUnitConversions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  /**
   * Submit form
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    // Prepare data for validation
    const dataToValidate = {
      ...formData,
      selling_price: Number(formData.selling_price) || 0,
      min_stock_level: Number(formData.min_stock_level) || 0,
      unit_conversions: unitConversions.map((c) => ({
        ...c,
        conversion_rate: Number(c.conversion_rate) || 0,
      })),
    };

    // Validate with Zod
    const result = productCreateSchema.safeParse(dataToValidate);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);

    try {
      if (isEdit && product) {
        // Update product
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: result.data.name,
            brand: result.data.brand,
            specification: result.data.specification,
            base_unit: result.data.base_unit,
            barcode: result.data.barcode || null,
            image_url: result.data.image_url || null,
            description: result.data.description || null,
            selling_price: result.data.selling_price,
            price_type: result.data.price_type,
            min_stock_level: result.data.min_stock_level,
          })
          .eq('id', product.id);

        if (updateError) throw updateError;

        // Update unit conversions: delete old, insert new
        await supabase
          .from('unit_conversions')
          .delete()
          .eq('product_id', product.id);

        if (unitConversions.length > 0) {
          const conversionsToInsert = unitConversions.map((c) => ({
            product_id: product.id,
            from_unit: c.from_unit,
            to_unit: c.to_unit,
            conversion_rate: Number(c.conversion_rate),
            selling_price: c.selling_price ? Number(c.selling_price) : null,
            level: c.level,
          }));

          const { error: convError } = await supabase
            .from('unit_conversions')
            .insert(conversionsToInsert);

          if (convError) throw convError;
        }
      } else {
        // Create product
        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert({
            name: result.data.name,
            brand: result.data.brand,
            specification: result.data.specification,
            base_unit: result.data.base_unit,
            barcode: result.data.barcode || null,
            image_url: result.data.image_url || null,
            description: result.data.description || null,
            selling_price: result.data.selling_price,
            price_type: result.data.price_type,
            min_stock_level: result.data.min_stock_level,
            current_stock: 0,
            weighted_avg_cost: 0,
            last_cost: 0,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Insert unit conversions
        if (unitConversions.length > 0 && newProduct) {
          const conversionsToInsert = unitConversions.map((c) => ({
            product_id: newProduct.id,
            from_unit: c.from_unit,
            to_unit: c.to_unit,
            conversion_rate: Number(c.conversion_rate),
            selling_price: c.selling_price ? Number(c.selling_price) : null,
            level: c.level,
          }));

          const { error: convError } = await supabase
            .from('unit_conversions')
            .insert(conversionsToInsert);

          if (convError) throw convError;
        }
      }

      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      {/* Thông tin cơ bản */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin cơ bản</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tên sản phẩm */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Tên sản phẩm <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="VD: Ống nhựa PVC Bình Minh"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Thương hiệu & Quy cách */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">
                Thương hiệu <span className="text-destructive">*</span>
              </Label>
              <Input
                id="brand"
                value={formData.brand || ''}
                onChange={(e) => updateField('brand', e.target.value)}
                placeholder="VD: Bình Minh"
                aria-invalid={!!errors.brand}
              />
              {errors.brand && (
                <p className="text-sm text-destructive">{errors.brand}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="specification">
                Quy cách <span className="text-destructive">*</span>
              </Label>
              <Input
                id="specification"
                value={formData.specification || ''}
                onChange={(e) => updateField('specification', e.target.value)}
                placeholder="VD: D21 x 2.0mm"
                aria-invalid={!!errors.specification}
              />
              {errors.specification && (
                <p className="text-sm text-destructive">{errors.specification}</p>
              )}
            </div>
          </div>

          {/* Đơn vị tính cơ bản */}
          <div className="space-y-2">
            <Label htmlFor="base_unit">
              Đơn vị tính cơ bản <span className="text-destructive">*</span>
            </Label>
            <UnitCombobox
              id="base_unit"
              value={formData.base_unit || ''}
              onChange={(value) => updateField('base_unit', value)}
              placeholder="Chọn đơn vị tính..."
              error={!!errors.base_unit}
            />
            {errors.base_unit && (
              <p className="text-sm text-destructive">{errors.base_unit}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Thuộc tính tùy chọn */}
      <Card>
        <CardHeader>
          <CardTitle>Thuộc tính tùy chọn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mã vạch — hỗ trợ quét camera để đăng ký */}
          <div className="space-y-2">
            <Label htmlFor="barcode">Mã vạch</Label>
            <BarcodeInput
              value={formData.barcode || ''}
              onChange={(value) => updateField('barcode', value)}
              error={errors.barcode}
            />
          </div>

          {/* Hình ảnh */}
          <div className="space-y-2">
            <Label htmlFor="image_url">Hình ảnh (URL)</Label>
            <Input
              id="image_url"
              value={formData.image_url || ''}
              onChange={(e) => updateField('image_url', e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
            {errors.image_url && (
              <p className="text-sm text-destructive">{errors.image_url}</p>
            )}
          </div>

          {/* Mô tả */}
          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Mô tả chi tiết sản phẩm..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Giá bán */}
      <Card>
        <CardHeader>
          <CardTitle>Giá bán</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="selling_price">
                Giá bán (VNĐ) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="selling_price"
                type="number"
                min="0"
                value={formData.selling_price || ''}
                onChange={(e) => updateField('selling_price', Number(e.target.value))}
                placeholder="0"
                aria-invalid={!!errors.selling_price}
              />
              {errors.selling_price && (
                <p className="text-sm text-destructive">{errors.selling_price}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_type">
                Loại giá <span className="text-destructive">*</span>
              </Label>
              <select
                id="price_type"
                value={formData.price_type || 'fixed'}
                onChange={(e) => updateField('price_type', e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="fixed">Giá cố định</option>
                <option value="variable">Giá biến động</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_stock_level">Mức tồn kho tối thiểu</Label>
            <Input
              id="min_stock_level"
              type="number"
              min="0"
              value={formData.min_stock_level || ''}
              onChange={(e) => updateField('min_stock_level', Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Đơn vị quy đổi */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Đơn vị quy đổi</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addUnitConversion}
              disabled={unitConversions.length >= 3}
            >
              + Thêm cấp quy đổi
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Tối đa 3 cấp. VD: 1 cuộn = 100 mét, 1 bao = 50 kg
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {unitConversions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Chưa có đơn vị quy đổi. Nhấn &quot;Thêm cấp quy đổi&quot; để thêm.
            </p>
          ) : (
            unitConversions.map((conversion, index) => (
              <div
                key={index}
                className="p-3 border rounded-md space-y-3 bg-muted/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cấp {conversion.level}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUnitConversion(index)}
                    className="h-8 text-xs text-destructive hover:text-destructive"
                  >
                    Xóa
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Đơn vị nguồn</Label>
                    <UnitCombobox
                      value={conversion.from_unit}
                      onChange={(value) =>
                        updateUnitConversion(index, 'from_unit', value)
                      }
                      placeholder="VD: cuộn"
                      className="[&_input]:h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tỷ lệ quy đổi</Label>
                    <Input
                      type="number"
                      min="0.001"
                      step="any"
                      value={conversion.conversion_rate}
                      onChange={(e) =>
                        updateUnitConversion(index, 'conversion_rate', Number(e.target.value))
                      }
                      placeholder="VD: 100"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Đơn vị đích</Label>
                    <UnitCombobox
                      value={conversion.to_unit}
                      onChange={(value) =>
                        updateUnitConversion(index, 'to_unit', value)
                      }
                      placeholder={formData.base_unit || 'VD: mét'}
                      className="[&_input]:h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Giá bán riêng (₫)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={conversion.selling_price ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        updateUnitConversion(index, 'selling_price', val as unknown as number);
                      }}
                      placeholder="Để trống = tự tính"
                      className="h-10"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  1 {conversion.from_unit || '?'} = {conversion.conversion_rate}{' '}
                  {conversion.to_unit || '?'}
                  {conversion.selling_price ? (
                    <span className="ml-2 text-primary font-medium">
                      • Giá bán: {Number(conversion.selling_price).toLocaleString('vi-VN')}₫/{conversion.from_unit || '?'}
                    </span>
                  ) : (
                    formData.selling_price ? (
                      <span className="ml-2">
                        • Giá tự tính: {(Number(formData.selling_price) * conversion.conversion_rate).toLocaleString('vi-VN')}₫/{conversion.from_unit || '?'}
                      </span>
                    ) : null
                  )}
                </p>
              </div>
            ))
          )}
          {errors['unit_conversions'] && (
            <p className="text-sm text-destructive">{errors['unit_conversions']}</p>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      {submitError && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{submitError}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="flex-1 sm:flex-none sm:min-w-[200px]"
        >
          {submitting
            ? 'Đang lưu...'
            : isEdit
            ? 'Cập nhật sản phẩm'
            : 'Thêm sản phẩm'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => window.history.back()}
          className="flex-1 sm:flex-none"
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}


// === Sub-component: BarcodeInput with scan support ===

interface BarcodeInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * Input mã vạch với nút quét camera.
 * Khi quét thành công → tự động fill mã vào input.
 */
function BarcodeInput({ value, onChange, error }: BarcodeInputProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);

  const handleScan = useCallback((barcode: string) => {
    onChange(barcode);
    setIsScannerOpen(false);
    setScanSuccess(true);
    setTimeout(() => setScanSuccess(false), 3000);
  }, [onChange]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id="barcode"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập hoặc quét mã vạch"
          className="flex-1"
          aria-invalid={!!error}
        />
        <Button
          type="button"
          variant={isScannerOpen ? 'default' : 'outline'}
          onClick={() => setIsScannerOpen(!isScannerOpen)}
          className="shrink-0 gap-2"
          aria-label={isScannerOpen ? 'Đóng máy quét' : 'Quét mã vạch'}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 8h10M7 12h10M7 16h6"
            />
          </svg>
          <span className="hidden sm:inline">Quét</span>
        </Button>
      </div>

      {/* Scanner */}
      {isScannerOpen && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="p-2 bg-muted text-xs text-muted-foreground text-center">
            Hướng camera vào mã vạch sản phẩm
          </div>
          <BarcodeScanner
            isActive={isScannerOpen}
            onScan={handleScan}
            onError={() => setIsScannerOpen(false)}
          />
          <div className="p-2 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsScannerOpen(false)}
            >
              Đóng camera
            </Button>
          </div>
        </div>
      )}

      {/* Success feedback */}
      {scanSuccess && value && (
        <p className="text-xs text-green-600 font-medium">
          Đã quét thành công: {value}
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
