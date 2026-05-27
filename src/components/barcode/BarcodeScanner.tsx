'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: Error) => void;
  isActive: boolean;
}

/**
 * Component quét mã vạch sử dụng BarcodeDetector API (native).
 * Tự quản lý camera + detection loop.
 * Không dùng hook riêng — tránh race condition với DOM.
 */
export function BarcodeScanner({ onScan, onError, isActive }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);
  const lastCodeRef = useRef<string | null>(null);
  const emptyFrameCountRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const cleanup = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setLastCode(null);
    lastCodeRef.current = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;

    // Check support
    if (!('BarcodeDetector' in window)) {
      setError('Trình duyệt không hỗ trợ BarcodeDetector. Dùng Chrome Android hoặc Safari iOS 16.4+.');
      onError?.(new Error('BarcodeDetector not supported'));
      return;
    }

    try {
      // Get supported formats
      const allFormats: string[] = await win.BarcodeDetector.getSupportedFormats();
      const wanted = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'];
      const formats = wanted.filter((f) => allFormats.includes(f));

      if (formats.length === 0) {
        setError('Thiết bị không hỗ trợ format mã vạch.');
        return;
      }

      // Create detector
      detectorRef.current = new win.BarcodeDetector({ formats });

      // Get camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;

      // Try continuous autofocus
      try {
        const track = stream.getVideoTracks()[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = (track as any).getCapabilities?.();
        if (caps?.focusMode?.includes('continuous')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (track as any).applyConstraints({
            advanced: [{ focusMode: 'continuous' }],
          });
        }
      } catch {
        // Autofocus not critical
      }

      // Attach to video element
      if (!videoRef.current) {
        cleanup();
        setError('Video element chưa sẵn sàng. Thử lại.');
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsScanning(true);

      // Detection loop
      const detectLoop = async () => {
        if (!videoRef.current || !detectorRef.current) return;

        if (videoRef.current.readyState >= 2) {
          try {
            const barcodes = await detectorRef.current.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              if (code) {
                // Reset empty frame counter — mã vạch vẫn visible
                emptyFrameCountRef.current = 0;

                // Chỉ trigger nếu mã KHÁC với lần quét trước
                if (code !== lastCodeRef.current) {
                  lastCodeRef.current = code;
                  setLastCode(code);
                  onScanRef.current(code);
                }
              }
            } else {
              // Frame trống — đếm số frame liên tiếp không thấy mã
              emptyFrameCountRef.current++;

              // Chỉ reset sau 30 frame liên tiếp trống (~0.5 giây ở 60fps)
              // Đảm bảo sản phẩm thật sự đã ra khỏi vùng quét, không phải do blur/lệch tạm thời
              if (emptyFrameCountRef.current >= 30 && lastCodeRef.current !== null) {
                lastCodeRef.current = null;
              }
            }
          } catch {
            // Frame detection error — continue
          }
        }

        frameRef.current = requestAnimationFrame(detectLoop);
      };

      frameRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      cleanup();
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowed') || msg.includes('Permission')) {
        setError('Cấp quyền camera: Settings > Site Settings > Camera > Allow');
      } else if (msg.includes('NotFound')) {
        setError('Không tìm thấy camera.');
      } else if (msg.includes('NotReadable') || msg.includes('Abort')) {
        setError('Camera đang bận. Đóng app camera khác rồi thử lại.');
      } else {
        setError('Lỗi: ' + msg);
      }
      onError?.(err instanceof Error ? err : new Error(msg));
    }
  }, [cleanup, onError]);

  // Start/stop based on isActive prop
  useEffect(() => {
    if (isActive) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startCamera();
      }, 100);
      return () => {
        clearTimeout(timer);
        cleanup();
      };
    } else {
      cleanup();
    }
  }, [isActive, startCamera, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Video element — camera renders here */}
      <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="w-full h-full object-cover"
        />

        {/* Scanning overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 opacity-75 animate-pulse" />
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-green-400" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-green-400" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-green-400" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-green-400" />
          </div>
        )}

        {/* Loading state */}
        {!isScanning && !error && isActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Last scanned */}
      {lastCode && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-600 font-medium">Đã quét:</p>
          <p className="text-sm text-green-800 font-mono font-bold">{lastCode}</p>
        </div>
      )}

      {/* Status */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-xs text-gray-600">
          {isScanning ? 'Đang quét (Native)' : error ? 'Lỗi' : 'Đang khởi tạo...'}
        </span>
      </div>
    </div>
  );
}
