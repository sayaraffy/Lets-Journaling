'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Upload, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function EditProfilePage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? '');
      setFullName(profile.full_name ?? '');
      setBio(profile.bio ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
      setCoverUrl(profile.cover_url ?? '');
    }
  }, [profile]);

  const uploadFile = async (file: File, bucket: string, pathPrefix: string) => {
    if (!profile) return null;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${pathPrefix}/${profile.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, 'avatars', 'avatars');
    if (url) setAvatarUrl(url);
  };

  const handleCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, 'covers', 'covers');
    if (url) setCoverUrl(url);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!cleanUsername) { toast.error('Username is required'); setSaving(false); return; }
      const { error } = await supabase
        .from('profiles')
        .update({
          username: cleanUsername,
          full_name: fullName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl || null,
          cover_url: coverUrl || null,
        })
        .eq('id', profile.id);
      if (error) {
        if (error.code === '23505') toast.error('Username already taken');
        else throw error;
        setSaving(false);
        return;
      }
      await refreshProfile();
      toast.success('Profile updated');
      router.push(`/profile/${cleanUsername}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  if (!profile) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Edit Profile</h1>
        <p className="text-sm text-muted-foreground">Update your identity and how others see you.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Cover & Avatar</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Cover image</Label>
            <div className="relative h-32 overflow-hidden rounded-xl border border-border bg-muted">
              {coverUrl && <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />}
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 transition-colors hover:bg-black/30">
                <input type="file" accept="image/*" onChange={handleCover} className="hidden" />
                <span className="flex items-center gap-2 rounded-lg bg-card/90 px-3 py-1.5 text-sm font-medium opacity-0 transition-opacity hover:opacity-100">
                  <Upload className="h-4 w-4" /> Upload cover
                </span>
              </label>
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Avatar</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                  {(username || '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label>
                <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
                <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
                  <Upload className="h-4 w-4" /> Upload avatar
                </span>
              </label>
            </div>
          </div>
          {uploading && <p className="text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Uploading…</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Profile Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="johndoe" />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell others about yourself…" className="min-h-[80px] resize-y" maxLength={300} />
            <p className="text-xs text-muted-foreground">{bio.length}/300</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save profile
        </Button>
      </div>
    </div>
  );
}
