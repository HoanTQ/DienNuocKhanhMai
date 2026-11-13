import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductSearch } from './ProductSearch';

/**
 * Supabase mock.
 *
 * ProductSearch dùng 2 kiểu query:
 *  1. Tải danh sách:  from('products').select('*').eq('is_active', true).order('name', ...)
 *  2. Tra mã vạch:    from('products').select('*').eq('barcode', code).limit(1)
 *
 * Việc lọc/tìm kiếm theo từ khóa được thực hiện PHÍA CLIENT (không dấu),
 * nên các test chỉ cần cung cấp dữ liệu qua 2 nguồn trên.
 */
let productList: unknown[] = [];
let barcodeResult: unknown[] = [];
let loadError: { message: string } | null = null;

// Chuỗi tải danh sách: select().eq('is_active').order().range()
// Trang đầu trả toàn bộ productList (<1000) nên vòng lặp phân trang dừng ngay.
const mockRange = vi.fn(() =>
  Promise.resolve({ data: loadError ? null : productList, error: loadError })
);
const mockOrder = vi.fn(() => ({ range: mockRange }));
// Chuỗi tra mã vạch: select().eq('barcode').limit()
const mockBarcodeLimit = vi.fn(() => Promise.resolve({ data: barcodeResult, error: null }));

const mockEq = vi.fn((column: string) => {
  if (column === 'is_active') {
    return { order: mockOrder };
  }
  // barcode
  return { limit: mockBarcodeLimit };
});

const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

// Mock BarcodeScanner component
vi.mock('@/components/barcode/BarcodeScanner', () => ({
  BarcodeScanner: ({ onScan, isActive }: { onScan: (code: string) => void; isActive: boolean }) =>
    isActive ? (
      <div data-testid="barcode-scanner">
        <button onClick={() => onScan('8934567890123')} data-testid="mock-scan-btn">
          Simulate Scan
        </button>
      </div>
    ) : null,
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
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const ironBar = {
  ...mockProduct,
  id: 'prod-2',
  name: 'Cây sắt P25',
  brand: '',
  specification: '',
  barcode: undefined,
};

describe('ProductSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productList = [mockProduct];
    barcodeResult = [];
    loadError = null;
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

  it('should display search results with product info', async () => {
    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'ống nước' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Ống nước PVC Bình Minh')).toBeInTheDocument();
    });

    expect(screen.getByText('Bình Minh')).toBeInTheDocument();
    expect(screen.getByText('D21 dày 1.8mm')).toBeInTheDocument();
    expect(screen.getByText('mét')).toBeInTheDocument();
    expect(screen.getByText(/15\.000/)).toBeInTheDocument();
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });

  it('should find product with accent-insensitive query (gõ không dấu)', async () => {
    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    // Gõ KHÔNG dấu "ong nuoc" vẫn ra "Ống nước PVC Bình Minh"
    fireEvent.change(input, { target: { value: 'ong nuoc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Ống nước PVC Bình Minh')).toBeInTheDocument();
    });
  });

  it('should match multiple out-of-order tokens ("sat 25" -> "Cây sắt P25")', async () => {
    productList = [ironBar];

    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'sat 25' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Cây sắt P25')).toBeInTheDocument();
    });
  });

  it('should show empty state when no results found', async () => {
    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'xyzkhongcosanpham' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy sản phẩm phù hợp.')).toBeInTheDocument();
    });
  });

  it('should call onSelectProduct when a result is clicked', async () => {
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

    fireEvent.click(screen.getByLabelText('Đóng máy quét'));
    expect(screen.queryByTestId('barcode-scanner')).not.toBeInTheDocument();
  });

  it('should lookup product by barcode when scanned', async () => {
    barcodeResult = [mockProduct];
    const onSelect = vi.fn();

    render(<ProductSearch onSelectProduct={onSelect} />);

    fireEvent.click(screen.getByLabelText('Quét mã vạch'));
    fireEvent.click(screen.getByTestId('mock-scan-btn'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('products');
      expect(onSelect).toHaveBeenCalledWith(mockProduct);
    });
  });

  it('should show error when barcode not found', async () => {
    barcodeResult = [];

    render(<ProductSearch />);

    fireEvent.click(screen.getByLabelText('Quét mã vạch'));
    fireEvent.click(screen.getByTestId('mock-scan-btn'));

    await waitFor(() => {
      expect(
        screen.getByText('Không tìm thấy sản phẩm với mã vạch này.')
      ).toBeInTheDocument();
    });
  });

  it('should show error message on load failure', async () => {
    loadError = { message: 'Network error' };

    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Không thể tìm kiếm. Vui lòng thử lại.')).toBeInTheDocument();
    });
  });

  it('should show low stock badge for products at or below min level', async () => {
    productList = [{ ...mockProduct, current_stock: 5, min_stock_level: 10 }];

    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: 'ống' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Tồn: 5/)).toBeInTheDocument();
    });
  });

  it('should not search when query is empty on Enter', async () => {
    render(<ProductSearch />);

    const input = screen.getByLabelText('Tìm kiếm sản phẩm');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
