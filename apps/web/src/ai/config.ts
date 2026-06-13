import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { type LanguageModel } from 'ai';

export type AIProvider = 'openai' | 'google';

export function getModel(provider: AIProvider = 'openai'): LanguageModel {
  if (provider === 'google') {
    return google('gemini-2.0-flash');
  }
  return openai('gpt-4o');
}

export function getAnalysisModel(): LanguageModel {
  return openai('gpt-4o');
}

export const AI_CONFIG = {
  maxTokens: 2048,
  temperature: 0.7,
  topP: 0.9,
  frequencyPenalty: 0.5,
} as const;
