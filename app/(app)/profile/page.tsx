'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Flame, BookHeart, Users, Calendar, Upload, Loader2 } from 'lucide-react';
import type { Profile as ProfileType } from '@/lib/types';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [journalCount, setJournalCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);

  const loadStats = useCallback(async () => {
    if (!user) return;
    const [j, f] = await Promise.all([
      supabase.from('journals').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('friends').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);
    setJournalCount(j.count ?? 0);
    setFriendCount(f.count ?? 0);
  }, [user]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? '');
      setFullName(profile.full_name ?? '');
      setBio(profile.bio ?? '');
      setAvatarUrl(profile.avatar_url);
    }
    loadStats();
  }, [profile, loadStats]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/avatar-${Date.now()}.${file.name.split('.').pop()}`;
    try {
      const { error } = await supabase.storage.from('avatars').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success('Avatar uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        username, full_name: fullName || null, bio: bio || null, avatar_url: avatarUrl,
      }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {/* Profile header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
                <AvatarFallback className="bg-brand-100 text-2xl font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  {(username || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }} disabled={uploading} />
              </label>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="font-display text-xl font-semibold">{username || 'User'}</h2>
              {fullName && <p className="text-sm text-muted-foreground">{fullName}</p>}
              {bio && <p className="mt-1 text-sm text-muted-foreground">{bio}</p>}
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground sm:justify-start">
                <Calendar className="h-3.5 w-3.5" />
                Joined {profile ? new Date(profile.join_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat icon={Flame} label="Streak" value={`${profile?.streak ?? 0}d`} color="text-gold-500" />
            <Stat icon={BookHeart} label="Journals" value={`${journalCount}`} color="text-brand-600" />
            <Stat icon={Users} label="Friends" value={`${friendCount}`} color="text-success" />
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullname">Full Name</Label>
            <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A few words about you…" />
          </div>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-3">
      <Icon className={`h-5 w-5 ${color}`} />
      <span className="font-display text-lg font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
