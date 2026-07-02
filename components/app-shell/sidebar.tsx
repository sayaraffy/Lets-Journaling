'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/components/providers/i18n-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { useUnreadMessages } from '@/lib/hooks/use-unread-messages';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CalendarDays,
  BookOpen,
  Timer,
  Activity,
  History,
  BarChart3,
  Compass,
  Users,
  Mail,
  User as UserIcon,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/today', key: 'nav.today', icon: CalendarDays },
  { href: '/journal', key: 'nav.journal', icon: BookOpen },
  { href: '/study', key: 'nav.study', icon: Timer, label: 'Study' },
  { href: '/activities', key: 'nav.activities', icon: Activity },
  { href: '/history', key: 'nav.history', icon: History },
  { href: '/stats', key: 'nav.stats', icon: BarChart3 },
  { href: '/discover', key: 'nav.feed', icon: Compass, label: 'Discover' },
  { href: '/friends', key: 'nav.friends', icon: Users },
  { href: '/pen-pal', key: 'nav.penpal', icon: Mail, badge: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { profile } = useAuth();
  const unread = useUnreadMessages();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card/50 backdrop-blur">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/today' && pathname.startsWith(item.href));
          const showBadge = item.badge && unread > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
              <span className="flex-1 truncate">{t(item.key)}</span>
              {showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href={`/profile/${profile?.username ?? ''}`}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
        >
          <Avatar className="h-9 w-9">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.username ?? ''} />}
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {(profile?.username ?? profile?.full_name ?? '?').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-foreground">
              {profile?.full_name ?? profile?.username ?? 'Profile'}
            </p>
            <p className="truncate text-xs text-muted-foreground">@{profile?.username ?? 'user'}</p>
          </div>
          <Settings className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </aside>
  );
}
