# Tree of Knowledge — Widget Design

**Date:** 2026-04-19

## Overview

A browser-only knowledge exploration widget. The user picks a local folder of Markdown and PDF files; the app ingests them into a tree structure, displays them in a split tree+table view, and uses a local Ollama model to generate AI summaries when nodes are collapsed.

---

## Architecture

**Approach:** Multi-file ES modules, served via a local static server (`npx serve .`). No build step, no npm dependencies — all third-party libraries loaded from CDN.

### File Structure

```
TreeOfKnowledge/
├── index.html          — entry point, welcome + layout shell
├── style.css           — all styles
└── js/
    ├── app.js          — bootstraps everything, handles folder pick + screen transitions
    ├── ingest.js       — reads directory, parses .md and .pdf, builds node tree
    ├── tree.js         — tree panel render + expand/collapse logic
    ├── table.js        — table panel render + row updates
    ├── ollama.js       — Ollama API calls, streaming, summary cache
    └── store.js        — shared state, simple event bus
```

### CDN Dependencies

```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.min.mjs" type="module"></script>
```

### Configuration (top of index.html)

```js
const CONFIG = {
  ollamaUrl: 'http://localhost:11434',
  model:     'llama3.2',
  maxTokens: 500,
};
```

---

## Data Model

Each node in memory:

```js
{
  id:       string,       // unique, derived from file path
  title:    string,       // folder/file name, leading numbers stripped
  content:  string,       // plain text extracted from .md or .pdf
  children: Node[],       // empty for leaf nodes
  summary:  string|null,  // null until Ollama generates it
  concepts: string[],     // empty until Ollama responds
  status:   'pending' | 'loading' | 'done' | 'error'
}
```

---

## User Flow

### Screen 1 — Welcome

- Centered layout: app title, subtitle, "📂 Open Folder" button
- Calls `showDirectoryPicker()` (File System Access API)
- Firefox fallback: `<input type="file" multiple webkitdirectory>` shown as secondary option
- On folder selected → transition to ingest screen

### Ingest (Screen 1.5)

Handled by `ingest.js`:

1. Walk `FileSystemDirectoryHandle` recursively
2. Skip hidden files/folders (names starting with `.`)
3. Sort siblings by filename (leading numbers used for order, then stripped from title)
4. Folders → parent nodes; `.md` / `.pdf` files → leaf nodes
5. `.md`: parse with `marked`, strip HTML tags to get plain text
6. `.pdf`: extract text page-by-page with `pdf.js`
7. Show progress bar: "N of M files processed" + current filename
8. On complete: write tree to `store`, transition to tree+table view

### Screen 2 — Tree + Table

Two-panel layout: tree on the left (~280px fixed), table fills the rest.

---

## Tree Panel

**Node types:**

- **Folder node** — has a toggle arrow (▶/▼). Click arrow = expand/collapse. Click label = select.
- **Leaf node** — no arrow. Click = select.

**Visual states:**

| State | Indicator |
|---|---|
| Selected | Highlighted background, left accent border |
| Expanded | ▼ arrow |
| Collapsed | ▶ arrow |
| Summary pending | no indicator |
| Summary loading | ⏳ spinner beside label |
| Summary ready | ✦ indicator beside label |
| Summary error | ⚠ indicator beside label |

**Summarization triggers:**

- **Folder node collapsed** for the first time → fire Ollama summarization. Input: concatenation of all direct children's titles + first 200 chars of their content (gives the model a structural overview of the section).
- **Folder node selected (clicked)** → sequentially fire Ollama summarization for each direct child leaf node that has not yet been summarized (`status === 'pending'`), one after another. This pre-warms all documents under the folder without requiring manual selection of each.
- **Leaf node selected** for the first time → fire Ollama summarization. Input: the leaf's full `content`.

All are cached on first generation and never re-fired.

---

## Table Panel

- Shows the **selected node + all its descendants**, indented to match tree depth
- On app load, root node is selected → full tree visible in table
- Clicking a table row selects that node in the tree (and re-scopes the table)
- Columns: **Title**, **Summary**, **Key Concepts**
- Key Concepts rendered as pill badges
- Summary streams in token-by-token with a blinking cursor; Key Concepts appear once full JSON is parsed

---

## Ollama Summarization

**Triggers:**
- Folder node collapsed for the first time → summarize using concatenated children titles + excerpts
- Folder node selected → sequentially summarize each direct child leaf with `status === 'pending'`
- Leaf node selected for the first time → summarize using full node content

**Cache:** In-memory in `store.js`. Summaries persist for the session; lost on page reload.

**API call:**

```
POST http://localhost:11434/api/generate
{
  "model": "llama3.2",
  "stream": true,
  "prompt": "Summarize the following text. Return JSON with two fields:
             'summary' (2-3 sentences) and 'concepts' (array of 3-5 key concept strings).\n\nTEXT:\n{node.content}"
}
```

**Response handling:**

- Stream tokens into the Summary cell as they arrive
- On stream complete, attempt `JSON.parse` of full response
- If parse succeeds: populate `summary` + `concepts` fields
- If parse fails: use raw response text as `summary`, leave `concepts` empty

**Error handling:**

| Condition | UX |
|---|---|
| Ollama unreachable | ⚠ "Cannot connect to Ollama at localhost:11434" inline in table |
| Timeout (30s) | ⚠ "Timed out" + Retry button |
| Bad JSON | Fall back to raw text as summary, no concepts shown |

---

## Browser Support

| Browser | Support |
|---|---|
| Chrome / Edge | Full (`showDirectoryPicker` supported) |
| Safari 15.2+ | Full |
| Firefox | Partial — file input fallback, no directory handle API |

---

## Out of Scope

- Persistence across sessions (no localStorage, no exported JSON)
- Editing content
- Search / filtering
- Multiple books open simultaneously
