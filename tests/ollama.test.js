import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildPrompt } from '../js/ollama.js';

describe('ollama prompt builder', () => {
  it('leaf prompt includes node content and JSON shape instruction', () => {
    const node = { title: 'Ch 1', content: 'Some chapter text.', children: [] };
    const prompt = buildPrompt(node, 'leaf');
    assert.ok(prompt.includes('Some chapter text.'));
    assert.ok(prompt.includes('"summary"'));
    assert.ok(prompt.includes('"concepts"'));
  });

  it('folder prompt uses provided folderInput instead of node.content', () => {
    const node = { title: 'Part I', content: '', children: [] };
    const prompt = buildPrompt(node, 'folder', 'Ch1: intro text\nCh2: basics text');
    assert.ok(prompt.includes('Ch1: intro text'));
    assert.ok(!prompt.includes('node.content'));
  });
});
