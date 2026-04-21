import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

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
