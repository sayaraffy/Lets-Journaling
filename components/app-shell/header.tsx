'use client';

import { Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/brand/theme-toggle';
import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/today': 'Today',
  '/journal': 'Daily Journal',
  '/activities': 'Activities',
  '/history': 'History',
  '/stats': 'Statistics',
  '/friends': 'Friends',
  '/pen-pal': 'Pen Pal',
  '/feed': 'Public Feed',
  '/settings': 'Settings',
  '/profile': 'Profile',
};

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Let's Journaling";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="font-display text-lg font-semibold tracking-tight">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
