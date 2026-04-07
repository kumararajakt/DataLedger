import { callAi, type AiSettings } from './client';

/**
 * Ask the AI to suggest a category name for a single transaction description.
 * Returns the matched category name, or null on failure / no match.
 */
export async function suggestCategory(
  description: string,
  settings: AiSettings,
  categoryNames: string[]
): Promise<string | null> {
  const catList = categoryNames.join(', ');
  const safe    = description.substring(0, 200).replace(/"/g, "'");

  const prompt = `Bank transaction: "${safe}"

Pick the single best category from: ${catList}

Reply with ONLY the category name. If none fit, reply: Other`;

  try {
    const reply = await callAi(settings, [{ role: 'user', content: prompt }], 30);
    const trimmed = reply.trim();
    if (categoryNames.includes(trimmed)) return trimmed;
    return null;
  } catch {
    return null;
  }
}
