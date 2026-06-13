import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
    newUser: "/onboarding",
  },
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env["GOOGLE_CLIENT_ID"]!,
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"]!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            password: true,
            role: true,
            emailVerified: true,
          },
        });

        if (!user || !user.password) return null;

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token["id"] = user.id;
        token["email"] = user.email ?? token["email"];
        token["name"] = user.name ?? token["name"];
        token["image"] = user.image ?? token["picture"];
        token["role"] = (user as { role?: string }).role ?? "USER";
      }
      if (trigger === "update" && session) {
        if (session.name) token["name"] = session.name;
        if (session.image) token["image"] = session.image;
      }
      // Refresh role from DB if not populated
      if (token["id"] && !token["role"]) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token["id"] as string },
            select: { role: true, name: true, email: true },
          });
          if (dbUser) {
            token["role"] = dbUser.role;
            token["name"] = dbUser.name ?? token["name"];
            token["email"] = dbUser.email ?? token["email"];
          }
        } catch (error) {
          console.error("[Auth] Failed to refresh user in JWT callback:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token["id"] as string;
        (session.user as { role?: string }).role = (token["role"] as string) ?? "USER";
        session.user.email = (token["email"] as string) ?? session.user.email;
        session.user.name = (token["name"] as string) ?? session.user.name;
        session.user.image =
          (token["image"] as string) ??
          (token["picture"] as string) ??
          session.user.image;
      }
      return session;
    },
    async signIn({ user, account, isNewUser }) {
      if (!user.id) return false;

      if (account?.provider === "google") {
        // Auto-verify email for Google OAuth users
        if (user.email) {
          await db.user
            .update({
              where: { email: user.email },
              data: { emailVerified: new Date() },
            })
            .catch(() => null);
        }
      }

      // For OAuth new users, create default records
      if (account?.provider !== "credentials" && isNewUser) {
        try {
          await Promise.all([
            db.settings.upsert({
              where: { userId: user.id },
              update: {},
              create: {
                userId: user.id,
                dailyReminderEnabled: true,
                reminderTime: "20:00",
                weeklyReportEnabled: true,
                crisisAlertsEnabled: true,
                aiInsightsEnabled: true,
                dataRetentionDays: 365,
                shareAnonymousData: false,
                theme: "system",
                language: "en",
              },
            }),
            db.wellnessStreak.upsert({
              where: { userId: user.id },
              update: {},
              create: {
                userId: user.id,
                currentStreak: 0,
                longestStreak: 0,
                totalCheckIns: 0,
              },
            }),
          ]);
        } catch (error) {
          console.error("[Auth] Failed to create default records for OAuth user:", error);
        }
      }

      return true;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;

      try {
        await db.profile.upsert({
          where: { userId: user.id },
          update: {},
          create: {
            userId: user.id,
            bio: null,
            examType: null,
            targetYear: null,
            currentLevel: null,
            studyHoursPerDay: null,
            strengths: [],
            weaknesses: [],
            onboardingCompleted: false,
          },
        });
      } catch (error) {
        console.error("[Auth] Failed to create default Profile in createUser event:", error);
      }
    },
  },
  debug: process.env["NODE_ENV"] === "development",
});

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
