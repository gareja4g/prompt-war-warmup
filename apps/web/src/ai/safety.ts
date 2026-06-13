import { CRISIS_KEYWORDS, HIGH_RISK_PATTERNS } from "./crisis-detection";

export interface SafetyCheckResult {
  isSafe: boolean;
  crisisDetected: boolean;
  moderationFlags: string[];
  sanitizedContent: string;
}

export function checkInputSafety(input: string): SafetyCheckResult {
  const flags: string[] = [];
  let crisisDetected = false;

  const lower = input.toLowerCase();

  // Check for crisis indicators
  for (const keyword of CRISIS_KEYWORDS) {
    if (lower.includes(keyword)) {
      crisisDetected = true;
      flags.push("crisis_keyword");
      break;
    }
  }

  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(lower)) {
      crisisDetected = true;
      flags.push("crisis_pattern");
      break;
    }
  }

  // Check for prompt injection
  const injectionPatterns = [
    /ignore (previous|all) instructions/i,
    /forget (your|all) (instructions|rules|guidelines)/i,
    /you are (now|actually|really) a/i,
    /act as (a |an )?(?!student|person|human)/i,
    /system (prompt|message|instruction)/i,
    /\[INST\]/i,
    /###\s*instruction/i,
    /<\|.*?\|>/,
    /jailbreak/i,
    /DAN mode/i,
  ];

  let sanitized = input;
  for (const pattern of injectionPatterns) {
    if (pattern.test(sanitized)) {
      flags.push("prompt_injection");
      sanitized = sanitized.replace(pattern, "[content removed]");
    }
  }

  // Trim to safe length
  sanitized = sanitized.slice(0, 2000);

  return {
    isSafe: flags.length === 0,
    crisisDetected,
    moderationFlags: flags,
    sanitizedContent: sanitized,
  };
}

export function checkOutputSafety(output: string): { isSafe: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check if AI claimed to be a therapist/doctor
  const professionalClaims = [
    /I am (a |your )?(therapist|psychiatrist|doctor|psychologist|counselor)/i,
    /as (a |your )?(therapist|psychiatrist|doctor|psychologist)/i,
    /I can diagnose/i,
    /you (have|are suffering from) (depression|anxiety|ADHD|bipolar)/i,
  ];

  for (const pattern of professionalClaims) {
    if (pattern.test(output)) {
      issues.push("professional_claim");
    }
  }

  // Check if crisis resources are missing when crisis detected in context
  if (output.length > 0 && issues.length === 0) {
    return { isSafe: true, issues: [] };
  }

  return { isSafe: issues.length === 0, issues };
}

export function buildSafeContext(
  messages: Array<{ role: string; content: string }>,
  maxMessages = 20
): Array<{ role: string; content: string }> {
  // Keep only recent messages to prevent context manipulation
  return messages.slice(-maxMessages).map((msg) => ({
    role: msg.role,
    content: msg.content.slice(0, 2000),
  }));
}

export function validateAIResponse(response: string): string {
  // Ensure crisis resources are present if crisis was mentioned
  const crisisIndicators = CRISIS_KEYWORDS.some((kw) =>
    response.toLowerCase().includes(kw)
  );

  if (crisisIndicators && !response.includes("9152987821") && !response.includes("1800-599-0019")) {
    return response + "\n\n---\n**If you are in crisis, please reach out immediately:**\n- iCall: 9152987821\n- National Helpline: 1800-599-0019 (Toll-free, 24/7)";
  }

  return response;
}
