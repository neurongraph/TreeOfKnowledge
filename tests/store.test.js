import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { setTree, getTree, setSelected, getSelected, setSummary, setStatus, findNode, on, off } from '../js/store.js';

describe('store', () => {
  beforeEach(() => {
    setTree(null);
    setSelected(null);
  });

  it('setTree / getTree round-trips', () => {
    const root = { id: 'root', title: 'Root', children: [] };
    setTree(root);
    assert.deepStrictEqual(getTree(), root);
  });

  it('setSelected / getSelected round-trips', () => {
    setSelected('part1');
    assert.strictEqual(getSelected(), 'part1');
  });

  it('on/emit fires listener on setSelected', () => {
    let fired = null;
    on('select:change', id => { fired = id; });
    setSelected('ch1');
    assert.strictEqual(fired, 'ch1');
  });

  it('off removes listener', () => {
    let count = 0;
    const fn = () => count++;
    on('select:change', fn);
    off('select:change', fn);
    setSelected('ch2');
    assert.strictEqual(count, 0);
  });

  it('setSummary updates node in tree and emits summary:change', () => {
    const leaf = { id: 'ch1', title: 'Ch 1', content: 'text', children: [], summary: null, concepts: [], status: 'pending' };
    const root = { id: 'root', title: 'Root', content: '', children: [leaf], summary: null, concepts: [], status: 'pending' };
    setTree(root);
    let emittedId = null;
    on('summary:change', id => { emittedId = id; });
    setSummary('ch1', 'A summary.', ['concept1', 'concept2']);
    assert.strictEqual(emittedId, 'ch1');
    assert.strictEqual(getTree().children[0].summary, 'A summary.');
    assert.deepStrictEqual(getTree().children[0].concepts, ['concept1', 'concept2']);
    assert.strictEqual(getTree().children[0].status, 'done');
  });

  it('findNode finds nested node by id', () => {
    const leaf = { id: 'ch1', children: [] };
    const root = { id: 'root', children: [{ id: 'part1', children: [leaf] }] };
    setTree(root);
    assert.strictEqual(findNode(root, 'ch1'), leaf);
  });

  it('findNode returns null for missing id', () => {
    const root = { id: 'root', children: [] };
    assert.strictEqual(findNode(root, 'nope'), null);
  });
});
