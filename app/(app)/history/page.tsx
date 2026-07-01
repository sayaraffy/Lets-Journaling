'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, List, Search, ChevronLeft, ChevronRight, BookHeart, Flame, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Journal, MoodEntry, WaterEntry } from '@/lib/types';

const moodEmojis: Record<number, string> = { 1: '😔', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

export default function HistoryPage() {
  const { user } = useAuth();
  const [view, setView] = useState<'calendar' | 'timeline' | 'heatmap'>('heatmap');
  const [search, setSearch] = useState('');
  const [journals, setJournals] = useState<Journal[]>([]);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [waters, setWaters] = useState<WaterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [j, m, w] = await Promise.all([
      supabase.from('journals').select('*').eq('user_id', user.id).order('journal_date', { ascending: false }),
      supabase.from('mood_entries').select('*').eq('user_id', user.id),
      supabase.from('water_entries').select('*').eq('user_id', user.id),
    ]);
    setJournals((j.data as Journal[]) ?? []);
    setMoods((m.data as MoodEntry[]) ?? []);
    setWaters((w.data as WaterEntry[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const moodByDate = useMemo(() => {
    const map = new Map<string, number>();
    moods.forEach((m) => map.set(m.mood_date, m.mood));
    return map;
  }, [moods]);

  const journalByDate = useMemo(() => {
    const map = new Map<string, Journal>();
    journals.forEach((j) => map.set(j.journal_date, j));
    return map;
  }, [journals]);

  const journalCountsByDate = useMemo(() => {
    const map = new Map<string, number>();
    journals.forEach((j) => {
      map.set(j.journal_date, (map.get(j.journal_date) ?? 0) + 1);
    });
    return map;
  }, [journals]);

  const filtered = useMemo(() => {
    if (!search.trim()) return journals;
    const q = search.toLowerCase();
    return journals.filter((j) =>
      [j.what_happened, j.what_i_learned, j.what_to_improve, j.grateful_for, j.free_notes, ...(j.tags ?? [])]
        .filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [journals, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button onClick={() => setView('heatmap')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', view === 'heatmap' ? 'bg-card shadow-soft' : 'text-muted-foreground')}>
            <Grid3X3 className="h-4 w-4" /> Heatmap
          </button>
          <button onClick={() => setView('calendar')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', view === 'calendar' ? 'bg-card shadow-soft' : 'text-muted-foreground')}>
            <Calendar className="h-4 w-4" /> Calendar
          </button>
          <button onClick={() => setView('timeline')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', view === 'timeline' ? 'bg-card shadow-soft' : 'text-muted-foreground')}>
            <List className="h-4 w-4" /> Timeline
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search journals…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 sm:w-64" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse-soft rounded-xl bg-muted" />)}</div>
      ) : view === 'heatmap' ? (
        <HeatmapView journalCountsByDate={journalCountsByDate} />
      ) : view === 'calendar' ? (
        <CalendarView cursor={cursor} setCursor={setCursor} journalByDate={journalByDate} moodByDate={moodByDate} />
      ) : (
        <TimelineView journals={filtered} moodByDate={moodByDate} />
      )}
    </div>
  );
}

function CalendarView({
  cursor, setCursor, journalByDate, moodByDate,
}: {
  cursor: Date; setCursor: (d: Date) => void; journalByDate: Map<string, Journal>; moodByDate: Map<string, number>;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())} className="h-8">Today</Button>
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const ds = d.toISOString().slice(0, 10);
            const hasJournal = journalByDate.has(ds);
            const mood = moodByDate.get(ds);
            const isToday = ds === today;
            return (
              <Link
                key={i}
                href={`/journal?date=${ds}`}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-all hover:scale-105 hover:shadow-soft',
                  isToday ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border',
                  hasJournal && 'bg-brand-50 dark:bg-brand-900/20',
                )}
              >
                <span className={cn('font-medium', isToday && 'text-primary')}>{d.getDate()}</span>
                {hasJournal && <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-brand-500" />}
                {mood && <span className="absolute right-1 top-1 text-xs">{moodEmojis[mood]}</span>}
              </Link>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-500" /> Journal entry</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Today</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineView({ journals, moodByDate }: { journals: Journal[]; moodByDate: Map<string, number> }) {
  if (journals.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <BookHeart className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No journals found. Start writing today!</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {journals.map((j) => {
        const mood = moodByDate.get(j.journal_date);
        const preview = j.what_happened || j.what_i_learned || j.grateful_for || j.free_notes || 'No content';
        return (
          <Link key={j.id} href={`/journal?date=${j.journal_date}`}>
            <Card className="group transition-all hover:-translate-y-0.5 hover:shadow-soft-lg">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex w-16 shrink-0 flex-col items-center">
                  <span className="font-display text-2xl font-semibold">{new Date(j.journal_date).getDate()}</span>
                  <span className="text-xs uppercase text-muted-foreground">{new Date(j.journal_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {mood && <span className="text-lg">{moodEmojis[mood]}</span>}
                    <Badge variant="secondary" className="capitalize text-xs">{j.visibility}</Badge>
                    {j.tags?.slice(0, 3).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{preview}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function HeatmapView({ journalCountsByDate }: { journalCountsByDate: Map<string, number> }) {
  const today = new Date();
  const weeks: { date: Date; count: number }[][] = [];

  // Generate last 52 weeks (like GitHub)
  for (let w = 51; w >= 0; w--) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - (w * 7) - weekStart.getDay());
    const week: { date: Date; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().slice(0, 10);
      const count = journalCountsByDate.get(dateStr) ?? 0;
      week.push({ date, count });
    }
    weeks.push(week);
  }

  // Calculate max count for scaling
  const maxCount = Math.max(1, ...Array.from(journalCountsByDate.values()));
  const totalCount = Array.from(journalCountsByDate.values()).reduce((a, b) => a + b, 0);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted/50';
    const level = Math.ceil((count / maxCount) * 4);
    if (level === 1) return 'bg-brand-200 dark:bg-brand-800';
    if (level === 2) return 'bg-brand-300 dark:bg-brand-700';
    if (level === 3) return 'bg-brand-400 dark:bg-brand-600';
    return 'bg-brand-500 dark:bg-brand-500';
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-brand-600" /> Writing Activity
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {totalCount} entries in the last year
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Month labels */}
        <div className="mb-2 flex justify-start" style={{ marginLeft: '20px' }}>
          <div className="flex w-full gap-1">
            {weeks.map((week, i) => {
              const firstDay = week[0];
              const month = firstDay.date.getMonth();
              const prevWeek = weeks[i - 1];
              const showMonth = !prevWeek || prevWeek[0].date.getMonth() !== month;
              return (
                <div key={i} className="flex-1 text-[10px] text-muted-foreground" style={{ minWidth: '11px' }}>
                  {showMonth ? months[month] : ''}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
            <div className="h-3" />
            <div className="h-3 flex items-center">Mon</div>
            <div className="h-3" />
            <div className="h-3 flex items-center">Wed</div>
            <div className="h-3" />
            <div className="h-3 flex items-center">Fri</div>
            <div className="h-3" />
          </div>

          {/* Heatmap grid */}
          <div className="flex flex-1 gap-1 overflow-x-auto">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => {
                  const dateStr = day.date.toISOString().slice(0, 10);
                  const isToday = dateStr === today.toISOString().slice(0, 10);
                  const isFuture = day.date > today;
                  return (
                    <Link
                      key={di}
                      href={`/journal?date=${dateStr}`}
                      title={`${day.date.toLocaleDateString()} — ${day.count} entries`}
                      className={cn(
                        'h-3 w-3 rounded-sm transition-all hover:ring-2 hover:ring-primary',
                        isFuture ? 'bg-transparent' : getColor(day.count),
                        isToday && 'ring-2 ring-primary',
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="h-3 w-3 rounded-sm bg-muted/50" />
            <div className="h-3 w-3 rounded-sm bg-brand-200 dark:bg-brand-800" />
            <div className="h-3 w-3 rounded-sm bg-brand-300 dark:bg-brand-700" />
            <div className="h-3 w-3 rounded-sm bg-brand-400 dark:bg-brand-600" />
            <div className="h-3 w-3 rounded-sm bg-brand-500" />
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
