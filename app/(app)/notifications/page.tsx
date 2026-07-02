'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Notification } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Heart, MessageCircle, UserPlus, Mail, Flame, Calendar, Check, Trash2, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/journal-utils';

const typeIcons: Record<string, typeof Bell> = {
  like: Heart,
  comment: MessageCircle,
  friend_request: UserPlus,
  friend_accepted: UserPlus,
  penpal: Mail,
  streak: Flame,
  activity: Calendar,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (filter === 'unread') q = q.eq('is_read', false);
    const { data } = await q;
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [user, filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const clearAll = async () => {
    if (!user || !confirm('Clear all notifications?')) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            <Bell className="h-6 w-6 text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground">{notifications.filter((n) => !n.is_read).length} unread</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-2 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button>
        <Button variant={filter === 'unread' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('unread')}>Unread</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : notifications.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-center">
          <Bell className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">No notifications</p>
          <p className="mt-1 text-sm text-muted-foreground">You&apos;re all caught up.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = typeIcons[n.type] ?? Bell;
            return (
              <Card key={n.id} className={cn('transition-colors', !n.is_read && 'border-primary/30 bg-primary/5')}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', !n.is_read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-medium', !n.is_read && 'text-foreground')}>{n.title}</p>
                    {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => markRead(n.id)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
