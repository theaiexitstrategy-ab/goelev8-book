/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'GoElev8.AI Booking — AI-Powered Scheduling',
    template: '%s | GoElev8.AI Booking',
  },
  description:
    'Your booking link, powered by AI. Share the link. The AI assistant handles the rest — answering questions, qualifying clients, collecting payment, sending confirmations.',
  metadataBase: new URL('https://book.goelev8.ai'),
  openGraph: {
    title: 'GoElev8.AI Booking — AI-Powered Scheduling',
    description: 'Your booking link, powered by AI.',
    url: 'https://book.goelev8.ai',
    siteName: 'GoElev8.AI Booking',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080808',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
