import { cn } from '@/lib/utils';

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 shadow-soft">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white">
          <path
            d="M5 4.5a1 1 0 0 1 1-1h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1v-16Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M8 7h6M8 10.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="m15.5 14.5 2-2 1.5 1.5-2 2-2.5.5.5-2.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="m14.5 15.5-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-gold-400 ring-2 ring-background">
          <svg viewBox="0 0 12 12" className="h-2 w-2 text-white">
            <path d="M3 6.5 5 8.5 9 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </span>
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-semibold tracking-tight text-foreground">
            Let&apos;s Journaling
          </span>
        </div>
      )}
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn('relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 shadow-soft', className)}>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white">
        <path d="M5 4.5a1 1 0 0 1 1-1h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1v-16Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 7h6M8 10.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="m15.5 14.5 2-2 1.5 1.5-2 2-2.5.5.5-2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m14.5 15.5-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-gold-400 ring-2 ring-background">
        <svg viewBox="0 0 12 12" className="h-2 w-2 text-white">
          <path d="M3 6.5 5 8.5 9 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </span>
    </div>
  );
}
