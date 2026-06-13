import {
  ExamType,
  Mood,
  InsightType,
  NotificationType,
  AchievementType,
} from "@prisma/client";

export { ExamType, Mood, InsightType, NotificationType, AchievementType };

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  createdAt: Date;
  profile: {
    examType: ExamType;
    targetYear: number;
    studyHoursPerDay: number;
    sleepHoursTarget: number;
    bio: string | null;
    city: string | null;
    onboardingDone: boolean;
  } | null;
}

export interface JournalEntryWithInsights {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood: Mood;
  sentiment: number;
  aiInsight: string | null;
  tags: string[];
  wordCount: number;
  isPrivate: boolean;
  gratitudeItems: string[];
  studyHours: number | null;
  sleepHours: number | null;
  createdAt: Date;
  updatedAt: Date;
  aiInsights: AIInsightData[];
}

export interface AIInsightData {
  id: string;
  insightType: InsightType;
  content: string;
  confidence: number;
  actionItems: string[];
  isRead: boolean;
  createdAt: Date;
}

export interface MoodLogData {
  id: string;
  mood: Mood;
  intensity: number;
  notes: string | null;
  factors: string[];
  createdAt: Date;
}

export interface WellnessScoreData {
  id: string;
  overallScore: number;
  burnoutRisk: number;
  anxietyScore: number;
  motivationScore: number;
  recoveryScore: number;
  studyBalance: number;
  date: Date;
}

export interface ConversationData {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: MessageData[];
}

export interface MessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

export interface DashboardStats {
  currentWellnessScore: number;
  burnoutRisk: number;
  currentStreak: number;
  totalJournalEntries: number;
  weeklyMoodAvg: number;
  anxietyScore: number;
  motivationScore: number;
  recoveryScore: number;
  weeklyScores: WellnessScoreData[];
  recentMoodLogs: MoodLogData[];
  recentInsights: AIInsightData[];
  achievements: UserAchievementData[];
}

export interface UserAchievementData {
  id: string;
  earnedAt: Date;
  achievement: {
    type: AchievementType;
    title: string;
    description: string;
    iconName: string;
    xpReward: number;
  };
}

export interface StudyLogData {
  id: string;
  date: Date;
  hoursStudied: number;
  hoursSlept: number | null;
  hoursExercised: number | null;
  breaksTaken: number;
  notes: string | null;
}

export interface APIResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateJournalInput {
  title: string;
  content: string;
  mood: Mood;
  tags: string[];
  gratitudeItems?: string[];
  studyHours?: number;
  sleepHours?: number;
  isPrivate?: boolean;
}

export interface CreateMoodLogInput {
  mood: Mood;
  intensity: number;
  notes?: string;
  factors: string[];
}

export interface WellnessAnalysis {
  burnoutScore: number;
  anxietyScore: number;
  motivationScore: number;
  recoveryScore: number;
  overallScore: number;
  insights: string[];
  recommendations: string[];
  crisisDetected: boolean;
  crisisMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type MoodColor = {
  bg: string;
  text: string;
  border: string;
  label: string;
  emoji: string;
  value: number;
};

export const MOOD_CONFIG: Record<Mood, MoodColor> = {
  ECSTATIC: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-300",
    label: "Ecstatic",
    emoji: "🤩",
    value: 10,
  },
  HAPPY: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-300",
    label: "Happy",
    emoji: "😊",
    value: 8,
  },
  CALM: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
    label: "Calm",
    emoji: "😌",
    value: 7,
  },
  NEUTRAL: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-300",
    label: "Neutral",
    emoji: "😐",
    value: 5,
  },
  UNEASY: {
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-300",
    label: "Uneasy",
    emoji: "😟",
    value: 4,
  },
  SAD: {
    bg: "bg-blue-100",
    text: "text-blue-900",
    border: "border-blue-400",
    label: "Sad",
    emoji: "😢",
    value: 3,
  },
  ANXIOUS: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-300",
    label: "Anxious",
    emoji: "😰",
    value: 2,
  },
  OVERWHELMED: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-300",
    label: "Overwhelmed",
    emoji: "😵",
    value: 1,
  },
  EXHAUSTED: {
    bg: "bg-slate-100",
    text: "text-slate-800",
    border: "border-slate-300",
    label: "Exhausted",
    emoji: "😴",
    value: 2,
  },
  ANGRY: {
    bg: "bg-red-100",
    text: "text-red-900",
    border: "border-red-400",
    label: "Angry",
    emoji: "😤",
    value: 1,
  },
};

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  NEET: "NEET (Medical)",
  JEE: "JEE (Engineering)",
  CUET: "CUET (University)",
  CAT: "CAT (MBA)",
  GATE: "GATE (PG Engineering)",
  UPSC: "UPSC (Civil Services)",
  BOARD: "Board Exams",
};
