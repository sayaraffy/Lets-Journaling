import { supabase } from '@/lib/supabase/client';
import type { Journal, Activity, Profile } from '@/lib/types';

export type ProfileStats = {
  journalCount: number;
  publicJournalCount: number;
  activityCount: number;
  friendCount: number;
  likesReceived: number;
  commentsReceived: number;
  totalStudyMinutes: number;
  studySessionCount: number;
};

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const [journals, publicJ, activities, friends, likes, comments, pomodoro] = await Promise.all([
    supabase.from('journals').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('journals').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('visibility', 'public'),
    supabase.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('friends').select('id', { count: 'exact', head: true }).or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    supabase.from('journal_likes').select('id', { count: 'exact', head: true }).in('journal_id',
      (await supabase.from('journals').select('id').eq('user_id', userId)).data?.map((j) => j.id) ?? []),
    supabase.from('journal_comments').select('id', { count: 'exact', head: true }).in('journal_id',
      (await supabase.from('journals').select('id').eq('user_id', userId)).data?.map((j) => j.id) ?? []),
    supabase.from('pomodoro_sessions').select('duration_minutes').eq('user_id', userId).eq('session_type', 'work'),
  ]);

  const studyMinutes = (pomodoro.data ?? []).reduce((sum, s) => sum + (s as { duration_minutes: number }).duration_minutes, 0);

  return {
    journalCount: journals.count ?? 0,
    publicJournalCount: publicJ.count ?? 0,
    activityCount: activities.count ?? 0,
    friendCount: friends.count ?? 0,
    likesReceived: likes.count ?? 0,
    commentsReceived: comments.count ?? 0,
    totalStudyMinutes: studyMinutes,
    studySessionCount: pomodoro.data?.length ?? 0,
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
