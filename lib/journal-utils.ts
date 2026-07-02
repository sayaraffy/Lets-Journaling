export const MOODS = [
  { value: 1, emoji: '😔', label: 'Sad', color: 'text-blue-500' },
  { value: 2, emoji: '😕', label: 'Low', color: 'text-slate-500' },
  { value: 3, emoji: '😐', label: 'Neutral', color: 'text-amber-500' },
  { value: 4, emoji: '🙂', label: 'Good', color: 'text-lime-500' },
  { value: 5, emoji: '😄', label: 'Great', color: 'text-emerald-500' },
] as const;

export function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function charCount(text: string): number {
  return text.length;
}

export function getMood(value: number) {
  return MOODS.find((m) => m.value === value) ?? MOODS[2];
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, opts ?? { month: 'short', day: 'numeric', year: 'numeric' });
}

export function relativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatDate(d);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function combineJournalText(j: {
  what_happened?: string | null;
  what_i_learned?: string | null;
  what_to_improve?: string | null;
  grateful_for?: string | null;
  free_notes?: string | null;
}): string {
  return [j.what_happened, j.what_i_learned, j.what_to_improve, j.grateful_for, j.free_notes]
    .filter(Boolean)
    .join('\n\n');
}
