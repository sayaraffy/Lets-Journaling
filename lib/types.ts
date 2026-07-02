export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  streak: number;
  longest_streak: number;
  last_journal_date: string | null;
  join_date: string;
  updated_at: string;
  settings: Record<string, unknown> | null;
};

export type JournalVisibility = 'private' | 'friends' | 'public';

export type Journal = {
  id: string;
  user_id: string;
  journal_date: string;
  what_happened: string | null;
  what_i_learned: string | null;
  what_to_improve: string | null;
  grateful_for: string | null;
  free_notes: string | null;
  motivation_quote: string | null;
  visibility: JournalVisibility;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  color: string;
  reminder_minutes: number | null;
  recurring_rule: string | null;
  category: string | null;
  is_completed: boolean;
  google_calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ChecklistItem = {
  id: string;
  user_id: string;
  journal_id: string | null;
  content: string;
  is_completed: boolean;
  due_date: string | null;
  created_at: string;
};

export type MoodEntry = {
  id: string;
  user_id: string;
  mood_date: string;
  mood: number;
  note: string | null;
  created_at: string;
};

export type WaterEntry = {
  id: string;
  user_id: string;
  water_date: string;
  glasses: number;
  goal_glasses: number;
  created_at: string;
};

export type Photo = {
  id: string;
  user_id: string;
  journal_id: string | null;
  storage_path: string;
  caption: string | null;
  created_at: string;
};

export type PomodoroSession = {
  id: string;
  user_id: string;
  session_type: 'work' | 'short_break' | 'long_break';
  duration_minutes: number;
  completed_at: string;
};

export type Friend = {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
};

export type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
};

export type PenPalMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  image_path: string | null;
  shared_journal_id: string | null;
  read_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

export type JournalLike = {
  id: string;
  journal_id: string;
  user_id: string;
  created_at: string;
};

export type JournalComment = {
  id: string;
  journal_id: string;
  user_id: string;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
};

export type JournalShare = {
  id: string;
  journal_id: string;
  user_id: string;
  platform: string | null;
  created_at: string;
};

export type JournalSave = {
  id: string;
  journal_id: string;
  user_id: string;
  created_at: string;
};
