import NextAuth from 'next-auth';

// Browser-facing URL — what the user's browser navigates to for the OAuth consent page
const GITEA_URL = process.env.GITEA_URL ?? 'http://localhost:3000';
// Server-facing URL — what the Next.js server calls for token exchange and userinfo.
// Inside Docker, epoch-web reaches Gitea via host.docker.internal; in dev they're the same.
const GITEA_INTERNAL_URL = process.env.GITEA_INTERNAL_URL ?? GITEA_URL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    {
      id: 'gitea',
      name: 'Gitea',
      type: 'oauth',
      authorization: {
        url: `${GITEA_URL}/login/oauth/authorize`,
        params: { scope: 'read:user write:repository' },
      },
      token: `${GITEA_INTERNAL_URL}/login/oauth/access_token`,
      userinfo: `${GITEA_INTERNAL_URL}/api/v1/user`,
      clientId: process.env.GITEA_CLIENT_ID!,
      clientSecret: process.env.GITEA_CLIENT_SECRET!,
      profile(profile: Record<string, unknown>) {
        return {
          id: String(profile['id']),
          name: (profile['full_name'] as string) || (profile['login'] as string),
          email: profile['email'] as string | null,
          image: profile['avatar_url'] as string | null,
          login: profile['login'] as string,
        };
      },
    },
  ],
  callbacks: {
    authorized({ auth }) {
      // Return true to allow, false to redirect to sign-in
      return !!auth?.user;
    },
    jwt({ token, account, profile }) {
      if (account?.access_token) {
        token['accessToken'] = account.access_token;
      }
      if (profile) {
        token['login'] = (profile as Record<string, unknown>)['login'];
      }
      return token;
    },
    session({ session, token }) {
      (session as unknown as Record<string, unknown>)['accessToken'] = token['accessToken'];
      if (session.user) {
        (session.user as unknown as Record<string, unknown>)['login'] = token['login'];
      }
      return session;
    },
  },
});
