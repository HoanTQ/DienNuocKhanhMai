'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Trang Nhập sản phẩm từ Excel.
 *
 * Người dùng (owner) tải file .xlsx theo template lên; hệ thống đọc sheet
 * "San pham", validate, tự sinh SKU và ghi vào Supabase, rồi hiển thị
 * báo cáo: số dòng thành công, dòng lỗi (kèm lý do).
 */

interface RowError {
  row: number;
  ten_san_pham: string;
  errors: string[];
}

interface ImportResult {
  success: boolean;
  total_rows: number;
  inserted: number;
  skipped_empty: number;
  row_errors: RowError[];
  insert_errors: { sku: string; message: string }[];
}

export default function ProductImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        const detail = json.missing_columns
          ? `${json.error}: ${json.missing_columns.join(', ')}. ${json.hint ?? ''}`
          : json.error || 'Upload thất bại';
        setError(detail);
        return;
      }
      setResult(json as ImportResult);
    } catch {
      setError('Không kết nối được máy chủ. Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nhập sản phẩm từ Excel</h1>
          <p className="text-sm text-slate-600 mt-1">
            Tải file theo mẫu (sheet &quot;San pham&quot;). Hệ thống tự sinh mã SKU và chuẩn hóa giá.
          </p>
        </div>
        <Link href="/products">
          <Button variant="outline">Quay lại danh sách</Button>
        </Link>
      </div>

      {/* Hướng dẫn */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hướng dẫn</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700 space-y-1.5">
          <p>1. Điền dữ liệu vào file mẫu, chọn Nhóm và Loại từ danh sách có sẵn.</p>
          <p>2. Các cột bắt buộc: Nhóm, Loại, Tên sản phẩm, Thương hiệu, Quy cách, ĐVT cơ bản, Giá bán lẻ.</p>
          <p>3. Giá nhập dưới 1.000 được hiểu là nghìn đồng (VD: 140 = 140.000đ).</p>
          <p>4. Nhà cung cấp mới sẽ được tự động tạo.</p>
        </CardContent>
      </Card>

      {/* Vùng upload */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <label
            htmlFor="excel-file"
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center cursor-pointer transition-colors duration-200 hover:border-slate-400 hover:bg-slate-100"
          >
            <svg
              className="h-10 w-10 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 7.5 7.5 12M12 7.5V21"
              />
            </svg>
            <div>
              <span className="font-medium text-slate-900">
                {file ? file.name : 'Chọn file Excel (.xlsx)'}
              </span>
              <p className="text-xs text-slate-500 mt-1">Tối đa 5MB</p>
            </div>
            <input
              id="excel-file"
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={handleSelect}
            />
          </label>

          <div className="flex gap-2">
            <Button onClick={handleUpload} disabled={!file || uploading} className="cursor-pointer">
              {uploading ? 'Đang xử lý...' : 'Tải lên và nhập'}
            </Button>
            {(file || result || error) && (
              <Button variant="outline" onClick={reset} disabled={uploading} className="cursor-pointer">
                Làm lại
              </Button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kết quả */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kết quả nhập</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Tổng dòng" value={result.total_rows} tone="slate" />
              <Stat label="Thành công" value={result.inserted} tone="green" />
              <Stat label="Lỗi" value={result.row_errors.length + result.insert_errors.length} tone="red" />
              <Stat label="Bỏ qua (trống)" value={result.skipped_empty} tone="slate" />
            </div>

            {result.row_errors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">
                  Dòng lỗi dữ liệu ({result.row_errors.length})
                </h3>
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium w-16">Dòng</th>
                        <th className="px-3 py-2 text-left font-medium">Sản phẩm</th>
                        <th className="px-3 py-2 text-left font-medium">Lý do</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.row_errors.map((e) => (
                        <tr key={e.row} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-500">{e.row}</td>
                          <td className="px-3 py-2 text-slate-900">{e.ten_san_pham || '(trống)'}</td>
                          <td className="px-3 py-2 text-red-700">{e.errors.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.insert_errors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">
                  Lỗi khi ghi vào hệ thống ({result.insert_errors.length})
                </h3>
                <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                  {result.insert_errors.map((e, i) => (
                    <li key={i}>
                      <span className="font-mono">{e.sku}</span>: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.inserted > 0 && (
              <Link href="/products">
                <Button variant="outline" className="cursor-pointer">
                  Xem danh sách sản phẩm
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'green' | 'red';
}) {
  const toneClass =
    tone === 'green'
      ? 'text-green-700'
      : tone === 'red'
        ? 'text-red-700'
        : 'text-slate-900';
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
