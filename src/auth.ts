import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { reconcileThemeAtLogin } from "@/lib/theme-cookie";
import { logInSchema } from "@/lib/validation";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter stores users/accounts so OAuth providers can be added later.
  // The Prisma 7 client is structurally compatible with the adapter's v6 types.
  adapter: PrismaAdapter(
    prisma as unknown as Parameters<typeof PrismaAdapter>[0],
  ),
  // Credentials sign-in requires JWT sessions. The cookie has a fixed expiry,
  // so sessions survive browser restarts (US-1.2).
  session: { strategy: "jwt", maxAge: THIRTY_DAYS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = logInSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        // Compare against a dummy hash when the user doesn't exist so response
        // timing doesn't reveal which emails are registered.
        const ok = await bcrypt.compare(
          parsed.data.password,
          user?.passwordHash ??
            "$2b$12$yEIHoC8fnemA4sAKg7vxd.IkpAcsL.a8MxNCe9PMaSb6yTrrUKUM2",
        );
        if (!user?.passwordHash || !ok) return null;
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  events: {
    // Sync the theme between this browser and the account (see reconcileAtLogin).
    async signIn({ user }) {
      if (!user.id) return;
      try {
        await reconcileThemeAtLogin(user.id);
      } catch (e) {
        console.error("Theme sync at login failed", e); // never block a login
      }
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
