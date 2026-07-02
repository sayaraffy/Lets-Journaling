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
  title: 'Lets Journaling — Capture Today, Understand Tomorrow',
  description:
    'A social journaling platform for reflection, growth, and connection. Capture today, understand tomorrow.',
  applicationName: 'Lets Journaling',
  authors: [{ name: 'Lets Journaling' }],
  keywords: ['journal', 'journaling', 'social', 'productivity', 'mood', 'habits', 'reflection', 'lets journaling'],
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
    title: 'Lets Journaling',
  },
  openGraph: {
    title: 'Lets Journaling — Capture Today, Understand Tomorrow',
    description: 'A social journaling platform for reflection, growth, and connection.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lets Journaling — Capture Today, Understand Tomorrow',
    description: 'A social journaling platform for reflection, growth, and connection.',
  },
};

export const viewport = {
  themeColor: '#2563EB',
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
