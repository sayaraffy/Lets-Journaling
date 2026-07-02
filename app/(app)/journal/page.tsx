'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { supabase } from '@/lib/supabase/client';
import type { Journal, JournalVisibility } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookOpen, Search, Lock, Users, Globe, Pin, Archive, Plus } from 'lucide-react';
import Link from 'next/link';
import { formatDate, readingTime, combineJournalText } from '@/lib/journal-utils';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const visibilityIcons: Record<JournalVisibility, typeof Lock> = {
  private: Lock,
  friends: Users,
  public: Globe,
};

export default function JournalPage() {
  const { user } = useAuth();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visFilter, setVisFilter] = useState<string>('all');
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [sort, setSort] = useState<string>('date-desc');

  const loadJournals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from('journals').select('*').eq('user_id', user.id);
    if (visFilter !== 'all') query = query.eq('visibility', visFilter);
    if (sort === 'date-desc') query = query.order('journal_date', { ascending: false });
    else if (sort === 'date-asc') query = query.order('journal_date', { ascending: true });
    const { data } = await query;
    let list = (data as Journal[]) ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((j) =>
        [j.what_happened, j.what_i_learned, j.what_to_improve, j.grateful_for, j.free_notes]
          .filter(Boolean)
          .some((t) => t!.toLowerCase().includes(q)),
      );
    }
    setJournals(list);
    setLoading(false);
  }, [user, visFilter, sort, search]);

  useEffect(() => { loadJournals(); }, [loadJournals]);

  const togglePin = async (j: Journal) => {
    const newTags = j.tags?.includes('pinned')
      ? j.tags.filter((t) => t !== 'pinned')
      : [...(j.tags ?? []), 'pinned'];
    await supabase.from('journals').update({ tags: newTags }).eq('id', j.id);
    loadJournals();
    toast.success(newTags.includes('pinned') ? 'Journal pinned' : 'Journal unpinned');
  };

  const toggleArchive = async (j: Journal) => {
    const newTags = j.tags?.includes('archived')
      ? j.tags.filter((t) => t !== 'archived')
      : [...(j.tags ?? []), 'archived'];
    await supabase.from('journals').update({ tags: newTags }).eq('id', j.id);
    loadJournals();
    toast.success(newTags.includes('archived') ? 'Journal archived' : 'Journal unarchived');
  };

  const pinned = journals.filter((j) => j.tags?.includes('pinned'));
  const active = journals.filter((j) => !j.tags?.includes('archived') && !j.tags?.includes('pinned'));
  const archived = journals.filter((j) => j.tags?.includes('archived'));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">My Journals</h1>
          <p className="text-sm text-muted-foreground">{journals.length} entries</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/today"><Plus className="h-4 w-4" /> New entry</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your journals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={visFilter} onValueChange={setVisFilter}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Visibility" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All visibility</SelectItem>
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="friends">Friends</SelectItem>
            <SelectItem value="public">Public</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Newest first</SelectItem>
            <SelectItem value="date-asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : journals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No journals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Start writing to see your entries here.</p>
            <Button asChild className="mt-4"><Link href="/today">Write today&apos;s journal</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Pin className="h-4 w-4" /> Pinned
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">{pinned.map((j) => <JournalCard key={j.id} journal={j} onPin={togglePin} onArchive={toggleArchive} />)}</div>
            </div>
          )}
          {active.length > 0 && (
            <div>
              {pinned.length > 0 && <h2 className="mb-3 text-sm font-semibold text-muted-foreground">All entries</h2>}
              <div className="grid gap-4 sm:grid-cols-2">{active.map((j) => <JournalCard key={j.id} journal={j} onPin={togglePin} onArchive={toggleArchive} />)}</div>
            </div>
          )}
          {archived.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Archive className="h-4 w-4" /> Archived
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">{archived.map((j) => <JournalCard key={j.id} journal={j} onPin={togglePin} onArchive={toggleArchive} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JournalCard({ journal, onPin, onArchive }: { journal: Journal; onPin: (j: Journal) => void; onArchive: (j: Journal) => void }) {
  const VisIcon = visibilityIcons[journal.visibility];
  const text = combineJournalText(journal);
  const preview = text.slice(0, 280);
  const isPinned = journal.tags?.includes('pinned');
  const isArchived = journal.tags?.includes('archived');

  return (
    <Card className={cn('group transition-all hover:shadow-soft-lg', isArchived && 'opacity-60')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/journal/${journal.id}`} className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold">{formatDate(journal.journal_date, { month: 'long', day: 'numeric', year: 'numeric' })}</CardTitle>
          </Link>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="gap-1 text-xs">
              <VisIcon className="h-3 w-3" /> {journal.visibility}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Link href={`/journal/${journal.id}`}>
          <div
            className="prose-journal line-clamp-4 text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(preview) }}
          />
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{readingTime(text)} min read</span>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPin(journal)} title={isPinned ? 'Unpin' : 'Pin'}>
              <Pin className={cn('h-3.5 w-3.5', isPinned && 'fill-current text-primary')} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onArchive(journal)} title={isArchived ? 'Unarchive' : 'Archive'}>
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
