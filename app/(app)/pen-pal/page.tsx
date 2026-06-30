'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PenTool, Send, ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile, PenPalMessage, Friend } from '@/lib/types';

type Conversation = {
  friend: Profile;
  friendId: string;
  lastMessage: PenPalMessage | null;
  unreadCount: number;
};

export default function PenPalPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('to'));
  const [messages, setMessages] = useState<PenPalMessage[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: friendsData } = await supabase
      .from('friends')
      .select('*, friend:profiles!friends_friend_id_fkey(*)')
      .eq('user_id', user.id);
    const friends = (friendsData as (Friend & { friend: Profile })[]) ?? [];

    if (friends.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const friendIds = friends.map((f) => f.friend_id);
    const { data: msgs } = await supabase
      .from('pen_pal_messages')
      .select('*')
      .or(`sender_id.in.(${friendIds.join(',')}),receiver_id.in.(${friendIds.join(',')})`)
      .order('created_at', { ascending: false });

    const allMsgs = (msgs as PenPalMessage[]) ?? [];
    const convos: Conversation[] = friends.map((f) => {
      const fMsgs = allMsgs.filter((m) =>
        (m.sender_id === f.friend_id && m.receiver_id === user.id) ||
        (m.sender_id === user.id && m.receiver_id === f.friend_id),
      );
      const lastMessage = fMsgs[0] ?? null;
      const unreadCount = fMsgs.filter((m) => m.sender_id === f.friend_id && m.receiver_id === user.id && !m.read_at).length;
      return { friend: f.friend, friendId: f.friend_id, lastMessage, unreadCount };
    });
    convos.sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return bTime - aTime;
    });
    setConversations(convos);
    if (!selectedId && convos.length > 0) setSelectedId(convos[0].friendId);
    setLoading(false);
  }, [user, selectedId]);

  const loadMessages = useCallback(async () => {
    if (!user || !selectedId) return;
    const { data } = await supabase
      .from('pen_pal_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedId}),and(sender_id.eq.${selectedId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(30);
    setMessages((data as PenPalMessage[]) ?? []);
    // Mark received as read
    await supabase.from('pen_pal_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', selectedId)
      .eq('receiver_id', user.id)
      .is('read_at', null);
    // Update unread count for this conversation
    setConversations((prev) => prev.map((c) => c.friendId === selectedId ? { ...c, unreadCount: 0 } : c));
  }, [user, selectedId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('pen-pal-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pen_pal_messages' }, (payload) => {
        const msg = payload.new as PenPalMessage;
        // If message involves current user, update messages or conversations
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          // Update conversations list (last message + sorting)
          loadConversations();
          // If this is the selected conversation, add to messages
          if (msg.sender_id === selectedId && msg.receiver_id === user.id) {
            setMessages((prev) => [...prev, msg]);
            // Auto-mark as delivered + read since we're viewing this conversation
            supabase.from('pen_pal_messages').update({ delivered_at: new Date().toISOString(), read_at: new Date().toISOString() }).eq('id', msg.id);
          } else if (msg.sender_id === user.id && msg.receiver_id === selectedId) {
            setMessages((prev) => [...prev, msg]);
          } else if (msg.receiver_id === user.id) {
            // Message from another conversation — mark as delivered + show notification
            supabase.from('pen_pal_messages').update({ delivered_at: new Date().toISOString() }).eq('id', msg.id).is('delivered_at', null);
            showNotification(msg);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pen_pal_messages' }, (payload) => {
        const msg = payload.new as PenPalMessage;
        setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedId, loadConversations]);

  // Realtime typing indicator via presence/broadcast
  useEffect(() => {
    if (!user || !selectedId) return;
    const channel = supabase.channel(`typing-${user.id}-${selectedId}`, {
      config: { presence: { key: user.id } },
    });
    channel.on('broadcast', { event: 'typing' }, (payload: { payload?: { userId?: string; isTyping?: boolean } }) => {
      const senderId = payload.payload?.userId;
      const isTyping = payload.payload?.isTyping;
      if (!senderId || senderId === user.id) return;
      if (isTyping) {
        setTypingUsers((prev) => new Set(prev).add(senderId));
        // Clear after 2 seconds
        if (typingTimeoutRef.current[senderId]) clearTimeout(typingTimeoutRef.current[senderId]);
        typingTimeoutRef.current[senderId] = setTimeout(() => {
          setTypingUsers((prev) => { const n = new Set(prev); n.delete(senderId); return n; });
        }, 2000);
      } else {
        setTypingUsers((prev) => { const n = new Set(prev); n.delete(senderId); return n; });
      }
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Presence: track online status of all friends
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('online-presence', {
      config: { presence: { key: user.id } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online = new Set<string>();
        Object.keys(state).forEach((key) => online.add(key));
        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers((prev) => new Set(prev).add(key));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => { const n = new Set(prev); n.delete(key); return n; });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const showNotification = (msg: PenPalMessage) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const sender = conversations.find((c) => c.friendId === msg.sender_id)?.friend;
    new Notification(sender?.username ?? 'New message', {
      body: msg.body.length > 50 ? msg.body.slice(0, 50) + '…' : msg.body,
    });
  };

  const sendTyping = (isTyping: boolean) => {
    if (!user || !selectedId) return;
    const channel = supabase.channel(`typing-${user.id}-${selectedId}`);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, isTyping } });
      }
    });
  };

  const send = async () => {
    if (!user || !selectedId || !body.trim()) return;
    const tempBody = body.trim();
    setBody('');
    setSending(true);
    // Optimistic: add message immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: PenPalMessage = {
      id: tempId, sender_id: user.id, receiver_id: selectedId, body: tempBody,
      image_path: null, shared_journal_id: null, read_at: null, delivered_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    sendTyping(false);
    try {
      const { data, error } = await supabase.from('pen_pal_messages').insert({
        sender_id: user.id, receiver_id: selectedId, body: tempBody,
      }).select().single();
      if (error) throw error;
      // Replace optimistic message with real one
      setMessages((prev) => prev.map((m) => m.id === tempId ? (data as PenPalMessage) : m));
      loadConversations();
    } catch (err) {
      // Rollback optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const selectedConvo = conversations.find((c) => c.friendId === selectedId);
  const isTyping = selectedId ? typingUsers.has(selectedId) : false;

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  const formatLastMessageTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getLastMessagePreview = (msg: PenPalMessage | null) => {
    if (!msg) return 'No messages yet';
    const prefix = msg.sender_id === user?.id ? 'You: ' : '';
    const text = msg.body.length > 30 ? msg.body.slice(0, 30) + '…' : msg.body;
    return prefix + text;
  };

  return (
    <div className="animate-fade-in">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Conversation list */}
        <Card className={cn('h-[calc(100vh-12rem)] overflow-hidden', mobileChatOpen && selectedId ? 'hidden lg:block' : '')}>
          <CardContent className="flex h-full flex-col p-0">
            <div className="border-b border-border p-3">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold"><PenTool className="h-4 w-4 text-brand-600" /> Pen Pals</h3>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loading ? (
                <div className="space-y-2 p-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse-soft rounded-xl bg-muted" />)}</div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                  <PenTool className="h-8 w-8" />
                  <p className="text-sm">Start chatting with your friends.</p>
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.friendId}
                    onClick={() => { setSelectedId(c.friendId); setMobileChatOpen(true); }}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-border/50 p-3 text-left transition-colors hover:bg-muted/50',
                      selectedId === c.friendId && 'bg-brand-50 dark:bg-brand-900/20',
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        {c.friend?.avatar_url ? <img src={c.friend.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                        <AvatarFallback className="bg-brand-100 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          {(c.friend?.username ?? '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {onlineUsers.has(c.friendId) && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-success" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{c.friend?.username ?? 'User'}</p>
                        {c.lastMessage && (
                          <span className="shrink-0 text-xs text-muted-foreground">{formatLastMessageTime(c.lastMessage.created_at)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">{getLastMessagePreview(c.lastMessage)}</p>
                        {c.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Conversation */}
        <Card className={cn('h-[calc(100vh-12rem)] overflow-hidden', !mobileChatOpen && 'hidden lg:flex')}>
          <CardContent className="flex h-full flex-col p-0">
            {selectedConvo ? (
              <>
                <div className="flex items-center gap-3 border-b border-border p-3">
                  <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setMobileChatOpen(false)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-9 w-9">
                    {selectedConvo.friend?.avatar_url ? <img src={selectedConvo.friend.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                    <AvatarFallback className="bg-brand-100 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      {(selectedConvo.friend?.username ?? '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedConvo.friend?.username ?? 'User'}</p>
                    {isTyping ? (
                      <p className="flex items-center gap-1 text-xs text-brand-600">
                        typing
                        <span className="flex gap-0.5">
                          <span className="h-1 w-1 animate-bounce rounded-full bg-brand-600 [animation-delay:-0.3s]" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-brand-600 [animation-delay:-0.15s]" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-brand-600" />
                        </span>
                      </p>
                    ) : selectedId && onlineUsers.has(selectedId) ? (
                      <p className="flex items-center gap-1.5 text-xs text-success">
                        <span className="h-2 w-2 rounded-full bg-success" /> Online
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Offline</p>
                    )}
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                      <PenTool className="h-8 w-8" />
                      <p className="text-sm">Send your first letter to {selectedConvo.friend?.username}.</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender_id === user?.id;
                      const isTemp = m.id.startsWith('temp-');
                      return (
                        <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                          <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5', mine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                            <div className={cn('mt-1 flex items-center justify-end gap-1 text-xs', mine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                              <span>{formatTime(m.created_at)}</span>
                              {mine && (
                                isTemp ? (
                                  <span className="text-primary-foreground/40">…</span>
                                ) : m.read_at ? (
                                  <CheckCheck className="h-3 w-3 text-blue-300" />
                                ) : m.delivered_at ? (
                                  <CheckCheck className="h-3 w-3" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )
                              )}
                            </div>
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
                      onChange={(e) => {
                        setBody(e.target.value);
                        sendTyping(true);
                      }}
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
