'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useTodayData } from '@/lib/hooks/use-today-data';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Flame,
  Droplets,
  Smile,
  Timer,
  CheckCircle2,
  Circle,
  CalendarPlus,
  ArrowRight,
  BookHeart,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const moodLabels: Record<number, { label: string; emoji: string; color: string }> = {
  1: { label: 'Low', emoji: '😔', color: 'text-destructive' },
  2: { label: 'Down', emoji: '😕', color: 'text-warning' },
  3: { label: 'Okay', emoji: '😐', color: 'text-muted-foreground' },
  4: { label: 'Good', emoji: '🙂', color: 'text-success' },
  5: { label: 'Great', emoji: '😄', color: 'text-brand-600' },
};

const quotes = [
  'The journey of a thousand miles begins with a single step.',
  'Small notes today, big growth tomorrow.',
  'Every day is a new page in your story.',
  'Progress, not perfection.',
  'Reflect better, grow better.',
];

export default function TodayPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { profile } = useAuth();
  const { loading, journal, activities, checklist, mood, water, pomodoroCount, reload } = useTodayData(today);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const quote = useMemo(() => quotes[new Date().getDate() % quotes.length], []);
  const completedActivities = activities.filter((a) => a.is_completed).length;
  const completedChecklist = checklist.filter((c) => c.is_completed).length;
  const waterPct = water ? Math.min(100, (water.glasses / water.goal_glasses) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse-soft rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 p-6 text-white shadow-soft-lg sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <p className="text-sm font-medium text-white/80">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            {greeting}, {profile?.username ?? 'friend'}.
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/80 text-balance">
            {journal ? "You've journaled today. Keep the momentum going." : "Ready to capture today? Your journal is a blank page."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {!journal && (
              <Button asChild variant="secondary" size="sm" className="gap-2 bg-white text-brand-700 hover:bg-white/90">
                <Link href="/journal"><BookHeart className="h-4 w-4" /> Write today's journal</Link>
              </Button>
            )}
            <Button asChild variant="secondary" size="sm" className="gap-2 bg-white/15 text-white hover:bg-white/25 backdrop-blur">
              <Link href="/activities?new=1"><CalendarPlus className="h-4 w-4" /> Add activity</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Streak + quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Flame} label="Streak" value={`${profile?.streak ?? 0}d`} accent="text-gold-500" bg="bg-gold-50 dark:bg-gold-400/10" />
        <StatCard icon={Droplets} label="Water" value={`${water?.glasses ?? 0}/${water?.goal_glasses ?? 8}`} accent="text-brand-600" bg="bg-brand-50 dark:bg-brand-900/30" />
        <StatCard icon={Timer} label="Pomodoros" value={`${pomodoroCount}`} accent="text-destructive" bg="bg-destructive/10" />
        <StatCard icon={CheckCircle2} label="Tasks" value={`${completedChecklist}/${checklist.length}`} accent="text-success" bg="bg-success/10" />
      </div>

      {/* Motivation quote */}
      <Card className="border-gold-300/40 bg-gold-50/50 dark:bg-gold-400/5">
        <CardContent className="flex items-center gap-3 py-4">
          <Sparkles className="h-5 w-5 shrink-0 text-gold-500" />
          <p className="font-display text-sm italic text-foreground/80">&ldquo;{quote}&rdquo;</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mood + Water */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smile className="h-4 w-4 text-brand-600" /> Today's Mood
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mood ? (
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{moodLabels[mood.mood].emoji}</span>
                  <div>
                    <p className={cn('font-display text-lg font-semibold', moodLabels[mood.mood].color)}>
                      {moodLabels[mood.mood].label}
                    </p>
                    {mood.note && <p className="text-sm text-muted-foreground">{mood.note}</p>}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Not logged yet today.</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/journal?focus=mood">Log mood</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Droplets className="h-4 w-4 text-brand-600" /> Water Intake</span>
                <span className="text-sm font-normal text-muted-foreground">{water?.glasses ?? 0} / {water?.goal_glasses ?? 8}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={waterPct} className="h-2" />
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: water?.goal_glasses ?? 8 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={async () => {
                      const newCount = i + 1 === water?.glasses ? i : i + 1;
                      try {
                        if (water) {
                          await supabase.from('water_entries').update({ glasses: newCount }).eq('id', water.id);
                        } else {
                          await supabase.from('water_entries').insert({ water_date: today, glasses: newCount, goal_glasses: 8 });
                        }
                        reload();
                      } catch {
                        toast.error('Failed to update water intake');
                      }
                    }}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg border transition-all',
                      i < (water?.glasses ?? 0)
                        ? 'border-brand-400 bg-brand-100 text-brand-600 dark:bg-brand-900/40'
                        : 'border-border bg-muted/50 text-muted-foreground hover:border-brand-300',
                    )}
                  >
                    <Droplets className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activities + Checklist */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Today's Activities</span>
                <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  <Link href="/activities">View all <ArrowRight className="h-3 w-3" /></Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activities.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No activities scheduled today.</p>
              ) : (
                activities.slice(0, 4).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
                    <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    {a.is_completed && <CheckCircle2 className="h-4 w-4 text-success" />}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Checklist</span>
                <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  <Link href="/journal?focus=checklist">Open <ArrowRight className="h-3 w-3" /></Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {checklist.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No tasks for today.</p>
              ) : (
                checklist.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 py-1">
                    {c.is_completed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={cn('text-sm', c.is_completed && 'text-muted-foreground line-through')}>
                      {c.content}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
  bg: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', bg)}>
          <Icon className={cn('h-5 w-5', accent)} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
