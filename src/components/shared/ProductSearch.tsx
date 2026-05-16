'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarcodeScanner } from '@/components/barcode/BarcodeScanner';
import type { Product } from '@/lib/types';

interface ProductSearchProps {
  /** Callback khi chọn sản phẩm từ kết quả */
  onSelectProduct?: (product: Product) => void;
  /** Placeholder cho ô tìm kiếm */
  placeholder?: string;
  /** Ẩn/hiện nút quét mã vạch */
  showBarcodeScanner?: boolean;
}

/**
 * Component tìm kiếm sản phẩm và tra cứu giá.
 * - Full-text search tiếng Việt (tên, thương hiệu, quy cách)
 * - Tích hợp barcode scanner: quét → lookup → hiển thị
 * - Responsive, mobile-first, thao tác một tay
 * - Kết quả hiển thị: tên, quy cách, đơn vị tính, giá bán, tồn kho
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 5.3, 5.4
 */
export function ProductSearch({
  onSelectProduct,
  placeholder = 'Tìm sản phẩm (tên, thương hiệu, quy cách)...',
  showBarcodeScanner = true,
}: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useRef(createClient());

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  /**
   * Tìm kiếm sản phẩm bằng full-text search hoặc ilike.
   * Sử dụng FTS index: idx_products_fts (to_tsvector('simple', name || ' ' || brand || ' ' || specification))
   * Fallback sang ilike nếu FTS không trả kết quả.
   * Target: < 2 giây (Requirement 2.2)
   */
  const searchProducts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Thử full-text search trước (nhanh hơn với index)
      const ftsQuery = searchQuery.trim().split(/\s+/).join(' & ');
      const { data: ftsResults, error: ftsError } = await supabase.current
        .from('products')
        .select('*')
        .textSearch('fts', ftsQuery, { config: 'simple' })
        .limit(20);

      if (!ftsError && ftsResults && ftsResults.length > 0) {
        setResults(ftsResults);
        setIsLoading(false);
        return;
      }

      // Fallback: ilike search trên name, brand, specification
      const likePattern = `%${searchQuery.trim()}%`;
      const { data: likeResults, error: likeError } = await supabase.current
        .from('products')
        .select('*')
        .or(
          `name.ilike.${likePattern},brand.ilike.${likePattern},specification.ilike.${likePattern}`
        )
        .limit(20);

      if (likeError) {
        throw likeError;
      }

      setResults(likeResults || []);
    } catch (err) {
      setError('Không thể tìm kiếm. Vui lòng thử lại.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Tra cứu sản phẩm theo mã vạch.
   * Sử dụng index: idx_products_barcode
   * Target: < 1 giây (Requirement 2.1)
   */
  const lookupByBarcode = useCallback(
    async (barcode: string) => {
      setIsLoading(true);
      setError(null);
      setQuery(barcode);

      try {
        const { data, error: lookupError } = await supabase.current
          .from('products')
          .select('*')
          .eq('barcode', barcode)
          .limit(1);

        if (lookupError) {
          throw lookupError;
        }

        if (data && data.length > 0) {
          setResults(data);
          // Tự động chọn sản phẩm nếu chỉ có 1 kết quả
          if (onSelectProduct) {
            onSelectProduct(data[0]);
          }
        } else {
          setResults([]);
          setError('Không tìm thấy sản phẩm với mã vạch này.');
        }
      } catch {
        setError('Lỗi tra cứu mã vạch. Vui lòng thử lại.');
        setResults([]);
      } finally {
        setIsLoading(false);
        setIsScannerOpen(false);
      }
    },
    [onSelectProduct]
  );

  /**
   * Xử lý thay đổi input với debounce 300ms.
   * Giảm số lượng request khi người dùng đang gõ.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchProducts(value);
      }, 300);
    },
    [searchProducts]
  );

  /** Xử lý khi nhấn Enter */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        searchProducts(query);
      }
    },
    [query, searchProducts]
  );

  /** Xử lý khi quét mã vạch thành công */
  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      lookupByBarcode(barcode);
    },
    [lookupByBarcode]
  );

  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  /** Format số lượng tồn kho */
  const formatStock = (stock: number): string => {
    return new Intl.NumberFormat('vi-VN').format(stock);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Search input + barcode button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="search"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-12 text-base pr-10"
            aria-label="Tìm kiếm sản phẩm"
          />
          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div
                className="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin"
                aria-label="Đang tìm kiếm"
              />
            </div>
          )}
        </div>

        {/* Barcode scanner toggle button */}
        {showBarcodeScanner && (
          <Button
            type="button"
            variant={isScannerOpen ? 'default' : 'outline'}
            size="icon"
            className="h-12 w-12 shrink-0"
            onClick={() => setIsScannerOpen(!isScannerOpen)}
            aria-label={isScannerOpen ? 'Đóng máy quét' : 'Quét mã vạch'}
            aria-pressed={isScannerOpen}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 8h10M7 12h10M7 16h6"
              />
            </svg>
          </Button>
        )}
      </div>

      {/* Barcode Scanner */}
      {isScannerOpen && (
        <div className="mt-3">
          <BarcodeScanner
            isActive={isScannerOpen}
            onScan={handleBarcodeScan}
            onError={() => setError('Không thể truy cập camera.')}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg"
          role="alert"
        >
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Search results */}
      {results.length > 0 && (
        <ul
          className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto"
          role="listbox"
          aria-label="Kết quả tìm kiếm sản phẩm"
        >
          {results.map((product) => (
            <li key={product.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary/5 active:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelectProduct?.(product)}
                aria-label={`Chọn ${product.name} - ${product.specification}`}
              >
                {/* Tên sản phẩm + thương hiệu */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium text-foreground truncate">
                      {product.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {product.brand} · {product.specification}
                    </p>
                  </div>
                  {/* Giá bán */}
                  <span className="text-base font-semibold text-primary whitespace-nowrap">
                    {formatPrice(product.selling_price)}
                  </span>
                </div>

                {/* Đơn vị tính + Tồn kho */}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {product.base_unit}
                  </Badge>
                  <Badge
                    variant={
                      product.current_stock <= product.min_stock_level
                        ? 'destructive'
                        : 'success'
                    }
                    className="text-xs"
                  >
                    Tồn: {formatStock(product.current_stock)} {product.base_unit}
                  </Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Empty state */}
      {!isLoading && query.trim() && results.length === 0 && !error && (
        <div className="mt-3 p-4 text-center text-muted-foreground">
          <p className="text-sm">Không tìm thấy sản phẩm phù hợp.</p>
        </div>
      )}
    </div>
  );
}
