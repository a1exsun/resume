// Renders resume.json (https://jsonresume.org/schema) as the web resume: the same fields,
// sections and order as pdf.html, laid out for the screen.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Words that get a brand icon wherever they appear (https://simpleicons.org).
const ICON_CDN = 'https://cdn.jsdelivr.net/npm/simple-icons@16.33.0/icons/';
const ICONS = {
  Tesla: 'tesla', Nissan: 'nissan', Siemens: 'siemens', 'Siemens JT Toolkit': 'siemens',
  MCP: 'modelcontextprotocol', LangGraph: 'langgraph', vLLM: 'vllm', Blender: 'blender', OpenCV: 'opencv',
  TypeScript: 'typescript', React: 'react', 'Next.js': 'nextdotjs', Vue: 'vuedotjs', 'Three.js': 'threedotjs',
  Tailwind: 'tailwindcss', 'shadcn/ui': 'shadcnui', WebAssembly: 'webassembly', WebGL: 'webgl', Electron: 'electron',
  Python: 'python', FastAPI: 'fastapi', NestJS: 'nestjs', PostgreSQL: 'postgresql', Redis: 'redis',
  MongoDB: 'mongodb', Prisma: 'prisma', RabbitMQ: 'rabbitmq', Firebase: 'firebase', Stripe: 'stripe',
  GCP: 'googlecloud', Cloudflare: 'cloudflare', 'Cloudflare Workers': 'cloudflareworkers', 'Durable Objects': 'cloudflare',
  Supabase: 'supabase', Docker: 'docker', Kubernetes: 'kubernetes', 'GitHub Actions': 'githubactions',
  Modal: 'modal', 'NVIDIA MIG': 'nvidia', GitHub: 'github', arXiv: 'arxiv',
};
const ICON_RE = new RegExp(
  `(?<![\\w-])(${Object.keys(ICONS).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`,
  'g',
);

export const escape = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const iconify = (html) =>
  html.replace(ICON_RE, (word) => `<span class="tech"><i class="ico" style="--icon:url(${ICON_CDN}${ICONS[word]}.svg)"></i>${word}</span>`);

// Same inline markup as pdf.html (**bold**, _italic_, [text](url)), plus highlighted figures and brand icons.
// Figures go first so the numbers in icon URLs added later are never touched.
const inline = (s) =>
  iconify(
    escape(s)
      .replace(/(?<![\w+#/.@-])(\d[\d.,]*(?:[KM]\+|[KM%])?\+?(?:-[a-z]+)?)(?!\w)/g, '<span class="fig">$1</span>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1<em>$2</em>'),
  ).replace(/\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');

const paragraphs = (s = '') => s.split(/\n{2,}/).map((p) => `<p>${inline(p)}</p>`).join('');
const link = (url, label, cls = '') =>
  `<a${cls ? ` class="${cls}"` : ''} href="${escape(url)}">${iconify(escape(label))}<span class="arrow" aria-hidden="true">↗</span></a>`;
const headingLink = (url, label) => (url ? link(url, label, 'out') : '');
const points = (items = []) => (items.length ? `<ul class="points">${items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>` : '');
const keywords = (items = [], cls) =>
  items.length ? `<p class="${cls}">${items.map((k) => `<span class="kw">${iconify(escape(k))}</span>`).join('')}</p>` : '';

// "2025-02" -> "Feb 2025"; dates after today get "(Expected)".
const formatDate = (iso) => {
  const [y, m] = iso.split('-').map(Number);
  return m ? `${MONTHS[m - 1]} ${y}` : String(y);
};
const dateRange = (start, end) => {
  if (!start) return '';
  if (!end) return `${formatDate(start)} – Present`;
  const expected = new Date(end) > new Date() ? ' (Expected)' : '';
  return `${formatDate(start)} – ${formatDate(end)}${expected}`;
};

// "Xun (Alex) Sun" -> the preferred name is set apart in italics.
const displayName = (name) => escape(name).replace(/\([^()]*\)/g, '<span class="nick">$&</span>');

const row = (title, when, body) => `
  <article class="row">
    <div class="line"><h3>${title}</h3>${when ? `<span class="when">${when}</span>` : ''}</div>
    ${body}
  </article>`;
const sub = (html) => (html ? ` <span class="sub"><span class="sep">~</span> ${html}</span>` : '');
const meta = (parts, after = '') => {
  const text = parts.filter(Boolean).map(escape).join(' · ');
  return text || after ? `<p class="meta">${text}${after}</p>` : '';
};

const hero = ({ name = '', label, email, phone, url, summary, image }) => `
  <section class="hero" id="top" data-title="">
    <h1 class="name">${displayName(name)}</h1>
    ${label ? `<p class="role">${escape(label)}</p>` : ''}
    <div class="intro">${paragraphs(summary)}</div>
    <ul class="contact">
      ${email ? `<li><span class="k">mail</span><a href="mailto:${escape(email)}">${escape(email)}</a></li>` : ''}
      ${phone ? `<li><span class="k">tel</span><a href="tel:${escape(phone.replace(/[^\d+]/g, ''))}">${escape(phone)}</a></li>` : ''}
      ${url ? `<li><span class="k">web</span><a href="${escape(url)}">${escape(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></li>` : ''}
      ${image ? `<li><span class="k">qr</span><button class="qr-open" type="button" popovertarget="qr">LinkedIn</button></li>` : ''}
    </ul>
    ${image ? `<figure class="qr" id="qr" popover><img src="${escape(image)}" alt="Scan to view Xun Sun on LinkedIn" width="168" height="168"><figcaption>LinkedIn</figcaption></figure>` : ''}
  </section>`;

const education = (items = []) =>
  items.map((e) => row(escape(e.institution), dateRange(e.startDate, e.endDate), meta([[e.studyType, e.area].filter(Boolean).join(' of '), e.score]))).join('');

const skills = (items = []) =>
  items.map((s) => `<div class="row"><h3>${escape(s.name)}</h3>${keywords(s.keywords, 'kws')}</div>`).join('');

const work = (items = []) =>
  items.map((w) => row(
    `${escape(w.position)}${sub(escape(w.name ?? ''))}`,
    dateRange(w.startDate, w.endDate),
    meta([w.location, w.employmentType], headingLink(w.url, 'GitHub')) + points(w.highlights),
  )).join('');

const publications = (items = []) =>
  items.map((p) => row(
    escape(p.name),
    [p.startDate, p.releaseDate].filter(Boolean).map(formatDate).join(' – '),
    `${meta([p.publisher], headingLink(p.url, 'arXiv'))}<div class="desc">${paragraphs(p.summary)}</div>${points(p.highlights)}`,
  )).join('');

const projects = (items = []) =>
  items.map((p) => row(
    `${escape(p.name)}${sub(p.url ? link(p.url, p.urlLabel, 'out') : '')}`,
    '',
    `${p.description ? `<p class="desc">${inline(p.description)}</p>` : ''}${points(p.highlights)}${keywords(p.keywords, 'stack')}`,
  )).join('');

const deliveries = (items = []) =>
  items.map((p) => `<li class="row"><span class="client">${iconify(escape(p.name))}</span>${p.description ? ` <span class="sep">~</span> ${inline(p.description)}` : ''}</li>`).join('');

export const render = (r) => {
  const projectsOf = (type) => r.projects?.filter((p) => p.type === type);
  const sections = [
    ['education', 'Education', education(r.education)],
    ['skills', 'Technical Skills', skills(r.skills)],
    ['experience', 'Experience', work(r.work)],
    ['research', 'Research', publications(r.publications)],
    ['projects', 'Selected Projects', projects(projectsOf('application'))],
    ['open-source', 'Open-source Contributions', projects(projectsOf('open-source'))],
    ['delivery', 'Enterprise Delivery', deliveries(projectsOf('enterprise'))],
  ].filter(([, , body]) => body);
  // Numbered like pdf.html: only the sections that have content count.
  return hero(r.basics ?? {}) + sections.map(([id, title, body], i) => {
    const n = String(i + 1).padStart(2, '0');
    const tag = id === 'delivery' ? 'ul' : 'div';
    return `
  <section id="${id}" data-title="${n} ${escape(title)}">
    <h2><span class="n">${n}</span> ${escape(title)}<span class="rule" aria-hidden="true"></span></h2>
    <${tag} class="list ${id}">${body}</${tag}>
  </section>`;
  }).join('');
};
