import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  startOfWeek,
  endOfWeek,
} from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, formatStr = "PPP"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, formatStr);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function getWeekRange(date = new Date()) {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function calculateWellnessColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  if (score >= 25) return "text-orange-600";
  return "text-red-600";
}

export function getBurnoutLevel(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score < 25)
    return {
      label: "Low",
      color: "text-green-600",
      description: "You are in great shape!",
    };
  if (score < 50)
    return {
      label: "Moderate",
      color: "text-yellow-600",
      description: "Keep an eye on your stress levels",
    };
  if (score < 75)
    return {
      label: "High",
      color: "text-orange-600",
      description: "Consider taking a break soon",
    };
  return {
    label: "Critical",
    color: "text-red-600",
    description: "Please prioritize rest and self-care",
  };
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateId(prefix = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeScore(value: number, min = 0, max = 100): number {
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

export function groupByDate<T extends { createdAt: Date }>(
  items: T[],
  formatStr = "yyyy-MM-dd"
): Record<string, T[]> {
  return items.reduce(
    (groups, item) => {
      const key = format(item.createdAt, formatStr);
      const group = groups[key] ?? [];
      group.push(item);
      return { ...groups, [key]: group };
    },
    {} as Record<string, T[]>
  );
}

export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function formatWordCount(count: number): string {
  if (count < 1000) return `${count} words`;
  return `${(count / 1000).toFixed(1)}k words`;
}

export function getExamDaysRemaining(
  targetYear: number,
  examMonth = 5
): number {
  const now = new Date();
  const examDate = new Date(targetYear, examMonth - 1, 15);
  const diff = examDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
