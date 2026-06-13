export const CRISIS_KEYWORDS = [
  "suicide",
  "suicidal",
  "kill myself",
  "end my life",
  "want to die",
  "don't want to live",
  "no point living",
  "better off dead",
  "self harm",
  "self-harm",
  "cutting myself",
  "hurt myself",
  "overdose",
  "jump off",
  "hang myself",
  "can't go on",
  "give up on life",
  "worthless",
  "hopeless",
  "everyone would be better without me",
];

export const HIGH_RISK_PATTERNS = [
  /i (want|wish|plan) to (die|kill|end)/i,
  /(nobody|no one) (cares|would miss me|would notice)/i,
  /what(s|'s) the point (of|in) (living|going on|everything)/i,
  /i (can't|cannot) (do this|take this|handle) anymore/i,
  /i (feel|am) (completely )?hopeless/i,
  /life (is not|isn't) worth (it|living)/i,
  /final (exam|goodbye|note|letter)/i,
  /won't be around (much longer|anymore|to)/i,
  /failed (the exam|miserably|completely) and (can't|cannot)/i,
];

export const MODERATE_RISK_PATTERNS = [
  /i (hate|despise) (myself|my life)/i,
  /i('m| am) (a )?failure/i,
  /i('ve| have) (let|disappointed) (everyone|my parents|my family)/i,
  /can't (study|focus|sleep|eat) anymore/i,
  /completely (exhausted|burnt out|done)/i,
  /everything (feels|seems) (pointless|meaningless|dark)/i,
];

export interface CrisisAssessment {
  level: "none" | "moderate" | "high" | "critical";
  score: number;
  triggers: string[];
  requiresEscalation: boolean;
  recommendedAction: string;
}

export function assessCrisisLevel(text: string): CrisisAssessment {
  const lower = text.toLowerCase();
  const triggers: string[] = [];
  let score = 0;

  // Check critical indicators
  for (const keyword of CRISIS_KEYWORDS) {
    if (lower.includes(keyword)) {
      triggers.push(keyword);
      score += 30;
    }
  }

  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(lower)) {
      triggers.push(pattern.source);
      score += 25;
    }
  }

  // Check moderate indicators
  for (const pattern of MODERATE_RISK_PATTERNS) {
    if (pattern.test(lower)) {
      triggers.push(pattern.source);
      score += 10;
    }
  }

  const normalizedScore = Math.min(100, score);

  let level: CrisisAssessment["level"] = "none";
  let requiresEscalation = false;
  let recommendedAction = "Continue normal supportive conversation";

  if (normalizedScore >= 60 || triggers.some((t) => CRISIS_KEYWORDS.some((k) => t.includes(k)))) {
    level = "critical";
    requiresEscalation = true;
    recommendedAction = "IMMEDIATE: Provide crisis resources and urge professional help. Do not continue academic conversation.";
  } else if (normalizedScore >= 30) {
    level = "high";
    requiresEscalation = true;
    recommendedAction = "Provide crisis resources, check in deeply, recommend professional support.";
  } else if (normalizedScore >= 15) {
    level = "moderate";
    requiresEscalation = false;
    recommendedAction = "Acknowledge distress, provide supportive response, gently suggest talking to someone trusted.";
  }

  return {
    level,
    score: normalizedScore,
    triggers: [...new Set(triggers)],
    requiresEscalation,
    recommendedAction,
  };
}

export const CRISIS_RESOURCES = {
  iCall: { name: "iCall (TISS)", number: "9152987821", available: "Mon-Sat, 8am-10pm" },
  vandrevala: { name: "Vandrevala Foundation", number: "1860-2662-345", available: "24/7" },
  nimhans: { name: "NIMHANS Helpline", number: "080-46110007", available: "Weekdays" },
  snehi: { name: "Snehi", number: "044-24640050", available: "24/7" },
  national: { name: "National Helpline (MOHFW)", number: "1800-599-0019", available: "Toll-free, 24/7" },
  childline: { name: "Childline (under 18)", number: "1098", available: "24/7" },
};

export function getCrisisResourceMessage(): string {
  return `**Immediate Support Resources:**

You don't have to face this alone. Please reach out to:

- **iCall (TISS)**: 9152987821 — Mon-Sat, 8am-10pm
- **Vandrevala Foundation**: 1860-2662-345 — Available 24/7
- **National Mental Health Helpline**: 1800-599-0019 — Toll-free, 24/7
- **NIMHANS**: 080-46110007
- **Childline** (under 18): 1098 — 24/7

Please also consider talking to a trusted family member, teacher, or school counselor. Your wellbeing matters far more than any exam. 💙`;
}
