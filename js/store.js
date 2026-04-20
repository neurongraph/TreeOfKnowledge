let _tree     = null;
let _selected = null;
const _listeners = {};

export const DEFAULT_PROMPT =
`Summarize the following text. Respond ONLY with valid JSON (no markdown, no code fences) in this exact shape:
{"summary": ["bullet 1", "bullet 2", "bullet 3"], "concepts": ["concept1", "concept2", "concept3"]}

The summary must be an array of up to 5 concise bullet points. Concepts should be 3-5 key terms.

TEXT:
{{text}}`;

let _promptTemplate = DEFAULT_PROMPT;
export function getPromptTemplate()    { return _promptTemplate; }
export function setPromptTemplate(t)   { _promptTemplate = t; }
export function resetPromptTemplate()  { _promptTemplate = DEFAULT_PROMPT; }

export const DEFAULT_SETTINGS = {
  ollamaUrl: 'http://localhost:11434',
  model:     'llama3.2',
  timeout:   30000,
};

let _settings = { ...DEFAULT_SETTINGS };
export function getSettings()          { return _settings; }
export function updateSettings(patch)  { Object.assign(_settings, patch); }

export function setTree(root)   { _tree = root;   emit('tree:change', root); }
export function getTree()       { return _tree; }
export function setSelected(id) { _selected = id; emit('select:change', id); }
export function getSelected()   { return _selected; }

export function setSummary(id, summary, concepts) {
  const node = findNode(_tree, id);
  if (!node) return;
  node.summary  = summary;
  node.concepts = concepts;
  node.status   = 'done';
  emit('summary:change', id);
}

export function setStatus(id, status) {
  const node = findNode(_tree, id);
  if (!node) return;
  node.status = status;
  emit('summary:change', id);
}

export function on(event, fn) {
  (_listeners[event] ??= []).push(fn);
}

export function off(event, fn) {
  _listeners[event] = (_listeners[event] ?? []).filter(f => f !== fn);
}

export function findNode(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function emit(event, data) {
  (_listeners[event] ?? []).forEach(fn => fn(data));
}
