'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { useI18n } from '@/components/providers/i18n-provider';
import type { Journal, Profile, JournalLike, JournalComment, JournalShare } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Heart, MessageCircle, Share2, Bookmark, Clock, Lock, Users, Globe,
  ArrowRight, Copy, MessageCircle as CommentIcon, Trash2, Send, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderMarkdown } from '@/lib/markdown';
import { readingTime, combineJournalText, relativeTime, formatDate } from '@/lib/journal-utils';
import Link from 'next/link';
import { toast } from 'sonner';

const PREVIEW_LENGTH = 300;
const visibilityConfig = {
  public: { icon: Globe, label: 'PUBLIC', color: 'text-blue-500 bg-blue-500/10' },
  friends: { icon: Users, label: 'FRIENDS', color: 'text-green-500 bg-green-500/10' },
  private: { icon: Lock, label: 'PRIVATE', color: 'text-muted-foreground bg-muted' },
};

export function JournalFeedCard({ journal, author }: { journal: Journal; author: Profile }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [hasSaved, setHasSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<(JournalComment & { author: Profile; replies?: (JournalComment & { author: Profile })[] })[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    (async () => {
      const [likes, commentsCount, shares, myLike, mySave] = await Promise.all([
        supabase.from('journal_likes').select('user_id', { count: 'exact', head: true }).eq('journal_id', journal.id),
        supabase.from('journal_comments').select('id', { count: 'exact', head: true }).eq('journal_id', journal.id),
        supabase.from('journal_shares').select('user_id', { count: 'exact', head: true }).eq('journal_id', journal.id),
        user ? supabase.from('journal_likes').select('id').eq('journal_id', journal.id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase.from('journal_saves').select('id').eq('journal_id', journal.id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setLikeCount(likes.count ?? 0);
      setCommentCount(commentsCount.count ?? 0);
      setShareCount(shares.count ?? 0);
      setHasLiked(!!myLike.data);
      setHasSaved(!!mySave.data);
    })();
  }, [journal.id, user]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase.channel(`journal-card-${journal.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'journal_likes', filter: `journal_id=eq.${journal.id}` }, () => setLikeCount((c) => c + 1))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'journal_likes', filter: `journal_id=eq.${journal.id}` }, () => setLikeCount((c) => Math.max(0, c - 1)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'journal_comments', filter: `journal_id=eq.${journal.id}` }, () => setCommentCount((c) => c + 1))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'journal_comments', filter: `journal_id=eq.${journal.id}` }, () => setCommentCount((c) => Math.max(0, c - 1)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'journal_shares', filter: `journal_id=eq.${journal.id}` }, () => setShareCount((c) => c + 1))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [journal.id]);

  const toggleLike = async () => {
    if (!user) return;
    const wasLiked = hasLiked;
    setHasLiked(!wasLiked);
    setLikeCount((c) => wasLiked ? Math.max(0, c - 1) : c + 1);
    if (wasLiked) {
      await supabase.from('journal_likes').delete().eq('journal_id', journal.id).eq('user_id', user.id);
    } else {
      await supabase.from('journal_likes').insert({ journal_id: journal.id, user_id: user.id });
      if (journal.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: journal.user_id, type: 'like',
          title: t('notif.like_title'), body: t('notif.like_body'),
          data: { journal_id: journal.id },
        });
      }
    }
  };

  const toggleSave = async () => {
    if (!user) return;
    setHasSaved(!hasSaved);
    if (hasSaved) {
      await supabase.from('journal_saves').delete().eq('journal_id', journal.id).eq('user_id', user.id);
      toast.success(t('journal.unsaved'));
    } else {
      await supabase.from('journal_saves').insert({ journal_id: journal.id, user_id: user.id });
      toast.success(t('journal.saved'));
    }
  };

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('journal_comments')
      .select('*, author:profiles!journal_comments_user_id_fkey(*)')
      .eq('journal_id', journal.id)
      .order('created_at', { ascending: true });
    const allComments = (data as (JournalComment & { author: Profile })[]) ?? [];
    const topLevel = allComments.filter((c) => !c.parent_comment_id);
    const withReplies = topLevel.map((c) => ({
      ...c,
      replies: allComments.filter((r) => r.parent_comment_id === c.id),
    }));
    setComments(withReplies);
  }, [journal.id]);

  const toggleComments = () => {
    setShowComments(!showComments);
    if (!showComments) loadComments();
  };

  const postComment = async () => {
    if (!user || !commentBody.trim()) return;
    const { data } = await supabase
      .from('journal_comments')
      .insert({ journal_id: journal.id, user_id: user.id, body: commentBody.trim() })
      .select('*, author:profiles!journal_comments_user_id_fkey(*)')
      .single();
    if (data) {
      setComments((prev) => [...prev, data as (JournalComment & { author: Profile })]);
      setCommentBody('');
      if (journal.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: journal.user_id, type: 'comment',
          title: t('notif.comment_title'), body: commentBody.trim().slice(0, 80),
          data: { journal_id: journal.id },
        });
      }
    }
  };

  const postReply = async (parentId: string) => {
    if (!user || !replyBody.trim()) return;
    const { data } = await supabase
      .from('journal_comments')
      .insert({ journal_id: journal.id, user_id: user.id, body: replyBody.trim(), parent_comment_id: parentId })
      .select('*, author:profiles!journal_comments_user_id_fkey(*)')
      .single();
    if (data) {
      setComments((prev) => prev.map((c) =>
        c.id === parentId ? { ...c, replies: [...(c.replies ?? []), data as (JournalComment & { author: Profile })] } : c,
      ));
      setReplyBody('');
      setReplyingTo(null);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!user) return;
    await supabase.from('journal_comments').delete().eq('id', commentId).eq('user_id', user.id);
    loadComments();
    toast.success(t('journal.comment_deleted'));
  };

  const handleShare = async (platform: string) => {
    const url = `${window.location.origin}/journal/${journal.id}`;
    const text = combineJournalText(journal).slice(0, 100);
    if (platform === 'link') {
      await navigator.clipboard.writeText(url);
      toast.success(t('journal.link_copied'));
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else if (platform === 'telegram') {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'x') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    }
    // Record share
    await supabase.from('journal_shares').upsert({ journal_id: journal.id, user_id: user?.id, platform }, { onConflict: 'journal_id,user_id' });
    setShareCount((c) => c + 1);
    setShowShareMenu(false);
    if (journal.user_id !== user?.id) {
      await supabase.from('notifications').insert({
        user_id: journal.user_id, type: 'share',
        title: t('notif.share_title'), body: t('notif.share_body'),
        data: { journal_id: journal.id },
      });
    }
  };

  const fullText = combineJournalText(journal);
  const isLong = fullText.length > PREVIEW_LENGTH;
  const displayText = expanded || !isLong ? fullText : fullText.slice(0, PREVIEW_LENGTH);
  const visConfig = visibilityConfig[journal.visibility];
  const VisIcon = visConfig.icon;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-soft sm:p-5">
      {/* Header: avatar, name, @username, timestamp, visibility */}
      <div className="mb-3 flex items-start gap-3">
        <Link href={`/profile/${author.username ?? ''}`} className="shrink-0">
          <Avatar className="h-11 w-11">
            {author.avatar_url && <AvatarImage src={author.avatar_url} alt={author.username ?? ''} />}
            <AvatarFallback className="bg-teal-500/10 font-semibold text-teal-600">
              {(author.username ?? author.full_name ?? '?').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${author.username ?? ''}`} className="truncate text-sm font-semibold hover:underline">
              {author.full_name ?? author.username}
            </Link>
            <span className="text-muted-foreground">·</span>
            <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(journal.created_at)}</span>
          </div>
          <Link href={`/profile/${author.username ?? ''}`} className="text-xs text-muted-foreground hover:underline">
            @{author.username}
          </Link>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', visConfig.color)}>
          <VisIcon className="h-3 w-3" /> {visConfig.label}
        </span>
      </div>

      {/* Body: journal text with expand/collapse */}
      <Link href={`/journal/${journal.id}`}>
        <div className="prose-journal text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(displayText) }} />
      </Link>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {expanded ? t('discover.show_less') : t('discover.read_more')} <ArrowRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
        </button>
      )}

      {/* Tags/hashtags */}
      {journal.tags && journal.tags.filter((tag) => tag !== 'pinned' && tag !== 'archived').length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {journal.tags.filter((tag) => tag !== 'pinned' && tag !== 'archived').map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
          ))}
        </div>
      )}

      {/* Reading time */}
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {readingTime(fullText)} {t('journal.reading_time')}</span>
        <span>·</span>
        <span>{formatDate(journal.journal_date, { month: 'short', day: 'numeric' })}</span>
      </div>

      {/* Engagement bar: Like, Comment, Share */}
      <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
        <Button variant={hasLiked ? 'default' : 'ghost'} size="sm" onClick={toggleLike} className="gap-1.5">
          <Heart className={cn('h-4 w-4', hasLiked && 'fill-current')} /> {likeCount}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleComments} className="gap-1.5">
          <MessageCircle className="h-4 w-4" /> {commentCount}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowShareMenu(!showShareMenu)} className="gap-1.5">
          <Share2 className="h-4 w-4" /> {shareCount}
        </Button>
        <div className="ml-auto">
          <Button variant={hasSaved ? 'default' : 'ghost'} size="icon" onClick={toggleSave} className="h-8 w-8">
            <Bookmark className={cn('h-4 w-4', hasSaved && 'fill-current')} />
          </Button>
        </div>
      </div>

      {/* Share menu */}
      {showShareMenu && (
        <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-border bg-muted/50 p-3">
          <Button variant="outline" size="sm" onClick={() => handleShare('link')} className="gap-2">
            <Copy className="h-4 w-4" /> {t('journal.copy_link')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleShare('whatsapp')} className="gap-2">
            <span className="text-base">💬</span> WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleShare('telegram')} className="gap-2">
            <Send className="h-4 w-4" /> Telegram
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleShare('x')} className="gap-2">
            <span className="text-base">𝕏</span> X
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowShareMenu(false)} className="ml-auto h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {/* Comment input */}
          {user && (
            <div className="flex gap-2">
              <Avatar className="h-8 w-8 shrink-0">
                {user.user_metadata?.avatar_url && <AvatarImage src={user.user_metadata.avatar_url} alt="" />}
                <AvatarFallback className="bg-muted text-xs font-semibold">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder={t('journal.comment_placeholder')}
                  className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  rows={2}
                />
                <Button size="sm" onClick={postComment} disabled={!commentBody.trim()} className="gap-1.5">
                  <Send className="h-3.5 w-3.5" /> {t('journal.post_comment')}
                </Button>
              </div>
            </div>
          )}

          {/* Comments list */}
          <div className="space-y-2">
            {comments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t('journal.no_comments')}</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="space-y-1.5">
                  <CommentItem comment={c} currentUserId={user?.id} onDelete={deleteComment} onReply={() => setReplyingTo(c.id)} />
                  {replyingTo === c.id && (
                    <div className="flex gap-2 pl-11">
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder={`@${c.author?.username ?? ''} …`}
                        className="flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        rows={2}
                      />
                      <Button size="sm" onClick={() => postReply(c.id)} disabled={!replyBody.trim()} className="gap-1.5">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {c.replies?.map((r) => (
                    <div key={r.id} className="pl-11">
                      <CommentItem comment={r} currentUserId={user?.id} onDelete={deleteComment} isReply />
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function CommentItem({ comment, currentUserId, onDelete, onReply, isReply }: {
  comment: JournalComment & { author: Profile };
  currentUserId?: string;
  onDelete: (id: string) => void;
  onReply?: () => void;
  isReply?: boolean;
}) {
  const isOwner = comment.user_id === currentUserId;
  // Process @mentions for highlighting
  const processedBody = comment.body.replace(/@(\w+)/g, '<span class="text-primary font-medium">@$1</span>');

  return (
    <div className="flex gap-2">
      <Avatar className={cn('shrink-0', isReply ? 'h-7 w-7' : 'h-9 w-9')}>
        {comment.author?.avatar_url && <AvatarImage src={comment.author.avatar_url} alt={comment.author.username ?? ''} />}
        <AvatarFallback className="bg-muted text-xs font-semibold">{(comment.author?.username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="rounded-xl bg-muted/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${comment.author?.username ?? ''}`} className="text-xs font-semibold hover:underline">
              {comment.author?.full_name ?? comment.author?.username}
            </Link>
            <span className="text-xs text-muted-foreground">{relativeTime(comment.created_at)}</span>
          </div>
          <p className="mt-0.5 text-sm" dangerouslySetInnerHTML={{ __html: processedBody }} />
        </div>
        <div className="mt-1 flex items-center gap-3 pl-1">
          {onReply && !isReply && (
            <button onClick={onReply} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Reply
            </button>
          )}
          {isOwner && (
            <button onClick={() => onDelete(comment.id)} className="text-xs font-medium text-destructive hover:text-destructive/80">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
