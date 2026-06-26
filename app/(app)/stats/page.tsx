'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, Droplets, Timer, Flame, CheckCircle2, Smile, Sparkles } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart,
} from 'recharts';
import type { MoodEntry, WaterEntry, PomodoroSession, Activity, Journal } from '@/lib/types';

const moodLabels: Record<number, string> = { 1: 'Low', 2: 'Down', 3: 'Okay', 4: 'Good', 5: 'Great' };
const moodColors: Record<number, string> = { 1: '#EF4444', 2: '#F59E0B', 3: '#94A3B8', 4: '#22C55E', 5: '#0000FF' };

export default function StatsPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [waters, setWaters] = useState<WaterEntry[]>([]);
  const [pomodoros, setPomodoros] = useState<PomodoroSession[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);
    const [m, w, p, a, j] = await Promise.all([
      supabase.from('mood_entries').select('*').eq('user_id', user.id).gte('mood_date', sinceStr).order('mood_date'),
      supabase.from('water_entries').select('*').eq('user_id', user.id).gte('water_date', sinceStr).order('water_date'),
      supabase.from('pomodoro_sessions').select('*').eq('user_id', user.id).gte('completed_at', since.toISOString()),
      supabase.from('activities').select('*').eq('user_id', user.id),
      supabase.from('journals').select('*').eq('user_id', user.id).order('journal_date', { ascending: false }),
    ]);
    setMoods((m.data as MoodEntry[]) ?? []);
    setWaters((w.data as WaterEntry[]) ?? []);
    setPomodoros((p.data as PomodoroSession[]) ?? []);
    setActivities((a.data as Activity[]) ?? []);
    setJournals((j.data as Journal[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const moodData = useMemo(() => moods.map((m) => ({ date: m.mood_date.slice(5), mood: m.mood })), [moods]);
  const waterData = useMemo(() => waters.map((w) => ({ date: w.water_date.slice(5), glasses: w.glasses })), [waters]);
  const pomodoroByDay = useMemo(() => {
    const map = new Map<string, number>();
    pomodoros.forEach((p) => {
      const d = new Date(p.completed_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + p.duration_minutes);
    });
    return Array.from(map.entries()).map(([date, minutes]) => ({ date: date.slice(5), minutes })).sort();
  }, [pomodoros]);

  const activityCompletion = useMemo(() => {
    const total = activities.length;
    const completed = activities.filter((a) => a.is_completed).length;
    return [
      { name: 'Completed', value: completed, color: '#22C55E' },
      { name: 'Pending', value: total - completed, color: '#E2E8F0' },
    ];
  }, [activities]);

  const moodDistribution = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    moods.forEach((m) => { counts[m.mood] = (counts[m.mood] ?? 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({ name: moodLabels[Number(k)], value: v, color: moodColors[Number(k)] }));
  }, [moods]);

  const avgMood = useMemo(() => moods.length ? (moods.reduce((s, m) => s + m.mood, 0) / moods.length).toFixed(1) : '—', [moods]);
  const avgWater = useMemo(() => waters.length ? (waters.reduce((s, w) => s + w.glasses, 0) / waters.length).toFixed(1) : '—', [waters]);
  const totalPomodoro = useMemo(() => pomodoros.filter((p) => p.session_type === 'work').reduce((s, p) => s + p.duration_minutes, 0), [pomodoros]);
  const journalCount = journals.length;

  const insight = useMemo(() => {
    if (moods.length < 3) return 'Keep logging your mood to unlock personalized insights.';
    const weekdayMoods: number[] = new Array(7).fill(0);
    const weekdayCounts: number[] = new Array(7).fill(0);
    moods.forEach((m) => {
      const day = new Date(m.mood_date).getDay();
      weekdayMoods[day] += m.mood;
      weekdayCounts[day] += 1;
    });
    const avgByDay = weekdayMoods.map((s, i) => weekdayCounts[i] ? s / weekdayCounts[i] : 0);
    const best = avgByDay.indexOf(Math.max(...avgByDay));
    const worst = avgByDay.indexOf(Math.min(...avgByDay.filter((v) => v > 0)));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (best === worst) return 'Your mood is consistent across the week — great balance!';
    return `Your mood tends to be highest on ${dayNames[best]} and lowest on ${dayNames[worst]}. Plan something nice for ${dayNames[worst]}!`;
  }, [moods]);

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse-soft rounded-2xl bg-muted" />)}</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Flame} label="Current Streak" value={`${profile?.streak ?? 0}d`} color="text-gold-500" bg="bg-gold-50 dark:bg-gold-400/10" />
        <StatCard icon={Smile} label="Avg Mood" value={avgMood} color="text-brand-600" bg="bg-brand-50 dark:bg-brand-900/30" />
        <StatCard icon={Droplets} label="Avg Water" value={avgWater} color="text-brand-600" bg="bg-brand-50 dark:bg-brand-900/30" />
        <StatCard icon={Timer} label="Focus Time" value={`${totalPomodoro}m`} color="text-destructive" bg="bg-destructive/10" />
      </div>

      {/* AI Insight */}
      <Card className="border-brand-300/40 bg-gradient-to-br from-brand-50/50 to-card dark:from-brand-900/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-gold-500" /> AI Insight</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/80">{insight}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mood trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-brand-600" /> Mood Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {moodData.length === 0 ? (
              <EmptyChart label="No mood data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={moodData}>
                  <defs>
                    <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0000FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0000FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="mood" stroke="#0000FF" strokeWidth={2} fill="url(#moodGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Water trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Droplets className="h-4 w-4 text-brand-600" /> Water Intake (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {waterData.length === 0 ? (
              <EmptyChart label="No water data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={waterData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="glasses" fill="#7EC8FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pomodoro */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Timer className="h-4 w-4 text-brand-600" /> Focus Minutes</CardTitle>
          </CardHeader>
          <CardContent>
            {pomodoroByDay.length === 0 ? (
              <EmptyChart label="No pomodoro sessions yet" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pomodoroByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="minutes" fill="#F4C542" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Activity completion */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-brand-600" /> Activity Completion</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <EmptyChart label="No activities yet" />
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={activityCompletion} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {activityCompletion.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {activityCompletion.map((e) => (
                    <div key={e.name} className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: e.color }} />
                      <span className="text-sm">{e.name}: {e.value}</span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted-foreground">{journalCount} journals written</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mood distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4 text-brand-600" /> Mood Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {moods.length === 0 ? (
            <EmptyChart label="No mood data yet" />
          ) : (
            <div className="space-y-2">
              {moodDistribution.map((m) => {
                const pct = moods.length ? (m.value / moods.length) * 100 : 0;
                return (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className="w-16 text-sm">{m.name}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                    </div>
                    <span className="w-8 text-right text-sm text-muted-foreground">{m.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string; bg: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
