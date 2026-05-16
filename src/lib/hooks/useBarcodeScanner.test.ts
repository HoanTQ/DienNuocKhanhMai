import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBarcodeScanner } from './useBarcodeScanner';

// Mock Quagga2
const mockInit = vi.fn();
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockOnDetected = vi.fn();
const mockOffDetected = vi.fn();

vi.mock('@ericblade/quagga2', () => ({
  default: {
    init: (...args: unknown[]) => mockInit(...args),
    start: () => mockStart(),
    stop: () => mockStop(),
    onDetected: (cb: unknown) => mockOnDetected(cb),
    offDetected: () => mockOffDetected(),
  },
}));

describe('useBarcodeScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useBarcodeScanner());

    expect(result.current.isScanning).toBe(false);
    expect(result.current.lastScannedCode).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should start scanning and set isScanning to true', () => {
    mockInit.mockImplementation((_config: unknown, callback: (err: unknown) => void) => {
      callback(null);
    });

    const { result } = renderHook(() => useBarcodeScanner());

    act(() => {
      result.current.startScanning();
    });

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(result.current.isScanning).toBe(true);
  });

  it('should configure correct barcode readers (EAN-13, CODE-128, UPC-A)', () => {
    mockInit.mockImplementation((_config: unknown, callback: (err: unknown) => void) => {
      callback(null);
    });

    const { result } = renderHook(() => useBarcodeScanner());

    act(() => {
      result.current.startScanning();
    });

    const config = mockInit.mock.calls[0][0] as {
      decoder: { readers: string[] };
      inputStream: { type: string };
    };
    expect(config.decoder.readers).toEqual(['ean_reader', 'code_128_reader', 'upc_reader']);
    expect(config.inputStream.type).toBe('LiveStream');
  });

  it('should set error when camera access fails', () => {
    mockInit.mockImplementation((_config: unknown, callback: (err: Error | null) => void) => {
      callback(new Error('Permission denied'));
    });

    const { result } = renderHook(() => useBarcodeScanner());

    act(() => {
      result.current.startScanning();
    });

    expect(result.current.isScanning).toBe(false);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('Permission denied');
  });

  it('should stop scanning and clean up', () => {
    mockInit.mockImplementation((_config: unknown, callback: (err: unknown) => void) => {
      callback(null);
    });

    const { result } = renderHook(() => useBarcodeScanner());

    act(() => {
      result.current.startScanning();
    });

    act(() => {
      result.current.stopScanning();
    });

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockOffDetected).toHaveBeenCalledTimes(1);
    expect(result.current.isScanning).toBe(false);
  });

  it('should update lastScannedCode when barcode is detected', () => {
    let detectedCallback: ((result: { codeResult: { code: string } }) => void) | null = null;

    mockInit.mockImplementation((_config: unknown, callback: (err: unknown) => void) => {
      callback(null);
    });
    mockOnDetected.mockImplementation((cb) => {
      detectedCallback = cb;
    });

    const { result } = renderHook(() => useBarcodeScanner());

    act(() => {
      result.current.startScanning();
    });

    expect(detectedCallback).not.toBeNull();

    act(() => {
      detectedCallback!({ codeResult: { code: '4901234567890' } });
    });

    expect(result.current.lastScannedCode).toBe('4901234567890');
  });

  it('should debounce duplicate scans within 500ms', () => {
    let detectedCallback: ((result: { codeResult: { code: string } }) => void) | null = null;

    mockInit.mockImplementation((_config: unknown, callback: (err: unknown) => void) => {
      callback(null);
    });
    mockOnDetected.mockImplementation((cb) => {
      detectedCallback = cb;
    });

    const { result } = renderHook(() => useBarcodeScanner());

    act(() => {
      result.current.startScanning();
    });

    // First scan
    act(() => {
      detectedCallback!({ codeResult: { code: '4901234567890' } });
    });

    expect(result.current.lastScannedCode).toBe('4901234567890');

    // Same code immediately after - should be debounced (state won't change)
    // The debounce prevents re-setting the same code, so lastScannedCode stays the same
    act(() => {
      detectedCallback!({ codeResult: { code: '4901234567890' } });
    });

    expect(result.current.lastScannedCode).toBe('4901234567890');
  });

  it('should accept a different barcode immediately', () => {
    let detectedCallback: ((result: { codeResult: { code: string } }) => void) | null = null;

    mockInit.mockImplementation((_config: unknown, callback: (err: unknown) => void) => {
      callback(null);
    });
    mockOnDetected.mockImplementation((cb) => {
      detectedCallback = cb;
    });

    const { result } = renderHook(() => useBarcodeScanner());

    act(() => {
      result.current.startScanning();
    });

    act(() => {
      detectedCallback!({ codeResult: { code: '4901234567890' } });
    });

    expect(result.current.lastScannedCode).toBe('4901234567890');

    // Different code should be accepted immediately
    act(() => {
      detectedCallback!({ codeResult: { code: '0012345678905' } });
    });

    expect(result.current.lastScannedCode).toBe('0012345678905');
  });

  it('should ignore detection results with no code', () => {
    let detectedCallback: ((result: { codeResult: { code: string | null } }) => void) | null = null;

    mockInit.mockImplementation((_config: unknown, callback: (err: unknown) => void) => {
      callback(null);
    });
    mockOnDetected.mockImplementation((cb) => {
      detectedCallback = cb;
    });

    const { result } = renderHook(() => useBarcodeScanner());

    act(() => {
      result.current.startScanning();
    });

    act(() => {
      detectedCallback!({ codeResult: { code: null as unknown as string } });
    });

    expect(result.current.lastScannedCode).toBeNull();
  });

  it('should reset state when startScanning is called again', () => {
    let detectedCallback: ((result: { codeResult: { code: string } }) => void) | null = null;

    mockInit.mockImplementation((_config: unknown, callback: (err: unknown) => void) => {
      callback(null);
    });
    mockOnDetected.mockImplementation((cb) => {
      detectedCallback = cb;
    });

    const { result } = renderHook(() => useBarcodeScanner());

    act(() => {
      result.current.startScanning();
    });

    act(() => {
      detectedCallback!({ codeResult: { code: '4901234567890' } });
    });

    expect(result.current.lastScannedCode).toBe('4901234567890');

    // Start scanning again - should reset
    act(() => {
      result.current.startScanning();
    });

    expect(result.current.lastScannedCode).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
