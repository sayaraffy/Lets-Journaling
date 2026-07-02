'use client';

import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { Logo, LogoMark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/brand/theme-toggle';
import { Button } from '@/components/ui/button';
import { BookHeart, CalendarCheck, Droplets, Brain, Timer, Users, Sparkles, ArrowRight } from 'lucide-react';

const features = [
  { icon: BookHeart, title: 'Daily Journal', desc: 'Reflect with guided questions, mood tracking, and free notes.' },
  { icon: CalendarCheck, title: 'Activity Scheduler', desc: 'Plan your day with activities, reminders, and categories.' },
  { icon: Brain, title: 'Mood & Insights', desc: 'Track your mood and discover patterns with AI-powered insights.' },
  { icon: Droplets, title: 'Water & Habits', desc: 'Build healthy habits with water tracking and checklists.' },
  { icon: Timer, title: 'Pomodoro Timer', desc: 'Stay focused with built-in focus sessions and streaks.' },
  { icon: Users, title: 'Pen Pals', desc: 'Exchange messages with friends in realtime.' },
  { icon: Sparkles, title: 'Discover', desc: 'Find meaningful writing from the community.' },
];

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <LogoMark className="h-12 w-12 animate-pulse-soft" />
        <p className="font-display text-sm font-medium text-muted-foreground">Lets Journaling</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-brand-50 via-background to-background p-6 text-center">
        <Logo />
        <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="max-w-md text-muted-foreground">Your journal is waiting. Pick up where you left off.</p>
        <Button asChild size="lg" className="gap-2">
          <Link href="/today">Go to Today <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-brand-50 via-background to-background">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-gold-300/15 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20 pt-12 sm:px-10 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-gold-400" />
            Capture today, understand tomorrow
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            A calm space to{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              journal your life
            </span>
            , one day at a time.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground text-balance sm:text-lg">
            Write, reflect, and connect. Discover meaningful writing from a community that values depth over noise.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto gap-2">
              <Link href="/signup">Start journaling <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border/60 bg-card/60 p-5 shadow-soft backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100 dark:bg-brand-900/30">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
