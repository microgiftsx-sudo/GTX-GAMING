import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { sendWelcomeEmail } from '@/lib/order-mail';
import { markEmailWelcomedOnce } from '@/lib/email-notify-state';

const googleId = process.env.AUTH_GOOGLE_ID?.trim();
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  providers:
    googleId && googleSecret
      ? [
          Google({
            clientId: googleId,
            clientSecret: googleSecret,
            authorization: { params: { prompt: 'select_account' } },
          }),
        ]
      : [],
  callbacks: {
    async signIn({ account, user, profile }) {
      if (account?.provider === 'google') {
        const email = user?.email?.trim();
        if (email) {
          try {
            const shouldSend = await markEmailWelcomedOnce(email);
            if (shouldSend) {
              const p = profile as { locale?: string } | undefined;
              const locale = p?.locale?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
              await sendWelcomeEmail(email, locale);
            }
          } catch {
            // ignore mail failures
          }
        }
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'google' && profile && typeof profile === 'object') {
        const p = profile as { name?: string; email?: string; picture?: string };
        if (p.name) token.name = p.name;
        if (p.email) token.email = p.email;
        if (p.picture) token.picture = p.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
});
