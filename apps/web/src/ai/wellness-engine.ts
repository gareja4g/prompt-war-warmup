import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { assessCrisisLevel } from "./crisis-detection";
import { getBurnoutAnalysisPrompt, getJournalAnalysisPrompt } from "./prompts";
import type { ExamType } from "@prisma/client";
import { MOOD_CONFIG } from "@/types";

const wellnessAnalysisSchema = z.object({
  burnoutScore: z.number().min(0).max(100),
  anxietyScore: z.number().min(0).max(100),
  motivationScore: z.number().min(0).max(100),
  recoveryScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  insights: z.array(z.string()).max(5),
  recommendations: z.array(z.string()).max(5),
  crisisDetected: z.boolean(),
  primaryStressors: z.array(z.string()).max(3),
  protectiveFactors: z.array(z.string()).max(3),
});

const journalInsightSchema = z.object({
  sentiment: z.number().min(-1).max(1),
  emotionalState: z.string(),
  intensity: z.enum(["low", "medium", "high"]),
  themes: z.array(z.string()).max(5),
  insight: z.string().max(500),
  recommendation: z.string().max(300),
  actionItems: z.array(z.string()).max(3),
  burnoutRisk: z.enum(["low", "medium", "high"]),
  anxietyLevel: z.enum(["low", "medium", "high"]),
  crisisIndicators: z.boolean(),
  positiveElements: z.array(z.string()).max(3),
});

export async function analyzeJournalEntry(
  userId: string,
  journalId: string,
  content: string,
  userName: string,
  examType: ExamType
): Promise<void> {
  try {
    // Quick crisis check before AI processing
    const crisisCheck = assessCrisisLevel(content);

    const prompt = getJournalAnalysisPrompt(content, userName, examType);

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: journalInsightSchema,
      prompt,
      temperature: 0.3,
    });

    const insightType = object.crisisIndicators || crisisCheck.level === "critical"
      ? "CRISIS"
      : object.burnoutRisk === "high"
      ? "BURNOUT"
      : object.anxietyLevel === "high"
      ? "ANXIETY"
      : object.sentiment > 0.3
      ? "POSITIVE"
      : object.themes.includes("motivation")
      ? "MOTIVATION"
      : "STRESS";

    await db.$transaction([
      db.journalEntry.update({
        where: { id: journalId },
        data: {
          sentiment: object.sentiment,
          aiInsight: object.insight,
        },
      }),
      db.aIInsight.create({
        data: {
          userId,
          journalId,
          insightType,
          content: object.insight,
          confidence: 0.85,
          actionItems: object.actionItems,
        },
      }),
    ]);

    // Update wellness score after journal analysis
    await updateDailyWellnessScore(userId, examType);
  } catch (error) {
    console.error("Journal analysis failed:", error);
    // Non-blocking - don't throw
  }
}

export async function updateDailyWellnessScore(userId: string, examType: ExamType): Promise<void> {
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const [recentMoods, recentJournals, profile] = await Promise.all([
      db.moodLog.findMany({
        where: { userId, createdAt: { gte: twoWeeksAgo } },
        orderBy: { createdAt: "desc" },
        take: 14,
      }),
      db.journalEntry.findMany({
        where: { userId, createdAt: { gte: twoWeeksAgo } },
        orderBy: { createdAt: "desc" },
        take: 14,
        select: { sentiment: true, studyHours: true, sleepHours: true, mood: true },
      }),
      db.profile.findUnique({ where: { userId } }),
    ]);

    if (recentMoods.length === 0 && recentJournals.length === 0) return;

    const moodValues = recentMoods.map((m) => MOOD_CONFIG[m.mood]?.value ?? 5);
    const avgMoodValue = moodValues.length > 0
      ? moodValues.reduce((a, b) => a + b, 0) / moodValues.length
      : 5;

    const sentiments = recentJournals.map((j) => j.sentiment);
    const avgSentiment = sentiments.length > 0
      ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
      : 0;

    const studyHoursArr = recentJournals.flatMap((j) => j.studyHours ? [j.studyHours] : []);
    const sleepHoursArr = recentJournals.flatMap((j) => j.sleepHours ? [j.sleepHours] : []);

    const targetStudy = profile?.studyHoursPerDay ?? 8;
    const targetSleep = profile?.sleepHoursTarget ?? 7;

    const avgStudy = studyHoursArr.length > 0
      ? studyHoursArr.reduce((a, b) => a + b, 0) / studyHoursArr.length
      : targetStudy;

    const avgSleep = sleepHoursArr.length > 0
      ? sleepHoursArr.reduce((a, b) => a + b, 0) / sleepHoursArr.length
      : targetSleep;

    // Compute composite scores
    const moodScore = (avgMoodValue / 10) * 100;
    const sentimentScore = ((avgSentiment + 1) / 2) * 100;
    const sleepScore = Math.min(100, (avgSleep / targetSleep) * 100);
    const studyBalance = Math.min(1, avgStudy / (targetStudy * 1.2));

    // Burnout risk increases with over-studying, poor sleep, negative mood
    const overStudyFactor = Math.max(0, (avgStudy - targetStudy * 1.1) / targetStudy);
    const poorSleepFactor = Math.max(0, (targetSleep - avgSleep) / targetSleep);
    const negativeMoodFactor = Math.max(0, (5 - avgMoodValue) / 5);
    const burnoutRisk = Math.min(100, (overStudyFactor * 30 + poorSleepFactor * 35 + negativeMoodFactor * 35));

    const anxietyScore = Math.min(100,
      100 - ((moodScore * 0.4 + sentimentScore * 0.4 + sleepScore * 0.2))
    );

    const motivationScore = Math.min(100,
      moodScore * 0.5 + sentimentScore * 0.3 + (studyHoursArr.length > 0 ? 20 : 0)
    );

    const recoveryScore = Math.min(100,
      sleepScore * 0.5 + (100 - burnoutRisk) * 0.3 + moodScore * 0.2
    );

    const overallScore = Math.min(100,
      (100 - burnoutRisk) * 0.25 +
      motivationScore * 0.25 +
      (100 - anxietyScore) * 0.25 +
      recoveryScore * 0.25
    );

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    await db.wellnessScore.upsert({
      where: { userId_date: { userId, date: dateOnly } },
      update: {
        overallScore,
        burnoutRisk,
        anxietyScore,
        motivationScore,
        recoveryScore,
        studyBalance,
      },
      create: {
        userId,
        date: dateOnly,
        overallScore,
        burnoutRisk,
        anxietyScore,
        motivationScore,
        recoveryScore,
        studyBalance,
      },
    });
  } catch (error) {
    console.error("Wellness score update failed:", error);
  }
}

export async function generateWellnessAnalysis(
  userId: string,
  examType: ExamType,
  userName: string
): Promise<{
  burnoutScore: number;
  anxietyScore: number;
  motivationScore: number;
  recoveryScore: number;
  overallScore: number;
  insights: string[];
  recommendations: string[];
} | null> {
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const [moods, journals] = await Promise.all([
      db.moodLog.findMany({
        where: { userId, createdAt: { gte: twoWeeksAgo } },
        take: 14,
        orderBy: { createdAt: "desc" },
      }),
      db.journalEntry.findMany({
        where: { userId, createdAt: { gte: twoWeeksAgo } },
        take: 14,
        orderBy: { createdAt: "desc" },
        select: { sentiment: true, studyHours: true, sleepHours: true },
      }),
    ]);

    const prompt = getBurnoutAnalysisPrompt({
      recentMoods: moods.map((m) => m.mood),
      journalSentiments: journals.map((j) => j.sentiment),
      studyHours: journals.flatMap((j) => j.studyHours ? [j.studyHours] : []),
      sleepHours: journals.flatMap((j) => j.sleepHours ? [j.sleepHours] : []),
      userName,
      examType,
    });

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: wellnessAnalysisSchema,
      prompt,
      temperature: 0.2,
    });

    return {
      burnoutScore: object.burnoutScore,
      anxietyScore: object.anxietyScore,
      motivationScore: object.motivationScore,
      recoveryScore: object.recoveryScore,
      overallScore: object.overallScore,
      insights: object.insights,
      recommendations: object.recommendations,
    };
  } catch (error) {
    console.error("Wellness analysis failed:", error);
    return null;
  }
}

export async function checkAndAwardAchievements(userId: string): Promise<void> {
  try {
    const [journalCount, moodCount, existingAchievements, currentScore] = await Promise.all([
      db.journalEntry.count({ where: { userId } }),
      db.moodLog.count({ where: { userId } }),
      db.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
      }),
      db.wellnessScore.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
      }),
    ]);

    // moodCount used for streak-based checks via the count itself
    void moodCount;

    const earnedTypes = new Set(existingAchievements.map((a) => a.achievement.type));

    const checkAndAward = async (type: string, condition: boolean) => {
      if (condition && !earnedTypes.has(type)) {
        const achievement = await db.achievement.findFirst({ where: { type } });
        if (achievement) {
          await db.userAchievement.create({
            data: { userId, achievementId: achievement.id },
          });
          await db.notification.create({
            data: {
              userId,
              type: "ACHIEVEMENT",
              title: `Achievement Unlocked: ${achievement.title}`,
              body: achievement.description,
              data: { achievementType: type, xp: achievement.xpReward },
            },
          });
        }
      }
    };

    await checkAndAward("FIRST_ENTRY", journalCount >= 1);
    await checkAndAward("JOURNAL_10", journalCount >= 10);
    await checkAndAward("JOURNAL_50", journalCount >= 50);
    await checkAndAward("JOURNAL_100", journalCount >= 100);

    // Check streak
    const streak = await calculateJournalStreak(userId);
    await checkAndAward("STREAK_3", streak >= 3);
    await checkAndAward("STREAK_7", streak >= 7);
    await checkAndAward("STREAK_30", streak >= 30);

    if (currentScore && currentScore.burnoutRisk < 30) {
      await checkAndAward("RECOVERY_CHAMPION", true);
    }
    if (currentScore && currentScore.overallScore >= 80) {
      await checkAndAward("WELLNESS_WARRIOR", true);
    }
  } catch (error) {
    console.error("Achievement check failed:", error);
  }
}

export async function calculateJournalStreak(userId: string): Promise<number> {
  const entries = await db.journalEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
    take: 100,
  });

  if (entries.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const uniqueDays = new Set(
    entries.map((e) => {
      const d = new Date(e.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);
  const msPerDay = 24 * 60 * 60 * 1000;

  for (let i = 0; i < sortedDays.length; i++) {
    const dayTime = sortedDays[i];
    if (dayTime === undefined) break;
    const expected = today.getTime() - i * msPerDay;
    if (Math.abs(dayTime - expected) < msPerDay) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
