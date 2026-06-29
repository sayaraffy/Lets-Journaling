'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase/client';
import { useI18n } from '@/components/providers/i18n-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Moon, Sun, Bell, Globe, Shield, Palette, Calendar, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type NotifKey = 'activity' | 'journal' | 'water' | 'pomodoro' | 'streak' | 'penpal' | 'quiet_hours';

const DEFAULT_NOTIFS: Record<NotifKey, boolean> = {
  activity: true,
  journal: true,
  water: false,
  pomodoro: true,
  streak: true,
  penpal: true,
  quiet_hours: false,
};

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>(DEFAULT_NOTIFS);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setGoogleLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .maybeSingle();
      const settings = (data?.settings as { notifications?: Record<NotifKey, boolean> } | null)?.notifications;
      if (settings) setNotifs({ ...DEFAULT_NOTIFS, ...settings });
      const { data: tokenData } = await supabase.from('google_tokens').select('user_id').maybeSingle();
      setGoogleConnected(!!tokenData);
      setGoogleLoading(false);
    })();
  }, []);

  const updateNotif = (key: NotifKey, value: boolean) => {
    setNotifs((prev) => ({ ...prev, [key]: value }));
  };

  const connectGoogle = async () => {
    setGoogleConnecting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/settings&google_calendar=1`,
          scopes: 'openid email profile https://www.googleapis.com/auth/calendar',
        },
      });
      if (error) throw error;
    } catch (err) {
      setGoogleConnecting(false);
      toast.error(t('google.connect_failed'));
    }
  };

  const disconnectGoogle = async () => {
    setGoogleLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('google_tokens').delete().eq('user_id', user.id);
    }
    setGoogleConnected(false);
    setGoogleLoading(false);
    toast.success(t('google.disconnected'));
  };

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { data } = await supabase.from('profiles').select('settings').eq('id', user.id).maybeSingle();
    const current = (data?.settings as Record<string, unknown> | null) ?? {};
    await supabase
      .from('profiles')
      .update({ settings: { ...current, language: lang, notifications: notifs } })
      .eq('id', user.id);
    setSaving(false);
    toast.success(t('settings.saved'));
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-brand-600" /> {t('settings.appearance')}</CardTitle>
          <CardDescription>{t('settings.appearance.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <div>
                <Label>{t('settings.theme')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.theme.desc')}</p>
              </div>
            </div>
            <Select value={theme ?? 'system'} onValueChange={setTheme}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('theme.light')}</SelectItem>
                <SelectItem value="dark">{t('theme.dark')}</SelectItem>
                <SelectItem value="system">{t('theme.system')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5" />
              <div>
                <Label>{t('settings.language')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.language.desc')}</p>
              </div>
            </div>
            <Select value={lang} onValueChange={(v) => setLang(v as 'en' | 'id')}>
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
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-brand-600" /> {t('settings.notifications')}</CardTitle>
          <CardDescription>{t('settings.notifications.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <NotifRow label={t('notif.activity')} desc={t('notif.activity.desc')} checked={notifs.activity} onChange={(v) => updateNotif('activity', v)} />
          <NotifRow label={t('notif.journal')} desc={t('notif.journal.desc')} checked={notifs.journal} onChange={(v) => updateNotif('journal', v)} />
          <NotifRow label={t('notif.water')} desc={t('notif.water.desc')} checked={notifs.water} onChange={(v) => updateNotif('water', v)} />
          <NotifRow label={t('notif.pomodoro')} desc={t('notif.pomodoro.desc')} checked={notifs.pomodoro} onChange={(v) => updateNotif('pomodoro', v)} />
          <NotifRow label={t('notif.streak')} desc={t('notif.streak.desc')} checked={notifs.streak} onChange={(v) => updateNotif('streak', v)} />
          <NotifRow label={t('notif.penpal')} desc={t('notif.penpal.desc')} checked={notifs.penpal} onChange={(v) => updateNotif('penpal', v)} />
          <Separator />
          <NotifRow label={t('notif.quiet')} desc={t('notif.quiet.desc')} checked={notifs.quiet_hours} onChange={(v) => updateNotif('quiet_hours', v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-brand-600" /> {t('settings.privacy')}</CardTitle>
          <CardDescription>{t('settings.privacy.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {lang === 'id'
              ? 'Hanya Anda yang dapat melihat jurnal pribadi. Anda dapat mengubah visibilitas jurnal ke "Teman" atau "Publik" dari editor jurnal. Admin tidak dapat membaca jurnal pribadi.'
              : 'Only you can see your private journals. You can change a journal\'s visibility to "Friends" or "Public" from the journal editor. Admins cannot read private journals.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4 text-brand-600" /> {t('settings.google')}</CardTitle>
          <CardDescription>{t('settings.google.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-3">
              {googleLoading || googleConnecting ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : googleConnected ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">{t('google.calendar')}</p>
                <p className="text-xs text-muted-foreground">
                  {googleLoading ? t('google.checking') : googleConnected ? t('google.connected') : t('google.not_connected')}
                </p>
              </div>
            </div>
            {googleConnected ? (
              <Button variant="outline" size="sm" onClick={disconnectGoogle} disabled={googleLoading}>{t('google.disconnect')}</Button>
            ) : (
              <Button size="sm" onClick={connectGoogle} disabled={googleConnecting || googleLoading}>
                {googleConnecting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Calendar className="mr-1.5 h-3.5 w-3.5" />}
                {t('google.connect')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('google.sync_desc')}</p>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        {t('settings.save')}
      </Button>
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
