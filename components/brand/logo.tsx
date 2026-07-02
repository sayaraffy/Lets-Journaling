import { cn } from '@/lib/utils';

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <QuillMark className="h-9 w-9" />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-semibold tracking-tight text-foreground">
            Lets Journaling
          </span>
        </div>
      )}
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return <QuillMark className={cn('h-9 w-9', className)} />;
}

function QuillMark({ className }: { className?: string }) {
  return (
    <div className={cn('relative flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-900 to-blue-600 shadow-soft', className)}>
      <svg viewBox="0 0 24 24" fill="none" className="h-[65%] w-[65%]">
        {/* Quill feather body */}
        <path d="M5 19 C6.5 16.5 8.5 14 11 12 C14 10 16 8 17 6 C17.5 5 17.7 4 17.5 3 C17.2 2 16.5 1.8 15.7 2 C14 2.5 12 4.5 10 6.5 C8 8.5 6.5 11 6 14 C5.5 16 5.2 18 5 19 Z" fill="url(#quillGrad)" />
        {/* Spine */}
        <path d="M5.5 18.5 C7 16 9 13.5 11.5 11.5 C14 9.5 15.8 7.5 16.8 5.5 L17 5 L16.8 5.5 C15.5 7.5 13.5 9.5 11 11.5 C8.5 13.5 6.5 16 5.5 18.5 Z" fill="#1E3A8A" opacity="0.25" />
        {/* Nib tip */}
        <path d="M4.5 19.5 L5.2 18.8 L5.9 19.5 L5.2 20.2 Z" fill="#FBBF24" />
        <circle cx="5.2" cy="19.8" r="0.3" fill="#FBBF24" />
        <defs>
          <linearGradient id="quillGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="60%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#DBEAFE" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
