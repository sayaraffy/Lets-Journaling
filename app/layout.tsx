import './globals.css';
import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { Toaster } from '@/components/ui/sonner';
import { SWRegister } from '@/components/brand/sw-register';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://lets-journaling.netlify.app'),
  title: 'Puffin — Social Journaling',
  description:
    'A calm social journaling platform. Capture today, understand tomorrow.',
  applicationName: 'Puffin',
  authors: [{ name: 'Puffin' }],
  keywords: ['journal', 'journaling', 'social', 'productivity', 'mood', 'habits', 'reflection', 'puffin'],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Puffin',
  },
  openGraph: {
    title: 'Puffin — Social Journaling',
    description: 'Capture today, understand tomorrow.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Puffin — Social Journaling',
    description: 'Capture today, understand tomorrow.',
  },
};

export const viewport = {
  themeColor: '#0D9488',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <I18nProvider>
              {children}
              <Toaster richColors position="top-center" />
              <SWRegister />
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
