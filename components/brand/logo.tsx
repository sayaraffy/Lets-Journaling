import { cn } from '@/lib/utils';

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <PuffinMark className="h-9 w-9" />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-semibold tracking-tight text-foreground">
            Puffin
          </span>
        </div>
      )}
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return <PuffinMark className={cn('h-9 w-9', className)} />;
}

function PuffinMark({ className }: { className?: string }) {
  return (
    <div className={cn('relative flex items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-teal-400 shadow-soft', className)}>
      <svg viewBox="0 0 24 24" fill="none" className="h-[60%] w-[60%]">
        {/* Puffin silhouette */}
        <ellipse cx="12" cy="15" rx="5.5" ry="6.5" fill="#1e293b" />
        <circle cx="12" cy="8" r="4" fill="#1e293b" />
        <path d="M8 7.5 Q10 5 12 5.5 Q14 5 16 7.5 Q15.8 9 14 9.5 Q12 9.7 10 9.5 Q8.2 9 8 7.5 Z" fill="#f8fafc" />
        <circle cx="12" cy="7.5" r="1.2" fill="#0f172a" />
        <circle cx="12.3" cy="7.2" r="0.4" fill="#f8fafc" />
        {/* Colorful beak */}
        <path d="M9.5 10 Q12 9 14.5 10 Q14.5 11.5 13 12 Q12 12.3 11 12 Q9.5 11.5 9.5 10 Z" fill="#F97316" />
        <path d="M10 10.5 Q12 10.2 14 10.5 L12 11.5 Z" fill="#FB923C" />
        {/* White belly */}
        <ellipse cx="12" cy="17" rx="3.5" ry="4.5" fill="#f8fafc" />
      </svg>
    </div>
  );
}
