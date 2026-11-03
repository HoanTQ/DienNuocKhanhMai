import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Bỏ dấu tiếng Việt và chuyển về chữ thường.
 * "Cây sắt P25" -> "cay sat p25", "Đồ điện" -> "do dien".
 * Dùng cho tìm kiếm không dấu phía client.
 */
export function stripAccents(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Kiểm tra `haystack` có khớp với `query` theo kiểu tìm nhanh không dấu hay không.
 *
 * - Cả hai vế đều được bỏ dấu + chữ thường trước khi so.
 * - Query được tách theo khoảng trắng thành nhiều mảnh (token).
 * - MỌI mảnh đều phải xuất hiện (dạng chuỗi con) trong haystack,
 *   KHÔNG cần đúng thứ tự.
 *
 * Ví dụ: haystack = "Cây sắt P25", query = "sat 25" -> true
 *        (bỏ dấu: "cay sat p25" chứa cả "sat" và "25").
 */
export function matchSearch(haystack: string, query: string): boolean {
  const normalizedHaystack = stripAccents(haystack);
  const tokens = stripAccents(query)
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => normalizedHaystack.includes(token));
}
