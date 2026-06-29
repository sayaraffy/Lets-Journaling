'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { dictionaries, type Lang } from '@/lib/i18n/translations';

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  loading: boolean;
};

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  loading: true,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 1. Try persisted DB preference
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', user.id)
          .maybeSingle();
        const dbLang = (data?.settings as { language?: Lang } | null)?.language;
        if (dbLang === 'en' || dbLang === 'id') {
          setLangState(dbLang);
          setLoading(false);
          return;
        }
      }
      // 2. Fall back to browser language
      if (typeof navigator !== 'undefined') {
        const browser = navigator.language.toLowerCase();
        if (browser.startsWith('id')) {
          setLangState('id');
        }
      }
      setLoading(false);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', user.id)
          .maybeSingle();
        const current = (data?.settings as Record<string, unknown> | null) ?? {};
        await supabase
          .from('profiles')
          .update({ settings: { ...current, language: l } })
          .eq('id', user.id);
      }
    })();
  }, []);

  const t = useCallback(
    (key: string) => dictionaries[lang][key] ?? dictionaries.en[key] ?? key,
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, loading }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
