'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/hooks/use-toast';
import type { Journal, JournalVisibility } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Check,
  Loader2,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  Lock,
  Users,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderMarkdown } from '@/lib/markdown';
import { readingTime, wordCount, charCount, MOODS, getMood } from '@/lib/journal-utils';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const fields = [
  { key: 'what_happened', label: 'What happened today?', placeholder: 'Describe the events of your day…' },
  { key: 'what_i_learned', label: 'What did I learn?', placeholder: 'A lesson, insight, or realization…' },
  { key: 'what_to_improve', label: 'What can I improve?', placeholder: 'Something to work on tomorrow…' },
  { key: 'grateful_for', label: 'What am I grateful for?', placeholder: 'Small or big things you appreciate…' },
  { key: 'free_notes', label: 'Free notes', placeholder: 'Anything else on your mind…' },
] as const;

type FieldKey = (typeof fields)[number]['key'];

const visibilityOptions: { value: JournalVisibility; icon: typeof Lock; label: string }[] = [
  { value: 'private', icon: Lock, label: 'Private' },
  { value: 'friends', icon: Users, label: 'Friends' },
  { value: 'public', icon: Globe, label: 'Public' },
];

export function JournalEditor({ date, existing }: { date: string; existing?: Journal | null }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<FieldKey, string>>({
    what_happened: existing?.what_happened ?? '',
    what_i_learned: existing?.what_i_learned ?? '',
    what_to_improve: existing?.what_to_improve ?? '',
    grateful_for: existing?.grateful_for ?? '',
    free_notes: existing?.free_notes ?? '',
  });
  const [motivationQuote, setMotivationQuote] = useState(existing?.motivation_quote ?? '');
  const [visibility, setVisibility] = useState<JournalVisibility>(existing?.visibility ?? 'private');
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [preview, setPreview] = useState(false);
  const [journalId, setJournalId] = useState<string | null>(existing?.id ?? null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>('');

  const loadMood = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('mood_date', date)
      .maybeSingle();
    if (data) setMood((data as { mood: number }).mood);
  }, [user, date]);

  useEffect(() => {
    loadMood();
    const draftKey = `journal-draft-${date}`;
    const draft = localStorage.getItem(draftKey);
    if (draft && !existing) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
          setValues(parsed.values);
          setMotivationQuote(parsed.motivationQuote ?? '');
          setVisibility(parsed.visibility ?? 'private');
          toast({
            title: 'Draft recovered',
            description: 'We restored your unsaved work from a previous session.',
          });
        }
      } catch { /* ignore */ }
    }
  }, [date, existing, loadMood, toast]);

  const fullText = Object.values(values).join(' ');
  const wc = wordCount(fullText);
  const cc = charCount(fullText);
  const rt = readingTime(fullText);

  const persistDraft = useCallback(() => {
    localStorage.setItem(
      `journal-draft-${date}`,
      JSON.stringify({ values, motivationQuote, visibility, timestamp: Date.now() }),
    );
  }, [date, values, motivationQuote, visibility]);

  const doSave = useCallback(async () => {
    if (!user) return;
    const snapshot = JSON.stringify({ values, motivationQuote, visibility });
    if (snapshot === lastSaved.current) return;
    setSaveState('saving');
    try {
      const payload = {
        user_id: user.id,
        journal_date: date,
        ...values,
        motivation_quote: motivationQuote || null,
        visibility,
        tags: tags.length ? tags : null,
      };
      if (journalId) {
        const { error } = await supabase.from('journals').update(payload).eq('id', journalId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('journals')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setJournalId(data.id);
      }
      if (mood) {
        await supabase.from('mood_entries').upsert(
          { user_id: user.id, mood_date: date, mood },
          { onConflict: 'user_id,mood_date' },
        );
      }
      lastSaved.current = snapshot;
      setSaveState('saved');
      localStorage.removeItem(`journal-draft-${date}`);
    } catch {
      setSaveState('error');
      persistDraft();
    }
  }, [user, date, values, motivationQuote, visibility, tags, journalId, mood, persistDraft]);

  useEffect(() => {
    persistDraft();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('idle');
    saveTimer.current = setTimeout(() => { doSave(); }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [values, motivationQuote, visibility, doSave, persistDraft]);

  const handleManualSave = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await doSave();
    if (saveState !== 'error') {
      toast({ title: 'Journal saved' });
    }
  };

  const insertMarkdown = (field: FieldKey, syntax: 'bold' | 'italic' | 'bullet' | 'number' | 'quote') => {
    const el = document.getElementById(`field-${field}`) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = values[field].slice(start, end);
    let replacement = '';
    switch (syntax) {
      case 'bold': replacement = `**${selected || 'text'}**`; break;
      case 'italic': replacement = `*${selected || 'text'}*`; break;
      case 'bullet': replacement = `- ${selected || 'item'}`; break;
      case 'number': replacement = `1. ${selected || 'item'}`; break;
      case 'quote': replacement = `> ${selected || 'quote'}`; break;
    }
    const newVal = values[field].slice(0, start) + replacement + values[field].slice(end);
    setValues((v) => ({ ...v, [field]: newVal }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 0);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          {saveState === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {saveState === 'saved' && <Check className="h-4 w-4 text-success" />}
          {saveState === 'idle' && <Cloud className="h-4 w-4 text-muted-foreground" />}
          {saveState === 'error' && <CloudOff className="h-4 w-4 text-destructive" />}
          <span className="text-muted-foreground">
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Save failed — draft kept locally' : 'Autosave on'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{wc} words</span>
          <span>·</span>
          <span>{cc} chars</span>
          <span>·</span>
          <span>{rt} min read</span>
        </div>
      </div>

      {/* Mood + visibility row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Label className="text-sm font-medium">How are you feeling?</Label>
          <div className="flex gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMood(mood === m.value ? null : m.value)}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition-all',
                  mood === m.value
                    ? 'border-primary bg-primary/10 scale-110'
                    : 'border-border bg-card hover:bg-muted',
                )}
                title={m.label}
                type="button"
              >
                {m.emoji}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Visibility</Label>
          <Select value={visibility} onValueChange={(v) => setVisibility(v as JournalVisibility)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibilityOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <opt.icon className="h-4 w-4" /> {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview toggle */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Your entry</h2>
        <Button variant="ghost" size="sm" onClick={() => setPreview(!preview)} className="gap-2">
          {preview ? <><EyeOff className="h-4 w-4" /> Edit</> : <><Eye className="h-4 w-4" /> Preview</>}
        </Button>
      </div>

      {/* Fields */}
      {preview ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          {fields.map((f) => {
            const val = values[f.key];
            if (!val.trim()) return null;
            return (
              <div key={f.key}>
                <h3 className="mb-1.5 text-sm font-semibold text-muted-foreground">{f.label}</h3>
                <div
                  className="prose-journal"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(val) }}
                />
              </div>
            );
          })}
          {motivationQuote.trim() && (
            <blockquote className="border-l-2 border-primary pl-4 text-sm italic text-muted-foreground">
              {motivationQuote}
            </blockquote>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {fields.map((f) => (
            <div key={f.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`field-${f.key}`} className="text-sm font-medium">{f.label}</Label>
                <div className="flex gap-0.5">
                  {(['bold', 'italic', 'bullet', 'number', 'quote'] as const).map((syn) => (
                    <button
                      key={syn}
                      type="button"
                      onClick={() => insertMarkdown(f.key, syn)}
                      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={syn}
                    >
                      {syn === 'bold' && <Bold className="h-3.5 w-3.5" />}
                      {syn === 'italic' && <Italic className="h-3.5 w-3.5" />}
                      {syn === 'bullet' && <List className="h-3.5 w-3.5" />}
                      {syn === 'number' && <ListOrdered className="h-3.5 w-3.5" />}
                      {syn === 'quote' && <Quote className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                id={`field-${f.key}`}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="min-h-[100px] resize-y border-border bg-card font-sans text-[15px] leading-relaxed focus-visible:ring-primary"
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="quote" className="text-sm font-medium">Motivation quote <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="quote"
              value={motivationQuote}
              onChange={(e) => setMotivationQuote(e.target.value)}
              placeholder="A quote that inspires you today…"
              className="min-h-[60px] resize-y border-border bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tags <span className="text-muted-foreground">(optional, max 8)</span></Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  #{t}
                  <button onClick={() => removeTag(t)} className="text-muted-foreground hover:text-foreground" type="button">×</button>
                </Badge>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Type a tag and press Enter…"
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleManualSave} disabled={saveState === 'saving'} className="gap-2">
          {saveState === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
          <Check className="h-4 w-4" /> Save journal
        </Button>
      </div>
    </div>
  );
}
