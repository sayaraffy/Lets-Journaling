'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Journal, Activity, MoodEntry, WaterEntry, PomodoroSession } from '@/lib/types';
import { JournalEditor } from '@/components/journal/journal-editor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CalendarDays, Activity as ActivityIcon, Droplets, Timer, CheckCircle2, Circle, Flame } from 'lucide-react';
import { todayISO, getMood, formatDate } from '@/lib/journal-utils';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { supabase as sb } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function TodayPage() {
  const { user, profile } = useAuth();
  const date = todayISO();
  const [loading, setLoading] = useState(true);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [checklist, setChecklist] = useState<{ id: string; content: string; is_completed: boolean }[]>([]);
  const [mood, setMood] = useState<MoodEntry | null>(null);
  const [water, setWater] = useState<WaterEntry | null>(null);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const start = `${date}T00:00:00`;
      const end = `${date}T23:59:59`;
      const [j, a, c, m, w, p] = await Promise.all([
        sb.from('journals').select('*').eq('user_id', user.id).eq('journal_date', date).maybeSingle(),
        sb.from('activities').select('*').eq('user_id', user.id).gte('start_time', start).lte('start_time', end).order('start_time'),
        sb.from('checklist_items').select('*').eq('user_id', user.id).eq('due_date', date).order('created_at'),
        sb.from('mood_entries').select('*').eq('user_id', user.id).eq('mood_date', date).maybeSingle(),
        sb.from('water_entries').select('*').eq('user_id', user.id).eq('water_date', date).maybeSingle(),
        sb.from('pomodoro_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('session_type', 'work').gte('completed_at', start).lte('completed_at', end),
      ]);
      setJournal(j.data as Journal | null);
      setActivities(a.data as Activity[]);
      setChecklist((c.data as { id: string; content: string; is_completed: boolean }[]) ?? []);
      setMood(m.data as MoodEntry | null);
      setWater(w.data as WaterEntry | null);
      setPomodoroCount(p.count ?? 0);
      setLoading(false);
    })();
  }, [user, date]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  const moodInfo = mood ? getMood(mood.mood) : null;
  const waterPct = water ? Math.min(100, (water.glasses / water.goal_glasses) * 100) : 0;

  const toggleChecklist = async (id: string, current: boolean) => {
    setTogglingId(id);
    await sb.from('checklist_items').update({ is_completed: !current }).eq('id', id);
    setTogglingId(null);
    setChecklist((prev) => prev.map((c) => c.id === id ? { ...c, is_completed: !current } : c));
  };

  const addGlass = async () => {
    if (!user) return;
    if (water) {
      await sb.from('water_entries').update({ glasses: water.glasses + 1 }).eq('id', water.id);
      setWater({ ...water, glasses: water.glasses + 1 });
    } else {
      await sb.from('water_entries').insert({ user_id: user.id, water_date: date, glasses: 1 });
      setWater({ id: '', user_id: user.id, water_date: date, glasses: 1, goal_glasses: 8, created_at: new Date().toISOString() });
    }
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand-50 to-card p-6 dark:from-brand-900/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {greeting()}, {profile?.full_name?.split(' ')[0] ?? profile?.username ?? 'there'}
            </h1>
            {profile && profile.streak > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold-400/15 px-3 py-1 text-sm font-medium text-gold-600 dark:text-gold-300">
                <Flame className="h-4 w-4" /> {profile.streak} day streak
              </div>
            )}
          </div>
          {moodInfo && (
            <div className="flex items-center gap-2 rounded-xl bg-card/80 px-4 py-2 shadow-soft">
              <span className="text-2xl">{moodInfo.emoji}</span>
              <span className="text-sm font-medium">{moodInfo.label}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ActivityIcon} label="Activities" value={activities.length} accent="text-brand-600" />
        <StatCard icon={Timer} label="Focus sessions" value={pomodoroCount} accent="text-success" />
        <StatCard icon={Droplets} label="Water" value={`${water?.glasses ?? 0}/${water?.goal_glasses ?? 8}`} accent="text-blue-500" />
        <StatCard icon={CheckCircle2} label="Tasks done" value={`${checklist.filter((c) => c.is_completed).length}/${checklist.length}`} accent="text-gold-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Today&apos;s Journal</CardTitle>
            </CardHeader>
            <CardContent><JournalEditor date={date} existing={journal} /></CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Activities</CardTitle>
                <Link href="/activities"><Button variant="ghost" size="sm">Manage</Button></Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {activities.length === 0 ? <p className="text-sm text-muted-foreground">No activities scheduled today.</p> : activities.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {a.is_completed && <CheckCircle2 className="h-4 w-4 text-success" />}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {checklist.length === 0 ? <p className="text-sm text-muted-foreground">No tasks for today.</p> : checklist.map((c) => (
                <button key={c.id} onClick={() => toggleChecklist(c.id, c.is_completed)} disabled={togglingId === c.id} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted">
                  {c.is_completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className={cn('flex-1', c.is_completed && 'text-muted-foreground line-through')}>{c.content}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Water intake</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{water?.glasses ?? 0} / {water?.goal_glasses ?? 8} glasses</span>
                <span className="font-medium">{Math.round(waterPct)}%</span>
              </div>
              <Progress value={waterPct} className="mb-3" />
              <Button onClick={addGlass} variant="outline" size="sm" className="w-full gap-2"><Droplets className="h-4 w-4" /> Add a glass</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof ActivityIcon; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between"><Icon className={cn('h-5 w-5', accent)} /></div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
