'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { useI18n } from '@/components/providers/i18n-provider';
import type { Journal, Profile, JournalLike, JournalComment, JournalShare } from '@/lib/types';
import { JournalFeedCard } from '@/components/journal/journal-feed-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Compass, Sparkles, Clock, TrendingUp, Users, Flame, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { combineJournalText, relativeTime } from '@/lib/journal-utils';
import Link from 'next/link';

type FeedMode = 'meaningful' | 'recent' | 'top';

type DiscoverItem = Journal & {
  author: Profile;
  like_count: number;
  comment_count: number;
  share_count: number;
  score: number;
};

type TrendingWriter = {
  profile: Profile;
  totalLikes: number;
  totalComments: number;
  journalCount: number;
};

export default function DiscoverPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [trendingWriters, setTrendingWriters] = useState<TrendingWriter[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<FeedMode>('meaningful');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;

  const loadFeed = useCallback(async (resetPage = false) => {
    setLoading(true);
    const currentPage = resetPage ? 0 : page;
    if (resetPage) { setItems([]); setPage(0); }

    const { data: journals } = await supabase
      .from('journals')
      .select('*, author:profiles!journals_user_id_fkey(*)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1 + PAGE_SIZE);

    if (!journals || journals.length === 0) {
      setHasMore(false);
      setLoading(false);
      return;
    }

    const journalIds = journals.map((j) => j.id);
    const [likesData, commentsData, sharesData] = await Promise.all([
      supabase.from('journal_likes').select('journal_id').in('journal_id', journalIds),
      supabase.from('journal_comments').select('journal_id').in('journal_id', journalIds),
      supabase.from('journal_shares').select('journal_id').in('journal_id', journalIds),
    ]);

    const likeMap = new Map<string, number>();
    (likesData.data as JournalLike[] | null)?.forEach((l) => likeMap.set(l.journal_id, (likeMap.get(l.journal_id) ?? 0) + 1));
    const commentMap = new Map<string, number>();
    (commentsData.data as JournalComment[] | null)?.forEach((c) => commentMap.set(c.journal_id, (commentMap.get(c.journal_id) ?? 0) + 1));
    const shareMap = new Map<string, number>();
    (sharesData.data as JournalShare[] | null)?.forEach((s) => shareMap.set(s.journal_id, (shareMap.get(s.journal_id) ?? 0) + 1));

    const scored: DiscoverItem[] = journals.map((j) => {
      const likeCount = likeMap.get(j.id) ?? 0;
      const commentCount = commentMap.get(j.id) ?? 0;
      const shareCount = shareMap.get(j.id) ?? 0;
      const ageHours = (Date.now() - new Date(j.created_at).getTime()) / (1000 * 60 * 60);

      // Trending score: likes×1 + comments×2 + shares×3 + recency bonus
      const baseScore = likeCount * 1 + commentCount * 2 + shareCount * 3;
      const recencyBonus = Math.exp(-ageHours / (24 * 7)); // exponential decay over 7 days
      const score = baseScore * (0.5 + recencyBonus * 0.5);

      return {
        ...(j as Journal),
        author: (j as unknown as { author: Profile }).author,
        like_count: likeCount,
        comment_count: commentCount,
        share_count: shareCount,
        score,
      };
    });

    if (mode === 'meaningful' || mode === 'top') {
      scored.sort((a, b) => b.score - a.score);
    } else {
      scored.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    if (resetPage) {
      setItems(scored);
    } else {
      setItems((prev) => [...prev, ...scored]);
    }
    setHasMore(scored.length >= PAGE_SIZE);
    setLoading(false);
  }, [mode, page]);

  // Load trending writers
  useEffect(() => {
    (async () => {
      const { data: journals } = await supabase
        .from('journals')
        .select('id, user_id')
        .eq('visibility', 'public')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (!journals || journals.length === 0) return;

      const journalIds = journals.map((j) => j.id);
      const [likes, comments, profiles] = await Promise.all([
        supabase.from('journal_likes').select('journal_id').in('journal_id', journalIds),
        supabase.from('journal_comments').select('journal_id').in('journal_id', journalIds),
        supabase.from('profiles').select('*').in('id', Array.from(new Set(journals.map((j) => j.user_id)))).limit(5),
      ]);

      const journalAuthorMap = new Map<string, string>();
      journals.forEach((j) => journalAuthorMap.set(j.id, j.user_id));

      const writerStats = new Map<string, { likes: number; comments: number; count: number }>();
      (likes.data as JournalLike[] | null)?.forEach((l) => {
        const authorId = journalAuthorMap.get(l.journal_id);
        if (authorId) {
          const s = writerStats.get(authorId) ?? { likes: 0, comments: 0, count: 0 };
          s.likes++;
          writerStats.set(authorId, s);
        }
      });
      (comments.data as JournalComment[] | null)?.forEach((c) => {
        const authorId = journalAuthorMap.get(c.journal_id);
        if (authorId) {
          const s = writerStats.get(authorId) ?? { likes: 0, comments: 0, count: 0 };
          s.comments++;
          writerStats.set(authorId, s);
        }
      });
      journals.forEach((j) => {
        const s = writerStats.get(j.user_id) ?? { likes: 0, comments: 0, count: 0 };
        s.count++;
        writerStats.set(j.user_id, s);
      });

      const writers: TrendingWriter[] = (profiles.data as Profile[] | null)?.map((p) => ({
        profile: p,
        totalLikes: writerStats.get(p.id)?.likes ?? 0,
        totalComments: writerStats.get(p.id)?.comments ?? 0,
        journalCount: writerStats.get(p.id)?.count ?? 0,
      })).sort((a, b) => (b.totalLikes + b.totalComments * 2) - (a.totalLikes + a.totalComments * 2)) ?? [];

      setTrendingWriters(writers);
    })();
  }, []);

  useEffect(() => { loadFeed(true); }, [mode]);

  const loadMore = () => {
    setPage((p) => p + 1);
    loadFeed(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
          <Compass className="h-6 w-6 text-teal-600" /> {t('discover.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('discover.subtitle')}</p>
      </div>

      {/* Feed mode selector */}
      <div className="flex gap-2">
        <FeedTab active={mode === 'meaningful'} onClick={() => setMode('meaningful')} icon={Sparkles} label={t('discover.meaningful')} />
        <FeedTab active={mode === 'recent'} onClick={() => setMode('recent')} icon={Clock} label={t('discover.recent')} />
        <FeedTab active={mode === 'top'} onClick={() => setMode('top')} icon={TrendingUp} label={t('discover.top')} />
      </div>

      {/* Trending writers section */}
      {trendingWriters.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-orange-500" /> {t('discover.trending_writers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-2">
              {trendingWriters.map((w) => (
                <Link key={w.profile.id} href={`/profile/${w.profile.username ?? ''}`} className="flex shrink-0 flex-col items-center gap-1.5">
                  <Avatar className="h-14 w-14">
                    {w.profile.avatar_url && <AvatarImage src={w.profile.avatar_url} alt={w.profile.username ?? ''} />}
                    <AvatarFallback className="bg-teal-500/10 font-semibold text-teal-600">
                      {(w.profile.username ?? '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="max-w-[5rem] truncate text-xs font-medium">{w.profile.full_name ?? w.profile.username}</p>
                  <p className="text-[10px] text-muted-foreground">{w.totalLikes + w.totalComments * 2} {t('discover.engagement')}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feed */}
      {loading && items.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Compass className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">{t('discover.empty')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('discover.empty.desc')}</p>
            <Button asChild className="mt-4"><Link href="/today">{t('journal.write_today')}</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <JournalFeedCard key={item.id} journal={item} author={item.author} />
          ))}
          {hasMore && !loading && (
            <Button variant="outline" onClick={loadMore} className="w-full">
              {t('discover.load_more')}
            </Button>
          )}
          {loading && items.length > 0 && (
            <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          )}
        </div>
      )}
    </div>
  );
}

function FeedTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Sparkles; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
        active ? 'bg-teal-600 text-white shadow-soft' : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border',
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
