'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { Turnstile } from '@marsidev/react-turnstile';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Loader2 } from 'lucide-react';

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';

export default function LoginClient() {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasGoogle, setHasGoogle] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        if (!cancelled) setHasGoogle(Boolean(data?.google));
      })
      .catch(() => {
        if (!cancelled) setHasGoogle(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const needsTurnstile = Boolean(siteKey);
  const canUseGoogle = hasGoogle === true && (!needsTurnstile || Boolean(turnstileToken));

  async function handleGoogleSignIn() {
    if (!hasGoogle) return;
    setError(null);
    setLoading(true);
    try {
      if (needsTurnstile && turnstileToken) {
        const vr = await fetch('/api/turnstile/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const vj = (await vr.json()) as { ok?: boolean; skipped?: boolean };
        if (!vr.ok || !vj.ok) {
          setError(t('turnstileFailed'));
          setLoading(false);
          return;
        }
      }

      await signIn('google', { callbackUrl: `/${locale}` });
    } catch {
      setError(t('signInError'));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="card-surface rounded-3xl border border-edge p-6 shadow-xl shadow-black/30 ring-1 ring-white/[0.04] sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{t('title')}</h1>
          <p className="mt-2 text-sm text-muted">{t('subtitle')}</p>
        </div>

        {needsTurnstile && (
          <div className="mb-6 flex flex-col items-center gap-3">
            <p className="text-center text-xs text-muted">{t('turnstileHint')}</p>
            <Turnstile
              siteKey={siteKey}
              onSuccess={(token) => {
                setTurnstileToken(token);
                setError(null);
              }}
              onExpire={() => setTurnstileToken(null)}
              onError={() => {
                setTurnstileToken(null);
                setError(t('turnstileWidgetError'));
              }}
              options={{ theme: 'dark' }}
            />
          </div>
        )}

        {hasGoogle === false && (
          <div
            role="status"
            className="mb-6 space-y-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-4 text-start text-xs leading-relaxed text-amber-50 sm:text-[13px]"
          >
            <p className="font-semibold text-amber-100">{t('providerMissingIntro')}</p>
            <p className="text-amber-100/90">{t('providerMissingWhere')}</p>
            <p className="text-amber-100/90">{t('providerMissingHow')}</p>
            <p className="text-amber-100/90">{t('providerMissingBrowse')}</p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={loading || hasGoogle !== true || !canUseGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-edge bg-surface-elevated py-3.5 text-sm font-semibold text-foreground shadow-inner transition hover:border-brand-orange/40 hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-45"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-brand-orange" aria-hidden />
          ) : (
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          {t('googleButton')}
        </button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">{t('googleLegal')}</p>

        <div className="mt-8 border-t border-edge pt-6 text-center text-xs">
          <Link href="/" className="font-medium text-brand-orange hover:underline">
            {t('backHome')}
          </Link>
          <span className="mx-2 text-faint" aria-hidden>
            ·
          </span>
          <Link href="/search" className="font-medium text-brand-orange hover:underline">
            {t('browseStore')}
          </Link>
        </div>
      </div>
    </div>
  );
}
