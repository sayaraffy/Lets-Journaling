'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Loader2, Image as ImageIcon, Palette, Bell, Globe, Shield } from 'lucide-react';

type NotifKey = 'activity' | 'journal' | 'water' | 'pomodoro' | 'streak' | 'penpal' | 'quiet_hours';
const DEFAULT_NOTIFS: Record<NotifKey, boolean> = { activity: true, journal: true, water: false, pomodoro: true, streak: true, penpal: true, quiet_hours: false };

export default function EditProfilePage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'id'>('en');
  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>(DEFAULT_NOTIFS);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? '');
      setFullName(profile.full_name ?? '');
      setBio(profile.bio ?? '');
      setAvatarUrl(profile.avatar_url);
      setCoverUrl(profile.cover_url);
      const s = profile.settings as { language?: 'en' | 'id'; notifications?: Record<NotifKey, boolean> } | null;
      if (s?.language) setLanguage(s.language);
      if (s?.notifications) setNotifs({ ...DEFAULT_NOTIFS, ...s.notifications });
    }
  }, [profile]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploadingAvatar(true);
    const path = `${user.id}/avatar-${Date.now()}.${file.name.split('.').pop()}`;
    try {
      const { error } = await supabase.storage.from('avatars').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success('Avatar updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const uploadCover = async (file: File) => {
    if (!user) return;
    setUploadingCover(true);
    const path = `${user.id}/cover-${Date.now()}.${file.name.split('.').pop()}`;
    try {
      const { error } = await supabase.storage.from('avatars').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setCoverUrl(data.publicUrl);
      toast.success('Cover updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingCover(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        username, full_name: fullName || null, bio: bio || null,
        avatar_url: avatarUrl, cover_url: coverUrl,
        settings: { language: language, notifications: notifs },
      }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile saved');
      router.push('/profile');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-brand-600" /> Profile</CardTitle>
          <CardDescription>Update your profile and cover photo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="mb-2 block">Cover Photo</Label>
            <div className="relative h-32 overflow-hidden rounded-xl bg-gradient-to-r from-brand-400 to-brand-600 dark:from-brand-700 dark:to-brand-900">
              {coverUrl && <img src={coverUrl} alt="" className="h-full w-full object-cover" />}
              <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1.5 text-xs text-white backdrop-blur hover:bg-black/60">
                {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                Change
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ''; }} disabled={uploadingCover} />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
                <AvatarFallback className="bg-brand-100 text-2xl font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  {(username || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
                {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }} disabled={uploadingAvatar} />
              </label>
            </div>
            <div className="flex-1 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fullname">Full Name</Label>
            <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A few words about you…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4 text-brand-600" /> Appearance & Language</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Theme</Label>
              <p className="text-xs text-muted-foreground">Light, dark, or system.</p>
            </div>
            <Select value={theme ?? 'system'} onValueChange={setTheme}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Language</Label>
              <p className="text-xs text-muted-foreground">Interface language.</p>
            </div>
            <Select value={language} onValueChange={(v) => setLanguage(v as 'en' | 'id')}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="id">Bahasa Indonesia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-brand-600" /> Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <NotifRow label="Activity reminders" desc="Get notified before activities start." checked={notifs.activity} onChange={(v) => setNotifs((p) => ({ ...p, activity: v }))} />
          <NotifRow label="Daily journal reminder" desc="A gentle nudge to write each day." checked={notifs.journal} onChange={(v) => setNotifs((p) => ({ ...p, journal: v }))} />
          <NotifRow label="Water reminders" desc="Stay hydrated throughout the day." checked={notifs.water} onChange={(v) => setNotifs((p) => ({ ...p, water: v }))} />
          <NotifRow label="Pomodoro reminders" desc="Focus session start and end." checked={notifs.pomodoro} onChange={(v) => setNotifs((p) => ({ ...p, pomodoro: v }))} />
          <NotifRow label="Streak reminders" desc="Don't break your streak." checked={notifs.streak} onChange={(v) => setNotifs((p) => ({ ...p, streak: v }))} />
          <NotifRow label="Pen pal reminders" desc="When you receive a new letter." checked={notifs.penpal} onChange={(v) => setNotifs((p) => ({ ...p, penpal: v }))} />
          <Separator />
          <NotifRow label="Do not disturb (quiet hours)" desc="Mute notifications from 10 PM to 7 AM." checked={notifs.quiet_hours} onChange={(v) => setNotifs((p) => ({ ...p, quiet_hours: v }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-brand-600" /> Privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your journals are private by default. You can change each journal&apos;s visibility to &ldquo;Friends&rdquo; or &ldquo;Public&rdquo; from the journal editor.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.back()} className="flex-1">Cancel</Button>
        <Button onClick={save} disabled={saving} className="flex-1 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Profile
        </Button>
      </div>
    </div>
  );
}

function NotifRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
