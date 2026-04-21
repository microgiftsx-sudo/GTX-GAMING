'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  /** بعد العودة من نافذة Google، إعادة جلب الجلسة تُظهر «حسابي» دون إعادة تحميل كاملة. */
  return <SessionProvider refetchOnWindowFocus>{children}</SessionProvider>;
}
