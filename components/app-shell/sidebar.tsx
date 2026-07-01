'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { useUnreadMessages } from '@/lib/hooks/use-unread-messages';
import {
  CalendarDays,
  BookHeart,
  CalendarRange,
  Users,
  PenTool,
  Settings,
  X,
  Compass,
  GraduationCap,
  History,
} from 'lucide-react';

const navItems = [
  { href: '/today', label: 'Today', icon: CalendarDays },
  { href: '/journal', label: 'Daily Journal', icon: BookHeart },
  { href: '/activities', label: 'Activities', icon: CalendarRange },
  { href: '/study', label: 'Study', icon: GraduationCap },
  { href: '/history', label: 'History', icon: History },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/pen-pal', label: 'Pen Pal', icon: PenTool },
];

export function Sidebar({
  mobileOpen,
  onClose,
  pathname,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const { profile, signOut } = useAuth();
  const unreadCount = useUnreadMessages();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/today" onClick={onClose}>
            <Logo />
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const showBadge = item.href === '/pen-pal' && unreadCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <Link
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (profile?.username ?? 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.username ?? 'User'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.streak ?? 0} day streak
              </p>
            </div>
          </Link>
          <Link
            href="/settings"
            onClick={onClose}
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <button
            onClick={() => signOut()}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
