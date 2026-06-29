'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, UserPlus, Check, X, PenTool, Users, Trash2 } from 'lucide-react';
import type { Profile, Friend, FriendRequest } from '@/lib/types';

export default function FriendsPage() {
  const { user } = useAuth();
  console.log('Current user id:', user?.id);
  const [friends, setFriends] = useState<(Friend & { profile: Profile })[]>([]);
  const [requests, setRequests] = useState<(FriendRequest & { sender: Profile })[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [fRes, rRes] = await Promise.all([
      supabase.from('friends')
    .select('*, friend:profiles!friends_friend_id_fkey(*)')
    .eq('user_id', user.id),

  supabase.from('friend_requests')
    .select('*, sender:profiles!friend_requests_sender_id_fkey(*)')
    .eq('receiver_id', user.id)
    .eq('status', 'pending'),
    ]);
    console.log('Friend Requests Response:', rRes);
    console.log('Friend Requests Data:', rRes.data);
    console.log('Friend Requests Error:', rRes.error);
    console.log('Friends Response:', fRes);
console.log('Friends Data:', fRes.data);
console.log('Friends Error:', fRes.error);
    
    setFriends((fRes.data as any) ?? []);
    setRequests((rRes.data as any) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const doSearch = async () => {
    if (!search.trim() || !user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${search.trim()}%`)
      .neq('id', user.id)
      .limit(10);
    setResults((data as Profile[]) ?? []);
  };

  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('friend_requests').insert({ sender_id: user.id, receiver_id: receiverId });
      if (error) throw error;
      toast.success('Friend request sent');
      setResults(results.filter((r) => r.id !== receiverId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send request');
    }
  };

  const acceptRequest = async (req: FriendRequest) => {
  try {
    const { error: requestError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', req.id);

    if (requestError) throw requestError;

    const { data, error: friendError } = await supabase
      .from('friends')
      .insert([
        {
          user_id: req.sender_id,
          friend_id: req.receiver_id,
        },
        {
          user_id: req.receiver_id,
          friend_id: req.sender_id,
        },
      ])
      .select();

    console.log('Inserted friends:', data);
    console.log('Friend insert error:', friendError);

    if (friendError) throw friendError;

    toast.success('Friend added');
    load();
  } catch (err) {
    console.error(err);
    toast.error(
      err instanceof Error ? err.message : 'Failed to accept request'
    );
  }
};

  const rejectRequest = async (id: string) => {
    await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', id);
    setRequests(requests.filter((r) => r.id !== id));
  };

  const removeFriend = async (f: Friend) => {
    if (!user) return;
    try {
      await Promise.all([
        supabase.from('friends').delete().eq('user_id', f.user_id).eq('friend_id', f.friend_id),
        supabase.from('friends').delete().eq('user_id', f.friend_id).eq('friend_id', f.user_id),
      ]);
      load();
      toast.success('Friend removed');
    } catch {
      toast.error('Failed to remove friend');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue="friends">
        <TabsList>
          <TabsTrigger value="friends" className="gap-1.5"><Users className="h-4 w-4" /> Friends</TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Requests
            {requests.length > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{requests.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5"><Search className="h-4 w-4" /> Find</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-4">
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse-soft rounded-xl bg-muted" />)}</div>
          ) : friends.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No friends yet. Search for users to connect.</p>
                <Button onClick={() => { const el = document.querySelector('[value="search"]') as HTMLButtonElement; el?.click(); }} className="gap-2"><Search className="h-4 w-4" /> Find friends</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {friends.map((f) => (
                <Card key={f.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Avatar className="h-11 w-11">
                      {f.profile?.avatar_url ? <img src={f.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                      <AvatarFallback className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {(f.profile?.username ?? '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{f.profile?.username ?? 'User'}</p>
                      {f.profile?.bio && <p className="truncate text-xs text-muted-foreground">{f.profile.bio}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/pen-pal?to=${f.friend_id}`}><PenTool className="h-4 w-4" /></Link></Button>
                      <Button variant="ghost" size="icon" onClick={() => removeFriend(f)} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <UserPlus className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Avatar className="h-11 w-11">
                      {r.sender?.avatar_url ? <img src={r.sender.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                      <AvatarFallback className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {(r.sender?.username ?? '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.sender?.username ?? 'User'}</p>
                      <p className="text-xs text-muted-foreground">wants to be your friend</p>
                    </div>
                    <Button size="sm" onClick={() => acceptRequest(r)} className="gap-1.5 h-8"><Check className="h-4 w-4" /> Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => rejectRequest(r.id)} className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search by username…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
            <Button onClick={doSearch} className="gap-2"><Search className="h-4 w-4" /> Search</Button>
          </div>
          {results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Search for users by username to send a friend request.</p>
          ) : (
            <div className="space-y-2">
              {results.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Avatar className="h-11 w-11">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                      <AvatarFallback className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {(p.username ?? '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.username ?? 'User'}</p>
                      {p.bio && <p className="truncate text-xs text-muted-foreground">{p.bio}</p>}
                    </div>
                    <Button size="sm" onClick={() => sendRequest(p.id)} className="gap-1.5 h-8"><UserPlus className="h-4 w-4" /> Add</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
