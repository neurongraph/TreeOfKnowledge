import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { titleFromName, buildFolderInput, extractTextFromXml, extractNotesFromXml } from '../js/ingest.js';

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

  it('extractTextFromXml extracts all <a:t> text from slide XML', () => {
    const xml = `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Hello World</a:t></a:r></a:p><a:p><a:r><a:t>Second line</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    const result = extractTextFromXml(xml);
    assert.strictEqual(result, 'Hello World Second line');
  });

  it('extractNotesFromXml returns only body-placeholder text, ignoring other shapes', () => {
    const xml = `<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Slide preview ignored</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Speaker note text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;
    const result = extractNotesFromXml(xml);
    assert.strictEqual(result, 'Speaker note text');
    assert.ok(!result.includes('Slide preview ignored'));
  });
});
