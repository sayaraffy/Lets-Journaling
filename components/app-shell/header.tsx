'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { useUnreadMessages } from '@/lib/hooks/use-unread-messages';
import { ThemeToggle } from '@/components/brand/theme-toggle';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, Bell, Mail, LogOut, User as UserIcon, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const mobileNav = [
  { href: '/today', label: 'Today' },
  { href: '/journal', label: 'Journal' },
  { href: '/study', label: 'Study' },
  { href: '/activities', label: 'Activities' },
  { href: '/history', label: 'History' },
  { href: '/stats', label: 'Statistics' },
  { href: '/discover', label: 'Discover' },
  { href: '/friends', label: 'Friends' },
  { href: '/pen-pal', label: 'Pen Pal' },
];

export function Header() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const unread = useUnreadMessages();
  const [notifCount, setNotifCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchNotifs = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      setNotifCount(count ?? 0);
    };
    fetchNotifs();
    const channel = supabase
      .channel('header-notifs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchNotifs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="h-16 justify-center border-b px-5">
              <SheetTitle className="text-left">
                <LogoMark className="inline-block" />
              </SheetTitle>
            </SheetHeader>
            <nav className="space-y-1 p-3">
              {mobileNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <Link href="/discover" className="hidden items-center gap-2 lg:flex">
          <LogoMark />
        </Link>
      </div>

      <div className="flex items-center gap-1.5">
        <Link href="/pen-pal">
          <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Pen pal messages">
            <Mail className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
        </Link>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications" asChild>
          <Link href="/notifications">
            <Bell className="h-[18px] w-[18px]" />
            {notifCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </Link>
        </Button>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Avatar className="h-9 w-9 ring-2 ring-border transition-all hover:ring-primary/40">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.username ?? ''} />}
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {(profile?.username ?? profile?.full_name ?? '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{profile?.full_name ?? 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">@{profile?.username ?? 'user'}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/profile/${profile?.username ?? ''}`} className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile/edit" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" /> Edit Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
