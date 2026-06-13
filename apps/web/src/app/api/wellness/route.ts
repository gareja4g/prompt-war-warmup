import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studyLogSchema } from "@/lib/validations";
import { updateDailyWellnessScore } from "@/ai/wellness-engine";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10), 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const scores = await db.wellnessScore.findMany({
      where: { userId: session.user.id, date: { gte: since } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ success: true, data: scores });
  } catch (error) {
    console.error("Wellness GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch wellness scores" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as unknown;
    const parsed = studyLogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.errors },
        { status: 422 }
      );
    }

    const date = parsed.data.date ? new Date(parsed.data.date) : new Date();
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const log = await db.studyLog.upsert({
      where: { userId_date: { userId: session.user.id, date: dateOnly } },
      update: {
        hoursStudied: parsed.data.hoursStudied,
        hoursSlept: parsed.data.hoursSlept,
        hoursExercised: parsed.data.hoursExercised,
        breaksTaken: parsed.data.breaksTaken,
        notes: parsed.data.notes,
      },
      create: {
        userId: session.user.id,
        date: dateOnly,
        hoursStudied: parsed.data.hoursStudied,
        hoursSlept: parsed.data.hoursSlept,
        hoursExercised: parsed.data.hoursExercised,
        breaksTaken: parsed.data.breaksTaken,
        notes: parsed.data.notes,
      },
    });

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { profile: true },
    });

    void updateDailyWellnessScore(session.user.id, user?.profile?.examType ?? "NEET");

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error("Study log POST error:", error);
    return NextResponse.json({ success: false, error: "Failed to log study data" }, { status: 500 });
  }
}
