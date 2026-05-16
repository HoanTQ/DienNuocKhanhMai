'use client';

import { useEffect, useRef } from 'react';
import { useBarcodeScanner } from '@/lib/hooks/useBarcodeScanner';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: Error) => void;
  isActive: boolean;
}

/**
 * Component quét mã vạch sử dụng camera thiết bị.
 * Hỗ trợ: EAN-13, CODE-128, UPC-A.
 * Thiết kế mobile-first với video preview và scanning overlay.
 */
export function BarcodeScanner({ onScan, onError, isActive }: BarcodeScannerProps) {
  const { startScanning, stopScanning, isScanning, lastScannedCode, error } =
    useBarcodeScanner();
  const prevCodeRef = useRef<string | null>(null);

  // Bắt đầu/dừng quét khi isActive thay đổi
  useEffect(() => {
    if (isActive) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isActive, startScanning, stopScanning]);

  // Gọi onScan khi có mã mới
  useEffect(() => {
    if (lastScannedCode && lastScannedCode !== prevCodeRef.current) {
      prevCodeRef.current = lastScannedCode;
      onScan(lastScannedCode);
    }
  }, [lastScannedCode, onScan]);

  // Gọi onError khi có lỗi
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Video viewport */}
      <div
        id="barcode-scanner-viewport"
        className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden"
      >
        {/* Scanning overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Scan line animation */}
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 opacity-75 animate-pulse" />
            {/* Corner markers */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-green-400" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-green-400" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-green-400" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-green-400" />
          </div>
        )}

        {/* Placeholder khi chưa quét */}
        {!isScanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            <div className="text-center p-4">
              <svg
                className="w-12 h-12 mx-auto mb-2 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 8h10M7 12h10M7 16h6"
                />
              </svg>
              <p className="text-sm">Nhấn để bắt đầu quét mã vạch</p>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      )}

      {/* Last scanned code */}
      {lastScannedCode && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-600 font-medium">Mã vạch đã quét:</p>
          <p className="text-sm text-green-800 font-mono mt-1">{lastScannedCode}</p>
        </div>
      )}

      {/* Status indicator */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`}
          aria-hidden="true"
        />
        <span className="text-xs text-gray-600">
          {isScanning ? 'Đang quét...' : 'Chờ quét'}
        </span>
      </div>
    </div>
  );
}
