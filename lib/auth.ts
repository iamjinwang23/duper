import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { adminEmails, env } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return adminEmails.includes(user.email.toLowerCase());
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/admin/login",
  },
  secret: env.NEXTAUTH_SECRET,
});
