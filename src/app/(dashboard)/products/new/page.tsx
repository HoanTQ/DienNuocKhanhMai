'use client';

import { useRouter } from 'next/navigation';
import ProductForm from '@/components/products/ProductForm';

/**
 * Trang Thêm sản phẩm mới
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */
export default function NewProductPage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push('/products');
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Thêm sản phẩm mới</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Điền thông tin sản phẩm. Các trường có dấu (*) là bắt buộc.
        </p>
      </div>

      <ProductForm onSuccess={handleSuccess} />
    </div>
  );
}
