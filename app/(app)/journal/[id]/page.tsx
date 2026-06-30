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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Heart, MessageCircle, Send, Bookmark, Loader2, ArrowLeft, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Journal, Profile, JournalLike, JournalComment } from '@/lib/types';

type CommentWithProfile = JournalComment & { profiles: Pick<Profile, 'username' | 'avatar_url'> };

export default function JournalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const journalId = params.id as string;

  const [journal, setJournal] = useState<(Journal & { profiles: Profile }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!journalId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('journals')
      .select('*, profiles!journals_user_id_fkey(*)')
      .eq('id', journalId)
      .maybeSingle();
    if (error || !data) {
      setJournal(null);
      setLoading(false);
      return;
    }
    setJournal(data as Journal & { profiles: Profile });

    if (user) {
      const [myLike, mySave, likeCountRes, commentsRes] = await Promise.all([
        supabase.from('journal_likes').select('id').eq('journal_id', journalId).eq('user_id', user.id).maybeSingle(),
        supabase.from('journal_saves').select('id').eq('journal_id', journalId).eq('user_id', user.id).maybeSingle(),
        supabase.from('journal_likes').select('id', { count: 'exact', head: true }).eq('journal_id', journalId),
        supabase.from('journal_comments').select('*, profiles!journal_comments_user_id_fkey(username, avatar_url)').eq('journal_id', journalId).order('created_at', { ascending: true }),
      ]);
      setLiked(!!myLike.data);
      setSaved(!!mySave.data);
      setLikeCount(likeCountRes.count ?? 0);
      setComments((commentsRes.data as CommentWithProfile[]) ?? []);
    }

    // Load photos for this journal
    const { data: photoData } = await supabase.from('photos').select('storage_path').eq('journal_id', journalId).order('created_at', { ascending: true });
    const urls = (photoData as { storage_path: string }[] | null)?.map((p) =>
      supabase.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl,
    ) ?? [];
    setPhotoUrls(urls);

    setLoading(false);
  }, [journalId, user]);

  useEffect(() => { load(); }, [load]);

  const toggleLike = async () => {
    if (!user || !journal) return;
    if (liked) {
      await supabase.from('journal_likes').delete().eq('journal_id', journal.id).eq('user_id', user.id);
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('journal_likes').insert({ journal_id: journal.id, user_id: user.id });
      setLiked(true);
      setLikeCount((c) => c + 1);
    }
  };

  const toggleSave = async () => {
    if (!user || !journal) return;
    if (saved) {
      await supabase.from('journal_saves').delete().eq('journal_id', journal.id).eq('user_id', user.id);
      setSaved(false);
    } else {
      await supabase.from('journal_saves').insert({ journal_id: journal.id, user_id: user.id });
      setSaved(true);
      toast.success('Saved');
    }
  };

  const postComment = async () => {
    if (!user || !journal || !commentInput.trim()) return;
    setPosting(true);
    const body = commentInput.trim();
    const { data, error } = await supabase
      .from('journal_comments')
      .insert({ journal_id: journal.id, user_id: user.id, body })
      .select('*, profiles!journal_comments_user_id_fkey(username, avatar_url)')
      .single();
    if (error) {
      toast.error('Failed to post comment');
      setPosting(false);
      return;
    }
    setComments((c) => [...c, data as CommentWithProfile]);
    setCommentInput('');
    setPosting(false);
  };

  const share = async () => {
    const url = `${window.location.origin}/journal/${journalId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Check out this journal', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      // cancelled
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!journal) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Globe className="h-12 w-12 text-muted-foreground" />
          <p className="font-medium">Journal not found</p>
          <p className="text-sm text-muted-foreground">It may be private or has been deleted.</p>
          <Button variant="outline" onClick={() => router.push('/feed')}>Back to Feed</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardContent className="p-6">
          <Link href={`/profile/${journal.profiles?.username ?? ''}`}>
            <div className="mb-4 flex cursor-pointer items-center gap-3">
              <Avatar className="h-11 w-11">
                {journal.profiles?.avatar_url ? <img src={journal.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                <AvatarFallback className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  {(journal.profiles?.username ?? '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium hover:underline">{journal.profiles?.username ?? 'Anonymous'}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(journal.journal_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
          </Link>

          <div className="space-y-3 text-sm">
            {journal.what_happened && (
              <div>
                <h3 className="mb-1 font-medium">What happened</h3>
                <p className="text-muted-foreground">{journal.what_happened}</p>
              </div>
            )}
            {journal.what_i_learned && (
              <div>
                <h3 className="mb-1 font-medium">What I learned</h3>
                <p className="text-muted-foreground">{journal.what_i_learned}</p>
              </div>
            )}
            {journal.what_to_improve && (
              <div>
                <h3 className="mb-1 font-medium">What to improve</h3>
                <p className="text-muted-foreground">{journal.what_to_improve}</p>
              </div>
            )}
            {journal.grateful_for && (
              <div>
                <h3 className="mb-1 font-medium">Grateful for</h3>
                <p className="text-muted-foreground">{journal.grateful_for}</p>
              </div>
            )}
            {journal.free_notes && (
              <div>
                <h3 className="mb-1 font-medium">Notes</h3>
                <p className="whitespace-pre-wrap text-muted-foreground">{journal.free_notes}</p>
              </div>
            )}
            {journal.motivation_quote && (
              <blockquote className="border-l-2 border-gold-400 pl-3 font-display italic text-foreground/80">
                &ldquo;{journal.motivation_quote}&rdquo;
              </blockquote>
            )}
          </div>

          {journal.tags && journal.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {journal.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">#{t}</Badge>)}
            </div>
          )}

          {photoUrls.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photoUrls.map((url, i) => (
                <img key={i} src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
              ))}
            </div>
          )}

          <div className="mt-5 flex items-center gap-1 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={toggleLike} className={cn('gap-1.5', liked && 'text-destructive')}>
              <Heart className={cn('h-4 w-4', liked && 'fill-current')} /> {likeCount}
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <MessageCircle className="h-4 w-4" /> {comments.length}
            </Button>
            <Button variant="ghost" size="sm" onClick={share} className="gap-1.5">
              <Send className="h-4 w-4" /> Share
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleSave} className={cn('ml-auto gap-1.5', saved && 'text-gold-500')}>
              <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} /> Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-medium">Comments ({comments.length})</h3>
          <div className="space-y-3">
            {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>}
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Link href={`/profile/${c.profiles?.username ?? ''}`}>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                    <AvatarFallback className="bg-muted text-xs">{(c.profiles?.username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                  <Link href={`/profile/${c.profiles?.username ?? ''}`}>
                    <p className="text-xs font-medium hover:underline">{c.profiles?.username ?? 'Anonymous'}</p>
                  </Link>
                  <p className="text-sm text-foreground/90">{c.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
            ))}
          </div>
          {user && (
            <div className="mt-4 flex gap-2">
              <Input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Add a comment…"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                disabled={posting}
              />
              <Button size="sm" onClick={postComment} disabled={posting || !commentInput.trim()}>
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
