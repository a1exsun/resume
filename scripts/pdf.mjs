// Prints pdf.html (optionally a version: ?v=<version>) to a PDF with headless Chrome.
//   npm run pdf                         -> out/resume.pdf
//   npm run pdf -- <version> [out.pdf]  -> out/<version>.pdf
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [version, outArg] = process.argv.slice(2);
if (version && !/^[a-z0-9-]+$/.test(version)) throw new Error(`invalid version "${version}"`);
const out = resolve(outArg ?? join(root, 'out', `${version ?? 'resume'}.pdf`));
// shortcut: macOS Chrome path by default; set CHROME on other systems.
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer((req, res) => {
  const file = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/pdf.html${version ? `?v=${version}` : ''}`;

// Async on purpose: this process must keep serving files while Chrome loads the page.
const chromeRun = (args) =>
  new Promise((ok, fail) =>
    execFile(chrome, ['--headless=new', '--disable-gpu', '--virtual-time-budget=20000', ...args, url], { maxBuffer: 1 << 26 },
      (err, stdout) => (err ? fail(err) : ok(stdout))),
  );

try {
  // pdf.html sets data-state="ready" once content, fonts and images are in; any other state would print a broken page.
  const dom = await chromeRun(['--dump-dom']);
  const state = dom.match(/<html[^>]*data-state="(\w+)"/)?.[1];
  if (state !== 'ready') throw new Error(`pdf.html ended in state "${state}": ${dom.match(/class="notice">(.*?)<\/div>/)?.[1] ?? ''}`);
  mkdirSync(dirname(out), { recursive: true });
  await chromeRun(['--no-pdf-header-footer', `--print-to-pdf=${out}`]);
  console.log(out);
} finally {
  server.close();
}
