import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { render, withVersion } from '../render.js';

const file = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const resume = () => JSON.parse(file('resume.json'));
const versions = readdirSync(new URL('../versions/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const XSS = '<img src=x onerror="alert(1)"> **Safe**';

// Runs pdf.html's script against in-memory files; resolves with its final state and the rendered HTML.
const runPdf = (files, search = '') => {
  const root = { dataset: { src: 'resume.json' }, innerHTML: '', removeAttribute: () => {} };
  return new Promise((resolve) => {
    runInNewContext(file('pdf.html').match(/<script>([\s\S]*?)<\/script>/)[1], {
      URLSearchParams,
      fetch: async (src) => (src in files ? { ok: true, json: async () => files[src] } : { ok: false, status: 404, statusText: 'Not Found' }),
      document: {
        getElementById: () => root,
        fonts: { ready: Promise.resolve() },
        images: [{ decode: async () => {} }],
        documentElement: { dataset: new Proxy({}, { set: (_, key, value) => (key === 'state' && resolve({ state: value, html: root.innerHTML }), true) }) },
      },
      location: { protocol: 'http:', search },
    });
  });
};

test('pdf.html renders every entry and escapes source text', async () => {
  const data = resume();
  data.work[0].highlights.push(XSS);
  const { state, html } = await runPdf({ 'resume.json': data });
  const entries = [...data.work, ...data.projects.filter((p) => p.type !== 'enterprise'), ...data.publications];
  assert.equal(state, 'ready');
  assert.match(html, /<h1>Xun <span class="nick">\(Alex\)<\/span> Sun<\/h1>/);
  assert.equal(html.match(/<article /g).length, entries.length);
  assert.equal(html.match(/<ul class="highlights">/g).length, entries.filter((e) => e.highlights?.length).length);
  assert.ok(html.includes('Author &amp; contributor'));
  assert.ok(html.includes('&lt;img src=x') && !html.includes('<img src=x'));
  assert.ok(html.includes('<strong>Safe</strong>'));
  assert.ok(html.includes('alt="Scan to view Xun Sun on LinkedIn"'));
  assert.ok(html.includes('href="tel:+61434570098"'));
  assert.deepEqual([...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]).slice(0, 2), ['Education', 'Technical Skills']);
});

const assertWebShowsAll = (data) => {
  const html = render(data);
  const text = html
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e])
    .replace(/\s+/g, ' ');
  const plain = (s) =>
    s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1$2').replace(/\[(.+?)\]\((\S+?)\)/g, '$1');
  const month = (iso) => new Date(`${iso}-01T00:00`).toLocaleString('en', { month: 'short', year: 'numeric' });

  const { basics, education, skills, work, projects, publications } = data;
  const expected = [
    basics.name, basics.label, basics.email, basics.phone, basics.summary,
    ...education.flatMap((e) => [e.institution, `${e.studyType} of ${e.area}`, e.score, e.startDate, e.endDate]),
    ...skills.flatMap((s) => [s.name, ...s.keywords]),
    ...work.flatMap((w) => [w.position, w.name, w.location, w.employmentType, w.startDate, w.endDate, ...w.highlights]),
    ...projects.flatMap((p) => [p.name, p.description, p.urlLabel, ...(p.highlights ?? []), ...(p.keywords ?? [])]),
    ...publications.flatMap((p) => [p.name, p.publisher, p.summary, p.startDate, p.releaseDate, ...p.highlights]),
  ].filter(Boolean);
  for (const value of expected) {
    const shown = /^\d{4}-\d{2}$/.test(value) ? month(value) : plain(value);
    assert.ok(text.includes(shown), `missing: ${shown}`);
  }
  const links = [...work, ...projects, ...publications].map((e) => e.url).filter(Boolean);
  const inlineLinks = [...JSON.stringify(data).matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
  for (const url of [...links, ...inlineLinks, basics.url]) assert.ok(html.includes(`href="${url}"`), `missing link: ${url}`);
  assert.ok(html.includes(`src="${basics.image}"`));
  assert.deepEqual([...html.matchAll(/data-title="\d+ (.*?)"/g)].map((m) => m[1]), [
    'Education', 'Technical Skills', 'Experience', 'Research', 'Selected Projects', 'Open-source Contributions', 'Enterprise Delivery',
  ]);
};

test('the web resume shows everything the PDF shows', () => assertWebShowsAll(resume()));

test('versions layer over resume.json on both pages', async () => {
  const SECTIONS = ['meta', 'basics', 'education', 'skills', 'work', 'projects', 'publications'];
  for (const name of versions) {
    const version = JSON.parse(file(`versions/${name}.json`));
    for (const key of Object.keys(version)) assert.ok(SECTIONS.includes(key), `${name}: unknown section "${key}"`);
    const data = withVersion(resume(), version);
    assert.equal(data.basics.email, resume().basics.email, `${name}: contact details come from resume.json`);
    assertWebShowsAll(data);
    const { state, html } = await runPdf({ 'resume.json': resume(), [`versions/${name}.json`]: version }, `?v=${name}`);
    assert.equal(state, 'ready', name);
    assert.equal(html.match(/<article /g).length, [...data.work, ...data.projects.filter((p) => p.type !== 'enterprise'), ...data.publications].length);
  }
  assert.equal((await runPdf({ 'resume.json': resume() }, '?v=missing')).state, 'error');
  assert.equal((await runPdf({ 'resume.json': resume() }, '?v=../resume')).state, 'error');
});

test('the web resume escapes source text', () => {
  const data = resume();
  data.work[0].highlights.push(XSS);
  const html = render(data);
  assert.ok(html.includes('&lt;img src=x') && !html.includes('<img src=x'));
  assert.ok(html.includes('<strong>Safe</strong>'));
});

test('theme: portfolio forces dark, a session choice beats the system, the system decides otherwise', () => {
  const script = file('index.html').match(/<script id="theme-init">([\s\S]*?)<\/script>/)[1];
  const run = ({ url = 'https://me.xsun.work/', stored, systemDark = false, storageThrows = false }) => {
    const store = new Map(stored ? [['theme', stored]] : []);
    const fail = () => { throw new Error('blocked'); };
    const dataset = {};
    const replaced = [];
    runInNewContext(script, {
      URL,
      location: { href: url },
      sessionStorage: storageThrows ? { getItem: fail, setItem: fail } : { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
      history: { state: null, replaceState: (_, __, next) => replaced.push(String(next)) },
      matchMedia: () => ({ matches: systemDark }),
      document: { documentElement: { dataset } },
    });
    return { theme: dataset.theme, stored: store.get('theme'), replaced };
  };

  assert.equal(run({}).theme, 'light');
  assert.equal(run({ systemDark: true }).theme, 'dark');
  assert.equal(run({ stored: 'light', systemDark: true }).theme, 'light');
  assert.equal(run({ stored: 'nonsense', systemDark: true }).theme, 'dark');
  assert.deepEqual(run({ url: 'https://me.xsun.work/?from=portfolio#experience', stored: 'light' }), {
    theme: 'dark',
    stored: 'dark',
    replaced: ['https://me.xsun.work/#experience'],
  });
  assert.equal(run({ url: 'https://me.xsun.work/?from=portfolio', storageThrows: true }).theme, 'dark');
  assert.deepEqual(run({ url: 'https://me.xsun.work/?ref=x' }).replaced, []);
});
