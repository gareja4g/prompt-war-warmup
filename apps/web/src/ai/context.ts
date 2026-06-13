import { db } from "@/lib/db";
import type { ExamType } from "@prisma/client";

export interface UserWellnessContext {
  userName: string;
  examType: ExamType;
  aiPersonality: string;
  recentMoodSummary: string;
  burnoutLevel: string;
  journalThemes: string[];
  daysToExam: number;
  currentStreak: number;
}

export async function buildUserContext(userId: string): Promise<UserWellnessContext | null> {
  try {
    const [user, recentMoods, latestScore, settings] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      }),
      db.moodLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 7,
      }),
      db.wellnessScore.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
      }),
      db.settings.findUnique({ where: { userId } }),
    ]);

    if (!user || !user.profile) return null;

    const moodFrequency = recentMoods.reduce((acc, m) => {
      acc[m.mood] = (acc[m.mood] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominantMood = Object.entries(moodFrequency).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "NEUTRAL";

    const burnoutLevel = !latestScore
      ? "unknown"
      : latestScore.burnoutRisk >= 75 ? "critical"
      : latestScore.burnoutRisk >= 50 ? "high"
      : latestScore.burnoutRisk >= 25 ? "moderate"
      : "low";

    const targetYear = user.profile.targetYear;
    const now = new Date();
    const examDate = new Date(targetYear, 4, 15); // May 15 of target year
    const daysToExam = Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const recentInsights = await db.aIInsight.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { insightType: true },
    });

    const journalThemes = [...new Set(recentInsights.map((i) => i.insightType))];

    return {
      userName: user.name ?? "Student",
      examType: user.profile.examType,
      aiPersonality: settings?.aiPersonality ?? "supportive",
      recentMoodSummary: `Recent mood trend: ${dominantMood} (based on last 7 days)`,
      burnoutLevel,
      journalThemes: journalThemes.map(String),
      daysToExam,
      currentStreak: 0, // Will be calculated separately
    };
  } catch (error) {
    console.error("Failed to build user context:", error);
    return null;
  }
}

export function formatContextForPrompt(context: UserWellnessContext): string {
  return `
STUDENT CONTEXT UPDATE:
- Dominant mood (last 7 days): ${context.recentMoodSummary}
- Current burnout level: ${context.burnoutLevel}
- Days until exam: ${context.daysToExam}
- Recent themes: ${context.journalThemes.join(", ") || "none identified"}
- Journal streak: ${context.currentStreak} days
`.trim();
}
