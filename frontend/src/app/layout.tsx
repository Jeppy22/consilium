import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Consilium',
  description: 'Multi-agent clinical reasoning workbench',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
