'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Unit } from '@/lib/types';

interface UnitComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  id?: string;
}

/**
 * Combobox chọn đơn vị tính từ danh mục units.
 *
 * - Load dữ liệu từ bảng `units` (is_active = true)
 * - Tìm kiếm theo tên hoặc viết tắt
 * - Cho phép chọn từ dropdown
 */
export function UnitCombobox({
  value,
  onChange,
  placeholder = 'Chọn đơn vị tính...',
  disabled = false,
  error = false,
  className,
  id,
}: UnitComboboxProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState(value || '');
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load units on first open or mount
  useEffect(() => {
    const loadUnits = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('units')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (data) setUnits(data);
      setLoaded(true);
    };
    loadUnits();
  }, []);

  // Sync external value to searchText
  useEffect(() => {
    setSearchText(value || '');
  }, [value]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Reset search text to current value if user didn't select
        setSearchText(value || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const filteredUnits = useMemo(() => {
    if (!searchText.trim()) return units;
    const q = searchText.toLowerCase();
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.abbreviation || '').toLowerCase().includes(q)
    );
  }, [units, searchText]);

  const handleSelect = (unit: Unit) => {
    onChange(unit.name);
    setSearchText(unit.name);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    onChange(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchText(value || '');
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={searchText}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
          autoComplete="off"
          className={cn(
            'flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base',
            'ring-offset-background placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive'
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { setIsOpen(!isOpen); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Mở danh sách đơn vị"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && loaded && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-white shadow-lg"
        >
          {filteredUnits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {searchText ? 'Không tìm thấy đơn vị phù hợp' : 'Chưa có đơn vị nào'}
            </li>
          ) : (
            filteredUnits.map((unit) => (
              <li
                key={unit.id}
                role="option"
                aria-selected={unit.name === value}
                onClick={() => handleSelect(unit)}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  unit.name === value && 'bg-accent/50 font-medium'
                )}
              >
                <span className="font-medium">{unit.name}</span>
                {unit.abbreviation && (
                  <span className="ml-2 text-muted-foreground">({unit.abbreviation})</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
