'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Journal, Profile, JournalLike, JournalComment } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Bookmark, Clock, Compass, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';
import { renderMarkdown } from '@/lib/markdown';
import { readingTime, combineJournalText, relativeTime, formatDate } from '@/lib/journal-utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';

type DiscoverItem = Journal & {
  author: Profile;
  like_count: number;
  comment_count: number;
  score: number;
};

type FeedMode = 'meaningful' | 'recent' | 'top';

const PREVIEW_LENGTH = 280;

export default function DiscoverPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<FeedMode>('meaningful');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [saves, setSaves] = useState<Set<string>>(new Set());

  const loadFeed = useCallback(async () => {
    setLoading(true);
    const { data: journals } = await supabase
      .from('journals')
      .select('*, author:profiles!journals_user_id_fkey(*)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!journals) { setLoading(false); return; }

    const journalIds = journals.map((j) => j.id);
    const [likesData, commentsData, myLikes, mySaves] = await Promise.all([
      supabase.from('journal_likes').select('journal_id').in('journal_id', journalIds),
      supabase.from('journal_comments').select('journal_id').in('journal_id', journalIds),
      user ? supabase.from('journal_likes').select('journal_id').eq('user_id', user.id).in('journal_id', journalIds) : Promise.resolve({ data: [] }),
      user ? supabase.from('journal_saves').select('journal_id').eq('user_id', user.id).in('journal_id', journalIds) : Promise.resolve({ data: [] }),
    ]);

    const likeMap = new Map<string, number>();
    (likesData.data as JournalLike[] | null)?.forEach((l) => likeMap.set(l.journal_id, (likeMap.get(l.journal_id) ?? 0) + 1));
    const commentMap = new Map<string, number>();
    (commentsData.data as JournalComment[] | null)?.forEach((c) => commentMap.set(c.journal_id, (commentMap.get(c.journal_id) ?? 0) + 1));

    const scored: DiscoverItem[] = journals.map((j) => {
      const likeCount = likeMap.get(j.id) ?? 0;
      const commentCount = commentMap.get(j.id) ?? 0;
      const textLen = combineJournalText(j as Journal).length;
      const ageHours = (Date.now() - new Date(j.created_at).getTime()) / (1000 * 60 * 60);
      const readTime = readingTime(combineJournalText(j as Journal));

      // 35% engagement quality — ratio of meaningful interactions (comments weighted 2x likes)
      const engagementQuality = (likeCount + commentCount * 2) / Math.max(1, textLen / 500);
      // 30% recency — exponential decay over 7 days
      const recencyScore = Math.exp(-ageHours / (24 * 7));
      // 20% reading completion — longer, well-structured entries score higher (capped)
      const readingScore = Math.min(1, readTime / 5);
      // 15% social interaction — total interaction volume
      const socialScore = Math.log1p(likeCount + commentCount) / Math.log1p(50);

      const score = engagementQuality * 0.35 + recencyScore * 0.30 + readingScore * 0.20 + socialScore * 0.15;

      return {
        ...(j as Journal),
        author: (j as unknown as { author: Profile }).author,
        like_count: likeCount,
        comment_count: commentCount,
        score,
      };
    });

    if (mode === 'meaningful') scored.sort((a, b) => b.score - a.score);
    else if (mode === 'recent') scored.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (mode === 'top') scored.sort((a, b) => b.like_count + b.comment_count * 2 - (a.like_count + a.comment_count * 2));

    setItems(scored);
    setLikes(new Set((myLikes.data as { journal_id: string }[] | null)?.map((l) => l.journal_id) ?? []));
    setSaves(new Set((mySaves.data as { journal_id: string }[] | null)?.map((s) => s.journal_id) ?? []));
    setLoading(false);
  }, [mode, user]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const toggleLike = async (journalId: string) => {
    if (!user) return;
    if (likes.has(journalId)) {
      await supabase.from('journal_likes').delete().eq('journal_id', journalId).eq('user_id', user.id);
      setLikes((s) => { const n = new Set(s); n.delete(journalId); return n; });
      setItems((arr) => arr.map((i) => i.id === journalId ? { ...i, like_count: i.like_count - 1 } : i));
    } else {
      await supabase.from('journal_likes').insert({ journal_id: journalId, user_id: user.id });
      setLikes((s) => { const n = new Set(s); n.add(journalId); return n; });
      setItems((arr) => arr.map((i) => i.id === journalId ? { ...i, like_count: i.like_count + 1 } : i));
      const target = items.find((i) => i.id === journalId);
      if (target && target.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: target.user_id, type: 'like', title: 'New like',
          body: 'Someone liked your journal', data: { journal_id: journalId },
        });
      }
    }
  };

  const toggleSave = async (journalId: string) => {
    if (!user) return;
    if (saves.has(journalId)) {
      await supabase.from('journal_saves').delete().eq('journal_id', journalId).eq('user_id', user.id);
      setSaves((s) => { const n = new Set(s); n.delete(journalId); return n; });
    } else {
      await supabase.from('journal_saves').insert({ journal_id: journalId, user_id: user.id });
      setSaves((s) => { const n = new Set(s); n.add(journalId); return n; });
      toast.success('Saved to your collection');
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
          <Compass className="h-6 w-6 text-primary" /> Discover
        </h1>
        <p className="text-sm text-muted-foreground">Meaningful writing, not just viral content. Find journals worth reading.</p>
      </div>

      {/* Feed mode selector */}
      <div className="flex gap-2">
        <FeedTab active={mode === 'meaningful'} onClick={() => setMode('meaningful')} icon={Sparkles} label="Meaningful" />
        <FeedTab active={mode === 'recent'} onClick={() => setMode('recent')} icon={Clock} label="Recent" />
        <FeedTab active={mode === 'top'} onClick={() => setMode('top')} icon={TrendingUp} label="Top" />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Compass className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No journals to discover yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Share your journal publicly to contribute to the community.</p>
            <Button asChild className="mt-4"><Link href="/today">Write a journal</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <DiscoverCard
              key={item.id}
              item={item}
              expanded={expanded.has(item.id)}
              hasLiked={likes.has(item.id)}
              hasSaved={saves.has(item.id)}
              onExpand={() => toggleExpand(item.id)}
              onLike={() => toggleLike(item.id)}
              onSave={() => toggleSave(item.id)}
            />
          ))}
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
        active ? 'bg-primary text-primary-foreground shadow-soft' : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border',
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function DiscoverCard({ item, expanded, hasLiked, hasSaved, onExpand, onLike, onSave }: {
  item: DiscoverItem;
  expanded: boolean;
  hasLiked: boolean;
  hasSaved: boolean;
  onExpand: () => void;
  onLike: () => void;
  onSave: () => void;
}) {
  const fullText = combineJournalText(item);
  const isLong = fullText.length > PREVIEW_LENGTH;
  const displayText = expanded || !isLong ? fullText : fullText.slice(0, PREVIEW_LENGTH);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-soft-lg">
      <CardHeader className="pb-3">
        <Link href={`/profile/${item.author?.username ?? ''}`} className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {item.author?.avatar_url && <AvatarImage src={item.author.avatar_url} alt={item.author.username ?? ''} />}
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {(item.author?.username ?? item.author?.full_name ?? '?').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{item.author?.full_name ?? item.author?.username}</p>
            <p className="text-xs text-muted-foreground">@{item.author?.username} · {relativeTime(item.created_at)}</p>
          </div>
        </Link>
      </CardHeader>
      <CardContent>
        <Link href={`/journal/${item.id}`}>
          <h3 className="mb-2 font-display text-lg font-semibold tracking-tight">
            {formatDate(item.journal_date, { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
        </Link>
        <div
          className={cn('prose-journal text-[15px] transition-all', !expanded && isLong && 'max-h-40 overflow-hidden')}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(displayText) }}
        />
        {isLong && (
          <button
            onClick={onExpand}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {expanded ? 'Show less' : 'Read more'} <ArrowRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
          </button>
        )}

        {item.tags && item.tags.filter((t) => t !== 'pinned' && t !== 'archived').length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.filter((t) => t !== 'pinned' && t !== 'archived').slice(0, 5).map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">#{t}</Badge>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-1">
            <Button variant={hasLiked ? 'default' : 'ghost'} size="sm" onClick={onLike} className="gap-1.5">
              <Heart className={cn('h-4 w-4', hasLiked && 'fill-current')} /> {item.like_count}
            </Button>
            <Button variant="ghost" size="sm" asChild className="gap-1.5">
              <Link href={`/journal/${item.id}`}><MessageCircle className="h-4 w-4" /> {item.comment_count}</Link>
            </Button>
            <Button variant={hasSaved ? 'default' : 'ghost'} size="sm" onClick={onSave}>
              <Bookmark className={cn('h-4 w-4', hasSaved && 'fill-current')} />
            </Button>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {readingTime(fullText)} min
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
