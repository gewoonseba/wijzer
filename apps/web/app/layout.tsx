import type { Metadata } from 'next';
import './globals.css';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';
import { ConvexClientProvider } from '@/components/convex-client-provider';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Wijzer',
  description: 'Save and summarize any link',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
