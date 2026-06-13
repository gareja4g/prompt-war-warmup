import { PrismaClient, Mood, ExamType, InsightType, AchievementType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed achievements
  const achievements = [
    {
      type: AchievementType.FIRST_ENTRY,
      title: "First Steps",
      description: "Write your first journal entry",
      iconName: "pencil",
      xpReward: 50,
    },
    {
      type: AchievementType.STREAK_3,
      title: "3-Day Streak",
      description: "Journal for 3 consecutive days",
      iconName: "flame",
      xpReward: 100,
    },
    {
      type: AchievementType.STREAK_7,
      title: "Week Warrior",
      description: "Journal for 7 consecutive days",
      iconName: "zap",
      xpReward: 250,
    },
    {
      type: AchievementType.STREAK_30,
      title: "Monthly Master",
      description: "Journal for 30 consecutive days",
      iconName: "crown",
      xpReward: 1000,
    },
    {
      type: AchievementType.JOURNAL_10,
      title: "Reflective Mind",
      description: "Write 10 journal entries",
      iconName: "book-open",
      xpReward: 200,
    },
    {
      type: AchievementType.JOURNAL_50,
      title: "Storyteller",
      description: "Write 50 journal entries",
      iconName: "library",
      xpReward: 500,
    },
    {
      type: AchievementType.JOURNAL_100,
      title: "Chronicle Keeper",
      description: "Write 100 journal entries",
      iconName: "archive",
      xpReward: 1000,
    },
    {
      type: AchievementType.MOOD_TRACKER,
      title: "Mood Maestro",
      description: "Log mood for 14 consecutive days",
      iconName: "heart",
      xpReward: 300,
    },
    {
      type: AchievementType.RECOVERY_CHAMPION,
      title: "Recovery Champion",
      description: "Recover from high burnout risk",
      iconName: "shield",
      xpReward: 400,
    },
    {
      type: AchievementType.WELLNESS_WARRIOR,
      title: "Wellness Warrior",
      description: "Maintain wellness score above 80 for a week",
      iconName: "trophy",
      xpReward: 600,
    },
    {
      type: AchievementType.CONSISTENCY_KING,
      title: "Consistency King",
      description: "Complete all daily check-ins for 21 days",
      iconName: "star",
      xpReward: 750,
    },
    {
      type: AchievementType.MINDFUL_WEEK,
      title: "Mindful Week",
      description: "Complete 7 breathing exercises",
      iconName: "wind",
      xpReward: 200,
    },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { type: achievement.type },
      update: {},
      create: achievement,
    });
  }

  console.log("Achievements seeded");

  // Create demo user
  const hashedPassword = await bcrypt.hash("Demo@123456", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@mindwell.app" },
    update: {},
    create: {
      email: "demo@mindwell.app",
      name: "Arjun Sharma",
      password: hashedPassword,
      emailVerified: new Date(),
      profile: {
        create: {
          examType: ExamType.JEE,
          targetYear: 2025,
          studyHoursPerDay: 10,
          sleepHoursTarget: 7,
          bio: "Aspiring engineer preparing for JEE Advanced",
          city: "Delhi",
          onboardingDone: true,
        },
      },
      settings: {
        create: {
          examType: ExamType.JEE,
          theme: "system",
          notifyWellnessCheck: true,
          notifyAchievements: true,
        },
      },
    },
  });

  console.log("Demo user created:", demoUser.email);

  // Create sample journal entries for the last 14 days
  const journalTemplates = [
    {
      title: "Feeling overwhelmed with syllabus",
      content:
        "Today was particularly tough. I have three chapters left in Mechanics and the exam is in two weeks. I feel like time is slipping through my fingers. Every time I sit down to study, my mind wanders to worst-case scenarios. I need to find a way to focus better. Maybe I should break down my remaining syllabus into smaller chunks instead of looking at the big picture.",
      mood: Mood.ANXIOUS,
      sentiment: -0.4,
      tags: ["stress", "syllabus", "focus"],
      studyHours: 8,
      sleepHours: 5.5,
    },
    {
      title: "Good practice session - finally got integration!",
      content:
        "Had a breakthrough today with integration by parts. What seemed impossible last week suddenly clicked. I solved 15 problems in a row correctly! This feeling is incredible - it reminds me why I am doing all this. Also had a great chat with my friend Priya who is also preparing for JEE. We decided to do weekly mock test together.",
      mood: Mood.HAPPY,
      sentiment: 0.7,
      tags: ["breakthrough", "math", "motivation"],
      studyHours: 9,
      sleepHours: 7,
    },
    {
      title: "Burned out again...",
      content:
        "I cannot do this anymore. Three months of continuous studying, barely any breaks, and I feel completely empty. My parents keep asking about my preparation and every question feels like a judgment. I snapped at my mom today and I feel terrible about it. I know I need to take care of my mental health but how do I do that when there is so much pressure?",
      mood: Mood.EXHAUSTED,
      sentiment: -0.8,
      tags: ["burnout", "family", "pressure"],
      studyHours: 4,
      sleepHours: 6,
    },
    {
      title: "Rest day reflection",
      content:
        "Decided to take a proper rest day today. No studying, just reading a novel and going for a walk in the park. The guilt was overwhelming at first, but gradually I started feeling human again. I realized that I have been running on empty for weeks. The walk helped clear my head. I am going to restructure my study schedule to include mandatory breaks.",
      mood: Mood.CALM,
      sentiment: 0.3,
      tags: ["rest", "recovery", "balance"],
      studyHours: 0,
      sleepHours: 8.5,
    },
    {
      title: "Mock test results - mixed feelings",
      content:
        "Got 87% in today's mock test. Physics was great (95%), Chemistry was decent (85%), but Math let me down again (80%). I know 87% is good but I keep comparing myself to toppers who score 98+. Need to work on coordinate geometry specifically. Setting up a targeted practice plan for the next two weeks.",
      mood: Mood.NEUTRAL,
      sentiment: 0.1,
      tags: ["mock-test", "performance", "improvement"],
      studyHours: 7,
      sleepHours: 6.5,
    },
  ];

  const now = new Date();
  for (let i = 0; i < journalTemplates.length; i++) {
    const template = journalTemplates[i];
    if (!template) continue;
    const date = new Date(now);
    date.setDate(date.getDate() - i * 3);

    await prisma.journalEntry.create({
      data: {
        userId: demoUser.id,
        title: template.title,
        content: template.content,
        mood: template.mood,
        sentiment: template.sentiment,
        tags: template.tags,
        wordCount: template.content.split(" ").length,
        studyHours: template.studyHours,
        sleepHours: template.sleepHours,
        aiInsight: "AI analysis will be generated when you next open this entry.",
        createdAt: date,
        updatedAt: date,
      },
    });
  }

  console.log("Journal entries seeded");

  // Create wellness scores for last 14 days
  for (let i = 0; i < 14; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Simulate realistic variation using a sine wave
    const baseScore = 65 + Math.sin(i * 0.5) * 15;

    await prisma.wellnessScore.upsert({
      where: { userId_date: { userId: demoUser.id, date: dateOnly } },
      update: {},
      create: {
        userId: demoUser.id,
        date: dateOnly,
        overallScore: Math.min(100, Math.max(0, baseScore)),
        burnoutRisk: Math.min(100, Math.max(0, 100 - baseScore + 20)),
        anxietyScore: Math.min(100, Math.max(0, 100 - baseScore + 10)),
        motivationScore: Math.min(100, Math.max(0, baseScore + 5)),
        recoveryScore: Math.min(100, Math.max(0, baseScore - 10)),
        studyBalance: Math.min(1, Math.max(0, baseScore / 100)),
      },
    });
  }

  console.log("Wellness scores seeded");

  // Create mood logs for last 14 days
  const moodSequence: Mood[] = [
    Mood.ANXIOUS,
    Mood.HAPPY,
    Mood.EXHAUSTED,
    Mood.CALM,
    Mood.NEUTRAL,
    Mood.SAD,
    Mood.UNEASY,
    Mood.HAPPY,
    Mood.CALM,
    Mood.OVERWHELMED,
    Mood.NEUTRAL,
    Mood.HAPPY,
    Mood.ANXIOUS,
    Mood.CALM,
  ];

  for (let i = 0; i < 14; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const mood = moodSequence[i] ?? Mood.NEUTRAL;

    await prisma.moodLog.create({
      data: {
        userId: demoUser.id,
        mood,
        intensity: Math.floor(Math.random() * 4) + 4,
        factors: ["studies", i % 3 === 0 ? "sleep-deprivation" : "exam-pressure"],
        createdAt: date,
      },
    });
  }

  console.log("Mood logs seeded");
  console.log("Database seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
