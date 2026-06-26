'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Heart, MessageCircle, Bookmark, Sparkles, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Journal, Profile, JournalLike, JournalSave } from '@/lib/types';

type FeedJournal = Journal & { profiles: Profile };

export default function FeedPage() {
  const { user } = useAuth();
  const [journals, setJournals] = useState<FeedJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [saves, setSaves] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

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

    const [myLikes, mySaves, allLikes] = await Promise.all([
      supabase.from('journal_likes').select('journal_id').eq('user_id', user.id),
      supabase.from('journal_saves').select('journal_id').eq('user_id', user.id),
      supabase.from('journal_likes').select('journal_id'),
    ]);
    setLikes(new Set((myLikes.data as JournalLike[])?.map((l) => l.journal_id) ?? []));
    setSaves(new Set((mySaves.data as JournalSave[])?.map((s) => s.journal_id) ?? []));
    const counts: Record<string, number> = {};
    (allLikes.data as JournalLike[] | null)?.forEach((l) => { counts[l.journal_id] = (counts[l.journal_id] ?? 0) + 1; });
    setLikeCounts(counts);
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

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse-soft rounded-2xl bg-muted" />)}</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border-brand-300/40 bg-gradient-to-r from-brand-50/50 to-card dark:from-brand-900/10">
        <CardContent className="flex items-center gap-3 py-4">
          <Globe className="h-5 w-5 text-brand-600" />
          <p className="text-sm text-muted-foreground">Public journals shared by the community. Be kind and respectful.</p>
        </CardContent>
      </Card>

      {journals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No public journals yet. Be the first to share!</p>
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
                    {new Date(j.journal_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                {j.tags?.slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
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
                <Button variant="ghost" size="sm" className="gap-1.5"><MessageCircle className="h-4 w-4" /> Comment</Button>
                <Button variant="ghost" size="sm" onClick={() => toggleSave(j)} className={cn('ml-auto gap-1.5', saves.has(j.id) && 'text-gold-500')}>
                  <Bookmark className={cn('h-4 w-4', saves.has(j.id) && 'fill-current')} /> Save
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
