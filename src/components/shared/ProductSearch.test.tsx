import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ProductSearch } from './ProductSearch';

// Mock Supabase client
const mockLimit = vi.fn();
const mockTextSearch = vi.fn(() => ({ limit: mockLimit }));
const mockOr = vi.fn(() => ({ limit: mockLimit }));
const mockEq = vi.fn(() => ({ limit: mockLimit }));
const mockSelect = vi.fn(() => ({
  textSearch: mockTextSearch,
  or: mockOr,
  eq: mockEq,
}));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

// Mock BarcodeScanner component
vi.mock('@/components/barcode/BarcodeScanner', () => ({
  BarcodeScanner: ({ onScan, isActive }: { onScan: (code: string) => void; isActive: boolean }) => (
    isActive ? (
      <div data-testid="barcode-scanner">
        <button onClick={() => onScan('8934567890123')} data-testid="mock-scan-btn">
          Simulate Scan
        </button>
      </div>
    ) : null
  ),
}));

const mockProduct = {
  id: 'prod-1',
  name: 'Ống nước PVC Bình Minh',
  brand: 'Bình Minh',
  specification: 'D21 dày 1.8mm',
  base_unit: 'mét',
  barcode: '8934567890123',
  selling_price: 15000,
  price_type: 'fixed' as const,
  weighted_avg_cost: 10000,
  last_cost: 10500,
  min_stock_level: 50,
  current_stock: 200,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('ProductSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  it('should render search input and barcode button', () => {
    render(<ProductSearch />);

    expect(screen.getByLabelText('Tìm kiếm sản phẩm')).toBeInTheDocument();
    expect(screen.getByLabelText('Quét mã vạch')).toBeInTheDocument();
  });

  it('should hide barcode button when showBarcodeScanner is false', () => {
    render(<ProductSearch showBarcodeScanner={false} />);

    expect(screen.queryByLabelText('Quét mã vạch')).not.toBeInTheDocument();
  });

  it('should use custom placeholder', () => {
    render(<ProductSearch placeholder="Tìm nhanh..." />);

    expect(screen.getByPlaceholderText('Tìm nhanh...')).toBeInTheDocument();
  });

  it('should search on Enter key press without debounce', async () => {
    mockLimit.mockResolvedValue({ data: [mockProduct], error: null });

    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'ống nước' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('products');
    });
  });

  it('should display search results with product info', async () => {
    mockLimit.mockResolvedValue({ data: [mockProduct], error: null });

    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'ống nước' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Ống nước PVC Bình Minh')).toBeInTheDocument();
    });

    // Verify all required fields are displayed (brand + spec shown together)
    expect(screen.getByText(/Bình Minh · D21 dày 1.8mm/)).toBeInTheDocument();
    expect(screen.getByText('mét')).toBeInTheDocument();
    // Price formatted as VND
    expect(screen.getByText(/15\.000/)).toBeInTheDocument();
    // Stock
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });

  it('should show empty state when no results found', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy sản phẩm phù hợp.')).toBeInTheDocument();
    });
  });

  it('should call onSelectProduct when a result is clicked', async () => {
    mockLimit.mockResolvedValue({ data: [mockProduct], error: null });
    const onSelect = vi.fn();

    render(<ProductSearch onSelectProduct={onSelect} />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'ống' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Ống nước PVC Bình Minh')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/Chọn Ống nước PVC Bình Minh/));
    expect(onSelect).toHaveBeenCalledWith(mockProduct);
  });

  it('should toggle barcode scanner on button click', () => {
    render(<ProductSearch />);

    const scanBtn = screen.getByLabelText('Quét mã vạch');
    fireEvent.click(scanBtn);

    expect(screen.getByTestId('barcode-scanner')).toBeInTheDocument();

    // Click again to close
    fireEvent.click(screen.getByLabelText('Đóng máy quét'));
    expect(screen.queryByTestId('barcode-scanner')).not.toBeInTheDocument();
  });

  it('should lookup product by barcode when scanned', async () => {
    mockLimit.mockResolvedValue({ data: [mockProduct], error: null });
    const onSelect = vi.fn();

    render(<ProductSearch onSelectProduct={onSelect} />);

    // Open scanner
    fireEvent.click(screen.getByLabelText('Quét mã vạch'));

    // Simulate scan
    fireEvent.click(screen.getByTestId('mock-scan-btn'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('products');
      expect(onSelect).toHaveBeenCalledWith(mockProduct);
    });
  });

  it('should show error when barcode not found', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    render(<ProductSearch />);

    // Open scanner
    fireEvent.click(screen.getByLabelText('Quét mã vạch'));

    // Simulate scan
    fireEvent.click(screen.getByTestId('mock-scan-btn'));

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy sản phẩm với mã vạch này.')).toBeInTheDocument();
    });
  });

  it('should show error message on search failure', async () => {
    // FTS returns error, ilike also returns error
    mockLimit.mockResolvedValue({ data: null, error: { message: 'Network error' } });

    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Không thể tìm kiếm. Vui lòng thử lại.')).toBeInTheDocument();
    });
  });

  it('should show low stock badge for products at or below min level', async () => {
    const lowStockProduct = {
      ...mockProduct,
      current_stock: 5,
      min_stock_level: 10,
    };
    mockLimit.mockResolvedValue({ data: [lowStockProduct], error: null });

    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'ống' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const stockBadge = screen.getByText(/Tồn: 5/);
      expect(stockBadge).toBeInTheDocument();
    });
  });

  it('should not search when query is empty on Enter', async () => {
    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Wait a bit to ensure no call is made
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should fallback to ilike search when FTS returns no results', async () => {
    // First call (FTS) returns empty, second call (ilike) returns results
    mockLimit
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [mockProduct], error: null });

    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'bình minh' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Ống nước PVC Bình Minh')).toBeInTheDocument();
    });

    // Verify both FTS and ilike were called
    expect(mockTextSearch).toHaveBeenCalled();
    expect(mockOr).toHaveBeenCalled();
  });

  it('should close scanner after successful barcode lookup', async () => {
    mockLimit.mockResolvedValue({ data: [mockProduct], error: null });

    render(<ProductSearch />);

    // Open scanner
    fireEvent.click(screen.getByLabelText('Quét mã vạch'));
    expect(screen.getByTestId('barcode-scanner')).toBeInTheDocument();

    // Simulate scan
    fireEvent.click(screen.getByTestId('mock-scan-btn'));

    await waitFor(() => {
      // Scanner should be closed after lookup
      expect(screen.queryByTestId('barcode-scanner')).not.toBeInTheDocument();
    });
  });
});
