/**
 * Strips leading numbers/punctuation and file extension, title-cases the result.
 * "01-introduction.md" → "Introduction"
 */
export function titleFromName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/^[\d]+[.\-_\s]+/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/**
 * Builds summarization input for a folder node from its direct children.
 * Uses title + first 200 chars of content per child.
 */
export function buildFolderInput(children) {
  return children.map(c => {
    const excerpt = (c.content ?? '').slice(0, 200).replace(/\s+/g, ' ').trim();
    return `${c.title}: ${excerpt}`;
  }).join('\n\n');
}

/** Strips HTML tags to plain text. */
export function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Entry point for Chrome/Edge/Safari: walks a FileSystemDirectoryHandle.
 * onProgress(done, total, currentFilename) called as each file is processed.
 * Returns a root Node.
 */
export async function ingestDirectory(dirHandle, onProgress) {
  const allFiles = await collectFileEntries(dirHandle, '');
  const total = allFiles.length;
  let done = 0;

  async function buildNode(entry) {
    if (entry.kind === 'directory') {
      const childEntries = await collectFileEntries(entry.handle, entry.path);
      const children = (
        await Promise.all(
          childEntries
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(buildNode)
        )
      ).filter(Boolean);
      return {
        id: entry.path, title: titleFromName(entry.name), content: '',
        children, summary: null, concepts: [], status: 'pending', expanded: true,
      };
    }

    const ext = entry.name.split('.').pop().toLowerCase();
    if (ext !== 'md' && ext !== 'pdf') return null;

    onProgress(done, total, entry.name);
    const content = ext === 'md'
      ? await parseMdHandle(entry.handle)
      : await parsePdfHandle(entry.handle);
    done++;
    onProgress(done, total, entry.name);

    return {
      id: entry.path, title: titleFromName(entry.name), content,
      children: [], summary: null, concepts: [], status: 'pending', expanded: false,
    };
  }

  const rootEntries = await collectFileEntries(dirHandle, 'root');
  const children = (
    await Promise.all(
      rootEntries
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(buildNode)
    )
  ).filter(Boolean);

  return {
    id: 'root', title: dirHandle.name, content: '',
    children, summary: null, concepts: [], status: 'pending', expanded: true,
  };
}

/**
 * Firefox fallback: builds a tree from a flat list of File objects
 * (from <input type="file" webkitdirectory>).
 */
export async function buildTreeFromFileList(files, onProgress) {
  const supported = files.filter(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    return ext === 'md' || ext === 'pdf';
  }).sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath));

  const total = supported.length;
  let done = 0;
  const nodeMap = new Map();

  const root = {
    id: 'root', title: 'Files', content: '',
    children: [], summary: null, concepts: [], status: 'pending', expanded: true,
  };
  nodeMap.set('', root);

  for (const file of supported) {
    const parts = file.webkitRelativePath.split('/');

    for (let i = 1; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join('/');
      if (!nodeMap.has(folderPath)) {
        const folderNode = {
          id: folderPath, title: titleFromName(parts[i]), content: '',
          children: [], summary: null, concepts: [], status: 'pending', expanded: true,
        };
        const parentPath = parts.slice(0, i).join('/');
        (nodeMap.get(parentPath) ?? root).children.push(folderNode);
        nodeMap.set(folderPath, folderNode);
      }
    }

    onProgress(done, total, file.name);
    const ext = file.name.split('.').pop().toLowerCase();
    const content = ext === 'md'
      ? stripHtml(window.marked.parse(await file.text()))
      : await parsePdfFile(file);
    done++;
    onProgress(done, total, file.name);

    const fileNode = {
      id: file.webkitRelativePath, title: titleFromName(file.name), content,
      children: [], summary: null, concepts: [], status: 'pending', expanded: false,
    };
    const parentPath = parts.slice(0, parts.length - 1).join('/');
    (nodeMap.get(parentPath) ?? root).children.push(fileNode);
  }

  return root;
}

// ── Internal helpers ─────────────────────────────────────────────

async function collectFileEntries(dirHandle, basePath) {
  const entries = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith('.')) continue;
    const path = basePath ? `${basePath}/${name}` : name;
    entries.push({ name, handle, path, kind: handle.kind });
  }
  return entries;
}

async function parseMdHandle(fileHandle) {
  const file = await fileHandle.getFile();
  return stripHtml(window.marked.parse(await file.text()));
}

async function parsePdfHandle(fileHandle) {
  return parsePdfFile(await fileHandle.getFile());
}

async function parsePdfFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.worker.min.mjs';
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) =>
      pdf.getPage(i + 1).then(p => p.getTextContent()).then(tc =>
        tc.items.map(item => item.str).join(' ')
      )
    )
  );
  return pages.join('\n').replace(/\s+/g, ' ').trim();
}
