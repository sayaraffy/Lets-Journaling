'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Profile, FriendRequest, Friend } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users, Search, UserPlus, Check, X, Mail } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type FriendWithProfile = Friend & { friend_profile: Profile };

export default function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [requests, setRequests] = useState<(FriendRequest & { sender: Profile })[]>([]);
  const [sentRequests, setSentRequests] = useState<(FriendRequest & { receiver: Profile })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [friendsRes, reqReceived, reqSent] = await Promise.all([
      supabase.from('friends').select('*, friend_profile:profiles!friends_friend_id_fkey(*)').eq('user_id', user.id),
      supabase.from('friend_requests').select('*, sender:profiles!friend_requests_sender_id_fkey(*)').eq('receiver_id', user.id).eq('status', 'pending'),
      supabase.from('friend_requests').select('*, receiver:profiles!friend_requests_receiver_id_fkey(*)').eq('sender_id', user.id).eq('status', 'pending'),
    ]);

    const reverse = await supabase.from('friends').select('*, friend_profile:profiles!friends_user_id_fkey(*)').eq('friend_id', user.id);
    const allFriends = [
      ...((friendsRes.data as FriendWithProfile[]) ?? []),
      ...(((reverse.data ?? []) as FriendWithProfile[]).map((f) => ({ ...f, friend_profile: (f as unknown as { friend_profile: Profile }).friend_profile }))),
    ];

    setFriends(allFriends);
    setRequests((reqReceived.data as (FriendRequest & { sender: Profile })[]) ?? []);
    setSentRequests((reqSent.data as (FriendRequest & { receiver: Profile })[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${searchQuery.trim()}%,full_name.ilike.%${searchQuery.trim()}%`)
      .neq('id', user.id)
      .limit(10);
    setSearchResults((data as Profile[]) ?? []);
    setSearching(false);
  };

  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    await supabase.from('friend_requests').insert({ sender_id: user.id, receiver_id: receiverId });
    toast.success('Friend request sent');
    load();
  };

  const acceptRequest = async (reqId: string, senderId: string) => {
    if (!user) return;
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', reqId);
    await supabase.from('friends').insert({ user_id: user.id, friend_id: senderId });
    await supabase.from('notifications').insert({
      user_id: senderId, type: 'friend_accepted', title: 'Friend request accepted',
      body: 'You are now friends', data: { friend_id: user.id },
    });
    toast.success('Friend added');
    load();
  };

  const rejectRequest = async (reqId: string) => {
    await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', reqId);
    load();
  };

  const removeFriend = async (friendId: string) => {
    if (!user || !confirm('Remove this friend?')) return;
    await supabase.from('friends').delete().or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq('friend_id', friendId);
    await supabase.from('friends').delete().eq('user_id', friendId).eq('friend_id', user.id);
    toast.success('Friend removed');
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
          <Users className="h-6 w-6 text-primary" /> Friends
        </h1>
        <p className="text-sm text-muted-foreground">Connect with people to share journals and exchange letters.</p>
      </div>

      <Tabs defaultValue="friends">
        <TabsList>
          <TabsTrigger value="friends" className="gap-2"><Users className="h-4 w-4" /> Friends ({friends.length})</TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <UserPlus className="h-4 w-4" /> Requests
            {requests.length > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{requests.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="find" className="gap-2"><Search className="h-4 w-4" /> Find</TabsTrigger>
        </TabsList>

        {/* Friends list */}
        <TabsContent value="friends" className="mt-4">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : friends.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No friends yet. Use the Find tab to search for people.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {friends.map((f) => (
                <Card key={f.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Link href={`/profile/${f.friend_profile?.username ?? ''}`}>
                      <Avatar className="h-12 w-12">
                        {f.friend_profile?.avatar_url && <AvatarImage src={f.friend_profile.avatar_url} alt={f.friend_profile.username ?? ''} />}
                        <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                          {(f.friend_profile?.username ?? '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${f.friend_profile?.username ?? ''}`} className="block truncate text-sm font-medium hover:underline">
                        {f.friend_profile?.full_name ?? f.friend_profile?.username}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">@{f.friend_profile?.username}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                        <Link href={`/pen-pal?to=${f.friend_profile?.id}`}><Mail className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeFriend(f.friend_id)} className="h-8 w-8 text-destructive hover:text-destructive">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Requests */}
        <TabsContent value="requests" className="mt-4 space-y-3">
          {requests.length === 0 && sentRequests.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No pending requests.</CardContent></Card>
          ) : (
            <>
              {requests.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Incoming ({requests.length})</h3>
                  <div className="space-y-2">
                    {requests.map((r) => (
                      <Card key={r.id}>
                        <CardContent className="flex items-center gap-3 p-3">
                          <Avatar className="h-10 w-10">
                            {r.sender?.avatar_url && <AvatarImage src={r.sender.avatar_url} alt="" />}
                            <AvatarFallback className="bg-muted">{(r.sender?.username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{r.sender?.full_name ?? r.sender?.username}</p>
                            <p className="truncate text-xs text-muted-foreground">@{r.sender?.username}</p>
                          </div>
                          <Button size="sm" onClick={() => acceptRequest(r.id, r.sender_id)} className="gap-1"><Check className="h-4 w-4" /> Accept</Button>
                          <Button size="sm" variant="ghost" onClick={() => rejectRequest(r.id)}><X className="h-4 w-4" /></Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              {sentRequests.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Sent ({sentRequests.length})</h3>
                  <div className="space-y-2">
                    {sentRequests.map((r) => (
                      <Card key={r.id}>
                        <CardContent className="flex items-center gap-3 p-3">
                          <Avatar className="h-10 w-10">
                            {r.receiver?.avatar_url && <AvatarImage src={r.receiver.avatar_url} alt="" />}
                            <AvatarFallback className="bg-muted">{(r.receiver?.username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{r.receiver?.full_name ?? r.receiver?.username}</p>
                            <p className="truncate text-xs text-muted-foreground">@{r.receiver?.username}</p>
                          </div>
                          <Badge variant="outline">Pending</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Find */}
        <TabsContent value="find" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by username or name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              className="pl-9"
            />
          </div>
          {searching && <p className="text-sm text-muted-foreground">Searching…</p>}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <Link href={`/profile/${p.username ?? ''}`}>
                      <Avatar className="h-10 w-10">
                        {p.avatar_url && <AvatarImage src={p.avatar_url} alt="" />}
                        <AvatarFallback className="bg-muted">{(p.username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${p.username ?? ''}`} className="block truncate text-sm font-medium hover:underline">
                        {p.full_name ?? p.username}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                    </div>
                    <Button size="sm" onClick={() => sendRequest(p.id)} className="gap-1"><UserPlus className="h-4 w-4" /> Add</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!searching && searchResults.length === 0 && searchQuery && (
            <p className="text-sm text-muted-foreground">No results found.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
