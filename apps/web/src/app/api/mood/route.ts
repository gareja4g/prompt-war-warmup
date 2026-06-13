import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createMoodLogSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { logDataMutation } from "@/security/audit";
import { updateDailyWellnessScore } from "@/ai/wellness-engine";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "30", 10);
  const clampedDays = Math.min(Math.max(days, 1), 365);

  const since = new Date();
  since.setDate(since.getDate() - clampedDays);

  try {
    const logs = await db.moodLog.findMany({
      where: { userId: session.user.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error("Mood GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch mood logs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { success: rateLimitOk } = await rateLimit(session.user.id, "journal");
  if (!rateLimitOk) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json() as unknown;
    const parsed = createMoodLogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.errors },
        { status: 422 }
      );
    }

    const log = await db.moodLog.create({
      data: {
        userId: session.user.id,
        ...parsed.data,
      },
    });

    await logDataMutation(session.user.id, "create", "mood_log", { logId: log.id });

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { profile: true },
    });

    void updateDailyWellnessScore(session.user.id, user?.profile?.examType ?? "NEET");

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error("Mood POST error:", error);
    return NextResponse.json({ success: false, error: "Failed to log mood" }, { status: 500 });
  }
}
