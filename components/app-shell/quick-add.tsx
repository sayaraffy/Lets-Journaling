'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, BookHeart, CalendarPlus, CheckSquare, StickyNote, ImagePlus, Timer, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const actions = [
  { label: 'New Journal', icon: BookHeart, href: '/journal', color: 'text-brand-600' },
  { label: 'New Activity', icon: CalendarPlus, href: '/activities?new=1', color: 'text-success' },
  { label: 'Checklist Item', icon: CheckSquare, href: '/journal?focus=checklist', color: 'text-warning' },
  { label: 'Quick Note', icon: StickyNote, href: '/journal?focus=notes', color: 'text-chart-2' },
  { label: 'Upload Photo', icon: ImagePlus, href: '/journal?focus=photos', color: 'text-chart-4' },
  { label: 'Start Pomodoro', icon: Timer, href: '/journal?focus=pomodoro', color: 'text-destructive' },
];

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="flex flex-col items-end gap-2 animate-fade-in">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                router.push(a.href);
                setOpen(false);
              }}
              className="group flex items-center gap-3 rounded-full border border-border bg-card py-2 pl-3 pr-4 shadow-soft-lg transition-all hover:scale-105"
            >
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-full bg-muted', a.color)}>
                <a.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{a.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition-all hover:scale-105 active:scale-95',
          open && 'rotate-45',
        )}
        aria-label="Quick add"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
