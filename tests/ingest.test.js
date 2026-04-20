import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { titleFromName, buildFolderInput } from '../js/ingest.js';

describe('ingest helpers', () => {
  it('strips leading numbers and extension from filename', () => {
    assert.strictEqual(titleFromName('01-introduction.md'),  'Introduction');
    assert.strictEqual(titleFromName('02_core-concepts.pdf'), 'Core Concepts');
    assert.strictEqual(titleFromName('10. The Beginning.md'), 'The Beginning');
    assert.strictEqual(titleFromName('chapter-three'),        'Chapter Three');
  });

  it('buildFolderInput includes child titles and excerpts', () => {
    const children = [
      { title: 'Ch 1', content: 'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu.' },
      { title: 'Ch 2', content: 'Short.' },
    ];
    const result = buildFolderInput(children);
    assert.ok(result.includes('Ch 1'));
    assert.ok(result.includes('Ch 2'));
    assert.ok(result.length < 2000);
  });

  it('buildFolderInput truncates long content to 200 chars per child', () => {
    const longContent = 'word '.repeat(200);
    const children = [{ title: 'Big Chapter', content: longContent }];
    const result = buildFolderInput(children);
    assert.ok(result.length < 300);
  });
});
