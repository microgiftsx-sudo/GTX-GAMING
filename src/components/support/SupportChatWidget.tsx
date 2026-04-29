"use client";

import React, { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

export default function SupportChatWidget() {
  const t = useTranslations('SupportChat');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const submit = async () => {
    if (sending) return;
    if (name.trim().length < 2 || contact.trim().length < 3 || message.trim().length < 3) {
      setStatus('error');
      return;
    }
    setSending(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim(),
          message: message.trim(),
          locale,
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
      if (!res.ok) throw new Error('send failed');
      setStatus('ok');
      setMessage('');
    } catch {
      setStatus('error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 end-5 z-[90] inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange text-white shadow-xl shadow-brand-orange/40 transition-transform hover:scale-105 active:scale-95"
        aria-label={t('open')}
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>

      {open && (
        <div className="fixed bottom-20 end-5 z-[90] w-[min(92vw,360px)] rounded-2xl border border-edge bg-surface-elevated p-4 shadow-2xl">
          <h3 className="mb-2 text-base font-bold text-foreground">{t('title')}</h3>
          <p className="mb-3 text-xs text-muted">{t('subtitle')}</p>

          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('name')}
              className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange/40"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('contact')}
              className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange/40"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('message')}
              rows={4}
              className="w-full resize-none rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange/40"
            />
          </div>

          {status === 'ok' && <p className="mt-2 text-xs text-emerald-400">{t('sent')}</p>}
          {status === 'error' && <p className="mt-2 text-xs text-red-300">{t('error')}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-orange/90 disabled:opacity-60"
          >
            <Send size={14} />
            {sending ? t('sending') : t('send')}
          </button>
        </div>
      )}
    </>
  );
}

