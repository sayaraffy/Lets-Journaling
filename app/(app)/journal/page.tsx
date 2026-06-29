'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Smile,
  Droplets,
  CheckSquare,
  BookHeart,
  StickyNote,
  ImagePlus,
  Timer,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  X,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Journal, MoodEntry, WaterEntry, ChecklistItem, Photo, PomodoroSession } from '@/lib/types';

const moodOptions = [
  { value: 1, emoji: '😔', label: 'Low', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  { value: 2, emoji: '😕', label: 'Down', color: 'bg-warning/15 text-warning border-warning/30' },
  { value: 3, emoji: '😐', label: 'Okay', color: 'bg-muted text-muted-foreground border-border' },
  { value: 4, emoji: '🙂', label: 'Good', color: 'bg-success/15 text-success border-success/30' },
  { value: 5, emoji: '😄', label: 'Great', color: 'bg-brand-100 text-brand-700 border-brand-300 dark:bg-brand-900/40 dark:text-brand-300' },
];

const quotes = [
  'The journey of a thousand miles begins with a single step.',
  'Small notes today, big growth tomorrow.',
  'Every day is a new page in your story.',
  'Progress, not perfection.',
  'Reflect better, grow better.',
  'Be the change you wish to see in the world.',
  'The best time to plant a tree was 20 years ago. The second best time is now.',
];

export default function JournalPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(searchParams.get('date') ?? today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [journal, setJournal] = useState<Journal | null>(null);
  const [form, setForm] = useState({
    what_happened: '',
    what_i_learned: '',
    what_to_improve: '',
    grateful_for: '',
    free_notes: '',
    motivation_quote: '',
    visibility: 'private' as 'private' | 'friends' | 'public',
    tags: '',
  });

  const [mood, setMood] = useState<MoodEntry | null>(null);
  const [moodNote, setMoodNote] = useState('');
  const [water, setWater] = useState<WaterEntry | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklist, setNewChecklist] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);

  const focus = searchParams.get('focus');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [j, m, w, c, p, ps] = await Promise.all([
      supabase.from('journals').select('*').eq('user_id', user.id).eq('journal_date', date).maybeSingle(),
      supabase.from('mood_entries').select('*').eq('user_id', user.id).eq('mood_date', date).maybeSingle(),
      supabase.from('water_entries').select('*').eq('user_id', user.id).eq('water_date', date).maybeSingle(),
      supabase.from('checklist_items').select('*').eq('user_id', user.id).eq('due_date', date).order('created_at'),
      supabase.from('photos').select('*').eq('user_id', user.id).eq('journal_id', null).order('created_at', { ascending: false }),
      supabase.from('pomodoro_sessions').select('*').eq('user_id', user.id).eq('session_type', 'work').gte('completed_at', `${date}T00:00:00`).lte('completed_at', `${date}T23:59:59`).order('completed_at', { ascending: false }),
    ]);

    const jData = j.data as Journal | null;
    setJournal(jData);
    if (jData) {
      setForm({
        what_happened: jData.what_happened ?? '',
        what_i_learned: jData.what_i_learned ?? '',
        what_to_improve: jData.what_to_improve ?? '',
        grateful_for: jData.grateful_for ?? '',
        free_notes: jData.free_notes ?? '',
        motivation_quote: jData.motivation_quote ?? '',
        visibility: jData.visibility,
        tags: (jData.tags ?? []).join(', '),
      });
    } else {
      setForm((f) => ({ ...f, motivation_quote: quotes[new Date().getDate() % quotes.length] }));
    }
    setMood(m.data as MoodEntry | null);
    setMoodNote((m.data as MoodEntry | null)?.note ?? '');
    setWater(w.data as WaterEntry | null);
    setChecklist((c.data as ChecklistItem[]) ?? []);
    setPhotos((p.data as Photo[]) ?? []);
    setPomodoroSessions((ps.data as PomodoroSession[]) ?? []);
    setLoading(false);
  }, [user, date]);

  useEffect(() => { load(); }, [load]);

  // Generate signed URLs for private photos bucket
  useEffect(() => {
    if (photos.length === 0) {
      setPhotoUrls({});
      return;
    }
    let cancelled = false;
    (async () => {
      const paths = photos.map((p) => p.storage_path);
      const { data, error } = await supabase.storage.from('photos').createSignedUrls(paths, 3600);
      if (cancelled || error || !data) return;
      const map: Record<string, string> = {};
      data.forEach((d, i) => {
        if (d.signedUrl) map[paths[i]] = d.signedUrl;
      });
      setPhotoUrls(map);
    })();
    return () => { cancelled = true; };
  }, [photos]);

  const saveJournal = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      journal_date: date,
      what_happened: form.what_happened || null,
      what_i_learned: form.what_i_learned || null,
      what_to_improve: form.what_to_improve || null,
      grateful_for: form.grateful_for || null,
      free_notes: form.free_notes || null,
      motivation_quote: form.motivation_quote || null,
      visibility: form.visibility,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    try {
      if (journal) {
        const { error } = await supabase.from('journals').update(payload).eq('id', journal.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('journals').insert(payload).select().single();
        if (error) throw error;
        setJournal(data as Journal);
      }
      toast.success('Journal saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = () => {
    const moodEmoji = mood ? moodOptions.find((m) => m.value === mood.mood)?.emoji ?? '' : '';
    const checklistHtml = checklist.map((c) =>
      `<li style="margin-bottom:4px">${c.is_completed ? '☑' : '☐'} ${c.content}</li>`,
    ).join('');
    const photoHtml = photos.map((p) => {
      const url = photoUrls[p.storage_path];
      return url ? `<img src="${url}" style="max-width:200px;border-radius:8px;margin:4px" />` : '';
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Journal — ${date}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
      h1 { font-size: 24px; border-bottom: 2px solid #0000FF; padding-bottom: 8px; }
      .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
      h2 { font-size: 16px; color: #0000FF; margin-top: 24px; }
      .quote { border-left: 3px solid #F4C542; padding-left: 12px; font-style: italic; color: #555; }
      ul { padding-left: 20px; }
      .photos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    </style></head><body>
    <h1>Let's Journaling</h1>
    <div class="meta">${new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ${moodEmoji ? '· ' + moodEmoji : ''}</div>
    ${form.what_happened ? `<h2>What happened</h2><p>${form.what_happened.replace(/</g, '&lt;')}</p>` : ''}
    ${form.what_i_learned ? `<h2>What I learned</h2><p>${form.what_i_learned.replace(/</g, '&lt;')}</p>` : ''}
    ${form.what_to_improve ? `<h2>What to improve</h2><p>${form.what_to_improve.replace(/</g, '&lt;')}</p>` : ''}
    ${form.grateful_for ? `<h2>Grateful for</h2><p>${form.grateful_for.replace(/</g, '&lt;')}</p>` : ''}
    ${form.free_notes ? `<h2>Notes</h2><p>${form.free_notes.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p>` : ''}
    ${form.motivation_quote ? `<div class="quote">"${form.motivation_quote.replace(/</g, '&lt;')}"</div>` : ''}
    ${checklist.length > 0 ? `<h2>Checklist</h2><ul>${checklistHtml}</ul>` : ''}
    ${photoHtml ? `<h2>Photos</h2><div class="photos">${photoHtml}</div>` : ''}
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Please allow popups to export PDF'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  const setMoodValue = async (value: number) => {
    if (!user) return;
    try {
      if (mood) {
        const { data, error } = await supabase.from('mood_entries').update({ mood: value, note: moodNote }).eq('id', mood.id).select().single();
        if (error) throw error;
        setMood(data as MoodEntry);
      } else {
        const { data, error } = await supabase.from('mood_entries').insert({ user_id: user.id, mood_date: date, mood: value, note: moodNote }).select().single();
        if (error) throw error;
        setMood(data as MoodEntry);
      }
      toast.success('Mood saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save mood');
    }
  };

  const updateWater = async (glasses: number) => {
    if (!user) return;
    try {
      if (water) {
        const { data, error } = await supabase.from('water_entries').update({ glasses }).eq('id', water.id).select().single();
        if (error) throw error;
        setWater(data as WaterEntry);
      } else {
        const { data, error } = await supabase.from('water_entries').insert({ user_id: user.id, water_date: date, glasses, goal_glasses: 8 }).select().single();
        if (error) throw error;
        setWater(data as WaterEntry);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update water');
    }
  };

  const addChecklist = async () => {
    if (!user || !newChecklist.trim()) return;
    try {
      const { data, error } = await supabase.from('checklist_items').insert({ user_id: user.id, content: newChecklist.trim(), due_date: date }).select().single();
      if (error) throw error;
      setChecklist([...checklist, data as ChecklistItem]);
      setNewChecklist('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add');
    }
  };

  const toggleChecklist = async (item: ChecklistItem) => {
    try {
      const { error } = await supabase.from('checklist_items').update({ is_completed: !item.is_completed }).eq('id', item.id);
      if (error) throw error;
      setChecklist(checklist.map((c) => c.id === item.id ? { ...c, is_completed: !c.is_completed } : c));
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const deleteChecklist = async (id: string) => {
    try {
      await supabase.from('checklist_items').delete().eq('id', id);
      setChecklist(checklist.filter((c) => c.id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10 MB');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/${date}/${crypto.randomUUID()}.${ext}`;
    try {
      const { error: upErr } = await supabase.storage.from('photos').upload(path, file);
      if (upErr) throw upErr;
      const { data, error } = await supabase.from('photos').insert({ user_id: user.id, storage_path: path }).select().single();
      if (error) throw error;
      setPhotos([data as Photo, ...photos]);
      toast.success('Photo uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const deletePhoto = async (photo: Photo) => {
    try {
      await supabase.storage.from('photos').remove([photo.storage_path]);
      await supabase.from('photos').delete().eq('id', photo.id);
      setPhotos(photos.filter((p) => p.id !== photo.id));
    } catch {
      toast.error('Failed to delete photo');
    }
  };

  const getPhotoUrl = (path: string) => photoUrls[path] ?? '';

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse-soft rounded-2xl bg-muted" />)}</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Date selector + save */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Label htmlFor="date" className="sr-only">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Badge variant="secondary" className="capitalize">{form.visibility}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF} className="gap-2">
            <FileDown className="h-4 w-4" /> Export PDF
          </Button>
          <Button onClick={saveJournal} disabled={saving} className="gap-2">
            {saving ? <Sparkles className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Journal'}
          </Button>
        </div>
      </div>

      {/* Mood */}
      <Card id="mood">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Smile className="h-4 w-4 text-brand-600" /> How are you feeling?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {moodOptions.map((m) => (
              <button
                key={m.value}
                onClick={() => setMoodValue(m.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-3 transition-all hover:scale-105',
                  mood?.mood === m.value ? m.color : 'border-border bg-card hover:border-muted-foreground/30',
                )}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-xs font-medium">{m.label}</span>
              </button>
            ))}
          </div>
          <Input
            placeholder="Add a note about your mood (optional)…"
            value={moodNote}
            onChange={(e) => setMoodNote(e.target.value)}
            onBlur={() => mood && setMoodValue(mood.mood)}
          />
        </CardContent>
      </Card>

      {/* Water */}
      <Card id="water">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Droplets className="h-4 w-4 text-brand-600" /> Water Intake</span>
            <span className="text-sm font-normal text-muted-foreground">{water?.glasses ?? 0} / {water?.goal_glasses ?? 8} glasses</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: water?.goal_glasses ?? 8 }).map((_, i) => (
              <button
                key={i}
                onClick={() => updateWater(i + 1 === water?.glasses ? i : i + 1)}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all hover:scale-110',
                  i < (water?.glasses ?? 0)
                    ? 'border-brand-400 bg-brand-100 text-brand-600 dark:bg-brand-900/40'
                    : 'border-border bg-muted/50 text-muted-foreground hover:border-brand-300',
                )}
              >
                <Droplets className="h-5 w-5" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card id="checklist">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><CheckSquare className="h-4 w-4 text-brand-600" /> Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {checklist.length === 0 && <p className="py-2 text-sm text-muted-foreground">No tasks yet. Add one below.</p>}
          {checklist.map((c) => (
            <div key={c.id} className="group flex items-center gap-2.5 rounded-lg border border-border/60 p-2.5">
              <button onClick={() => toggleChecklist(c)}>
                {c.is_completed ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
              </button>
              <span className={cn('flex-1 text-sm', c.is_completed && 'text-muted-foreground line-through')}>{c.content}</span>
              <button onClick={() => deleteChecklist(c.id)} className="opacity-0 transition-opacity group-hover:opacity-100">
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Input
              placeholder="Add a task…"
              value={newChecklist}
              onChange={(e) => setNewChecklist(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addChecklist()}
            />
            <Button onClick={addChecklist} size="icon"><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Reflection questions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><BookHeart className="h-4 w-4 text-brand-600" /> Reflection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ReflectionField label="What happened today?" value={form.what_happened} onChange={(v) => setForm({ ...form, what_happened: v })} />
          <ReflectionField label="What did I learn today?" value={form.what_i_learned} onChange={(v) => setForm({ ...form, what_i_learned: v })} />
          <ReflectionField label="What should I improve?" value={form.what_to_improve} onChange={(v) => setForm({ ...form, what_to_improve: v })} />
          <ReflectionField label="What am I grateful for today?" value={form.grateful_for} onChange={(v) => setForm({ ...form, grateful_for: v })} />
        </CardContent>
      </Card>

      {/* Free notes + motivation */}
      <Card id="notes">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><StickyNote className="h-4 w-4 text-brand-600" /> Free Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Write anything else on your mind…"
            value={form.free_notes}
            onChange={(e) => setForm({ ...form, free_notes: e.target.value })}
            rows={5}
          />
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Daily Motivation Quote</Label>
            <Input
              value={form.motivation_quote}
              onChange={(e) => setForm({ ...form, motivation_quote: e.target.value })}
              placeholder="Your daily spark…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card id="photos">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><ImagePlus className="h-4 w-4 text-brand-600" /> Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10">
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Click to upload a photo</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }}
            />
          </label>
          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => (
                <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border">
                  <img src={getPhotoUrl(p.storage_path)} alt={p.caption ?? ''} className="h-full w-full object-cover" />
                  <button
                    onClick={() => deletePhoto(p)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pomodoro */}
      <Card id="pomodoro">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Timer className="h-4 w-4 text-brand-600" /> Pomodoro Timer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PomodoroTimer
            onComplete={async (minutes) => {
              if (!user) return;
              await supabase.from('pomodoro_sessions').insert({ user_id: user.id, session_type: 'work', duration_minutes: minutes });
              load();
              toast.success('Pomodoro complete! Take a break.');
            }}
          />
          {pomodoroSessions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{pomodoroSessions.length} session(s) today</p>
              <div className="flex flex-wrap gap-2">
                {pomodoroSessions.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1.5">
                    <Timer className="h-3 w-3" /> {s.duration_minutes}m
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visibility + tags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Visibility & Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['private', 'friends', 'public'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setForm({ ...form, visibility: v })}
                className={cn(
                  'rounded-lg border-2 px-4 py-2 text-sm font-medium capitalize transition-all',
                  form.visibility === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-muted-foreground/30',
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Input
            placeholder="Tags (comma separated) e.g. work, travel, family"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ReflectionField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder="Reflect here…" />
    </div>
  );
}

function PomodoroTimer({ onComplete }: { onComplete: (minutes: number) => void }) {
  const [mode, setMode] = useState<'work' | 'short_break' | 'long_break'>('work');
  const durations = { work: 25, short_break: 5, long_break: 15 };
  const [secondsLeft, setSecondsLeft] = useState(durations.work * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setSecondsLeft(durations[mode] * 60);
    setRunning(false);
  }, [mode]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setRunning(false);
          if (mode === 'work') onComplete(durations.work);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode, onComplete]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const total = durations[mode] * 60;
  const pct = ((total - secondsLeft) / total) * 100;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-2">
        {(['work', 'short_break', 'long_break'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              mode === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {m.replace('_', ' ')}
          </button>
        ))}
      </div>
      <div className="relative flex h-40 w-40 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke="hsl(var(--primary))" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - pct / 100)}`}
            className="transition-all duration-1000"
          />
        </svg>
        <span className="font-display text-3xl font-semibold tabular-nums">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => setRunning((r) => !r)} size="sm" className="gap-2">
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? 'Pause' : 'Start'}
        </Button>
        <Button onClick={() => { setRunning(false); setSecondsLeft(durations[mode] * 60); }} size="sm" variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      </div>
    </div>
  );
}
