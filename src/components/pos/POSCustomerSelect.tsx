'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Customer } from '@/lib/types';

interface POSCustomerSelectProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
}

/**
 * Component chọn khách hàng cho đơn mua nợ.
 * Tìm kiếm theo tên hoặc số điện thoại.
 * Mobile-first, thao tác đơn giản.
 *
 * Validates: Requirements 3.6, 9.3
 */
export function POSCustomerSelect({ selectedCustomer, onSelect }: POSCustomerSelectProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useRef(createClient());

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const searchCustomers = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const likePattern = `%${searchQuery.trim()}%`;
      const { data, error } = await supabase.current
        .from('customers')
        .select('*')
        .or(`name.ilike.${likePattern},phone.ilike.${likePattern}`)
        .limit(10);

      if (!error && data) {
        setResults(data);
      }
    } catch {
      // Silently fail - user can retry
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setIsOpen(true);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchCustomers(value);
      }, 300);
    },
    [searchCustomers]
  );

  const handleSelectCustomer = useCallback(
    (customer: Customer) => {
      onSelect(customer);
      setQuery('');
      setResults([]);
      setIsOpen(false);
    },
    [onSelect]
  );

  const handleClearCustomer = useCallback(() => {
    onSelect(null);
    setQuery('');
  }, [onSelect]);

  // If customer is already selected, show their info
  if (selectedCustomer) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mt-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{selectedCustomer.name}</p>
          <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
          {selectedCustomer.current_debt > 0 && (
            <p className="text-xs text-red-600 mt-0.5">
              Nợ hiện tại:{' '}
              {new Intl.NumberFormat('vi-VN', {
                style: 'currency',
                currency: 'VND',
                maximumFractionDigits: 0,
              }).format(selectedCustomer.current_debt)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearCustomer}
          aria-label="Bỏ chọn khách hàng"
        >
          Đổi
        </Button>
      </div>
    );
  }

  return (
    <div className="relative mt-1">
      <Input
        type="search"
        value={query}
        onChange={handleInputChange}
        placeholder="Tìm khách hàng (tên, SĐT)..."
        className="h-10"
        aria-label="Tìm kiếm khách hàng"
        onFocus={() => setIsOpen(true)}
      />

      {/* Search results dropdown */}
      {isOpen && (query.trim() || results.length > 0) && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {isSearching && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Đang tìm...
            </div>
          )}

          {!isSearching && results.length === 0 && query.trim() && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Không tìm thấy khách hàng
            </div>
          )}

          {results.map((cust) => (
            <button
              key={cust.id}
              type="button"
              className="w-full text-left p-3 hover:bg-gray-50 active:bg-gray-100 border-b last:border-b-0 transition-colors"
              onClick={() => handleSelectCustomer(cust)}
            >
              <p className="text-sm font-medium">{cust.name}</p>
              <p className="text-xs text-muted-foreground">{cust.phone}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
