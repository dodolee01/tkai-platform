/**
 * @file Post-processes raw AI text output into structured, consistent
 * response shapes: extracting fenced JSON blocks, stripping markdown
 * for plain-text contexts, and normalizing confidence-bearing
 * analysis results. Pure functions — no AI calls, no state.
 * @module ai-core-engine/ResponseFormatter
 */

/**
 * Extract the first fenced JSON code block from AI text output (the
 * convention {@link PromptBuilder} instructs models to use for
 * structured output such as bot configurations).
 * @param {string} text
 * @returns {object|null} Parsed JSON, or `null` if no valid block was found.
 */
export function extractJSONBlock(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    return null;
  }
}

/**
 * Strip markdown formatting characters for contexts that need plain
 * text (e.g. SMS/push notification bodies).
 * @param {string} text
 * @returns {string}
 */
export function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Build a normalized {@link import('./types.js').AnalysisResult} from
 * a raw AI completion, separating the natural-language summary from
 * any structured JSON block the model included, and clamping
 * confidence to a valid [0,1] range.
 * @param {string} rawContent
 * @param {number} [confidence=0.7] - Default confidence when the AI response carries no explicit figure.
 * @param {string[]} [warnings=[]]
 * @returns {import('./types.js').AnalysisResult}
 */
export function formatAnalysisResult(rawContent, confidence = 0.7, warnings = []) {
  const structuredData = extractJSONBlock(rawContent);
  const summary = structuredData ? rawContent.replace(/```(?:json)?\s*[\s\S]*?```/i, '').trim() : rawContent.trim();

  return {
    summary,
    data: structuredData ?? {},
    confidence: Math.min(1, Math.max(0, confidence)),
    warnings,
  };
}

export default { extractJSONBlock, stripMarkdown, truncate, formatAnalysisResult };
