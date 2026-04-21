import '@/lib/load-env';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

/** Read OAuth env at request time so dev/Turbopack never caches an empty provider list. */
function googleProviders() {
  const googleId = process.env.AUTH_GOOGLE_ID?.trim();
  const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
  if (!googleId || !googleSecret) return [];
  return [
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
      authorization: { params: { prompt: 'select_account' } },
    }),
  ];
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  providers: googleProviders(),
  callbacks: {
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
}));
