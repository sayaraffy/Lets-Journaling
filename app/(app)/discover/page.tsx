'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Flame, BookHeart, Heart, MessageCircle, TrendingUp, Users, Sparkles } from 'lucide-react';
import type { Profile, Journal, JournalLike } from '@/lib/types';

type TrendingJournal = Journal & { profiles: Profile };

export default function DiscoverPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searched, setSearched] = useState(false);
  const [recommended, setRecommended] = useState<Profile[]>([]);
  const [trending, setTrending] = useState<TrendingJournal[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [uRes, jRes] = await Promise.all([
        supabase.from('profiles').select('*').order('streak', { ascending: false }).limit(6),
        supabase.from('journals').select('*, profiles!journals_user_id_fkey(*)').eq('visibility', 'public').order('created_at', { ascending: false }).limit(6),
      ]);
      setRecommended((uRes.data as Profile[]) ?? []);
      const jData = (jRes.data as TrendingJournal[]) ?? [];
      setTrending(jData);
      if (jData.length > 0) {
        const ids = jData.map((j) => j.id);
        const lRes = await supabase.from('journal_likes').select('journal_id').in('journal_id', ids);
        const lc: Record<string, number> = {};
        (lRes.data as JournalLike[] | null)?.forEach((l) => { lc[l.journal_id] = (lc[l.journal_id] ?? 0) + 1; });
        setLikeCounts(lc);
      }
      setLoading(false);
    })();
  }, []);

  const doSearch = useCallback(async () => {
    if (!search.trim()) return;
    setSearched(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${search.trim()}%`)
      .neq('id', user?.id ?? '')
      .limit(12);
    setResults((data as Profile[]) ?? []);
  }, [search, user]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-semibold">Discover</h1>
        <p className="text-sm text-muted-foreground">Find writers, explore trending journals, and grow your community.</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search by username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          className="max-w-md"
        />
        <Button onClick={doSearch} className="gap-2"><Search className="h-4 w-4" /> Search</Button>
      </div>

      {searched && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Search Results ({results.length})</h2>
          {results.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No users found for &ldquo;{search}&rdquo;.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((p) => (
                <Link key={p.id} href={`/profile/${p.username ?? ''}`}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
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
                      {p.streak > 0 && (
                        <Badge variant="outline" className="gap-1 text-xs"><Flame className="h-3 w-3 text-gold-500" /> {p.streak}d</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium"><TrendingUp className="h-4 w-4 text-brand-600" /> Trending Journals</h2>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        ) : trending.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">No public journals yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {trending.map((j) => (
              <Link key={j.id} href={`/journal/${j.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        {j.profiles?.avatar_url ? <img src={j.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                        <AvatarFallback className="bg-muted text-xs">{(j.profiles?.username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{j.profiles?.username ?? 'Anonymous'}</span>
                      <span className="text-xs text-muted-foreground">· {new Date(j.journal_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                    {j.what_happened && <p className="line-clamp-2 text-sm">{j.what_happened}</p>}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {likeCounts[j.id] ?? 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4 text-brand-600" /> Recommended Writers</h2>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : recommended.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">No users to recommend yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((p) => (
              <Link key={p.id} href={`/profile/${p.username ?? ''}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
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
                    {p.streak > 0 && (
                      <Badge variant="outline" className="gap-1 text-xs"><Flame className="h-3 w-3 text-gold-500" /> {p.streak}d</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
