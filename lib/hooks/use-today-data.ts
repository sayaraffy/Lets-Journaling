'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Activity, ChecklistItem, Journal, MoodEntry, WaterEntry, PomodoroSession } from '@/lib/types';

export function useTodayData(date: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [mood, setMood] = useState<MoodEntry | null>(null);
  const [water, setWater] = useState<WaterEntry | null>(null);
  const [pomodoroCount, setPomodoroCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const [journalRes, activitiesRes, checklistRes, moodRes, waterRes, pomodoroRes] = await Promise.all([
      supabase.from('journals').select('*').eq('user_id', user.id).eq('journal_date', date).maybeSingle(),
      supabase.from('activities').select('*').eq('user_id', user.id).gte('start_time', startOfDay).lte('start_time', endOfDay).order('start_time'),
      supabase.from('checklist_items').select('*').eq('user_id', user.id).eq('due_date', date).order('created_at'),
      supabase.from('mood_entries').select('*').eq('user_id', user.id).eq('mood_date', date).maybeSingle(),
      supabase.from('water_entries').select('*').eq('user_id', user.id).eq('water_date', date).maybeSingle(),
      supabase.from('pomodoro_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('session_type', 'work').gte('completed_at', startOfDay).lte('completed_at', endOfDay),
    ]);

    setJournal(journalRes.data as Journal | null);
    setActivities(activitiesRes.data as Activity[]);
    setChecklist(checklistRes.data as ChecklistItem[]);
    setMood(moodRes.data as MoodEntry | null);
    setWater(waterRes.data as WaterEntry | null);
    setPomodoroCount(pomodoroRes.count ?? 0);
    setLoading(false);
  }, [user, date]);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, journal, activities, checklist, mood, water, pomodoroCount, reload: load };
}
