'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  GraduationCap,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Flame,
  TrendingUp,
  Calendar,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StudySession = {
  id: string;
  user_id: string;
  session_type: string;
  duration_minutes: number;
  completed_at: string;
  created_at: string;
};

type StudyStats = {
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  totalSessions: number;
  streak: number;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function StudyPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [stats, setStats] = useState<StudyStats>({
    todayMinutes: 0,
    weekMinutes: 0,
    monthMinutes: 0,
    totalSessions: 0,
    streak: 0,
  });

  // Pomodoro state
  const [mode, setMode] = useState<'work' | 'short_break' | 'long_break'>('work');
  const durations = { work: 25, short_break: 5, long_break: 15 };
  const [secondsLeft, setSecondsLeft] = useState(durations.work * 60);
  const [running, setRunning] = useState(false);
  const [currentSessionMinutes, setCurrentSessionMinutes] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: allSessions } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_type', 'work')
      .order('completed_at', { ascending: false });

    const sessionData = (allSessions as StudySession[]) ?? [];
    setSessions(sessionData);

    // Calculate stats
    const todayMins = sessionData
      .filter((s) => s.completed_at?.slice(0, 10) === today)
      .reduce((sum, s) => sum + s.duration_minutes, 0);

    const weekMins = sessionData
      .filter((s) => s.completed_at >= weekAgo)
      .reduce((sum, s) => sum + s.duration_minutes, 0);

    const monthMins = sessionData
      .filter((s) => s.completed_at >= monthAgo)
      .reduce((sum, s) => sum + s.duration_minutes, 0);

    // Calculate study streak
    let streak = 0;
    const dates = new Set(sessionData.map((s) => s.completed_at?.slice(0, 10)));
    const sortedDates = Array.from(dates).sort((a, b) => (b ?? '').localeCompare(a ?? ''));
    let checkDate = new Date(today);
    for (const date of sortedDates) {
      if (date === checkDate.toISOString().slice(0, 10)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (date === new Date(checkDate.getTime() - 86400000).toISOString().slice(0, 10)) {
        streak++;
        checkDate = new Date(date);
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    setStats({
      todayMinutes: todayMins,
      weekMinutes: weekMins,
      monthMinutes: monthMins,
      totalSessions: sessionData.length,
      streak,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setSecondsLeft(durations[mode] * 60);
    setRunning(false);
    setCurrentSessionMinutes(0);
  }, [mode]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setRunning(false);
          if (mode === 'work') {
            completeSession(durations.work);
          }
          return 0;
        }
        return s - 1;
      });
      setCurrentSessionMinutes((m) => m + 1/60);
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode]);

  const completeSession = async (minutes: number) => {
    if (!user) return;
    await supabase.from('pomodoro_sessions').insert({
      user_id: user.id,
      session_type: 'work',
      duration_minutes: minutes,
      completed_at: new Date().toISOString(),
    });
    load();
    toast.success('Study session complete! Take a break.');
    if (mode === 'work') {
      setMode('short_break');
    }
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const total = durations[mode] * 60;
  const pct = ((total - secondsLeft) / total) * 100;

  const recentSessions = sessions.slice(0, 10);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse-soft rounded-2xl bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Study</h1>
        <Badge variant="secondary" className="gap-1.5">
          <Flame className="h-3.5 w-3.5 text-gold-500" /> {stats.streak} day streak
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Today" value={`${stats.todayMinutes}m`} color="text-brand-600" />
        <StatCard icon={Calendar} label="This Week" value={`${stats.weekMinutes}m`} color="text-success" />
        <StatCard icon={TrendingUp} label="This Month" value={`${stats.monthMinutes}m`} color="text-purple-500" />
        <StatCard icon={GraduationCap} label="Total Sessions" value={`${stats.totalSessions}`} color="text-gold-500" />
      </div>

      {/* Pomodoro Timer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-4 w-4 text-brand-600" /> Pomodoro Timer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-2">
            {(['work', 'short_break', 'long_break'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); }}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors',
                  mode === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70',
                )}
              >
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="relative flex h-48 w-48 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke="hsl(var(--primary))" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${pct * 2.83} 283`}
                />
              </svg>
              <div className="text-center">
                <p className="font-mono text-4xl font-semibold">{formatTime(secondsLeft)}</p>
                <p className="mt-1 text-xs text-muted-foreground capitalize">
                  {mode.replace('_', ' ')} {mode === 'work' ? `(${durations.work} min)` : `(${durations[mode]} min)`}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => { setSecondsLeft(durations[mode] * 60); setRunning(false); setCurrentSessionMinutes(0); }}
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
              <Button
                size="lg"
                onClick={() => setRunning(!running)}
                className="gap-2"
              >
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running ? 'Pause' : 'Start'}
              </Button>
            </div>
          </div>

          {/* Today's Sessions */}
          {stats.todayMinutes > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Today's Progress</p>
                <p className="text-sm text-muted-foreground">{stats.todayMinutes} minutes</p>
              </div>
              <Progress value={Math.min((stats.todayMinutes / 120) * 100, 100)} className="h-2" />
              <p className="mt-1 text-xs text-muted-foreground">
                Goal: 120 minutes daily
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-brand-600" /> Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div>
                    <p className="text-sm font-medium">{s.duration_minutes} minutes</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.completed_at).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Badge variant="secondary"><Timer className="h-3 w-3 mr-1" /> Done</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-brand-600" /> Weekly Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-32">
            {getLast7Days().map((day) => {
              const dayStr = day.toISOString().slice(0, 10);
              const mins = sessions
                .filter((s) => s.completed_at?.slice(0, 10) === dayStr)
                .reduce((sum, s) => sum + s.duration_minutes, 0);
              const height = Math.min((mins / 120) * 100, 100);
              const isToday = dayStr === new Date().toISOString().slice(0, 10);
              return (
                <div key={dayStr} className="flex flex-1 flex-col items-center gap-1">
                  <div className="relative w-full h-24 bg-muted rounded-md overflow-hidden">
                    <div
                      className={cn(
                        'absolute bottom-0 w-full transition-all rounded-md',
                        isToday ? 'bg-brand-600' : 'bg-brand-400'
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {day.toLocaleDateString(undefined, { weekday: 'short' })}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}
