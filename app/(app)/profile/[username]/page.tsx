'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Journal, Activity, Profile } from '@/lib/types';
import { fetchProfileStats, fetchUserJournals, fetchUserActivities, type ProfileStats } from '@/lib/profile-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Activity as ActivityIcon, Info, MapPin, Calendar, Flame, Heart, MessageCircle, Timer, Users, Globe, Lock, Bookmark } from 'lucide-react';
import { formatDate, relativeTime, readingTime, combineJournalText } from '@/lib/journal-utils';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, profile: myProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [friendReqSent, setFriendReqSent] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      if (!p) { setLoading(false); return; }
      setProfile(p as Profile);
      const [s, j, a] = await Promise.all([
        fetchProfileStats(p.id),
        fetchUserJournals(p.id, 'public'),
        fetchUserActivities(p.id),
      ]);
      setStats(s);
      setJournals(j);
      setActivities(a);
      if (currentUser && currentUser.id !== p.id) {
        const [friends, reqs] = await Promise.all([
          supabase.from('friends').select('user_id, friend_id').or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`).limit(1),
          supabase.from('friend_requests').select('id').eq('sender_id', currentUser.id).eq('receiver_id', p.id).eq('status', 'pending').maybeSingle(),
        ]);
        const f = (friends.data ?? []) as { user_id: string; friend_id: string }[];
        const isFriendRow = f.some((row) => row.user_id === p.id || row.friend_id === p.id);
        setIsFriend(isFriendRow);
        setFriendReqSent(!!reqs.data);
      }
      setLoading(false);
    })();
  }, [username, currentUser]);

  const sendFriendRequest = async () => {
    if (!currentUser || !profile) return;
    await supabase.from('friend_requests').insert({ sender_id: currentUser.id, receiver_id: profile.id });
    setFriendReqSent(true);
    toast.success('Friend request sent');
  };

  if (loading) {
    return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <p className="font-medium">User not found</p>
          <Button asChild className="mt-4"><Link href="/discover">Discover writers</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const isOwn = currentUser?.id === profile.id;

  return (
    <div className="space-y-6">
      {/* Cover + header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative h-40 bg-gradient-to-br from-brand-400 to-brand-600 sm:h-48">
          {profile.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.cover_url} alt="Cover" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="px-4 pb-6 sm:px-6">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
              <Avatar className="h-24 w-24 border-4 border-card shadow-soft">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.username ?? ''} />}
                <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                  {(profile.username ?? profile.full_name ?? '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="pb-1">
                <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                  {profile.full_name ?? profile.username}
                </h1>
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {isOwn ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/profile/edit">Edit profile</Link>
                </Button>
              ) : isFriend ? (
                <Badge variant="secondary" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Friends</Badge>
              ) : friendReqSent ? (
                <Button variant="outline" size="sm" disabled>Request sent</Button>
              ) : (
                <Button onClick={sendFriendRequest} size="sm" className="gap-2">
                  <Users className="h-4 w-4" /> Add friend
                </Button>
              )}
            </div>
          </div>

          {profile.bio && <p className="mt-4 max-w-2xl text-sm text-foreground">{profile.bio}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {profile.bio && (
              <span className="flex items-center gap-1.5"><Info className="h-4 w-4" /> {profile.bio}</span>
            )}
            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Joined {formatDate(profile.join_date)}</span>
            {profile.streak > 0 && (
              <span className="flex items-center gap-1.5 text-gold-600 dark:text-gold-300"><Flame className="h-4 w-4" /> {profile.streak} day streak</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile icon={BookOpen} label="Journals" value={stats.journalCount} />
          <StatTile icon={Globe} label="Public" value={stats.publicJournalCount} />
          <StatTile icon={ActivityIcon} label="Activities" value={stats.activityCount} />
          <StatTile icon={Users} label="Friends" value={stats.friendCount} />
          <StatTile icon={Heart} label="Likes" value={stats.likesReceived} />
          <StatTile icon={MessageCircle} label="Comments" value={stats.commentsReceived} />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="journals">
        <TabsList>
          <TabsTrigger value="journals" className="gap-2"><BookOpen className="h-4 w-4" /> Journals</TabsTrigger>
          <TabsTrigger value="activities" className="gap-2"><ActivityIcon className="h-4 w-4" /> Activities</TabsTrigger>
          <TabsTrigger value="about" className="gap-2"><Info className="h-4 w-4" /> About</TabsTrigger>
        </TabsList>

        <TabsContent value="journals" className="mt-4 space-y-4">
          {journals.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No public journals yet.</CardContent></Card>
          ) : (
            journals.map((j) => (
              <Link key={j.id} href={`/journal/${j.id}`}>
                <Card className="group transition-all hover:shadow-soft-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{formatDate(j.journal_date)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="prose-journal line-clamp-3 text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(combineJournalText(j).slice(0, 280)) }}
                    />
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{readingTime(combineJournalText(j))} min read</span>
                      {j.tags?.filter((t) => t !== 'pinned' && t !== 'archived').map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="activities" className="mt-4 space-y-3">
          {activities.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No activities yet.</CardContent></Card>
          ) : (
            activities.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.start_time)} · {new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {a.is_completed && <Badge variant="secondary">Done</Badge>}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="about" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="mb-1 text-sm font-semibold text-muted-foreground">Bio</h3>
                <p className="text-sm">{profile.bio ?? 'No bio yet.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h3 className="mb-1 font-semibold text-muted-foreground">Joined</h3>
                  <p>{formatDate(profile.join_date)}</p>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-muted-foreground">Longest streak</h3>
                  <p>{profile.longest_streak} days</p>
                </div>
              </div>
              {stats && (
                <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-4">
                  <div className="flex items-center gap-2"><Timer className="h-4 w-4 text-muted-foreground" /> {Math.round(stats.totalStudyMinutes / 60)}h studied</div>
                  <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" /> {stats.journalCount} journals</div>
                  <div className="flex items-center gap-2"><Heart className="h-4 w-4 text-muted-foreground" /> {stats.likesReceived} likes</div>
                  <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-muted-foreground" /> {stats.commentsReceived} comments</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <Icon className="mx-auto mb-1.5 h-5 w-5 text-primary" />
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
