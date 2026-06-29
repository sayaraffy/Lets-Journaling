'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { PenTool, Send, ArrowLeft, ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile, PenPalMessage, Friend } from '@/lib/types';

export default function PenPalPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [friends, setFriends] = useState<(Friend & { friend: Profile })[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('to'));
  const [messages, setMessages] = useState<PenPalMessage[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('friends').select('*, friend:profiles!friends_friend_id_fkey(*)').eq('user_id', user.id);
    setFriends((data as any) ?? []);
    if (!selectedId && (data as any[])?.length) setSelectedId((data as any[])[0].friend_id);
  }, [user, selectedId]);

  const loadMessages = useCallback(async () => {
    if (!user || !selectedId) return;
    const { data } = await supabase
      .from('pen_pal_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedId}),and(sender_id.eq.${selectedId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    setMessages((data as PenPalMessage[]) ?? []);
    // mark received as read
    await supabase.from('pen_pal_messages').update({ read_at: new Date().toISOString() }).eq('sender_id', selectedId).eq('receiver_id', user.id).is('read_at', null);
  }, [user, selectedId]);

  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!user || !selectedId || !body.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.from('pen_pal_messages').insert({
        sender_id: user.id, receiver_id: selectedId, body: body.trim(),
      }).select().single();
      if (error) throw error;
      setMessages([...messages, data as PenPalMessage]);
      setBody('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const selectedFriend = friends.find((f) => f.friend_id === selectedId);

  return (
    <div className="animate-fade-in">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Friends list */}
        <Card className="h-[calc(100vh-12rem)] overflow-hidden">
          <CardContent className="flex h-full flex-col p-0">
            <div className="border-b border-border p-3">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold"><PenTool className="h-4 w-4 text-brand-600" /> Pen Pals</h3>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {friends.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Add friends first to exchange letters.</p>
              ) : (
                friends.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedId(f.friend_id)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-border/50 p-3 text-left transition-colors hover:bg-muted/50',
                      selectedId === f.friend_id && 'bg-brand-50 dark:bg-brand-900/20',
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      {f.friend?.avatar_url ? <img src={f.friend.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                      <AvatarFallback className="bg-brand-100 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {(f.friend?.username ?? '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.friend?.username ?? 'User'}</p>
                      <p className="truncate text-xs text-muted-foreground">Tap to open</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Conversation */}
        <Card className="h-[calc(100vh-12rem)] overflow-hidden">
          <CardContent className="flex h-full flex-col p-0">
            {selectedFriend ? (
              <>
                <div className="flex items-center gap-3 border-b border-border p-3">
                  <Avatar className="h-9 w-9">
                    {selectedFriend.friend?.avatar_url ? <img src={selectedFriend.friend.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                    <AvatarFallback className="bg-brand-100 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      {(selectedFriend.friend?.username ?? '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedFriend.friend?.username ?? 'User'}</p>
                    <p className="text-xs text-muted-foreground">Letter exchange</p>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                      <PenTool className="h-8 w-8" />
                      <p className="text-sm">Write your first letter to {selectedFriend.friend?.username}.</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender_id === user?.id;
                      return (
                        <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                          <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5', mine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                            <p className={cn('mt-1 text-xs', mine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                              {new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-border p-3">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Write a letter…"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={2}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    />
                    <Button onClick={send} disabled={sending || !body.trim()} size="icon" className="h-auto">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <PenTool className="h-10 w-10" />
                <p className="text-sm">Select a pen pal to start exchanging letters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
