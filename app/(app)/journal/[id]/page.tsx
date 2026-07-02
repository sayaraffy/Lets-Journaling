'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Journal, JournalComment, JournalLike, Profile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Heart, MessageCircle, Bookmark, Lock, Users, Globe, Edit3, Trash2, Clock } from 'lucide-react';
import { renderMarkdown } from '@/lib/markdown';
import { readingTime, combineJournalText, formatDate, relativeTime } from '@/lib/journal-utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

const visibilityIcons = { private: Lock, friends: Users, public: Globe };
const fields = [
  { key: 'what_happened', label: 'What happened today?' },
  { key: 'what_i_learned', label: 'What did I learn?' },
  { key: 'what_to_improve', label: 'What can I improve?' },
  { key: 'grateful_for', label: 'What am I grateful for?' },
  { key: 'free_notes', label: 'Free notes' },
] as const;

export default function JournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [likes, setLikes] = useState<JournalLike[]>([]);
  const [comments, setComments] = useState<(JournalComment & { author: Profile })[]>([]);
  const [saved, setSaved] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: j }, { data: likesData }, { data: commentsData }, { data: savedData }] = await Promise.all([
        supabase.from('journals').select('*').eq('id', id).maybeSingle(),
        supabase.from('journal_likes').select('*, user:profiles!journal_likes_user_id_fkey(*)').eq('journal_id', id).order('created_at', { ascending: false }),
        supabase.from('journal_comments').select('*, author:profiles!journal_comments_user_id_fkey(*)').eq('journal_id', id).order('created_at', { ascending: false }),
        user ? supabase.from('journal_saves').select('id').eq('journal_id', id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setJournal(j as Journal | null);
      if (j) {
        const { data: a } = await supabase.from('profiles').select('*').eq('id', (j as Journal).user_id).maybeSingle();
        setAuthor(a as Profile | null);
      }
      setLikes((likesData as JournalLike[]) ?? []);
      setComments((commentsData as (JournalComment & { author: Profile })[]) ?? []);
      setSaved(!!savedData);
      setHasLiked(likesData?.some((l) => (l as JournalLike).user_id === user?.id) ?? false);
      setLoading(false);
    })();
  }, [id, user]);

  const toggleLike = async () => {
    if (!user || !journal) return;
    if (hasLiked) {
      await supabase.from('journal_likes').delete().eq('journal_id', journal.id).eq('user_id', user.id);
      setLikes(likes.filter((l) => l.user_id !== user.id));
      setHasLiked(false);
    } else {
      const { data } = await supabase.from('journal_likes').insert({ journal_id: journal.id, user_id: user.id }).select().single();
      if (data) {
        setLikes([data as JournalLike, ...likes]);
        setHasLiked(true);
        if (journal.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: journal.user_id,
            type: 'like',
            title: 'New like',
            body: 'Someone liked your journal',
            data: { journal_id: journal.id },
          });
        }
      }
    }
  };

  const toggleSave = async () => {
    if (!user || !journal) return;
    if (saved) {
      await supabase.from('journal_saves').delete().eq('journal_id', journal.id).eq('user_id', user.id);
      setSaved(false);
      toast.success('Removed from saved');
    } else {
      await supabase.from('journal_saves').insert({ journal_id: journal.id, user_id: user.id });
      setSaved(true);
      toast.success('Saved');
    }
  };

  const postComment = async () => {
    if (!user || !journal || !commentBody.trim()) return;
    setPosting(true);
    const { data } = await supabase
      .from('journal_comments')
      .insert({ journal_id: journal.id, user_id: user.id, body: commentBody.trim() })
      .select('*, author:profiles!journal_comments_user_id_fkey(*)')
      .single();
    if (data) {
      setComments([data as (JournalComment & { author: Profile }), ...comments]);
      setCommentBody('');
      if (journal.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: journal.user_id,
          type: 'comment',
          title: 'New comment',
          body: commentBody.trim().slice(0, 80),
          data: { journal_id: journal.id },
        });
      }
    }
    setPosting(false);
  };

  const deleteJournal = async () => {
    if (!journal || journal.user_id !== user?.id) return;
    if (!confirm('Delete this journal? This cannot be undone.')) return;
    await supabase.from('journals').delete().eq('id', journal.id);
    toast.success('Journal deleted');
    router.push('/journal');
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  }

  if (!journal) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <p className="font-medium">Journal not found</p>
          <Button asChild className="mt-4"><Link href="/journal">Back to journals</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const isOwner = journal.user_id === user?.id;
  const VisIcon = visibilityIcons[journal.visibility];
  const text = combineJournalText(journal);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="fixed left-0 top-16 z-20 h-1 bg-primary transition-all duration-150" style={{ width: `${progress}%` }} />

      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {isOwner && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link href={`/journal/${journal.id}?edit=1`}><Edit3 className="h-4 w-4" /> Edit</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={deleteJournal} className="gap-2 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <article className="rounded-2xl border border-border bg-card p-6 sm:p-10">
        {/* Header */}
        <div className="mb-8 border-b border-border pb-6">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <VisIcon className="h-3 w-3" /> {journal.visibility}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {readingTime(text)} min read
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {formatDate(journal.journal_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h1>
          {author && (
            <Link href={`/profile/${author.username ?? ''}`} className="mt-4 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {author.avatar_url && <AvatarImage src={author.avatar_url} alt={author.username ?? ''} />}
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {(author.username ?? author.full_name ?? '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{author.full_name ?? author.username}</p>
                <p className="text-xs text-muted-foreground">@{author.username} · {relativeTime(journal.created_at)}</p>
              </div>
            </Link>
          )}
        </div>

        {/* Body — comfortable reading */}
        <div className="reading-content space-y-8">
          {fields.map((f) => {
            const val = (journal as unknown as Record<string, string | null>)[f.key];
            if (!val?.trim()) return null;
            return (
              <section key={f.key}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</h2>
                <div className="prose-journal" dangerouslySetInnerHTML={{ __html: renderMarkdown(val) }} />
              </section>
            );
          })}
          {journal.motivation_quote?.trim() && (
            <blockquote className="border-l-2 border-primary pl-4 text-base italic text-muted-foreground">
              {journal.motivation_quote}
            </blockquote>
          )}
          {journal.tags && journal.tags.filter((t) => t !== 'pinned' && t !== 'archived').length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4">
              {journal.tags.filter((t) => t !== 'pinned' && t !== 'archived').map((t) => (
                <Badge key={t} variant="secondary">#{t}</Badge>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* Engagement bar */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button variant={hasLiked ? 'default' : 'ghost'} size="sm" onClick={toggleLike} className="gap-2">
          <Heart className={cn('h-4 w-4', hasLiked && 'fill-current')} /> {likes.length}
        </Button>
        <Button variant="ghost" size="sm" className="gap-2">
          <MessageCircle className="h-4 w-4" /> {comments.length}
        </Button>
        <Button variant={saved ? 'default' : 'ghost'} size="sm" onClick={toggleSave} className="gap-2">
          <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} />
        </Button>
      </div>

      {/* Comments */}
      <div className="mt-6 space-y-4">
        <h2 className="font-display text-lg font-semibold">Comments ({comments.length})</h2>
        {user && (
          <div className="flex gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              {user.user_metadata?.avatar_url && <AvatarImage src={user.user_metadata.avatar_url} alt="" />}
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a thoughtful comment…"
                className="min-h-[80px] resize-y"
              />
              <Button onClick={postComment} disabled={posting || !commentBody.trim()} size="sm">
                {posting ? 'Posting…' : 'Post comment'}
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 rounded-xl border border-border bg-card p-4">
              <Avatar className="h-9 w-9 shrink-0">
                {c.author?.avatar_url && <AvatarImage src={c.author.avatar_url} alt={c.author.username ?? ''} />}
                <AvatarFallback className="bg-muted text-sm font-semibold">
                  {(c.author?.username ?? c.author?.full_name ?? '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <Link href={`/profile/${c.author?.username ?? ''}`} className="text-sm font-medium hover:underline">
                    {c.author?.full_name ?? c.author?.username}
                  </Link>
                  <span className="text-xs text-muted-foreground">{relativeTime(c.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">{c.body}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
          )}
        </div>
      </div>
    </div>
  );
}
