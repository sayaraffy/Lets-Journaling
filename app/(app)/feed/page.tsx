'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { useI18n } from '@/components/providers/i18n-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Heart, MessageCircle, Bookmark, Sparkles, Globe, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Journal, Profile, JournalLike, JournalSave, JournalComment } from '@/lib/types';

type FeedJournal = Journal & { profiles: Profile };
type CommentWithProfile = JournalComment & { profiles: Pick<Profile, 'username' | 'avatar_url'> };

export default function FeedPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [journals, setJournals] = useState<FeedJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [saves, setSaves] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, CommentWithProfile[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentInput, setCommentInput] = useState('');
  const [posting, setPosting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('journals')
      .select('*, profiles!journals_user_id_fkey(*)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(50);
    setJournals((data as FeedJournal[]) ?? []);

    const [myLikes, mySaves, allLikes, myComments] = await Promise.all([
      supabase.from('journal_likes').select('journal_id').eq('user_id', user.id),
      supabase.from('journal_saves').select('journal_id').eq('user_id', user.id),
      supabase.from('journal_likes').select('journal_id'),
      supabase.from('journal_comments').select('journal_id'),
    ]);
    setLikes(new Set((myLikes.data as JournalLike[])?.map((l) => l.journal_id) ?? []));
    setSaves(new Set((mySaves.data as JournalSave[])?.map((s) => s.journal_id) ?? []));
    const lc: Record<string, number> = {};
    (allLikes.data as JournalLike[] | null)?.forEach((l) => { lc[l.journal_id] = (lc[l.journal_id] ?? 0) + 1; });
    setLikeCounts(lc);
    const cc: Record<string, number> = {};
    (myComments.data as { journal_id: string }[] | null)?.forEach((c) => { cc[c.journal_id] = (cc[c.journal_id] ?? 0) + 1; });
    setCommentCounts(cc);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggleLike = async (j: Journal) => {
    if (!user) return;
    const liked = likes.has(j.id);
    if (liked) {
      await supabase.from('journal_likes').delete().eq('journal_id', j.id).eq('user_id', user.id);
      setLikes((s) => { const n = new Set(s); n.delete(j.id); return n; });
      setLikeCounts((c) => ({ ...c, [j.id]: Math.max(0, (c[j.id] ?? 1) - 1) }));
    } else {
      await supabase.from('journal_likes').insert({ journal_id: j.id, user_id: user.id });
      setLikes((s) => { const n = new Set(s); n.add(j.id); return n; });
      setLikeCounts((c) => ({ ...c, [j.id]: (c[j.id] ?? 0) + 1 }));
    }
  };

  const toggleSave = async (j: Journal) => {
    if (!user) return;
    const saved = saves.has(j.id);
    if (saved) {
      await supabase.from('journal_saves').delete().eq('journal_id', j.id).eq('user_id', user.id);
      setSaves((s) => { const n = new Set(s); n.delete(j.id); return n; });
    } else {
      await supabase.from('journal_saves').insert({ journal_id: j.id, user_id: user.id });
      setSaves((s) => { const n = new Set(s); n.add(j.id); return n; });
      toast.success('Saved');
    }
  };

  const toggleComments = async (j: Journal) => {
    const isOpen = openComments.has(j.id);
    if (isOpen) {
      setOpenComments((s) => { const n = new Set(s); n.delete(j.id); return n; });
      return;
    }
    setOpenComments((s) => { const n = new Set(s); n.add(j.id); return n; });
    if (!comments[j.id]) {
      const { data } = await supabase
        .from('journal_comments')
        .select('*, profiles!journal_comments_user_id_fkey(username, avatar_url)')
        .eq('journal_id', j.id)
        .order('created_at', { ascending: true });
      setComments((c) => ({ ...c, [j.id]: (data as CommentWithProfile[]) ?? [] }));
    }
  };

  const postComment = async (j: Journal) => {
    if (!user || !commentInput.trim()) return;
    setPosting(j.id);
    const body = commentInput.trim();
    const { data, error } = await supabase
      .from('journal_comments')
      .insert({ journal_id: j.id, user_id: user.id, body })
      .select('*, profiles!journal_comments_user_id_fkey(username, avatar_url)')
      .single();
    if (error) {
      toast.error('Failed to post comment');
      setPosting(null);
      return;
    }
    setComments((c) => ({ ...c, [j.id]: [...(c[j.id] ?? []), data as CommentWithProfile] }));
    setCommentCounts((cc) => ({ ...cc, [j.id]: (cc[j.id] ?? 0) + 1 }));
    setCommentInput('');
    setPosting(null);
  };

  const shareJournal = async (j: Journal) => {
    const url = `${window.location.origin}/journal?date=${j.journal_date}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Check out this journal', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      }
    } catch {
      // user cancelled share
    }
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse-soft rounded-2xl bg-muted" />)}</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border-brand-300/40 bg-gradient-to-r from-brand-50/50 to-card dark:from-brand-900/10">
        <CardContent className="flex items-center gap-3 py-4">
          <Globe className="h-5 w-5 text-brand-600" />
          <p className="text-sm text-muted-foreground">
            {t('feed.title')} — {t('feed.empty.desc')}
          </p>
        </CardContent>
      </Card>

      {journals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
              <Sparkles className="h-7 w-7 text-brand-500" />
            </div>
            <p className="font-medium">{t('feed.empty')}</p>
            <p className="text-sm text-muted-foreground">{t('feed.empty.desc')}</p>
          </CardContent>
        </Card>
      ) : (
        journals.map((j) => (
          <Card key={j.id} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {j.profiles?.avatar_url ? <img src={j.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                  <AvatarFallback className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    {(j.profiles?.username ?? '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{j.profiles?.username ?? 'Anonymous'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(j.journal_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                {j.tags?.slice(0, 3).map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
              </div>

              <div className="space-y-2 text-sm">
                {j.what_happened && <p><span className="font-medium">What happened:</span> <span className="text-muted-foreground">{j.what_happened}</span></p>}
                {j.grateful_for && <p><span className="font-medium">Grateful for:</span> <span className="text-muted-foreground">{j.grateful_for}</span></p>}
                {j.free_notes && <p className="whitespace-pre-wrap text-muted-foreground">{j.free_notes}</p>}
                {j.motivation_quote && <p className="border-l-2 border-gold-400 pl-3 font-display italic text-foreground/80">&ldquo;{j.motivation_quote}&rdquo;</p>}
              </div>

              <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
                <Button variant="ghost" size="sm" onClick={() => toggleLike(j)} className={cn('gap-1.5', likes.has(j.id) && 'text-destructive')}>
                  <Heart className={cn('h-4 w-4', likes.has(j.id) && 'fill-current')} /> {likeCounts[j.id] ?? 0}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleComments(j)} className={cn('gap-1.5', openComments.has(j.id) && 'text-brand-600')}>
                  <MessageCircle className="h-4 w-4" /> {commentCounts[j.id] ?? 0}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => shareJournal(j)} className="gap-1.5">
                  <Send className="h-4 w-4" /> {t('feed.share')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleSave(j)} className={cn('ml-auto gap-1.5', saves.has(j.id) && 'text-gold-500')}>
                  <Bookmark className={cn('h-4 w-4', saves.has(j.id) && 'fill-current')} /> Save
                </Button>
              </div>

              {openComments.has(j.id) && (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  {(comments[j.id] ?? []).map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <Avatar className="h-7 w-7">
                        {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                        <AvatarFallback className="bg-muted text-xs">{(c.profiles?.username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                        <p className="text-xs font-medium">{c.profiles?.username ?? 'Anonymous'}</p>
                        <p className="text-sm text-foreground/90">{c.body}</p>
                      </div>
                    </div>
                  ))}
                  {(comments[j.id] ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No comments yet.</p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={j.id === posting ? '' : commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder={t('feed.add_comment')}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(j); } }}
                      disabled={posting === j.id}
                    />
                    <Button size="sm" onClick={() => postComment(j)} disabled={posting === j.id || !commentInput.trim()}>
                      {posting === j.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
