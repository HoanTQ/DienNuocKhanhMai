'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseBarcodeScanner {
  startScanning: () => void;
  stopScanning: () => void;
  isScanning: boolean;
  lastScannedCode: string | null;
  error: Error | null;
}

const SCAN_DEBOUNCE_MS = 500;

/**
 * Hook quét mã vạch — chỉ dùng BarcodeDetector API (native).
 *
 * BarcodeDetector API:
 * - Dùng hardware ML chip của thiết bị
 * - Quét < 50ms/frame
 * - Hỗ trợ: Chrome Android 83+, Safari iOS 16.4+
 * - Continuous autofocus
 *
 * Formats: EAN-13, EAN-8, CODE-128, CODE-39, UPC-A, UPC-E
 */
export function useBarcodeScanner(): UseBarcodeScanner {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const lastScanTimeRef = useRef<number>(0);
  const lastCodeRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
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
    detectorRef.current = null;
  };

  const stopScanning = useCallback(() => {
    cleanup();
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    setError(null);
    setLastScannedCode(null);
    lastCodeRef.current = null;

    // Check BarcodeDetector support
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
      setError(new Error('Trình duyệt không hỗ trợ BarcodeDetector. Vui lòng dùng Chrome Android hoặc Safari iOS 16.4+.'));
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BarcodeDetectorClass = (window as any).BarcodeDetector;

      // Check supported formats
      const supportedFormats: string[] = await BarcodeDetectorClass.getSupportedFormats();
      console.log('[BarcodeScanner] Supported formats:', supportedFormats);

      // Pick formats that are supported
      const wantedFormats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'];
      const formats = wantedFormats.filter((f) => supportedFormats.includes(f));

      if (formats.length === 0) {
        setError(new Error('Thiết bị không hỗ trợ format mã vạch nào. Formats có: ' + supportedFormats.join(', ')));
        return;
      }

      console.log('[BarcodeScanner] Using formats:', formats);

      // Create detector
      const detector = new BarcodeDetectorClass({ formats });
      detectorRef.current = detector;

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;

      // Try to enable continuous autofocus
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as Record<string, unknown> | undefined;
        const focusModes = capabilities?.focusMode as string[] | undefined;
        if (focusModes?.includes('continuous')) {
          await track.applyConstraints({
            // @ts-expect-error - focusMode is not in standard types but supported on Android
            advanced: [{ focusMode: 'continuous' }],
          });
          console.log('[BarcodeScanner] Continuous autofocus enabled');
        }
      } catch (e) {
        console.log('[BarcodeScanner] Could not set autofocus:', e);
      }

      // Create video element and attach to viewport
      const viewport = document.getElementById('barcode-scanner-viewport');
      if (!viewport) {
        cleanup();
        setError(new Error('Không tìm thấy viewport. Vui lòng thử lại.'));
        return;
      }

      // Clear viewport content
      viewport.innerHTML = '';

      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.setAttribute('muted', 'true');
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      viewport.appendChild(video);
      videoRef.current = video;

      await video.play();
      setIsScanning(true);

      console.log('[BarcodeScanner] Camera started, beginning detection loop');

      // Detection loop using requestAnimationFrame
      const detectLoop = async () => {
        if (!videoRef.current || !detectorRef.current) return;

        // Wait for video to be ready
        if (videoRef.current.readyState < 2) {
          animationFrameRef.current = requestAnimationFrame(detectLoop);
          return;
        }

        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);

          if (barcodes && barcodes.length > 0) {
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
                console.log('[BarcodeScanner] Detected:', code, 'format:', barcodes[0].format);
              }
            }
          }
        } catch (detectError) {
          // Detection errors are normal (e.g. frame not ready), just continue
          console.log('[BarcodeScanner] Detection frame error:', detectError);
        }

        animationFrameRef.current = requestAnimationFrame(detectLoop);
      };

      animationFrameRef.current = requestAnimationFrame(detectLoop);

    } catch (err) {
      cleanup();
      const message = err instanceof Error ? err.message : String(err);
      console.error('[BarcodeScanner] Error:', message);

      if (message.includes('NotAllowed') || message.includes('Permission')) {
        setError(new Error('Vui lòng cấp quyền camera. Vào Settings > Site Settings > Camera > Allow.'));
      } else if (message.includes('NotFound')) {
        setError(new Error('Không tìm thấy camera trên thiết bị.'));
      } else if (message.includes('NotReadable') || message.includes('AbortError')) {
        setError(new Error('Camera đang được sử dụng bởi ứng dụng khác. Đóng app camera rồi thử lại.'));
      } else {
        setError(new Error('Lỗi camera: ' + message));
      }
    }
  }, []);

  return {
    startScanning,
    stopScanning,
    isScanning,
    lastScannedCode,
    error,
  };
}
