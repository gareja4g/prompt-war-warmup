import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createJournalSchema, paginationSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { logDataMutation, logDataAccess } from "@/security/audit";
import { analyzeJournalEntry, checkAndAwardAchievements } from "@/ai/wellness-engine";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = paginationSchema.safeParse({
    page: searchParams.get("page") ?? 1,
    pageSize: searchParams.get("pageSize") ?? 20,
  });

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid pagination params" }, { status: 400 });
  }

  const { page, pageSize } = parsed.data;
  const skip = (page - 1) * pageSize;

  try {
    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          aiInsights: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      db.journalEntry.count({ where: { userId: session.user.id } }),
    ]);

    await logDataAccess(session.user.id, "journal_entries");

    return NextResponse.json({
      success: true,
      data: entries,
      total,
      page,
      pageSize,
      hasMore: skip + entries.length < total,
    });
  } catch (error) {
    console.error("Journal GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch journal entries" }, { status: 500 });
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
    const parsed = createJournalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.errors },
        { status: 422 }
      );
    }

    const { title, content, mood, tags, gratitudeItems, studyHours, sleepHours, isPrivate } = parsed.data;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { profile: true },
    });

    const entry = await db.journalEntry.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        content: content.trim(),
        mood,
        tags,
        gratitudeItems: gratitudeItems ?? [],
        studyHours,
        sleepHours,
        isPrivate: isPrivate ?? false,
        wordCount: content.trim().split(/\s+/).length,
        sentiment: 0,
      },
    });

    await logDataMutation(session.user.id, "create", "journal_entry", { entryId: entry.id });

    // Async AI analysis - don't block the response
    void analyzeJournalEntry(
      session.user.id,
      entry.id,
      content,
      user?.name ?? "Student",
      user?.profile?.examType ?? "NEET"
    ).then(() => checkAndAwardAchievements(session.user.id));

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error("Journal POST error:", error);
    return NextResponse.json({ success: false, error: "Failed to create journal entry" }, { status: 500 });
  }
}
