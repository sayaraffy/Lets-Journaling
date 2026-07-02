import { supabase } from '@/lib/supabase/client';
import type { Journal, Activity, Profile } from '@/lib/types';

export type ProfileStats = {
  journalCount: number;
  activityCompletedCount: number;
  totalStudyMinutes: number;
  currentStreak: number;
};

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const [journals, activities, pomodoro] = await Promise.all([
    supabase.from('journals').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true),
    supabase.from('pomodoro_sessions').select('duration_minutes').eq('user_id', userId).eq('session_type', 'work'),
  ]);

  const studyMinutes = (pomodoro.data ?? []).reduce(
    (sum, s) => sum + (s as { duration_minutes: number }).duration_minutes, 0,
  );

  return {
    journalCount: journals.count ?? 0,
    activityCompletedCount: activities.count ?? 0,
    totalStudyMinutes: studyMinutes,
    currentStreak: 0,
  };
}

export async function fetchUserJournals(userId: string, visibility?: string): Promise<Journal[]> {
  let q = supabase.from('journals').select('*').eq('user_id', userId).order('journal_date', { ascending: false });
  if (visibility) q = q.eq('visibility', visibility);
  const { data } = await q;
  return (data as Journal[]) ?? [];
}

export async function fetchUserActivities(userId: string): Promise<Activity[]> {
  const { data } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: false })
    .limit(20);
  return (data as Activity[]) ?? [];
}
