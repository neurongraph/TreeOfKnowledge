let _tree     = null;
let _selected = null;
const _listeners = {};

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
