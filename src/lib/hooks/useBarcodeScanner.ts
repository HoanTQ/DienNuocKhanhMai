'use client';

import { useState, useCallback, useRef } from 'react';
import Quagga from '@ericblade/quagga2';

interface UseBarcodeScanner {
  startScanning: () => void;
  stopScanning: () => void;
  isScanning: boolean;
  lastScannedCode: string | null;
  error: Error | null;
}

const SCAN_DEBOUNCE_MS = 500;

/**
 * Hook quản lý lifecycle camera và quét mã vạch.
 * Hỗ trợ formats: EAN-13, CODE-128, UPC-A.
 * Debounce kết quả để tránh đọc trùng lặp.
 */
export function useBarcodeScanner(): UseBarcodeScanner {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const lastCodeRef = useRef<string | null>(null);

  const stopScanning = useCallback(() => {
    Quagga.stop();
    Quagga.offDetected();
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(() => {
    setError(null);
    setLastScannedCode(null);
    lastCodeRef.current = null;

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: '#barcode-scanner-viewport',
          constraints: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        decoder: {
          readers: ['ean_reader', 'code_128_reader', 'upc_reader'],
        },
        locate: true,
        frequency: 10,
      },
      (err) => {
        if (err) {
          const cameraError = new Error(
            err.message || 'Không thể truy cập camera. Vui lòng cấp quyền camera.'
          );
          setError(cameraError);
          return;
        }

        Quagga.start();
        setIsScanning(true);
      }
    );

    Quagga.onDetected((result) => {
      const code = result?.codeResult?.code;
      if (!code) return;

      const now = Date.now();
      // Debounce: bỏ qua nếu cùng mã và quét trong khoảng thời gian ngắn
      if (
        code === lastCodeRef.current &&
        now - lastScanTimeRef.current < SCAN_DEBOUNCE_MS
      ) {
        return;
      }

      lastScanTimeRef.current = now;
      lastCodeRef.current = code;
      setLastScannedCode(code);
    });
  }, []);

  return {
    startScanning,
    stopScanning,
    isScanning,
    lastScannedCode,
    error,
  };
}
