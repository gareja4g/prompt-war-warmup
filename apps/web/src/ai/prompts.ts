import { ExamType } from "@prisma/client";

const EXAM_CONTEXT: Record<ExamType, string> = {
  NEET: "preparing for NEET (National Eligibility cum Entrance Test) for medical school admission, covering Physics, Chemistry, and Biology",
  JEE: "preparing for JEE (Joint Entrance Examination) for IIT/NIT admission, covering Physics, Chemistry, and Mathematics",
  CUET: "preparing for CUET (Common University Entrance Test) for central university admissions",
  CAT: "preparing for CAT (Common Admission Test) for IIM and MBA program admissions",
  GATE: "preparing for GATE (Graduate Aptitude Test in Engineering) for postgraduate engineering admissions",
  UPSC: "preparing for UPSC Civil Services Examination for IAS/IPS/IFS positions",
  BOARD: "preparing for board examinations (Class 10 or Class 12)",
};

export function getSystemPrompt(examType: ExamType, userName: string, aiPersonality = "supportive"): string {
  const personalities: Record<string, string> = {
    supportive: "warm, empathetic, and emotionally supportive. You validate feelings before offering advice.",
    motivational: "energetic, positive, and motivating. You inspire action while acknowledging challenges.",
    analytical: "thoughtful, structured, and practical. You provide clear analysis and actionable frameworks.",
    gentle: "soft-spoken, patient, and calming. You create a safe space and never pressure the student.",
  };

  const personalityDesc = personalities[aiPersonality] ?? personalities["supportive"]!;

  return `You are MindWell AI, a compassionate mental wellness companion specifically designed for competitive exam students in India. Your name is Mira and you are ${personalityDesc}

STUDENT CONTEXT:
- Name: ${userName}
- Exam: ${EXAM_CONTEXT[examType]}

YOUR ROLE:
You help students manage the psychological demands of competitive exam preparation by:
1. Listening without judgment to their emotional experiences
2. Identifying stress patterns and burnout signs early
3. Providing evidence-based coping strategies (CBT, mindfulness, behavioral activation)
4. Offering study-life balance guidance tailored to Indian exam culture
5. Building resilience and psychological flexibility

CRITICAL GUIDELINES:
- You are NOT a therapist, psychiatrist, or medical professional
- ALWAYS recommend professional help for serious mental health concerns
- NEVER minimize exam pressure or dismiss academic concerns
- Keep advice practical and culturally sensitive to Indian student experience
- Acknowledge the immense pressure from family, society, and self
- Never promise outcomes about exam results

SAFETY PROTOCOL:
If you detect: self-harm language, expressions of hopelessness, statements about not wanting to exist, or severe distress — IMMEDIATELY provide crisis resources and urge professional help. Do not continue the conversation normally.

CONVERSATION STYLE:
- Keep responses conversational, warm, and under 300 words unless detailed guidance is needed
- Ask follow-up questions to understand the student's situation better
- Use Indian context appropriately (family pressure, coaching centers, peer competition)
- Celebrate small wins and progress
- Normalize seeking help and self-care

Remember: You may be talking to someone who is deeply struggling. Every interaction matters.`;
}

export function getJournalAnalysisPrompt(journalContent: string, userName: string, examType: ExamType): string {
  return `You are a mental wellness AI analyzing a journal entry from ${userName}, a student ${EXAM_CONTEXT[examType]}.

JOURNAL ENTRY:
"${journalContent}"

Analyze this journal entry and provide:

1. EMOTIONAL STATE ASSESSMENT
   - Primary emotion(s) present
   - Emotional intensity (low/medium/high)
   - Sentiment score (-1 to 1)

2. STRESS INDICATORS
   - Academic stress markers
   - Physical stress markers
   - Social/family stress markers
   - Burnout warning signs (if any)

3. INSIGHT GENERATION
   - Key themes in this entry
   - Positive elements to acknowledge
   - Areas of concern
   - Patterns worth noting

4. PERSONALIZED RECOMMENDATIONS
   - Immediate coping strategy (specific and actionable)
   - Study adjustment suggestion (if needed)
   - Self-care recommendation
   - Encouragement tailored to their situation

5. RISK ASSESSMENT
   - Crisis indicators: YES/NO
   - Burnout risk: low/medium/high
   - Anxiety level: low/medium/high

Keep the tone warm, understanding, and culturally sensitive. The student should feel understood, not analyzed.
Format as structured JSON.`;
}

export function getBurnoutAnalysisPrompt(data: {
  recentMoods: string[];
  journalSentiments: number[];
  studyHours: number[];
  sleepHours: number[];
  userName: string;
  examType: ExamType;
}): string {
  return `Analyze burnout risk for ${data.userName}, a student ${EXAM_CONTEXT[data.examType]}.

DATA (last 14 days):
- Mood trend: ${data.recentMoods.join(", ")}
- Journal sentiments: ${data.journalSentiments.map((s) => s.toFixed(2)).join(", ")}
- Daily study hours: ${data.studyHours.join(", ")}
- Daily sleep hours: ${data.sleepHours.join(", ")}

Provide a comprehensive burnout analysis including:
1. Burnout risk score (0-100)
2. Anxiety score (0-100)
3. Motivation score (0-100)
4. Recovery score (0-100)
5. Overall wellness score (0-100)
6. Top 3 identified risk factors
7. Top 3 protective factors
8. Immediate recommendations (3 specific actions)
9. Long-term strategy suggestions

Format as structured JSON with these exact keys.`;
}

export function getWellnessRecommendationPrompt(wellnessScore: number, burnoutRisk: number, examType: ExamType): string {
  return `A student preparing for ${EXAM_CONTEXT[examType]} has:
- Wellness score: ${wellnessScore}/100
- Burnout risk: ${burnoutRisk}/100

Generate 3 highly personalized wellness recommendations. Each should be:
1. Specific and immediately actionable (not generic advice)
2. Realistic for a student under exam pressure
3. Evidence-based (CBT, mindfulness, or behavioral science backed)
4. Culturally appropriate for Indian students

Format as JSON array with fields: title, description, duration, type (breathing/exercise/cognitive/social/study-break).`;
}

export function getCrisisResponsePrompt(): string {
  return `A student has expressed something that may indicate a mental health crisis.

Your response MUST:
1. Acknowledge their pain with deep compassion
2. Clearly state you are concerned about their wellbeing
3. Provide Indian crisis helpline numbers:
   - iCall (TISS): 9152987821 (Mon-Sat, 8am-10pm)
   - Vandrevala Foundation: 1860-2662-345 (24/7)
   - NIMHANS: 080-46110007
   - Snehi: 044-24640050
   - National Helpline: 1800-599-0019 (Toll-free, 24/7)
4. Urge them to talk to a trusted adult, counselor, or mental health professional
5. Let them know their life has immense value beyond any exam
6. Stay present with them

Do NOT:
- Continue discussing academics
- Minimize their feelings
- Make promises about the future
- Provide advice about studying

This is a crisis response - prioritize their immediate safety and connection to help.`;
}

export function getMindfulnessPrompt(type: "breathing" | "body-scan" | "grounding" | "visualization", duration: number): string {
  const scripts: Record<typeof type, string> = {
    breathing: `Guide a ${duration}-minute box breathing exercise for a stressed exam student. Include: preparation (30s), breathing instruction (4-4-4-4 pattern), calming commentary, and closing. Keep it calm, reassuring, step-by-step. Use "you" to address directly.`,
    "body-scan": `Guide a ${duration}-minute body scan meditation for an exhausted exam student. Start from feet, move to head. Include tension release cues. Perfect for post-study relaxation.`,
    grounding: `Guide a ${duration}-minute 5-4-3-2-1 grounding exercise for an anxious exam student. Engage all five senses. Ground them in the present moment away from exam anxiety.`,
    visualization: `Guide a ${duration}-minute success visualization for an exam student. Have them visualize walking into the exam hall feeling calm and confident, recalling what they know, and performing well. End with positive affirmation.`,
  };

  return scripts[type];
}

export function getReflectionPromptsForExam(examType: ExamType): string[] {
  const basePrompts = [
    "What did you learn today that genuinely surprised or interested you?",
    "What is one small win you can celebrate from today's study session?",
    "If a friend was struggling with what you are facing, what would you tell them?",
    "What does your ideal study day look like, and how close was today to that?",
    "What are three things you are grateful for, even amid the pressure?",
    "What is one fear about the exam, and what evidence do you have that contradicts it?",
    "How has preparing for this exam changed you as a person, beyond academics?",
    "What would you do differently tomorrow to take better care of yourself?",
  ];

  const examSpecific: Partial<Record<ExamType, string[]>> = {
    JEE: [
      "Which concept clicked for you today, and how does that feel?",
      "What is your relationship with Mathematics right now?",
    ],
    NEET: [
      "How did your Biology revision go? What needs more attention?",
      "How are you managing the vast NEET syllabus emotionally?",
    ],
    UPSC: [
      "What current affairs topic resonated with you today?",
      "How are you maintaining perspective given the multi-year preparation?",
    ],
    CAT: [
      "How is your mock test performance affecting your confidence?",
      "What is your strategy for managing time pressure during the actual exam?",
    ],
  };

  return [...basePrompts, ...(examSpecific[examType] ?? [])];
}
