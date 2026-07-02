'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { PenPalMessage, Profile, Friend } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Send, CheckCheck, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/journal-utils';

type FriendWithProfile = Friend & { friend_profile: Profile };

export default function PenPalPage() {
  const params = useSearchParams();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<PenPalMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [friendOnline, setFriendOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load friends list
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [f1, f2] = await Promise.all([
        supabase.from('friends').select('*, friend_profile:profiles!friends_friend_id_fkey(*)').eq('user_id', user.id),
        supabase.from('friends').select('*, friend_profile:profiles!friends_user_id_fkey(*)').eq('friend_id', user.id),
      ]);
      const all = [
        ...((f1.data as FriendWithProfile[]) ?? []),
        ...(((f2.data ?? []) as FriendWithProfile[]).map((f) => ({ ...f, friend_profile: (f as unknown as { friend_profile: Profile }).friend_profile }))),
      ];
      setFriends(all);
      setLoading(false);
      const toParam = params.get('to');
      if (toParam) {
        const target = all.find((f) => f.friend_profile?.id === toParam);
        if (target) selectFriend(target.friend_profile);
      }
    })();
  }, [user, params]);

  const selectFriend = useCallback((friend: Profile) => {
    setSelectedFriend(friend);
    setMessages([]);
    setFriendTyping(false);
  }, []);

  // Subscribe to messages + typing for selected conversation
  useEffect(() => {
    if (!user || !selectedFriend) return;
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }

    const channelId = `penpal-${[user.id, selectedFriend.id].sort().join('-')}`;

    (async () => {
      const { data: msgs } = await supabase
        .from('pen_pal_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedFriend.id}),and(sender_id.eq.${selectedFriend.id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
        .limit(200);
      setMessages((msgs as PenPalMessage[]) ?? []);

      // Mark received messages as read
      const unread = (msgs as PenPalMessage[])?.filter((m) => m.receiver_id === user.id && !m.read_at) ?? [];
      if (unread.length > 0) {
        await supabase.from('pen_pal_messages').update({ read_at: new Date().toISOString() }).in('id', unread.map((m) => m.id));
      }
    })();

    const channel = supabase.channel(channelId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'pen_pal_messages',
        filter: `or(and(sender_id.eq.${user.id},receiver_id.eq.${selectedFriend.id}),and(sender_id.eq.${selectedFriend.id},receiver_id.eq.${user.id}))`,
      }, (payload) => {
        const msg = payload.new as PenPalMessage;
        setMessages((prev) => [...prev, msg]);
        if (msg.sender_id === selectedFriend.id) {
          // Mark as read immediately
          supabase.from('pen_pal_messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id);
          setFriendTyping(false);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'pen_pal_messages',
        filter: `sender_id.eq.${selectedFriend.id}`,
      }, (payload) => {
        const updated = payload.new as PenPalMessage;
        setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.userId === selectedFriend.id) {
          setFriendTyping(true);
          setTimeout(() => setFriendTyping(false), 3000);
        }
      })
      .on('broadcast', { event: 'stop-typing' }, (payload) => {
        if (payload.payload?.userId === selectedFriend.id) setFriendTyping(false);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const isOnline = Object.keys(state).some((key) => key === selectedFriend.id);
        setFriendOnline(isOnline);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, selectedFriend]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, friendTyping]);

  const sendTyping = () => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id } });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      channelRef.current?.send({ type: 'broadcast', event: 'stop-typing', payload: { userId: user.id } });
    }, 2000);
  };

  const sendMessage = async () => {
    if (!user || !selectedFriend || !draft.trim()) return;
    const body = draft.trim();
    setDraft('');
    const { data } = await supabase
      .from('pen_pal_messages')
      .insert({ sender_id: user.id, receiver_id: selectedFriend.id, body, delivered_at: new Date().toISOString() })
      .select()
      .single();
    if (data) {
      setMessages((prev) => [...prev, data as PenPalMessage]);
      await supabase.from('notifications').insert({
        user_id: selectedFriend.id, type: 'penpal', title: 'New message',
        body: body.slice(0, 80), data: { sender_id: user.id },
      });
    }
    channelRef.current?.send({ type: 'broadcast', event: 'stop-typing', payload: { userId: user.id } });
  };

  if (loading) {
    return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 lg:h-[calc(100vh-9rem)]">
      {/* Conversation list */}
      <div className={cn('w-full shrink-0 lg:w-72', selectedFriend && 'hidden lg:block')}>
        <div className="mb-3 flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-semibold">Pen Pal</h1>
        </div>
        <div className="space-y-1.5">
          {friends.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              No friends yet. Add friends to start writing letters.
            </CardContent></Card>
          ) : (
            friends.map((f) => {
              const fp = f.friend_profile;
              if (!fp) return null;
              return (
                <button
                  key={f.id}
                  onClick={() => selectFriend(fp)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all',
                    selectedFriend?.id === fp.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      {fp.avatar_url && <AvatarImage src={fp.avatar_url} alt={fp.username ?? ''} />}
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary">{(fp.username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fp.full_name ?? fp.username}</p>
                    <p className="truncate text-xs text-muted-foreground">@{fp.username}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat panel */}
      {selectedFriend ? (
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border p-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedFriend(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              {selectedFriend.avatar_url && <AvatarImage src={selectedFriend.avatar_url} alt={selectedFriend.username ?? ''} />}
              <AvatarFallback className="bg-primary/10 font-semibold text-primary">{(selectedFriend.username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium">{selectedFriend.full_name ?? selectedFriend.username}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {friendOnline ? (
                  <><span className="h-2 w-2 rounded-full bg-success" /> Online</>
                ) : (
                  <><span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> {lastSeen ? `last seen ${relativeTime(lastSeen)}` : 'Offline'}</>
                )}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">Start the conversation. Say hello to {selectedFriend.full_name ?? selectedFriend.username}.</p>
              </div>
            )}
            {messages.map((m) => {
              const isMine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5', isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                    <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                    <div className={cn('mt-1 flex items-center gap-1 text-[10px]', isMine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                      {relativeTime(m.created_at)}
                      {isMine && (
                        <CheckCheck className={cn('h-3 w-3', m.read_at ? 'text-gold-300' : 'text-primary-foreground/50')} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {friendTyping && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-border p-3">
            <Input
              value={draft}
              onChange={(e) => { setDraft(e.target.value); sendTyping(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type a message…"
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!draft.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center lg:flex">
          <div className="text-center">
            <Mail className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Select a friend to start chatting.</p>
          </div>
        </div>
      )}
    </div>
  );
}
