'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Moon, Sun, Bell, Globe, Shield, Palette, Calendar, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState('en');
  const [notifActivity, setNotifActivity] = useState(true);
  const [notifJournal, setNotifJournal] = useState(true);
  const [notifWater, setNotifWater] = useState(false);
  const [notifPomodoro, setNotifPomodoro] = useState(true);
  const [notifStreak, setNotifStreak] = useState(true);
  const [notifPenPal, setNotifPenPal] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(true);

  useEffect(() => {
    supabase.from('google_tokens').select('user_id').maybeSingle()
      .then(({ data }) => { setGoogleConnected(!!data); setGoogleLoading(false); });
  }, []);

  const disconnectGoogle = async () => {
    setGoogleLoading(true);
    await supabase.from('google_tokens').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    setGoogleConnected(false);
    setGoogleLoading(false);
    toast.success('Google Calendar disconnected');
  };

  const save = () => {
    toast.success('Settings saved');
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-brand-600" /> Appearance</CardTitle>
          <CardDescription>Choose how Let&apos;s Journaling looks to you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <div>
                <Label>Theme</Label>
                <p className="text-xs text-muted-foreground">Switch between light and dark mode.</p>
              </div>
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
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5" />
              <div>
                <Label>Language</Label>
                <p className="text-xs text-muted-foreground">Choose your interface language.</p>
              </div>
            </div>
            <Select value={language} onValueChange={setLanguage}>
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
          <CardDescription>Choose which reminders you want to receive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <NotifRow label="Activity reminders" desc="Get notified before activities start." checked={notifActivity} onChange={setNotifActivity} />
          <NotifRow label="Daily journal reminder" desc="A gentle nudge to write each day." checked={notifJournal} onChange={setNotifJournal} />
          <NotifRow label="Water reminders" desc="Stay hydrated throughout the day." checked={notifWater} onChange={setNotifWater} />
          <NotifRow label="Pomodoro reminders" desc="Focus session start and end." checked={notifPomodoro} onChange={setNotifPomodoro} />
          <NotifRow label="Streak reminders" desc="Don't break your streak." checked={notifStreak} onChange={setNotifStreak} />
          <NotifRow label="Pen pal reminders" desc="When you receive a new letter." checked={notifPenPal} onChange={setNotifPenPal} />
          <Separator />
          <NotifRow label="Do not disturb (quiet hours)" desc="Mute notifications from 10 PM to 7 AM." checked={quietHours} onChange={setQuietHours} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-brand-600" /> Privacy</CardTitle>
          <CardDescription>Your journals are private by default.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only you can see your private journals. You can change a journal&apos;s visibility to
            &ldquo;Friends&rdquo; or &ldquo;Public&rdquo; from the journal editor. Admins cannot read
            private journals.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4 text-brand-600" /> Google Workspace</CardTitle>
          <CardDescription>Connect Google Calendar for automatic activity sync.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-3">
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : googleConnected ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Google Calendar</p>
                <p className="text-xs text-muted-foreground">
                  {googleLoading ? 'Checking status…' : googleConnected ? 'Connected — activities sync automatically.' : 'Not connected.'}
                </p>
              </div>
            </div>
            {googleConnected ? (
              <Button variant="outline" size="sm" onClick={disconnectGoogle} disabled={googleLoading}>Disconnect</Button>
            ) : (
              <Badge variant="secondary">Connect to enable</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            When connected, activities you create here appear in Google Calendar automatically, and changes sync both ways.
          </p>
        </CardContent>
      </Card>

      <Button onClick={save} className="w-full">Save settings</Button>
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
