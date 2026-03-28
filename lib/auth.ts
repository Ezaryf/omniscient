import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

// NextAuth configuration
const nextAuth = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID ?? "mock",
      clientSecret: process.env.GITHUB_SECRET ?? "mock",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

// Wrap auth to provide a mock session in development if GITHUB_ID is missing
const originalAuth = nextAuth.auth;

export const auth = async (...args: any[]) => {
  // If we are in development and no GitHub credentials, return a mock session
  if (process.env.NODE_ENV === "development" && (!process.env.GITHUB_ID || process.env.GITHUB_ID === "mock")) {
    return {
      user: {
        id: "dev-user-id",
        name: "Mock Developer",
        email: "dev@example.com",
      },
      expires: new Date(Date.now() + 3600 * 1000).toISOString(),
    } as any;
  }
  return (originalAuth as any)(...args);
};

export const { handlers, signIn, signOut } = nextAuth;
