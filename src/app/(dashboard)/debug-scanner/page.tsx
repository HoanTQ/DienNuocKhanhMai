'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Debug page for BarcodeDetector API testing.
 * Shows all logs directly on screen — no USB debugging needed.
 *
 * URL: /debug-scanner
 */
export default function DebugScannerPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<unknown>(null);
  const frameRef = useRef<number | null>(null);

  const log = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('vi-VN');
    setLogs((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
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
  };

  const startScanning = async () => {
    setLogs([]);
    setLastCode(null);
    log('=== BẮT ĐẦU TEST ===');

    // Step 1: Check BarcodeDetector
    log('Kiểm tra BarcodeDetector API...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;

    if (!('BarcodeDetector' in window)) {
      log('❌ BarcodeDetector KHÔNG có trên trình duyệt này!');
      log('User Agent: ' + navigator.userAgent);
      return;
    }
    log('✅ BarcodeDetector có sẵn');

    // Step 2: Check supported formats
    try {
      const formats = await win.BarcodeDetector.getSupportedFormats();
      log('✅ Formats hỗ trợ: ' + formats.join(', '));
    } catch (e) {
      log('❌ Lỗi getSupportedFormats: ' + String(e));
      return;
    }

    // Step 3: Create detector
    try {
      const formats = await win.BarcodeDetector.getSupportedFormats();
      const wanted = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'];
      const use = wanted.filter((f: string) => formats.includes(f));
      log('Sử dụng formats: ' + use.join(', '));

      const detector = new win.BarcodeDetector({ formats: use });
      detectorRef.current = detector;
      log('✅ Tạo BarcodeDetector thành công');
    } catch (e) {
      log('❌ Lỗi tạo BarcodeDetector: ' + String(e));
      return;
    }

    // Step 4: Get camera
    log('Yêu cầu camera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      log(`✅ Camera OK: ${settings.width}x${settings.height}`);
      log(`Camera: ${track.label}`);

      // Try autofocus
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = track.getCapabilities?.() as any;
        if (caps?.focusMode) {
          log('Focus modes: ' + JSON.stringify(caps.focusMode));
          if (caps.focusMode.includes('continuous')) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (track as any).applyConstraints({
              advanced: [{ focusMode: 'continuous' }],
            });
            log('✅ Continuous autofocus bật');
          }
        } else {
          log('⚠️ Không có thông tin focusMode');
        }
      } catch (e) {
        log('⚠️ Không set được autofocus: ' + String(e));
      }
    } catch (e) {
      log('❌ Lỗi camera: ' + String(e));
      return;
    }

    // Step 5: Attach video
    if (!videoRef.current) {
      log('❌ Video element không tìm thấy');
      return;
    }

    videoRef.current.srcObject = streamRef.current;
    try {
      await videoRef.current.play();
      log('✅ Video đang phát');
    } catch (e) {
      log('❌ Lỗi play video: ' + String(e));
      return;
    }

    setIsScanning(true);
    log('🔍 Bắt đầu detect loop... Hướng camera vào mã vạch');

    // Step 6: Detection loop
    let frameCount = 0;
    let lastDetectTime = 0;

    const detectLoop = async () => {
      if (!videoRef.current || !detectorRef.current) return;

      if (videoRef.current.readyState < 2) {
        frameRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      frameCount++;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const barcodes = await (detectorRef.current as any).detect(videoRef.current);

        if (barcodes && barcodes.length > 0) {
          const now = Date.now();
          if (now - lastDetectTime > 500) {
            lastDetectTime = now;
            const code = barcodes[0].rawValue;
            const format = barcodes[0].format;
            log(`🎉 DETECTED: "${code}" (${format}) [frame #${frameCount}]`);
            setLastCode(code);
          }
        }
      } catch (e) {
        // Only log first error
        if (frameCount <= 3) {
          log('⚠️ Detect error (frame ' + frameCount + '): ' + String(e));
        }
      }

      // Log progress every 100 frames
      if (frameCount % 100 === 0) {
        log(`... đã scan ${frameCount} frames, chưa phát hiện mã`);
      }

      frameRef.current = requestAnimationFrame(detectLoop);
    };

    frameRef.current = requestAnimationFrame(detectLoop);
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">Debug: Barcode Scanner</h1>
      <p className="text-sm text-gray-600">
        Trang test BarcodeDetector API. Mọi log hiển thị trực tiếp bên dưới.
      </p>

      {/* Camera preview */}
      <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="w-full h-full object-cover"
        />
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 opacity-75 animate-pulse" />
            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-green-400" />
            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-green-400" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-green-400" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-green-400" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={startScanning}
          disabled={isScanning}
          className="flex-1 h-12 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50 cursor-pointer"
        >
          {isScanning ? 'Đang quét...' : 'Bắt đầu quét'}
        </button>
        <button
          onClick={stopCamera}
          disabled={!isScanning}
          className="flex-1 h-12 rounded-lg bg-red-600 text-white font-medium disabled:opacity-50 cursor-pointer"
        >
          Dừng
        </button>
      </div>

      {/* Last detected code */}
      {lastCode && (
        <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg">
          <p className="text-xs text-green-600 font-medium">MÃ VẠCH ĐÃ QUÉT:</p>
          <p className="text-2xl font-mono font-bold text-green-800 mt-1">{lastCode}</p>
        </div>
      )}

      {/* Logs */}
      <div className="bg-gray-900 rounded-lg p-3 max-h-[40vh] overflow-y-auto">
        <p className="text-xs text-gray-400 mb-2">Console Log:</p>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500">Nhấn "Bắt đầu quét" để test...</p>
        ) : (
          logs.map((line, i) => (
            <p
              key={i}
              className={`text-xs font-mono leading-relaxed ${
                line.includes('❌') ? 'text-red-400' :
                line.includes('✅') ? 'text-green-400' :
                line.includes('🎉') ? 'text-yellow-300 font-bold' :
                line.includes('⚠️') ? 'text-orange-400' :
                'text-gray-300'
              }`}
            >
              {line}
            </p>
          ))
        )}
      </div>

      {/* Device info */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer">Thông tin thiết bị</summary>
        <pre className="mt-2 p-2 bg-gray-100 rounded text-[10px] overflow-x-auto whitespace-pre-wrap">
          {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}
        </pre>
      </details>
    </div>
  );
}
