import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations";
import { rateLimit, AUTH_LIMIT } from "@/lib/rate-limit";
import { logAuditEvent } from "@/security/audit";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const { success } = await rateLimit(
    `auth:register:${ip}`,
    AUTH_LIMIT.limit,
    AUTH_LIMIT.window,
  );

  if (!success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const body = (await req.json()) as unknown;
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 422 },
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "An account with this email already exists",
        },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        settings: {
          create: {
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
        },
        profile: {
          create: {
            bio: null,
            examType: null,
            targetYear: null,
            currentLevel: null,
            studyHoursPerDay: null,
            strengths: [],
            weaknesses: [],
            onboardingCompleted: false,
          },
        },
        wellnessStreak: {
          create: {
            currentStreak: 0,
            longestStreak: 0,
            totalCheckIns: 0,
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    await logAuditEvent({
      userId: user.id,
      action: "register",
      resource: "user",
      details: { email: normalizedEmail },
    });

    return NextResponse.json(
      { success: true, data: { userId: user.id } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
