import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Điện nước Khánh Mai',
  description: 'Hệ thống quản lý cửa hàng điện nước Khánh Mai',
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
