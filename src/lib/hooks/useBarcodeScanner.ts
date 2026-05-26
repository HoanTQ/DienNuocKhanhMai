'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Quagga from '@ericblade/quagga2';

interface UseBarcodeScanner {
  startScanning: () => void;
  stopScanning: () => void;
  isScanning: boolean;
  lastScannedCode: string | null;
  error: Error | null;
  scannerType: 'native' | 'quagga' | null;
}

const SCAN_DEBOUNCE_MS = 500;

/**
 * Hook quét mã vạch — ưu tiên BarcodeDetector API (native), fallback Quagga2.
 *
 * Strategy:
 * 1. Check BarcodeDetector API available → dùng native (hardware accelerated, cực nhanh)
 * 2. Nếu không có → fallback sang Quagga2 (JS image processing)
 *
 * Native BarcodeDetector:
 * - Dùng hardware ML chip của thiết bị
 * - Quét < 100ms
 * - Hỗ trợ: Chrome Android 83+, Chrome OS, Safari iOS 16.4+
 * - Autofocus tốt hơn vì dùng native camera pipeline
 *
 * Quagga2 fallback:
 * - Pure JS image processing
 * - Chậm hơn nhưng hoạt động trên mọi browser
 */
export function useBarcodeScanner(): UseBarcodeScanner {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [scannerType, setScannerType] = useState<'native' | 'quagga' | null>(null);

  const lastScanTimeRef = useRef<number>(0);
  const lastCodeRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeDetectorRef = useRef<BarcodeDetector | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopNativeScanning();
      stopQuaggaScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Check if native BarcodeDetector is available */
  const isNativeSupported = useCallback((): boolean => {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window;
  }, []);

  // =============================================
  // NATIVE BarcodeDetector Implementation
  // =============================================

  const stopNativeScanning = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    nativeDetectorRef.current = null;
  }, []);

  const startNativeScanning = useCallback(async () => {
    try {
      // Create BarcodeDetector with supported formats
      const detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
      });
      nativeDetectorRef.current = detector;

      // Get camera stream with high resolution + continuous autofocus
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;

      // Try to enable continuous autofocus
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.();
      if (capabilities?.focusMode?.includes('continuous')) {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
        });
      }

      // Create video element and attach to viewport
      const viewport = document.getElementById('barcode-scanner-viewport');
      if (!viewport) throw new Error('Scanner viewport not found');

      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      viewport.innerHTML = '';
      viewport.appendChild(video);
      videoRef.current = video;

      await video.play();
      setIsScanning(true);
      setScannerType('native');

      // Start detection loop
      const detectLoop = async () => {
        if (!videoRef.current || !nativeDetectorRef.current) return;
        if (videoRef.current.readyState < 2) {
          animationFrameRef.current = requestAnimationFrame(detectLoop);
          return;
        }

        try {
          const barcodes = await nativeDetectorRef.current.detect(videoRef.current);

          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
              const now = Date.now();
              if (
                code !== lastCodeRef.current ||
                now - lastScanTimeRef.current >= SCAN_DEBOUNCE_MS
              ) {
                lastScanTimeRef.current = now;
                lastCodeRef.current = code;
                setLastScannedCode(code);
              }
            }
          }
        } catch {
          // Detection error — continue scanning
        }

        animationFrameRef.current = requestAnimationFrame(detectLoop);
      };

      animationFrameRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      stopNativeScanning();
      const message = err instanceof Error ? err.message : 'Không thể truy cập camera';
      if (message.includes('NotAllowed') || message.includes('Permission')) {
        setError(new Error('Vui lòng cấp quyền camera trong cài đặt trình duyệt.'));
      } else if (message.includes('NotFound')) {
        setError(new Error('Không tìm thấy camera trên thiết bị.'));
      } else if (message.includes('NotReadable')) {
        setError(new Error('Camera đang được sử dụng bởi ứng dụng khác.'));
      } else {
        setError(new Error(message));
      }
    }
  }, [stopNativeScanning]);

  // =============================================
  // QUAGGA2 Fallback Implementation
  // =============================================

  const stopQuaggaScanning = useCallback(() => {
    Quagga.stop();
    Quagga.offDetected();
  }, []);

  const startQuaggaScanning = useCallback(() => {
    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: '#barcode-scanner-viewport',
          constraints: {
            facingMode: 'environment',
            width: { min: 1280, ideal: 1920 },
            height: { min: 720, ideal: 1080 },
          },
        },
        locator: {
          patchSize: 'medium',
          halfSample: false,
        },
        decoder: {
          readers: [
            'ean_reader',
            'ean_8_reader',
            'code_128_reader',
            'code_39_reader',
            'upc_reader',
            'upc_e_reader',
          ],
          multiple: false,
        },
        locate: true,
        frequency: 15,
      },
      (err) => {
        if (err) {
          let message = 'Không thể truy cập camera.';
          if (err.message?.includes('NotAllowed') || err.message?.includes('Permission')) {
            message = 'Vui lòng cấp quyền camera trong cài đặt trình duyệt.';
          } else if (err.message?.includes('NotFound')) {
            message = 'Không tìm thấy camera trên thiết bị.';
          } else if (err.message?.includes('NotReadable')) {
            message = 'Camera đang được sử dụng bởi ứng dụng khác.';
          }
          setError(new Error(message));
          return;
        }

        Quagga.start();
        setIsScanning(true);
        setScannerType('quagga');
      }
    );

    Quagga.onDetected((result) => {
      const code = result?.codeResult?.code;
      if (!code) return;

      // Filter low confidence results
      const errors = result?.codeResult?.decodedCodes
        ?.filter((d: { error?: number }) => d.error !== undefined)
        ?.map((d: { error?: number }) => d.error ?? 1) || [];

      if (errors.length > 0) {
        const avgError = errors.reduce((sum: number, e: number) => sum + e, 0) / errors.length;
        if (avgError > 0.25) return;
      }

      const now = Date.now();
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

  // =============================================
  // Public API
  // =============================================

  const startScanning = useCallback(() => {
    setError(null);
    setLastScannedCode(null);
    lastCodeRef.current = null;

    if (isNativeSupported()) {
      startNativeScanning();
    } else {
      startQuaggaScanning();
    }
  }, [isNativeSupported, startNativeScanning, startQuaggaScanning]);

  const stopScanning = useCallback(() => {
    if (scannerType === 'native') {
      stopNativeScanning();
    } else {
      stopQuaggaScanning();
    }
    setIsScanning(false);
    setScannerType(null);
  }, [scannerType, stopNativeScanning, stopQuaggaScanning]);

  return {
    startScanning,
    stopScanning,
    isScanning,
    lastScannedCode,
    error,
    scannerType,
  };
}

// =============================================
// Type declarations for BarcodeDetector API
// =============================================

interface DetectedBarcode {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
  cornerPoints: { x: number; y: number }[];
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap): Promise<DetectedBarcode[]>;
  static getSupportedFormats(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector: typeof BarcodeDetector;
  }
}
