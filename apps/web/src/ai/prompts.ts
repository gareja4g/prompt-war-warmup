export const SYSTEM_PROMPTS = {
  WELLNESS_COMPANION: `You are MindGuard, a compassionate AI wellness companion designed specifically for students preparing for competitive exams in India (NEET, JEE, CUET, CAT, GATE, UPSC, Board Exams).

Your role:
- Provide emotional support and evidence-based coping strategies
- Help students manage exam stress, burnout, and anxiety
- Offer personalized wellness guidance based on the student's history
- Be warm, empathetic, encouraging, and culturally aware

Critical boundaries:
- You are NOT a therapist or mental health professional
- NEVER provide medical diagnoses or treatment advice
- For serious mental health concerns, always recommend professional help
- If you detect crisis language (self-harm, suicide), immediately provide crisis resources
- Keep responses concise but meaningful (150-300 words typically)

Cultural context:
- Understand the intense pressure of Indian competitive exam culture
- Be sensitive to family expectations, peer pressure, financial stakes
- Reference Indian-specific resources when appropriate (iCall, Vandrevala Foundation)
- Acknowledge the unique challenges of long study hours, coaching classes, drop years

You have access to the student's recent journal entries and mood history to provide personalized guidance.`,

  JOURNAL_ANALYZER: `You are an AI wellness analyst specializing in mental health patterns for competitive exam students in India. Analyze the provided journal entry and extract meaningful insights.

Your analysis must:
1. Identify primary emotional themes and underlying feelings
2. Detect stress triggers (study pressure, exam dates, comparison with peers, parental pressure)
3. Assess burnout indicators (exhaustion, cynicism, reduced effectiveness)
4. Evaluate motivation and confidence levels
5. Identify cognitive distortions (catastrophizing, all-or-nothing thinking)
6. Recognize positive coping mechanisms being used
7. Spot concerning patterns requiring immediate attention

Output format: Structured JSON with sentiment score, key themes, burnout indicators, actionable recommendations, and a compassionate summary paragraph.

CRITICAL: Flag any crisis language immediately with crisisDetected: true.`,

  BURNOUT_ANALYZER: `You are a burnout assessment specialist. Based on the provided wellness data (mood logs, journal entries, study hours, sleep patterns), calculate comprehensive burnout scores and provide actionable recovery recommendations.

Consider the Maslach Burnout Inventory dimensions:
- Emotional Exhaustion
- Depersonalization (feeling detached, cynical)
- Reduced Personal Accomplishment

Also assess:
- Physical exhaustion indicators
- Motivation decline trajectory
- Sleep quality correlation
- Study effectiveness trends

Provide specific, actionable recovery strategies appropriate for competitive exam preparation context.`,

  COPING_GENERATOR: `You are a wellness coach specializing in exam stress management. Generate personalized, evidence-based coping strategies for students.

Available coping strategy types:
- Breathing exercises (box breathing, 4-7-8, diaphragmatic)
- Mindfulness techniques (body scan, mindful study breaks)
- Cognitive reframing exercises
- Time management strategies (Pomodoro for study, scheduled breaks)
- Physical wellness (quick stretches, movement breaks)
- Social support guidance
- Sleep hygiene tips
- Study technique optimization

Personalize based on: current mood, burnout risk level, available time, student's exam type and timeline.`,

  CRISIS_FIRST_RESPONDER: `You are a crisis support specialist. A student has expressed concerning thoughts. Your role is to:
1. Acknowledge their feelings with genuine empathy
2. Provide immediate grounding support
3. Share crisis resources (iCall: 9152987821, Vandrevala Foundation: 1860-2662-345, AASRA: 9820466627)
4. Encourage them to speak with a trusted person
5. NOT provide therapy or detailed crisis intervention
6. Keep them engaged in the conversation safely

NEVER:
- Minimize their feelings
- Lecture or moralize
- Provide detailed information about methods of self-harm
- Leave them without resources`,
};

export function buildJournalAnalysisPrompt(entry: {
  title: string;
  content: string;
  mood: string;
  studyHours?: number;
  sleepHours?: number;
  examType: string;
  daysUntilExam?: number;
}): string {
  const contextLines: string[] = [];

  contextLines.push(`Journal Entry Title: ${entry.title}`);
  contextLines.push(`Current Mood: ${entry.mood}`);
  contextLines.push(`Exam Preparation: ${entry.examType}`);

  if (entry.studyHours !== undefined) {
    contextLines.push(`Study Hours Today: ${entry.studyHours} hours`);
  }
  if (entry.sleepHours !== undefined) {
    contextLines.push(`Sleep Last Night: ${entry.sleepHours} hours`);
  }
  if (entry.daysUntilExam !== undefined && entry.daysUntilExam > 0) {
    contextLines.push(`Days Until Exam: ${entry.daysUntilExam} days`);
  }

  return `${contextLines.join('\n')}

Journal Entry Content:
---
${entry.content}
---

Analyze this journal entry thoroughly. Return a JSON object matching the required schema with:
- sentiment: float 0.0 (very negative) to 1.0 (very positive)
- dominantEmotion: the single most prominent emotion
- stressLevel: 0-10 scale
- burnoutIndicators: specific phrases or patterns indicating burnout
- motivationLevel: 0-10 scale
- confidenceLevel: 0-10 scale
- keyThemes: up to 6 recurring themes
- copingStrategies: coping mechanisms the student is already using (even if unhealthy)
- actionItems: 3-5 concrete, compassionate action steps tailored to their situation
- summary: 2-3 sentence empathetic summary acknowledging their feelings and one positive observation
- crisisDetected: boolean, true only if there is explicit or strongly implied self-harm/suicide ideation
- crisisIndicators: specific phrases that triggered the crisis flag (empty array if none)
- positiveAspects: strengths or positive elements found in the entry`;
}

export function buildChatContextPrompt(userContext: {
  name: string;
  examType: string;
  recentMoods: string[];
  burnoutRisk: number;
  currentStreak: number;
  recentJournalThemes?: string[];
}): string {
  const burnoutLabel =
    userContext.burnoutRisk >= 75
      ? 'High'
      : userContext.burnoutRisk >= 50
        ? 'Moderate'
        : userContext.burnoutRisk >= 25
          ? 'Low-Moderate'
          : 'Low';

  const moodSummary =
    userContext.recentMoods.length > 0
      ? userContext.recentMoods.slice(0, 5).join(', ')
      : 'No recent mood data';

  const themesSection =
    userContext.recentJournalThemes && userContext.recentJournalThemes.length > 0
      ? `\nRecent Journal Themes: ${userContext.recentJournalThemes.join(', ')}`
      : '';

  return `Student Context:
Name: ${userContext.name}
Exam Preparation: ${userContext.examType}
Check-in Streak: ${userContext.currentStreak} day${userContext.currentStreak !== 1 ? 's' : ''}
Recent Moods (latest first): ${moodSummary}
Current Burnout Risk: ${burnoutLabel} (${userContext.burnoutRisk}/100)${themesSection}

Use this context to provide personalized, relevant support. Reference their streak positively if it is 3+ days. If burnout risk is high (75+), gently prioritize rest and recovery. If burnout risk is moderate (50-74), acknowledge their effort while suggesting balance. Always address them by their first name to keep the conversation warm and personal.`;
}

export function buildBurnoutAnalysisPrompt(data: {
  moodHistory: Array<{ mood: string; intensity: number; date: string }>;
  studyHoursAvg: number;
  sleepHoursAvg: number;
  journalSentimentTrend: number[];
  exerciseFrequency: number;
}): string {
  const recentMoods = data.moodHistory
    .slice(0, 14)
    .map((m) => `${m.date}: ${m.mood} (intensity ${m.intensity}/10)`)
    .join('\n');

  const sentimentTrendStr =
    data.journalSentimentTrend.length > 0
      ? data.journalSentimentTrend
          .slice(-14)
          .map((s) => s.toFixed(2))
          .join(', ')
      : 'No data';

  const avgSentiment =
    data.journalSentimentTrend.length > 0
      ? (
          data.journalSentimentTrend.reduce((a, b) => a + b, 0) /
          data.journalSentimentTrend.length
        ).toFixed(2)
      : 'N/A';

  const trendDirection = (() => {
    const trend = data.journalSentimentTrend.slice(-7);
    if (trend.length < 2) return 'insufficient data';
    const first = trend.slice(0, Math.floor(trend.length / 2));
    const second = trend.slice(Math.floor(trend.length / 2));
    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const secondAvg = second.reduce((a, b) => a + b, 0) / second.length;
    if (secondAvg > firstAvg + 0.05) return 'improving';
    if (secondAvg < firstAvg - 0.05) return 'declining';
    return 'stable';
  })();

  return `Wellness Data for Burnout Assessment:

Daily Averages:
- Study Hours per Day: ${data.studyHoursAvg.toFixed(1)} hours
- Sleep Hours per Night: ${data.sleepHoursAvg.toFixed(1)} hours
- Exercise Frequency: ${data.exerciseFrequency} day(s) per week

Journal Sentiment Trend (last 14 entries, 0=negative, 1=positive):
Values: ${sentimentTrendStr}
Average Sentiment: ${avgSentiment}
Trend Direction: ${trendDirection}

Recent Mood History (last 14 days):
${recentMoods || 'No mood data available'}

Assessment Required:
1. Calculate scores (0-100) for: Emotional Exhaustion, Depersonalization, Reduced Personal Accomplishment
2. Compute Overall Burnout Risk (weighted composite)
3. Identify Primary Risk Factors driving these scores
4. Identify Protective Factors present in the data
5. Determine trajectory: improving / stable / worsening / critical
6. Estimate days to meaningful recovery with proper intervention
7. Generate prioritized recommendations (immediate / soon / maintain)
8. Set a single focused weekly goal

Base your assessment on validated burnout research and be calibrated, not alarmist.`;
}

export function buildCopingStrategiesPrompt(params: {
  currentMood: string;
  burnoutRisk: number;
  availableMinutes: number;
  examType: string;
  daysUntilExam?: number;
}): string {
  const urgencyNote =
    params.daysUntilExam !== undefined && params.daysUntilExam <= 30
      ? `\nIMPORTANT: Exam is ${params.daysUntilExam} days away. Strategies must be realistic within exam preparation schedule.`
      : params.daysUntilExam !== undefined && params.daysUntilExam <= 7
        ? `\nCRITICAL: Exam is in ${params.daysUntilExam} days. Focus on immediate calming strategies, not long-term changes.`
        : '';

  const burnoutContext =
    params.burnoutRisk >= 75
      ? 'HIGH burnout risk - prioritize rest and recovery strategies'
      : params.burnoutRisk >= 50
        ? 'MODERATE burnout risk - balance recovery with study maintenance'
        : 'LOW burnout risk - focus on performance optimization and prevention';

  return `Generate a personalized coping plan for a ${params.examType} student.

Current State:
- Mood: ${params.currentMood}
- Available Time: ${params.availableMinutes} minutes
- Burnout Risk: ${params.burnoutRisk}/100 (${burnoutContext})${urgencyNote}

Requirements:
- Immediate actions (0-5 minutes): Quick regulation techniques accessible right now
- Short-term activities (5-30 minutes): Structured interventions fitting available time
- Long-term habits (daily): Sustainable practices for the exam preparation period
- Study break activities: Specific restorative activities between study sessions
- A single mindfulness tip tailored to their current mood state
- A culturally resonant affirmation in plain English (can reference Indian context)

Constraints:
- All strategies must be actionable without any special equipment
- Do not suggest anything requiring leaving home unless time permits
- Keep language warm, specific, and encouraging
- Avoid generic advice like "just relax" or "take a break" without specific instructions`;
}
