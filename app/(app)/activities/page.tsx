'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, CalendarPlus, MapPin, Clock, Trash2, CheckCircle2, Circle, Pencil, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Activity } from '@/lib/types';

const colorOptions = [
  { name: 'Blue', value: '#0000FF' },
  { name: 'Light Blue', value: '#7EC8FF' },
  { name: 'Gold', value: '#F4C542' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
];

const categories = ['Work', 'Personal', 'Health', 'Study', 'Social', 'Family', 'Other'];
const reminders = [
  { label: 'No reminder', value: 'none' },
  { label: '5 minutes before', value: '5' },
  { label: '10 minutes before', value: '10' },
  { label: '15 minutes before', value: '15' },
  { label: '30 minutes before', value: '30' },
  { label: '1 hour before', value: '60' },
  { label: '1 day before', value: '1440' },
];

export default function ActivitiesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState<Activity | null>(null);
  const [view, setView] = useState<'list' | 'agenda'>('list');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true });
    setActivities((data as Activity[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const upcoming = useMemo(() => activities.filter((a) => new Date(a.start_time) >= new Date()), [activities]);
  const past = useMemo(() => activities.filter((a) => new Date(a.start_time) < new Date()).reverse(), [activities]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button onClick={() => setView('list')} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', view === 'list' ? 'bg-card shadow-soft' : 'text-muted-foreground')}>List</button>
          <button onClick={() => setView('agenda')} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', view === 'agenda' ? 'bg-card shadow-soft' : 'text-muted-foreground')}>Agenda</button>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Activity
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse-soft rounded-xl bg-muted" />)}</div>
      ) : activities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/30">
              <CalendarPlus className="h-7 w-7 text-brand-600" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">No activities yet</h3>
              <p className="text-sm text-muted-foreground">Create your first activity to start scheduling your day.</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Activity</Button>
          </CardContent>
        </Card>
      ) : view === 'list' ? (
        <div className="space-y-6">
          <ActivitySection title="Upcoming" items={upcoming} onEdit={(a) => { setEditing(a); setDialogOpen(true); }} onReload={load} />
          {past.length > 0 && <ActivitySection title="Past" items={past} onEdit={(a) => { setEditing(a); setDialogOpen(true); }} onReload={load} />}
        </div>
      ) : (
        <AgendaView activities={activities} onEdit={(a) => { setEditing(a); setDialogOpen(true); }} onReload={load} />
      )}

      <ActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={load} />
    </div>
  );
}

function ActivitySection({ title, items, onEdit, onReload }: { title: string; items: Activity[]; onEdit: (a: Activity) => void; onReload: () => void }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-2">
        {items.map((a) => (
          <ActivityRow key={a.id} activity={a} onEdit={() => onEdit(a)} onReload={onReload} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ activity, onEdit, onReload }: { activity: Activity; onEdit: () => void; onReload: () => void }) {
  const toggleComplete = async () => {
    await supabase.from('activities').update({ is_completed: !activity.is_completed }).eq('id', activity.id);
    onReload();
  };
  const del = async () => {
    await supabase.from('activities').delete().eq('id', activity.id);
    onReload();
    toast.success('Activity deleted');
  };

  const addToGoogleCalendar = () => {
    const startDate = new Date(activity.start_time);
    const endDate = activity.end_time ? new Date(activity.end_time) : new Date(startDate.getTime() + 60 * 60 * 1000);
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', activity.title);
    url.searchParams.set('dates', `${formatDate(startDate)}/${formatDate(endDate)}`);
    if (activity.location) url.searchParams.set('location', activity.location);
    if (activity.description) url.searchParams.set('details', activity.description);
    window.open(url.toString(), '_blank');
  };

  return (
    <Card className="group overflow-hidden">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: activity.color }} />
        <button onClick={toggleComplete} className="shrink-0">
          {activity.is_completed ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-medium', activity.is_completed && 'text-muted-foreground line-through')}>{activity.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(activity.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            {activity.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {activity.location}</span>}
            {activity.category && <Badge variant="secondary" className="text-xs">{activity.category}</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" onClick={addToGoogleCalendar} className="h-8 w-8" title="Add to Google Calendar">
            <CalendarPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={del} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AgendaView({ activities, onEdit, onReload }: { activities: Activity[]; onEdit: (a: Activity) => void; onReload: () => void }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>();
    activities.forEach((a) => {
      const day = new Date(a.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(a);
    });
    return Array.from(map.entries());
  }, [activities]);

  return (
    <div className="space-y-6">
      {grouped.map(([day, items]) => (
        <div key={day}>
          <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">{day}</h3>
          <div className="space-y-2">
            {items.map((a) => <ActivityRow key={a.id} activity={a} onEdit={() => onEdit(a)} onReload={onReload} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityDialog({ open, onOpenChange, editing, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Activity | null; onSaved: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [color, setColor] = useState('#0000FF');
  const [reminder, setReminder] = useState('');
  const [category, setCategory] = useState('Work');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setLocation(editing.location ?? '');
      setStartTime(editing.start_time.slice(0, 16));
      setEndTime(editing.end_time.slice(0, 16));
      setColor(editing.color);
      setReminder(editing.reminder_minutes ? editing.reminder_minutes.toString() : 'none');
      setCategory(editing.category ?? 'Work');
    } else {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
      const later = new Date(now);
      later.setHours(later.getHours() + 1);
      setTitle(''); setDescription(''); setLocation('');
      setStartTime(now.toISOString().slice(0, 16));
      setEndTime(later.toISOString().slice(0, 16));
      setColor('#0000FF'); setReminder('none'); setCategory('Work');
    }
  }, [editing, open]);

  const save = async () => {
    if (!user || !title.trim() || !startTime || !endTime) { toast.error('Title and times are required'); return; }
    if (new Date(endTime) <= new Date(startTime)) { toast.error('End time must be after start time'); return; }
    setSaving(true);
    const payload = {
      user_id: user.id,
      title: title.trim(),
      description: description || null,
      location: location || null,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      color,
      reminder_minutes: reminder && reminder !== 'none' ? parseInt(reminder) : null,
      category,
    };
    try {
      let savedActivity: Activity;
      if (editing) {
        const { data, error } = await supabase.from('activities').update(payload).eq('id', editing.id).select().single();
        if (error) throw error;
        savedActivity = data as Activity;
        toast.success('Activity updated');
      } else {
        const { data, error } = await supabase.from('activities').insert(payload).select().single();
        if (error) throw error;
        savedActivity = data as Activity;
        toast.success('Activity created');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Activity' : 'New Activity'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning workout" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional details…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">Start</Label>
              <Input id="start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End</Label>
              <Input id="end" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc">Location</Label>
            <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reminder</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger><SelectValue placeholder="No reminder" /></SelectTrigger>
                <SelectContent>{reminders.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={cn('h-8 w-8 rounded-full border-2 transition-all', color === c.value ? 'scale-110 border-foreground' : 'border-transparent')}
                  style={{ backgroundColor: c.value }}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create activity'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
