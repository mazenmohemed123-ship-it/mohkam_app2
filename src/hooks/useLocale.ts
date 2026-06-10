import { useState, useEffect } from 'react';

export type AppLocale = 'ar' | 'en' | 'fr';

const LOCALE_MAP: Record<string, AppLocale> = {
  ar: 'ar',
  areg: 'ar',
  arsa: 'ar',
  arae: 'ar',
  armu: 'ar',
  fr: 'fr',
  frfr: 'fr',
  frma: 'fr',
  frcd: 'fr',
  frtn: 'fr',
  frdz: 'fr',
  frmr: 'fr',
  en: 'en',
  enus: 'en',
  engb: 'en',
  enau: 'en',
  enca: 'en',
};

function detectLocale(): AppLocale {
  const langs = navigator.languages || [navigator.language || 'ar'];
  for (const lang of langs) {
    const lower = lang.toLowerCase().replace(/[-_]/g, '');
    if (LOCALE_MAP[lower]) return LOCALE_MAP[lower];
    const prefix = lower.slice(0, 2);
    if (LOCALE_MAP[prefix]) return LOCALE_MAP[prefix];
    if (prefix === 'ar') return 'ar';
    if (prefix === 'fr') return 'fr';
    if (prefix === 'en') return 'en';
  }
  return 'ar';
}

export function useLocale() {
  const [locale, setLocale] = useState<AppLocale>(() => {
    const stored = localStorage.getItem('mohkam_locale') as AppLocale | null;
    return stored || detectLocale();
  });

  useEffect(() => {
    localStorage.setItem('mohkam_locale', locale);
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  return { locale, setLocale, isRTL: locale === 'ar' };
}
