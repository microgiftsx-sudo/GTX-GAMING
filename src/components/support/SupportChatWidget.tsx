"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, MessageCircle, Send, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type TicketMessage = {
  id: string;
  from: 'customer' | 'agent';
  text?: string;
  attachment?: { url: string; kind: 'image' | 'video'; fileName: string };
  createdAt: string;
};

type TicketPayload = {
  id: string;
  messages: TicketMessage[];
};

const TICKET_STORAGE_KEY = 'gtx_support_ticket_id';

export default function SupportChatWidget() {
  const t = useTranslations('SupportChat');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error' | 'loading'>('idle');
  const [hasUnreadAgentReply, setHasUnreadAgentReply] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedMessagesRef = useRef(false);

  const playAgentReplyTone = () => {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const tones = [
        { f: 1318.5, d: 0.08, gap: 0.02 },
        { f: 1108.7, d: 0.08, gap: 0.02 },
        { f: 1760.0, d: 0.12, gap: 0 },
      ];
      let offset = 0;
      for (const tone of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = tone.f;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.linearRampToValueAtTime(0.12, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + tone.d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + tone.d);
        offset += tone.d + tone.gap;
      }
      window.setTimeout(() => void ctx.close(), 650);
    } catch {
      // ignore audio API failures
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(TICKET_STORAGE_KEY);
    if (saved?.trim()) setTicketId(saved.trim());
  }, []);

  useEffect(() => {
    if (!ticketId || !open) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/support/chat?ticketId=${encodeURIComponent(ticketId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { ticket?: TicketPayload };
        if (!cancelled && data.ticket?.messages) {
          setMessages(data.ticket.messages);
        }
      } catch {
        // ignore
      }
    };
    void run();
    const timer = window.setInterval(run, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ticketId, open]);

  useEffect(() => {
    if (!open) return;
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open && hasUnreadAgentReply) {
      setHasUnreadAgentReply(false);
    }
  }, [open, hasUnreadAgentReply]);

  useEffect(() => {
    if (messages.length === 0) return;
    if (!bootstrappedMessagesRef.current) {
      for (const m of messages) knownMessageIdsRef.current.add(m.id);
      bootstrappedMessagesRef.current = true;
      return;
    }
    const newAgentReply = messages.some(
      (m) => m.from === 'agent' && !knownMessageIdsRef.current.has(m.id),
    );
    for (const m of messages) knownMessageIdsRef.current.add(m.id);
    if (newAgentReply) {
      if (!open) setHasUnreadAgentReply(true);
      playAgentReplyTone();
    }
  }, [messages, open]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!open) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [open]);

  const submit = async () => {
    if (sending) return;
    if (message.trim().length < 1 && !mediaFile) {
      setStatus('error');
      return;
    }
    setSending(true);
    setStatus('loading');
    try {
      const form = new FormData();
      if (ticketId) form.set('ticketId', ticketId);
      form.set('message', message.trim());
      form.set('locale', locale);
      if (typeof window !== 'undefined') form.set('pageUrl', window.location.href);
      if (mediaFile) form.set('media', mediaFile);
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error('send failed');
      const data = (await res.json()) as { ticket?: TicketPayload; ticketId?: string };
      if (data.ticket?.id) {
        setTicketId(data.ticket.id);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(TICKET_STORAGE_KEY, data.ticket.id);
        }
      } else if (data.ticketId && typeof window !== 'undefined') {
        window.localStorage.setItem(TICKET_STORAGE_KEY, data.ticketId);
        setTicketId(data.ticketId);
      }
      if (data.ticket?.messages) setMessages(data.ticket.messages);
      setStatus('ok');
      setMessage('');
      setMediaFile(null);
    } catch {
      setStatus('error');
    } finally {
      setSending(false);
    }
  };

  const hasMessages = messages.length > 0;
  const selectedMediaLabel = useMemo(() => mediaFile?.name ?? '', [mediaFile]);
  const mediaPreviewUrl = useMemo(() => {
    if (!mediaFile) return '';
    return URL.createObjectURL(mediaFile);
  }, [mediaFile]);
  const mediaIsImage = mediaFile?.type.startsWith('image/') ?? false;
  const mediaIsVideo = mediaFile?.type.startsWith('video/') ?? false;

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 end-5 z-[90] inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange text-white transition-transform hover:scale-105 active:scale-95"
        aria-label={t('open')}
      >
        {hasUnreadAgentReply && (
          <span className="absolute -end-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-surface-elevated bg-red-500" />
        )}
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex h-[100svh] w-screen flex-col overflow-hidden overscroll-none bg-surface-elevated px-3 pb-3 pt-1 md:bottom-20 md:end-5 md:inset-auto md:h-[min(72vh,560px)] md:w-[min(94vw,390px)] md:rounded-2xl md:border md:border-edge md:px-3 md:pb-3 md:pt-2 md:shadow-2xl">
          <div className="mb-2 border-b border-edge pb-2">
            <div className="mb-0 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center text-muted transition-colors hover:text-foreground"
                aria-label={t('close')}
              >
                <X size={16} />
              </button>
            </div>
            <h3 className="text-base font-bold text-foreground">{t('title')}</h3>
            <p className="text-xs text-muted">{t('subtitle')}</p>
          </div>

          <div ref={bodyRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pe-1">
            {!hasMessages && <p className="text-xs text-muted">{t('empty')}</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'customer' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[88%]">
                  {m.text && (
                    <div className={`rounded-2xl px-3 py-2 text-sm ${
                      m.from === 'customer' ? 'bg-brand-orange text-white' : 'bg-white/8 text-foreground'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    </div>
                  )}
                  {m.attachment?.kind === 'image' && (
                    <a
                      href={m.attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`block overflow-hidden rounded-2xl border border-white/10 bg-black/20 ${m.text ? 'mt-2' : ''}`}
                    >
                      <img src={m.attachment.url} alt={m.attachment.fileName} className="max-h-48 w-full object-cover" />
                    </a>
                  )}
                  {m.attachment?.kind === 'video' && (
                    <div className={`overflow-hidden rounded-2xl border border-white/10 bg-black/20 ${m.text ? 'mt-2' : ''}`}>
                      <video src={m.attachment.url} controls className="max-h-56 w-full" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            className="mt-2 border-t border-edge pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {selectedMediaLabel && (
              <div className="mb-2 overflow-hidden rounded-xl border border-edge bg-surface px-2 py-2">
                <div className="mb-1 flex items-start justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMediaFile(null)}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-edge text-[11px] text-muted hover:text-foreground"
                    aria-label="Remove selected media"
                  >
                    <X size={11} />
                  </button>
                </div>
                {mediaPreviewUrl && mediaIsImage && (
                  <img
                    src={mediaPreviewUrl}
                    alt={selectedMediaLabel}
                    className="max-h-28 w-auto rounded-md object-cover"
                  />
                )}
                {mediaPreviewUrl && mediaIsVideo && (
                  <video src={mediaPreviewUrl} className="max-h-32 w-auto rounded-md" muted controls />
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-edge text-muted hover:bg-white/5 hover:text-foreground">
                <Paperclip size={16} />
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder={t('message')}
                className="h-10 min-w-0 flex-1 rounded-full border border-edge bg-surface px-3 text-sm text-foreground outline-none focus:border-brand-orange/40"
              />
              <button
                type="submit"
                disabled={sending}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white transition-colors hover:bg-brand-orange/90 disabled:opacity-60"
                aria-label={sending || status === 'loading' ? t('sending') : t('send')}
              >
                <Send size={15} />
              </button>
            </div>
          </form>

          {status === 'error' && <p className="mt-2 text-xs text-red-300">{t('error')}</p>}
        </div>
      )}
    </>
  );
}

