import { buildFolderInput } from './ingest.js';
import { getPromptTemplate, getSettings } from './store.js';

/**
 * Builds the Ollama prompt for a node using the current prompt template.
 * type: 'leaf' | 'folder'
 * folderInput: pre-built string (optional; auto-built from children if omitted)
 */
export function buildPrompt(node, type, folderInput) {
  const text = type === 'folder'
    ? (folderInput ?? buildFolderInput(node.children ?? []))
    : node.content;

  return getPromptTemplate().replace('{{text}}', text);
}

/**
 * Calls Ollama, streams tokens via onToken(text), resolves with { summary, concepts }.
 * Throws Error('timeout') or Error('unreachable') on failure.
 */
export async function summarize(node, type, onToken) {
  const prompt = buildPrompt(node, type);
  const { ollamaUrl, model, timeout } = getSettings();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(`${ollamaUrl}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream:      true,
        num_predict: CONFIG.maxTokens,
        prompt,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(err.name === 'AbortError' ? 'timeout' : 'unreachable');
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    throw new Error(`ollama_error:${response.status}`);
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.response) {
          fullText += parsed.response;
          onToken(parsed.response);
        }
      } catch { /* partial JSON line — skip */ }
    }
  }

  clearTimeout(timeoutId);

  try {
    const result = JSON.parse(fullText.trim());
    return {
      summary:  result.summary  ?? fullText.trim(),
      concepts: result.concepts ?? [],
    };
  } catch {
    return { summary: fullText.trim(), concepts: [] };
  }
}
