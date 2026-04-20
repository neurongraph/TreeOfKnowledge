# PPTX Support — Design Spec

**Date:** 2026-04-20

## Overview

Add `.pptx` file ingestion to the Tree of Knowledge widget. Text is extracted from slide bodies and speaker notes, then passed to Ollama for summarization exactly like `.md` and `.pdf` files. No build step — JSZip is loaded lazily from CDN.

---

## Approach

**JSZip + native DOMParser.**

A `.pptx` file is a ZIP archive (Open XML format). JSZip unpacks it in the browser; the browser's built-in `DOMParser` parses each slide's XML. No additional libraries beyond JSZip.

CDN URL (lazy dynamic import, same pattern as pdf.js):
```
https://cdn.jsdelivr.net/npm/jszip/dist/jszip.min.js
```

---

## What Gets Extracted

| Source file | Content extracted |
|---|---|
| `ppt/slides/slide1.xml`, `slide2.xml`, … | All `<a:t>` text nodes; slides sorted numerically |
| `ppt/notesSlides/notesSlide1.xml`, … | Only the shape whose `<p:ph>` has `type="body"` — the speaker notes body. The other shape (slide preview) is skipped to avoid duplicating slide text. |

Per slide: slide text + `\n` + notes text (if present). All slides joined with `\n\n`.

---

## Code Changes

### `js/ingest.js`

1. **`extractTextFromXml(xmlString)`** — pure helper, exported for testing.
   - Parses XML string with `DOMParser`
   - Queries all `<a:t>` elements
   - Returns joined plain text

2. **`extractNotesFromXml(xmlString)`** — pure helper, exported for testing.
   - Parses XML string with `DOMParser`
   - Finds the `<p:sp>` shape containing `<p:ph type="body">`
   - Returns `<a:t>` text from that shape only

3. **`parsePptxFile(file)`** — internal async function (same pattern as `parsePdfFile`).
   - Lazy-imports JSZip from CDN
   - Calls `JSZip.loadAsync(arrayBuffer)`
   - Collects `ppt/slides/slide*.xml` files, sorts numerically
   - For each slide: extracts slide text + matching notes text
   - Returns combined plain text string

4. **Extension filter** updated in both `ingestDirectory` and `buildTreeFromFileList`:
   - `'md' | 'pdf' | 'pptx'` — `pptx` added to the allowed set
   - Content branch extended with `ext === 'pptx'` → `parsePptxFile(file)`

### `js/app.js`

- `<input>` `accept` attribute updated from `".md,.pdf"` to `".md,.pdf,.pptx"`

### `tests/ingest.test.js`

Two new unit tests using inline XML fixture strings (no real PPTX file needed):

- `extractTextFromXml` returns correct plain text from a minimal slide XML fixture
- `extractNotesFromXml` returns only the body-placeholder text, ignoring other shapes

---

## What Is Not Changing

- `index.html` — no new `<script>` tag; JSZip loads lazily inside `parsePptxFile`
- `store.js`, `ollama.js`, `tree.js`, `table.js` — no changes; PPTX nodes are plain leaf nodes identical to PDF nodes once text is extracted
- Node data model — unchanged; PPTX files produce the same `{ id, title, content, children: [], … }` leaf shape

---

## Error Handling

| Condition | Behaviour |
|---|---|
| JSZip CDN unreachable | `parsePptxFile` throws; node gets `status: 'error'` via existing `ingestDirectory` error propagation |
| File is not a valid ZIP / PPTX | JSZip throws on `loadAsync`; same error path |
| Slide has no text | Returns empty string for that slide; no error |
| Notes file missing for a slide | Skipped gracefully; only slide text used |

---

## Browser Support

No change — JSZip works in Chrome, Safari, and Firefox. PPTX files are accessible via both the `FileSystemDirectoryHandle` path (Chrome) and the `<input webkitdirectory>` fallback (Safari/Firefox).
