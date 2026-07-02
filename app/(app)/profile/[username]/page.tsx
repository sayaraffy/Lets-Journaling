'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { useI18n } from '@/components/providers/i18n-provider';
import type { Journal, Activity, Profile } from '@/lib/types';
import { fetchProfileStats, fetchUserJournals, fetchUserActivities, type ProfileStats } from '@/lib/profile-data';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, CheckCircle2, Timer, Flame, Info, Calendar, Users, ArrowLeft } from 'lucide-react';
import { formatDate, relativeTime, readingTime, combineJournalText } from '@/lib/journal-utils';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const { t } = useI18n();
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

      // Get streak from profile
      const profileData = p as Profile;
      setStats({ ...s, currentStreak: profileData.streak ?? 0 });
      setJournals(j);
      setActivities(a);

      if (currentUser && currentUser.id !== p.id) {
        const [friends, reqs] = await Promise.all([
          supabase.from('friends').select('user_id, friend_id').or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`).limit(1),
          supabase.from('friend_requests').select('id').eq('sender_id', currentUser.id).eq('receiver_id', p.id).eq('status', 'pending').maybeSingle(),
        ]);
        const f = (friends.data ?? []) as { user_id: string; friend_id: string }[];
        setIsFriend(f.some((row) => row.user_id === p.id || row.friend_id === p.id));
        setFriendReqSent(!!reqs.data);
      }
      setLoading(false);
    })();
  }, [username, currentUser]);

  const sendFriendRequest = async () => {
    if (!currentUser || !profile) return;
    await supabase.from('friend_requests').insert({ sender_id: currentUser.id, receiver_id: profile.id });
    await supabase.from('notifications').insert({
      user_id: profile.id, type: 'friend_request', title: t('notif.friend_request_title'),
      body: t('notif.friend_request_body'), data: { sender_id: currentUser.id },
    });
    setFriendReqSent(true);
    toast.success(t('friends.request_sent'));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <p className="font-medium">{t('profile.not_found')}</p>
          <Button asChild className="mt-4"><Link href="/discover">{t('discover.title')}</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const isOwn = currentUser?.id === profile.id;
  const studyHours = stats ? Math.floor(stats.totalStudyMinutes / 60) : 0;
  const studyMins = stats ? stats.totalStudyMinutes % 60 : 0;

  return (
    <div className="space-y-6">
      {/* Cover + header — modern style */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative h-36 bg-gradient-to-br from-teal-500 to-teal-700 sm:h-44">
          {profile.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.cover_url} alt="Cover" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
              <Avatar className="h-24 w-24 border-4 border-card shadow-soft">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.username ?? ''} />}
                <AvatarFallback className="bg-teal-500/10 text-2xl font-semibold text-teal-600">
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
                  <Link href="/profile/edit">{t('profile.edit')}</Link>
                </Button>
              ) : isFriend ? (
                <Badge variant="secondary" className="gap-1.5"><Users className="h-3.5 w-3.5" /> {t('profile.friends')}</Badge>
              ) : friendReqSent ? (
                <Button variant="outline" size="sm" disabled>{t('profile.request_sent')}</Button>
              ) : (
                <Button onClick={sendFriendRequest} size="sm" className="gap-2">
                  <Users className="h-4 w-4" /> {t('profile.add_friend')}
                </Button>
              )}
            </div>
          </div>

          {profile.bio && <p className="mt-4 max-w-2xl text-sm text-foreground">{profile.bio}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {t('profile.joined')} {formatDate(profile.join_date)}</span>
            {stats && stats.currentStreak > 0 && (
              <span className="flex items-center gap-1.5 text-orange-500"><Flame className="h-4 w-4" /> {stats.currentStreak} {t('stats.day_streak')}</span>
            )}
          </div>
        </div>
      </div>

      {/* 4 stats only — colored icons */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={BookOpen} label={t('profile.journals')} value={stats.journalCount} color="text-blue-500" bg="bg-blue-500/10" />
          <StatTile icon={CheckCircle2} label={t('profile.activities_completed')} value={stats.activityCompletedCount} color="text-green-500" bg="bg-green-500/10" />
          <StatTile icon={Timer} label={t('profile.study_time')} value={studyHours > 0 ? `${studyHours}h ${studyMins}m` : `${studyMins}m`} color="text-purple-500" bg="bg-purple-500/10" />
          <StatTile icon={Flame} label={t('profile.streak')} value={stats.currentStreak} color="text-orange-500" bg="bg-orange-500/10" />
        </div>
      )}

      {/* Tabs — Journals, Activities, About */}
      <Tabs defaultValue="journals">
        <TabsList>
          <TabsTrigger value="journals" className="gap-2"><BookOpen className="h-4 w-4" /> {t('profile.journals')}</TabsTrigger>
          <TabsTrigger value="activities" className="gap-2"><CheckCircle2 className="h-4 w-4" /> {t('profile.activities')}</TabsTrigger>
          <TabsTrigger value="about" className="gap-2"><Info className="h-4 w-4" /> {t('profile.about')}</TabsTrigger>
        </TabsList>

        {/* Journals tab */}
        <TabsContent value="journals" className="mt-4 space-y-3">
          {journals.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t('profile.no_journals')}</CardContent></Card>
          ) : (
            journals.map((j) => {
              const text = combineJournalText(j);
              return (
                <Link key={j.id} href={`/journal/${j.id}`}>
                  <Card className="group transition-all hover:shadow-soft-lg">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-semibold">{formatDate(j.journal_date)}</span>
                        <Badge variant="outline" className="text-xs capitalize">{j.visibility}</Badge>
                      </div>
                      <div
                        className="prose-journal line-clamp-3 text-sm text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(text.slice(0, 280)) }}
                      />
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{readingTime(text)} {t('journal.reading_time')}</span>
                        {j.tags?.filter((tag) => tag !== 'pinned' && tag !== 'archived').slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </TabsContent>

        {/* Activities tab */}
        <TabsContent value="activities" className="mt-4 space-y-2">
          {activities.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t('profile.no_activities')}</CardContent></Card>
          ) : (
            activities.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.start_time)} · {new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {a.is_completed && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {t('activities.done')}</Badge>}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* About tab */}
        <TabsContent value="about" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="mb-1 text-sm font-semibold text-muted-foreground">{t('profile.bio')}</h3>
                <p className="text-sm">{profile.bio ?? t('profile.no_bio')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h3 className="mb-1 font-semibold text-muted-foreground">{t('profile.joined')}</h3>
                  <p>{formatDate(profile.join_date)}</p>
                </div>
              </div>
              {stats && (
                <div className="border-t border-border pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('profile.stats')}</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-blue-500" /> {stats.journalCount} {t('profile.journals')}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" /> {stats.activityCompletedCount} {t('profile.activities_completed')}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4 text-purple-500" /> {studyHours > 0 ? `${studyHours}h ${studyMins}m` : `${studyMins}m`}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Flame className="h-4 w-4 text-orange-500" /> {stats.currentStreak} {t('stats.days')}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color, bg }: { icon: typeof BookOpen; label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', bg)}>
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-semibold leading-tight">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
