import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateJournalStreak } from "@/ai/wellness-engine";

export const revalidate = 60; // ISR - revalidate every minute

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      latestWellness,
      weeklyScores,
      recentMoods,
      recentInsights,
      totalEntries,
      userAchievements,
      streak,
    ] = await Promise.all([
      db.wellnessScore.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
      }),
      db.wellnessScore.findMany({
        where: { userId, date: { gte: sevenDaysAgo } },
        orderBy: { date: "asc" },
      }),
      db.moodLog.findMany({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 7,
      }),
      db.aIInsight.findMany({
        where: { userId, isRead: false },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      db.journalEntry.count({ where: { userId } }),
      db.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
        orderBy: { earnedAt: "desc" },
        take: 5,
      }),
      calculateJournalStreak(userId),
    ]);

    const moodValues: Record<string, number> = {
      ECSTATIC: 10,
      HAPPY: 8,
      CALM: 7,
      NEUTRAL: 5,
      UNEASY: 4,
      SAD: 3,
      ANXIOUS: 2,
      OVERWHELMED: 1,
      EXHAUSTED: 2,
      ANGRY: 1,
    };

    const weeklyMoodAvg =
      recentMoods.length > 0
        ? recentMoods.reduce((sum, m) => sum + (moodValues[m.mood] ?? 5), 0) / recentMoods.length
        : 5;

    return NextResponse.json({
      success: true,
      data: {
        currentWellnessScore: latestWellness?.overallScore ?? 50,
        burnoutRisk: latestWellness?.burnoutRisk ?? 30,
        anxietyScore: latestWellness?.anxietyScore ?? 30,
        motivationScore: latestWellness?.motivationScore ?? 70,
        recoveryScore: latestWellness?.recoveryScore ?? 60,
        currentStreak: streak,
        totalJournalEntries: totalEntries,
        weeklyMoodAvg: Math.round(weeklyMoodAvg * 10) / 10,
        weeklyScores,
        recentMoodLogs: recentMoods,
        recentInsights,
        achievements: userAchievements,
      },
    });
  } catch (error) {
    console.error("Dashboard GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
