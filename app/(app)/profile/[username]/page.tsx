'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Flame, Calendar, Heart, MessageCircle, PenTool, UserPlus, UserMinus,
  Share2, BookHeart, Trophy, Users, Sparkles, TrendingUp, Award, Droplets, CheckCircle2,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { Profile, Journal, Friend, JournalLike, MoodEntry } from '@/lib/types';

type ProfileJournal = Journal & { profiles: Profile };

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const username = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [pendingSent, setPendingSent] = useState(false);
  const [journals, setJournals] = useState<ProfileJournal[]>([]);
  const [friends, setFriends] = useState<(Friend & { friend: Profile })[]>([]);
  const [moodData, setMoodData] = useState<MoodEntry[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ totalJournals: 0, totalActivities: 0, avgMood: 0, monthlyCount: [] as { month: string; count: number }[] });
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    const { data: prof, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    if (error || !prof) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setProfile(prof as Profile);

    const isOwn = user?.id === prof.id;
    if (user && !isOwn) {
      const [fRes, frRes] = await Promise.all([
        supabase.from('friends').select('id').eq('user_id', user.id).eq('friend_id', prof.id).maybeSingle(),
        supabase.from('friend_requests').select('id').eq('sender_id', user.id).eq('receiver_id', prof.id).eq('status', 'pending').maybeSingle(),
      ]);
      setIsFriend(!!fRes.data);
      setPendingSent(!!frRes.data);
    }

    const [jRes, fRes, mRes, aRes] = await Promise.all([
      supabase.from('journals').select('*, profiles!journals_user_id_fkey(*)').eq('user_id', prof.id).eq('visibility', 'public').order('created_at', { ascending: false }),
      supabase.from('friends').select('*, friend:profiles!friends_friend_id_fkey(*)').eq('user_id', prof.id).limit(20),
      supabase.from('mood_entries').select('*').eq('user_id', prof.id).order('mood_date', { ascending: true }).limit(30),
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', prof.id).eq('is_completed', true),
    ]);
    const jData = (jRes.data as ProfileJournal[]) ?? [];
    setJournals(jData);
    setFriends((fRes.data as (Friend & { friend: Profile })[]) ?? []);
    setMoodData((mRes.data as MoodEntry[]) ?? []);

    if (jData.length > 0) {
      const ids = jData.map((j) => j.id);
      const [lRes, cRes] = await Promise.all([
        supabase.from('journal_likes').select('journal_id').in('journal_id', ids),
        supabase.from('journal_comments').select('journal_id').in('journal_id', ids),
      ]);
      const lc: Record<string, number> = {};
      (lRes.data as JournalLike[] | null)?.forEach((l) => { lc[l.journal_id] = (lc[l.journal_id] ?? 0) + 1; });
      setLikeCounts(lc);
      const cc: Record<string, number> = {};
      (cRes.data as { journal_id: string }[] | null)?.forEach((c) => { cc[c.journal_id] = (cc[c.journal_id] ?? 0) + 1; });
      setCommentCounts(cc);
    }

    const avgMood = mRes.data && mRes.data.length > 0
      ? mRes.data.reduce((sum, m) => sum + (m as MoodEntry).mood, 0) / mRes.data.length
      : 0;

    const monthly: Record<string, number> = {};
    jData.forEach((j) => {
      const m = j.journal_date.slice(0, 7);
      monthly[m] = (monthly[m] ?? 0) + 1;
    });
    const monthlyArr = Object.entries(monthly).slice(-6).map(([month, count]) => ({ month, count }));

    setStats({
      totalJournals: jData.length,
      totalActivities: aRes.count ?? 0,
      avgMood: Math.round(avgMood * 10) / 10,
      monthlyCount: monthlyArr,
    });

    setLoading(false);
  }, [username, user]);

  useEffect(() => { load(); }, [load]);

  const sendRequest = async () => {
    if (!user || !profile) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('friend_requests').insert({ sender_id: user.id, receiver_id: profile.id });
      if (error) throw error;
      setPendingSent(true);
      toast.success('Friend request sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setActionLoading(false);
    }
  };

  const removeFriend = async () => {
    if (!user || !profile) return;
    setActionLoading(true);
    try {
      await Promise.all([
        supabase.from('friends').delete().eq('user_id', user.id).eq('friend_id', profile.id),
        supabase.from('friends').delete().eq('user_id', profile.id).eq('friend_id', user.id),
      ]);
      setIsFriend(false);
      toast.success('Friend removed');
    } catch {
      toast.error('Failed to remove friend');
    } finally {
      setActionLoading(false);
    }
  };

  const shareProfile = async () => {
    const url = `${window.location.origin}/profile/${username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${username}'s profile`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Profile link copied');
      }
    } catch {
      // cancelled
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-10 w-64" />
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground" />
          <p className="font-medium">User not found</p>
          <Button variant="outline" onClick={() => router.back()}>Go back</Button>
        </CardContent>
      </Card>
    );
  }

  const isOwn = user?.id === profile.id;
  const moodChart = moodData.slice(-14).map((m) => ({ date: m.mood_date.slice(5), mood: m.mood }));

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-brand-400 to-brand-600 dark:from-brand-700 dark:to-brand-900" />
        <CardContent className="p-6">
          <div className="-mt-16 flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar className="h-24 w-24 border-4 border-card shadow-soft">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
              <AvatarFallback className="bg-brand-100 text-2xl font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {(profile.username ?? '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 pb-1">
              <h1 className="font-display text-2xl font-semibold">{profile.username ?? 'User'}</h1>
              {profile.full_name && <p className="text-sm text-muted-foreground">{profile.full_name}</p>}
              {profile.bio && <p className="mt-1 text-sm text-foreground/80">{profile.bio}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Joined {new Date(profile.join_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isOwn ? (
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/profile"><PenTool className="h-4 w-4" /> Edit Profile</Link>
                </Button>
              ) : isFriend ? (
                <>
                  <Button asChild variant="outline" className="gap-2"><Link href={`/pen-pal?to=${profile.id}`}><PenTool className="h-4 w-4" /> Message</Link></Button>
                  <Button variant="outline" onClick={removeFriend} disabled={actionLoading} className="gap-2"><UserMinus className="h-4 w-4" /> Remove</Button>
                </>
              ) : pendingSent ? (
                <Button variant="outline" disabled className="gap-2"><CheckCircle2 className="h-4 w-4" /> Request sent</Button>
              ) : (
                <Button onClick={sendRequest} disabled={actionLoading} className="gap-2"><UserPlus className="h-4 w-4" /> Add Friend</Button>
              )}
              <Button variant="ghost" size="icon" onClick={shareProfile}><Share2 className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Flame} label="Streak" value={`${profile.streak}d`} color="text-gold-500" />
            <Stat icon={BookHeart} label="Journals" value={`${stats.totalJournals}`} color="text-brand-600" />
            <Stat icon={CheckCircle2} label="Activities" value={`${stats.totalActivities}`} color="text-success" />
            <Stat icon={TrendingUp} label="Avg Mood" value={stats.avgMood > 0 ? `${stats.avgMood}/5` : '—'} color="text-purple-500" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="journals">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="journals" className="gap-1.5"><BookHeart className="h-4 w-4" /> Journals</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Statistics</TabsTrigger>
          <TabsTrigger value="achievements" className="gap-1.5"><Trophy className="h-4 w-4" /> Achievements</TabsTrigger>
          <TabsTrigger value="friends" className="gap-1.5"><Users className="h-4 w-4" /> Friends</TabsTrigger>
        </TabsList>

        <TabsContent value="journals" className="mt-4 space-y-3">
          {journals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <BookHeart className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No public journals yet.</p>
              </CardContent>
            </Card>
          ) : (
            journals.map((j) => (
              <Link key={j.id} href={`/journal/${j.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">{new Date(j.journal_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Badge>
                      <span className="text-xs text-muted-foreground">{j.tags?.slice(0, 2).map((t) => `#${t}`).join(' ')}</span>
                    </div>
                    {j.what_happened && <p className="line-clamp-2 text-sm text-foreground/90">{j.what_happened}</p>}
                    {j.free_notes && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{j.free_notes}</p>}
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {likeCounts[j.id] ?? 0}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {commentCounts[j.id] ?? 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard icon={Flame} label="Current Streak" value={`${profile.streak} days`} color="text-gold-500" />
            <StatCard icon={Flame} label="Longest Streak" value={`${profile.longest_streak} days`} color="text-gold-500" />
            <StatCard icon={BookHeart} label="Total Journals" value={`${stats.totalJournals}`} color="text-brand-600" />
          </div>
          {moodChart.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-medium">Mood Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={moodChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[1, 5]} className="text-xs" />
                    <Tooltip />
                    <Line type="monotone" dataKey="mood" stroke="#0000FF" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {stats.monthlyCount.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-medium">Journals per Month</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.monthlyCount}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0000FF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {moodChart.length === 0 && stats.monthlyCount.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">No statistics available yet.</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Achievement icon={BookHeart} title="First Journal" desc="Published your first journal" unlocked={stats.totalJournals >= 1} color="text-brand-600" />
            <Achievement icon={Flame} title="7 Day Streak" desc="Journaled 7 days in a row" unlocked={profile.longest_streak >= 7} color="text-gold-500" />
            <Achievement icon={Flame} title="30 Day Streak" desc="Journaled 30 days in a row" unlocked={profile.longest_streak >= 30} color="text-gold-500" />
            <Achievement icon={BookHeart} title="100 Entries" desc="Published 100 journals" unlocked={stats.totalJournals >= 100} color="text-brand-600" />
            <Achievement icon={Users} title="First Friend" desc="Made your first friend" unlocked={friends.length >= 1} color="text-success" />
            <Achievement icon={Users} title="Social Butterfly" desc="Connected with 10 friends" unlocked={friends.length >= 10} color="text-success" />
            <Achievement icon={CheckCircle2} title="Task Master" desc="Completed 50 activities" unlocked={stats.totalActivities >= 50} color="text-purple-500" />
            <Achievement icon={TrendingUp} title="Mindful" desc="Tracked mood 30 times" unlocked={moodData.length >= 30} color="text-blue-500" />
            <Achievement icon={Droplets} title="Hydration Master" desc="Stay hydrated for 7 days" unlocked={false} color="text-cyan-500" />
          </div>
        </TabsContent>

        <TabsContent value="friends" className="mt-4">
          {friends.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No friends yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {friends.map((f) => (
                <Link key={f.id} href={`/profile/${f.friend?.username ?? ''}`}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center gap-3 p-4">
                      <Avatar className="h-10 w-10">
                        {f.friend?.avatar_url ? <img src={f.friend.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                        <AvatarFallback className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          {(f.friend?.username ?? '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.friend?.username ?? 'User'}</p>
                        {f.friend?.bio && <p className="truncate text-xs text-muted-foreground">{f.friend.bio}</p>}
                      </div>
                      {f.friend?.streak > 0 && (
                        <Badge variant="outline" className="gap-1 text-xs"><Flame className="h-3 w-3 text-gold-500" /> {f.friend.streak}d</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-3 text-center">
      <Icon className={`h-5 w-5 ${color}`} />
      <span className="font-display text-lg font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Achievement({ icon: Icon, title, desc, unlocked, color }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; unlocked: boolean; color: string }) {
  return (
    <Card className={unlocked ? '' : 'opacity-50'}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${unlocked ? 'bg-muted' : 'bg-muted/50'} ${unlocked ? color : 'text-muted-foreground'}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
          {unlocked && <Badge variant="secondary" className="mt-1 gap-1 text-xs"><Award className="h-3 w-3" /> Unlocked</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
