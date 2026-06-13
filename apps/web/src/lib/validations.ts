import { z } from "zod";
import { Mood, ExamType } from "@prisma/client";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^A-Za-z0-9]/, "Must contain special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const onboardingSchema = z.object({
  examType: z.nativeEnum(ExamType),
  targetYear: z.number().int().min(2024).max(2035),
  studyHoursPerDay: z.number().min(1).max(24),
  sleepHoursTarget: z.number().min(4).max(12),
  city: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
});

export const createJournalSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200),
  content: z
    .string()
    .min(10, "Entry must be at least 10 characters")
    .max(10000),
  mood: z.nativeEnum(Mood),
  tags: z.array(z.string().max(30)).max(10).default([]),
  gratitudeItems: z.array(z.string().max(200)).max(5).default([]),
  studyHours: z.number().min(0).max(24).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  isPrivate: z.boolean().default(false),
});

export const updateJournalSchema = createJournalSchema.partial();

export const createMoodLogSchema = z.object({
  mood: z.nativeEnum(Mood),
  intensity: z.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
  factors: z.array(z.string().max(50)).max(10).default([]),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000),
  conversationId: z.string().optional(),
});

export const studyLogSchema = z.object({
  date: z.string().datetime().optional(),
  hoursStudied: z.number().min(0).max(24),
  hoursSlept: z.number().min(0).max(24).optional(),
  hoursExercised: z.number().min(0).max(12).optional(),
  breaksTaken: z.number().int().min(0).max(20).default(0),
  notes: z.string().max(500).optional(),
});

export const updateSettingsSchema = z.object({
  notifyWellnessCheck: z.boolean().optional(),
  notifyAchievements: z.boolean().optional(),
  notifyInsights: z.boolean().optional(),
  notifyReminders: z.boolean().optional(),
  reminderTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  privacyJournalDefault: z.boolean().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  examType: z.nativeEnum(ExamType).optional(),
  aiPersonality: z
    .enum(["supportive", "motivational", "analytical", "gentle"])
    .optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
export type CreateMoodLogInput = z.infer<typeof createMoodLogSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type StudyLogInput = z.infer<typeof studyLogSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
