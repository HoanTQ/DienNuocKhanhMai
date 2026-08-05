'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ProductForm from '@/components/products/ProductForm';
import ProductPriceInfo from '@/components/products/ProductPriceInfo';
import type { Product, UnitConversion, UserProfile } from '@/lib/types';

/**
 * Trang Sửa sản phẩm
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */
export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch user profile for role check
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profile) setUserProfile(profile as UserProfile);
      }

      // Fetch product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError) {
        setError('Không tìm thấy sản phẩm');
        setLoading(false);
        return;
      }

      setProduct(productData);

      // Fetch unit conversions
      const { data: convData } = await supabase
        .from('unit_conversions')
        .select('*')
        .eq('product_id', productId)
        .order('level', { ascending: true });

      setConversions(convData || []);
      setLoading(false);
    }

    if (productId) {
      fetchData();
    }
  }, [productId, supabase]);

  const handleSuccess = () => {
    router.push('/products');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải thông tin sản phẩm...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="text-center py-12">
          <p className="text-destructive text-lg font-medium">
            {error || 'Không tìm thấy sản phẩm'}
          </p>
          <button
            onClick={() => router.push('/products')}
            className="mt-4 text-primary underline"
          >
            Quay lại danh sách sản phẩm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Sửa sản phẩm</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cập nhật thông tin cho: <span className="font-medium">{product.name}</span>
        </p>
      </div>

      {/* Price Info — Owner only */}
      {userProfile?.role === 'owner' && (
        <div className="mb-6">
          <ProductPriceInfo product={product} />
        </div>
      )}

      <ProductForm
        product={product}
        existingConversions={conversions}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
