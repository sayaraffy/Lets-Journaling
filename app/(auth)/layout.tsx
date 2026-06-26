import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/brand/theme-toggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-brand-50 via-background to-background">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-gold-300/20 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
