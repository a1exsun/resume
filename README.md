# Xun (Alex) Sun — Resume

The resume at <https://me.xsun.work>. Static files, no build step: pushing `main` deploys it (Cloudflare Pages project `resume` serves the repository root).

| File | Role |
| --- | --- |
| `resume.json` | The content, in [JSON Resume](https://jsonresume.org/schema) format. Both pages render it at runtime. |
| `index.html`, `main.js`, `render.js`, `styles.css` | The web resume. |
| `pdf.html` | The print/PDF layout (Letter, two pages). Print it from the browser to export the PDF. |

The web and PDF versions show the same fields, sections and order; `tests/resume.test.js` fails if the web version drops anything the PDF shows.

## Run

```sh
npm run dev    # http://localhost:5190
npm test       # node --test, no dependencies
```

## Web resume

- Layout after [ruru.build](https://ruru.build): one narrow column, muted body text with figures, tech names (with [Simple Icons](https://simpleicons.org)) and links in full ink.
- Motion with [GSAP](https://gsap.com) 3.15 from jsDelivr (SplitText, ScrollTrigger, ScrambleText). Without it, or with reduced motion, the page is static.
- Theme: the system setting, unless a choice was made in this tab (the dot in the nav). Arriving from the portfolio (`?from=portfolio`, which the page then removes from the URL) always starts dark. Leaving for the portfolio switches to dark first, then fades out. The switch is a View Transition: the new theme grows as a circle from the control that triggered it.
