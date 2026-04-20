# PPTX Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.pptx` file ingestion — slide text + speaker notes extracted via JSZip + regex, then fed to Ollama exactly like `.md` and `.pdf` files.

**Architecture:** Two pure regex helpers (`extractTextFromXml`, `extractNotesFromXml`) do the XML parsing — regex is chosen over `DOMParser` because it is testable in Node.js without browser globals, and PPTX XML is machine-generated and consistently structured. `parsePptxFile` lazily imports JSZip from `https://esm.sh/jszip@3` (an ES-module CDN wrapper), unzips the file, and calls both helpers per slide. Extension filters in both directory-walk paths (`ingestDirectory`, `buildTreeFromFileList`) are extended to include `pptx`.

**Tech Stack:** Vanilla JS ES modules, JSZip v3 via `esm.sh` CDN, regex XML extraction, Node.js built-in test runner.

---

## File Map

| File | Change |
|---|---|
| `js/ingest.js` | Add `extractTextFromXml`, `extractNotesFromXml` (exported), `parsePptxFile` (internal); update extension filters in both walk paths |
| `js/app.js` | Add `.pptx` to `<input accept>` attribute |
| `tests/ingest.test.js` | Add two new unit tests for the two exported helpers |

---

### Task 1: Pure helpers — TDD

**Files:**
- Modify: `tests/ingest.test.js`
- Modify: `js/ingest.js`

- [ ] **Step 1: Add failing tests to `tests/ingest.test.js`**

Append inside the existing `describe('ingest helpers', ...)` block, after the last `it(...)`:

```js
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
```

Also update the import line at the top of the file:

```js
import { titleFromName, buildFolderInput, extractTextFromXml, extractNotesFromXml } from '../js/ingest.js';
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test
```

Expected: `SyntaxError` or `extractTextFromXml is not exported` — the functions don't exist yet.

- [ ] **Step 3: Add the two helpers to `js/ingest.js`**

Add immediately after the existing `stripHtml` function (around line 28):

```js
/**
 * Extracts all <a:t> text nodes from a PPTX slide XML string.
 * Uses regex rather than DOMParser so it is testable in Node.js.
 */
export function extractTextFromXml(xmlString) {
  return [...xmlString.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)]
    .map(m => m[1])
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts speaker-notes text from a PPTX notesSlide XML string.
 * Only reads from the shape whose <p:ph> has type="body", skipping
 * the slide-preview shape that would otherwise duplicate slide content.
 */
export function extractNotesFromXml(xmlString) {
  const spBlocks = [...xmlString.matchAll(/<p:sp[\s\S]*?<\/p:sp>/g)].map(m => m[0]);
  const bodyShape = spBlocks.find(sp => /<p:ph[^>]+type="body"/.test(sp));
  if (!bodyShape) return '';
  return extractTextFromXml(bodyShape);
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test
```

Expected: `14 pass, 0 fail` (12 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add js/ingest.js tests/ingest.test.js
git commit -m "feat: pptx — extractTextFromXml and extractNotesFromXml helpers"
```

---

### Task 2: parsePptxFile + extension wiring + app.js update

**Files:**
- Modify: `js/ingest.js`
- Modify: `js/app.js`

- [ ] **Step 1: Add `parsePptxFile` to `js/ingest.js`**

Add at the bottom of the file, after `parsePdfFile`:

```js
async function parsePptxFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const JSZipModule = await import('https://esm.sh/jszip@3');
  const JSZip = JSZipModule.default ?? JSZipModule;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const n = s => parseInt(s.match(/slide(\d+)\.xml$/)[1]);
      return n(a) - n(b);
    });

  const parts = await Promise.all(slideNames.map(async slideName => {
    const slideXml  = await zip.files[slideName].async('string');
    const slideText = extractTextFromXml(slideXml);

    const notesName = slideName
      .replace('ppt/slides/slide', 'ppt/notesSlides/notesSlide');
    const notesText = zip.files[notesName]
      ? extractNotesFromXml(await zip.files[notesName].async('string'))
      : '';

    return [slideText, notesText].filter(Boolean).join('\n');
  }));

  return parts.filter(Boolean).join('\n\n').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 2: Update extension filter in `ingestDirectory`**

Find this line (around line 57):

```js
    if (ext !== 'md' && ext !== 'pdf') return null;
```

Replace with:

```js
    if (ext !== 'md' && ext !== 'pdf' && ext !== 'pptx') return null;
```

Find the content branch (around line 60–62):

```js
    const content = ext === 'md'
      ? await parseMdHandle(entry.handle)
      : await parsePdfHandle(entry.handle);
```

Replace with:

```js
    const content = ext === 'md'
      ? await parseMdHandle(entry.handle)
      : ext === 'pdf'
        ? await parsePdfHandle(entry.handle)
        : await parsePptxFile(await entry.handle.getFile());
```

- [ ] **Step 3: Update extension filter in `buildTreeFromFileList`**

Find this line (around line 93–95):

```js
  const supported = files.filter(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    return ext === 'md' || ext === 'pdf';
  })
```

Replace with:

```js
  const supported = files.filter(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    return ext === 'md' || ext === 'pdf' || ext === 'pptx';
  })
```

Find the content branch (around line 125–127):

```js
    const content = ext === 'md'
      ? stripHtml(window.marked.parse(await file.text()))
      : await parsePdfFile(file);
```

Replace with:

```js
    const content = ext === 'md'
      ? stripHtml(window.marked.parse(await file.text()))
      : ext === 'pdf'
        ? await parsePdfFile(file)
        : await parsePptxFile(file);
```

- [ ] **Step 4: Update `<input accept>` in `js/app.js`**

Find:

```js
  <input type="file" id="input-files" multiple accept=".md,.pdf" webkitdirectory style="display:none">
```

Replace with:

```js
  <input type="file" id="input-files" multiple accept=".md,.pdf,.pptx" webkitdirectory style="display:none">
```

- [ ] **Step 5: Run tests — confirm still 14 passing**

```bash
npm test
```

Expected: `14 pass, 0 fail`.

- [ ] **Step 6: Manual browser verification**

```bash
npx serve .
```

1. Open http://localhost:3000
2. Click "Open Folder" → select a folder containing at least one `.pptx` file
3. Verify the `.pptx` file appears as a leaf node in the tree
4. Click the leaf → confirm summary streams in (or ⚠ if Ollama is not running)
5. Confirm `.md` and `.pdf` files in the same folder still ingest correctly

- [ ] **Step 7: Commit**

```bash
git add js/ingest.js js/app.js
git commit -m "feat: pptx — full ingestion with slide text and speaker notes"
```

---

## Spec Coverage

| Requirement | Task |
|---|---|
| `.pptx` files ingested as leaf nodes | Task 2 |
| Slide `<a:t>` text extracted | Task 1 |
| Speaker notes (body placeholder only) extracted | Task 1 |
| Slides sorted numerically | Task 2 |
| Notes missing for a slide → skip gracefully | Task 2 |
| Extension filter updated in `ingestDirectory` | Task 2 |
| Extension filter updated in `buildTreeFromFileList` | Task 2 |
| `<input accept>` updated | Task 2 |
| Unit tests for helpers | Task 1 |
| No new `<script>` in `index.html` | Task 2 (lazy import) |
