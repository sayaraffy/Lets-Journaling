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
  title: "Let's Journaling — Capture Today, Understand Tomorrow",
  description:
    'A calm, private journaling platform to organize your day, build habits, reflect, and grow.',
  applicationName: "Let's Journaling",
  authors: [{ name: "Let's Journaling" }],
  keywords: ['journal', 'journaling', 'productivity', 'mood', 'habits', 'reflection'],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: "Let's Journaling",
  },
  openGraph: {
    title: "Let's Journaling",
    description: 'Capture Today, Understand Tomorrow.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Let's Journaling",
    description: 'Capture Today, Understand Tomorrow.',
  },
};

export const viewport = {
  themeColor: '#0000FF',
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
