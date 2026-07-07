import type { Metadata } from 'next';
import './globals.css';
import '@excalidraw/excalidraw/index.css';
import AuthProvider from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Epoch',
  description: 'Mathematical research platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
