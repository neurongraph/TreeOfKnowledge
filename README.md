# Tree of Knowledge

A browser-based knowledge explorer that ingests a local folder of documents and uses a locally-running Ollama language model to generate AI-powered summaries and extract key concepts — all without sending your data to the cloud.

![Tree of Knowledge](docs/screenshot.png)

## What it does

Load a folder of Markdown, PDF, and PowerPoint files. The app builds a hierarchical tree from your folder structure. Click any node — file or folder — and the app streams an AI-generated summary and a set of key concept tags in real time.

## Features

- **Multi-format support** — `.md`, `.pdf`, `.pptx` (including speaker notes)
- **Dual-panel interface** — tree navigator on the left, summary table on the right
- **Real-time streaming** — summaries appear token-by-token as Ollama responds
- **Smart summarization triggers** — selecting a folder auto-summarizes its direct children; collapsing a folder summarizes the whole section
- **Configurable** — edit the Ollama URL, model name, timeout, and prompt template via the settings panel
- **Session cache** — summaries are computed once and reused within a session
- **Error recovery** — failed nodes show a retry button; partial JSON responses fall back gracefully
- **No build step, no backend** — pure static files served locally

## Prerequisites

- [Ollama](https://ollama.com) installed and running locally
- A pulled model, e.g. `llama3.2`
- A static HTTP server (e.g. `npx serve`)
- Chrome, Edge, or Safari 15.2+ (Firefox falls back to file-by-file selection)

## Getting started

```bash
# 1. Pull a model (first time only)
ollama pull llama3.2

# 2. Start Ollama (if not already running)
ollama serve

# 3. Serve the app
npx serve .

# 4. Open http://localhost:3000 in your browser
```

Then click **Open Folder**, select a directory containing your documents, and start clicking nodes to generate summaries.

## Running tests

```bash
npm test
```

Tests use Node's built-in test runner — no additional dependencies required.

## Configuration

Click the **⚙** icon to open the settings panel. You can configure:

| Setting | Default | Description |
|---|---|---|
| Ollama URL | `http://localhost:11434` | Base URL for your Ollama instance |
| Model | `llama3.2` | Any model you have pulled locally |
| Timeout | `30s` | Per-request timeout (5–300 seconds) |
| Prompt template | *(built-in)* | The system prompt sent with each document |

The default prompt instructs the model to return `{"summary": "...", "concepts": [...]}`. You can customise it for your use case or swap in a different schema.

## Architecture

```
TreeOfKnowledge/
├── index.html        # Entry point and CONFIG block
├── style.css         # Dark-theme styles
├── js/
│   ├── app.js        # Bootstrap, screen transitions, settings modal
│   ├── store.js      # Shared state and event bus
│   ├── ingest.js     # File traversal and text extraction
│   ├── tree.js       # Left panel — tree render and expand/collapse
│   ├── table.js      # Right panel — scoped subtree display
│   └── ollama.js     # Ollama API calls and streaming
└── tests/
    ├── store.test.js
    ├── ingest.test.js
    └── ollama.test.js
```

**Key design decisions:**

- **No build tool, no npm dependencies** — third-party libraries (`marked`, `pdf.js`, `jszip`) are loaded from CDN
- **Functional state store** — `store.js` uses plain getter/setter functions and a lightweight pub/sub event bus
- **Lazy library loading** — `pdf.js` and `jszip` are imported dynamically only when a matching file type is encountered
- **Folder summaries from excerpts** — to avoid large context windows, folders are summarised from their children's titles plus the first 200 characters of each child's content

## Browser compatibility

| Browser | Directory picker | Notes |
|---|---|---|
| Chrome / Edge | `showDirectoryPicker()` | Full support |
| Safari 15.2+ | `<input webkitdirectory>` | Full support via fallback |
| Firefox | File-by-file `<input>` | Works, but no recursive folder traversal |

## License

MIT
