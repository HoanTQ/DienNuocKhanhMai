import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quản lý Cửa hàng Điện Nước',
  description: 'Hệ thống quản lý cửa hàng điện nước - Tồn kho, Bán hàng, Công nợ',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
