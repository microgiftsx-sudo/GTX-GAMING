/** Stored in `document.cookie` as JSON (URI-encoded). */

export const CONSENT_COOKIE_NAME = "gtx_cookie_consent";
export const CONSENT_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year

export type CookieConsentState = {
  v: 1;
  essential: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: number;
};

export function defaultAccepted(): CookieConsentState {
  const t = Date.now();
  return { v: 1, essential: true, analytics: true, marketing: true, updatedAt: t };
}

export function defaultRejected(): CookieConsentState {
  const t = Date.now();
  return { v: 1, essential: true, analytics: false, marketing: false, updatedAt: t };
}

export function parseConsent(raw: string | null): CookieConsentState | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as CookieConsentState;
    if (parsed?.v !== 1 || parsed.essential !== true) return null;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean")
      return null;
    return parsed;
  } catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = `; ${document.cookie}`.split(`; ${name}=`);
  if (parts.length !== 2) return null;
  const raw = parts.pop()?.split(";").shift();
  return raw ? decodeURIComponent(raw) : null;
}

export function getConsentFromDocument(): CookieConsentState | null {
  return parseConsent(readCookie(CONSENT_COOKIE_NAME));
}

export function writeConsentToDocument(state: CookieConsentState): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(state));
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; path=/; max-age=${CONSENT_MAX_AGE_SEC}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
