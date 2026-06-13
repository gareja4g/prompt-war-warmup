/**
 * Server-safe sanitization utilities for MindGuard.
 *
 * All functions run in a Node.js (server) environment and do NOT depend on
 * a DOM or external sanitization libraries, making them safe for Next.js
 * server components, route handlers, and server actions.
 */

// ---------------------------------------------------------------------------
// HTML entity encoding map
// ---------------------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

// ---------------------------------------------------------------------------
// 1. sanitizeHTML
// ---------------------------------------------------------------------------

// Tags whose entire element (including content) should be removed
const DANGEROUS_TAGS_WITH_CONTENT =
  /(<\s*(?:script|style|iframe|object|embed|applet|base|form|input|button|select|textarea|link|meta|head|html|body)[^>]*>[\s\S]*?<\s*\/\s*(?:script|style|iframe|object|embed|applet|base|form|input|button|select|textarea|link|meta|head|html|body)\s*>)/gi;

// Any remaining dangerous opening/closing tags
const DANGEROUS_TAGS =
  /<\s*\/?\s*(?:script|style|iframe|object|embed|applet|base|form|input|button|select|textarea|link|meta|head|html|body)\b[^>]*>/gi;

// Dangerous attributes: event handlers, javascript: hrefs, data: URIs
const DANGEROUS_ATTRS =
  /\s(?:on\w+|formaction|action|srcdoc|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;

const JAVASCRIPT_PROTOCOL = /href\s*=\s*["']?\s*javascript:/gi;
const DATA_PROTOCOL = /src\s*=\s*["']?\s*data:/gi;

/**
 * Strips dangerous HTML tags and attributes from a string.
 * Safe to use in Node.js (no DOMParser required).
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let result = input;

  // Remove dangerous tags with their content first
  result = result.replace(DANGEROUS_TAGS_WITH_CONTENT, '');

  // Strip remaining dangerous self-closing or malformed tags
  result = result.replace(DANGEROUS_TAGS, '');

  // Remove dangerous event attributes
  result = result.replace(DANGEROUS_ATTRS, '');

  // Remove javascript: and data: protocols
  result = result.replace(JAVASCRIPT_PROTOCOL, 'href="#"');
  result = result.replace(DATA_PROTOCOL, 'src=""');

  // Remove HTML comments (may hide injection attempts)
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // Remove null bytes
  result = result.replace(/\0/g, '');

  return result.trim();
}

// ---------------------------------------------------------------------------
// 2. sanitizeText
// ---------------------------------------------------------------------------

/**
 * Escapes all HTML entities in a string, making it safe to render as text.
 * Use this when you need to display user input inside HTML without rendering it.
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] ?? char);
}

// ---------------------------------------------------------------------------
// 3. sanitizeMarkdown
// ---------------------------------------------------------------------------

// Markdown elements we want to allow through (headings, lists, bold, italic,
// code, blockquotes, links, images).  We only strip genuinely dangerous parts.
const MARKDOWN_SCRIPT_BLOCK = /```(?:html|javascript|js|vbscript)[^`]*```/gi;
const MARKDOWN_INLINE_HTML = /<\s*(?:script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed)\s*>/gi;
const MARKDOWN_DANGEROUS_LINKS = /\[([^\]]*)\]\(javascript:[^)]*\)/gi;
const MARKDOWN_DANGEROUS_IMAGE = /!\[([^\]]*)\]\(javascript:[^)]*\)/gi;

/**
 * Sanitizes a Markdown string by removing dangerous constructs while
 * preserving safe formatting (headings, bold, italic, code, links, etc.).
 */
export function sanitizeMarkdown(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let result = input;

  // Remove script/dangerous code blocks
  result = result.replace(MARKDOWN_SCRIPT_BLOCK, '');

  // Remove inline HTML that could be dangerous
  result = result.replace(MARKDOWN_INLINE_HTML, '');

  // Replace dangerous link targets
  result = result.replace(MARKDOWN_DANGEROUS_LINKS, '[$1](#)');
  result = result.replace(MARKDOWN_DANGEROUS_IMAGE, '![$1](#)');

  // Strip HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // Remove null bytes
  result = result.replace(/\0/g, '');

  return result.trim();
}

// ---------------------------------------------------------------------------
// 4. validateAndSanitizeJournalContent
// ---------------------------------------------------------------------------

const JOURNAL_MIN_LENGTH = 10;
const JOURNAL_MAX_LENGTH = 10_000;

export interface JournalValidationResult {
  valid: boolean;
  sanitized: string;
  error?: string;
}

/**
 * Validates and sanitizes journal entry content.
 * - Enforces min/max character limits
 * - Sanitizes markdown (safe for rich-text editors)
 * - Returns a typed result object
 */
export function validateAndSanitizeJournalContent(
  content: string,
): JournalValidationResult {
  if (!content || typeof content !== 'string') {
    return { valid: false, sanitized: '', error: 'Content is required.' };
  }

  const trimmed = content.trim();

  if (trimmed.length < JOURNAL_MIN_LENGTH) {
    return {
      valid: false,
      sanitized: trimmed,
      error: `Journal entry must be at least ${JOURNAL_MIN_LENGTH} characters.`,
    };
  }

  if (trimmed.length > JOURNAL_MAX_LENGTH) {
    return {
      valid: false,
      sanitized: trimmed.slice(0, JOURNAL_MAX_LENGTH),
      error: `Journal entry cannot exceed ${JOURNAL_MAX_LENGTH} characters.`,
    };
  }

  const sanitized = sanitizeMarkdown(trimmed);

  return { valid: true, sanitized };
}

// ---------------------------------------------------------------------------
// 5. detectPromptInjection
// ---------------------------------------------------------------------------

export type RiskLevel = 'low' | 'medium' | 'high';

export interface PromptInjectionResult {
  detected: boolean;
  risk: RiskLevel;
  patterns: string[];
}

const PROMPT_INJECTION_PATTERNS: Array<{
  label: string;
  regex: RegExp;
  risk: RiskLevel;
}> = [
  {
    label: 'ignore previous instructions',
    regex: /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
    risk: 'high',
  },
  {
    label: 'you are now',
    regex: /you\s+are\s+now\s+(?:a|an|the)\s+\w/i,
    risk: 'high',
  },
  {
    label: 'disregard your training',
    regex: /disregard\s+(?:your|all|previous)\s+(?:training|instructions?|rules?)/i,
    risk: 'high',
  },
  {
    label: 'system prompt override',
    regex: /\[?system\]?:/i,
    risk: 'high',
  },
  {
    label: 'instruction tag',
    regex: /\[INST\]|\[\/INST\]|<\|system\|>|<\|user\|>|<\|assistant\|>/i,
    risk: 'high',
  },
  {
    label: 'act as',
    regex: /act\s+as\s+(?:a|an|the|if)\s+\w/i,
    risk: 'medium',
  },
  {
    label: 'pretend to be',
    regex: /pretend\s+to\s+be\b/i,
    risk: 'medium',
  },
  {
    label: 'jailbreak',
    regex: /\bjailbreak\b|\bDAN\b|\bdo\s+anything\s+now\b/i,
    risk: 'high',
  },
  {
    label: 'forget everything',
    regex: /forget\s+(?:everything|all)\s+(?:you|above|before)/i,
    risk: 'high',
  },
  {
    label: 'new instructions',
    regex: /new\s+instructions?:/i,
    risk: 'medium',
  },
  {
    label: 'override safety',
    regex: /override\s+(?:safety|ethical|content)\s+(?:measures?|filters?|guidelines?)/i,
    risk: 'high',
  },
  {
    label: 'assistant token',
    regex: /<\/?assistant>|<\/?human>|<\/?ai>/i,
    risk: 'medium',
  },
  {
    label: 'end of prompt',
    regex: /---\s*end\s*of\s*(?:prompt|instructions?)\s*---/i,
    risk: 'medium',
  },
  {
    label: 'reveal system prompt',
    regex: /(?:reveal|show|print|output)\s+(?:your\s+)?(?:system\s+)?prompt/i,
    risk: 'medium',
  },
];

/**
 * Detects common prompt injection patterns in user input.
 * Does NOT block the input; callers decide how to respond to the result.
 */
export function detectPromptInjection(input: string): PromptInjectionResult {
  if (!input || typeof input !== 'string') {
    return { detected: false, risk: 'low', patterns: [] };
  }

  const matchedLabels: string[] = [];
  let maxRisk: RiskLevel = 'low';

  for (const { label, regex, risk } of PROMPT_INJECTION_PATTERNS) {
    if (regex.test(input)) {
      matchedLabels.push(label);
      if (risk === 'high') {
        maxRisk = 'high';
      } else if (risk === 'medium' && maxRisk !== 'high') {
        maxRisk = 'medium';
      }
    }
  }

  return {
    detected: matchedLabels.length > 0,
    risk: matchedLabels.length > 0 ? maxRisk : 'low',
    patterns: matchedLabels,
  };
}

// ---------------------------------------------------------------------------
// 6. sanitizeAIOutput
// ---------------------------------------------------------------------------

/**
 * Sanitizes AI-generated output before rendering to the end user.
 * Removes any HTML injection or script-like content the model may have produced.
 */
export function sanitizeAIOutput(output: string): string {
  if (!output || typeof output !== 'string') return '';

  // AI output is treated as Markdown, so use markdown sanitization
  let result = sanitizeMarkdown(output);

  // Extra pass: strip any remaining raw HTML tags that Markdown doesn't normally produce
  result = result.replace(/<(?!\/?(b|i|em|strong|code|pre|ul|ol|li|p|br|h[1-6]|blockquote)\b)[^>]+>/gi, '');

  // Strip null bytes
  result = result.replace(/\0/g, '');

  return result.trim();
}
