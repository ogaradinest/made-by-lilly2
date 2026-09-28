// Made by Lilly — static site generator.
// Reads everything in /content, writes a finished static site to /_site.
// No dependencies: run with `node build.mjs`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, "content");
const STATIC = path.join(ROOT, "static");
const OUT = path.join(ROOT, "_site");

const site = readJson("site.json");
const stock = readJson("stock.json");
const events = readJson("events.json");
const products = readJson("products.json").map((p, i) => ({
  ...p,
  no: String(i + 1).padStart(2, "0"),
  sold: stock[p.slug] !== "available",
}));
const BUILD_VERSION = Date.now().toString(36);
const sitemap = [];

/* ---------- helpers ---------- */

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(CONTENT, file), "utf8"));
}

function readCollection(dir) {
  const full = path.join(CONTENT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => f.endsWith(".md")).map((f) => {
    const { data, body } = frontMatter(fs.readFileSync(path.join(full, f), "utf8"));
    return { ...data, slug: f.replace(/\.md$/, ""), html: markdown(body), words: body.split(/\s+/).length };
  });
}

function frontMatter(src) {
  const m = src.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return { data, body: m[2] };
}

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const url = (p = "/") => site.basePath + p;
const abs = (p = "/") => site.siteUrl + p;
const price = (n) => "£" + n;
const mailto = (subject) => `mailto:${site.email}${subject ? "?subject=" + encodeURIComponent(subject) : ""}`;
const fmtDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const readMins = (words) => Math.max(2, Math.round(words / 200));

function inline(s) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, a, src) => `<img src="${src}" alt="${a}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, href) => `<a href="${href.startsWith("/") ? url(href) : href}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// Small Markdown subset: ## / ### headings, paragraphs, - and 1. lists, > quotes, images, links, bold, italic.
function markdown(src) {
  const blocks = src.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return blocks.map((b) => {
    const lines = b.split("\n");
    if (/^###\s/.test(b)) return `<h3>${inline(b.replace(/^###\s/, ""))}</h3>`;
    if (/^##\s/.test(b)) return `<h2>${inline(b.replace(/^##\s/, ""))}</h2>`;
    if (lines.every((l) => /^[-*]\s/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s/, ""))}</li>`).join("")}</ul>`;
    if (lines.every((l) => /^\d+\.\s/.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s/, ""))}</li>`).join("")}</ol>`;
    if (lines.every((l) => /^>\s?/.test(l))) return `<blockquote><p>${inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "))}</p></blockquote>`;
    return `<p>${inline(lines.join(" "))}</p>`;
  }).join("\n");
}

// Responsive <img>. `name` is the base filename in static/images (e.g. "plum-orchard-shawl").
const imageFiles = fs.readdirSync(path.join(STATIC, "images"));
function img(name, alt, { sizes = "100vw", cls = "", eager = false, extra = "" } = {}) {
  const variants = imageFiles
    .map((f) => f.match(new RegExp(`^${name}-(\\d+)\\.jpg$`)))
    .filter(Boolean)
    .map((m) => ({ file: m[0], w: +m[1] }))
    .sort((a, b) => a.w - b.w);
  if (!variants.length) throw new Error(`Missing image: ${name}`);
  const largest = variants[variants.length - 1];
  const srcset = variants.map((v) => `${url("/images/" + v.file)} ${v.w}w`).join(", ");
  return `<img src="${url("/images/" + largest.file)}" srcset="${srcset}" sizes="${sizes}" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ""} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${extra}>`;
}
const imgAbs = (name) => {
  const f = imageFiles.filter((x) => x.startsWith(name + "-")).sort().pop();
  return abs("/images/" + f);
};

// Crochet chain divider: a row of linked loops that draws itself in when scrolled into view.
function chain(cls = "") {
  const loops = Array.from({ length: 32 }, (_, i) => `<ellipse cx="${14 + i * 20.6}" cy="12" rx="12" ry="6"/>`).join("");
  return `<div class="chain ${cls}" aria-hidden="true"><svg viewBox="0 0 676 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" stroke-width="1.4">${loops}</svg></div>`;
}

const heartPath = "M12 21s-7.5-4.6-9.6-9.3C.9 8.3 2.8 4.5 6.5 4.2c2.2-.2 4 1 5.5 3 1.5-2 3.3-3.2 5.5-3 3.7.3 5.6 4.1 4.1 7.5C19.5 16.4 12 21 12 21z";

const blog = readCollection("blog").sort((a, b) => b.date.localeCompare(a.date));
const guides = readCollection("pattern-guides").sort((a, b) => a.date.localeCompare(b.date));
const technical = readCollection("technical-details").sort((a, b) => a.title.localeCompare(b.title));

/* ---------- layout ---------- */

const NAV = [
  { href: "/shop/", label: "Shop", key: "shop" },
  { href: "/about/", label: "About", key: "about" },
  { href: "/resources/", label: "Resources", key: "resources" },
  { href: "/contact/", label: "Contact", key: "contact" },
];

function header(active) {
  const links = NAV.map((n) => `<li><a href="${url(n.href)}"${n.key === active ? ' aria-current="page"' : ""}>${n.label}</a></li>`).join("");
  const mobile = NAV.map((n, i) => `<li><a href="${url(n.href)}"${n.key === active ? ' aria-current="page"' : ""}><span class="mobile-menu__no">0${i + 1}</span>${n.label}</a></li>`).join("");
  return `
<a class="skip-link" href="#main">Skip to content</a>
<header class="masthead" data-masthead>
  <div class="masthead__inner">
    <a class="wordmark" href="${url("/")}" aria-label="${site.name}, home">Made by <em>Lilly</em></a>
    <nav class="nav" aria-label="Main"><ul>${links}</ul></nav>
    <a class="masthead__cta" href="${url("/shop/")}">The collection <span aria-hidden="true">→</span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle>
      <span class="menu-toggle__label">Menu</span><span class="menu-toggle__icon" aria-hidden="true"><i></i><i></i></span>
    </button>
  </div>
</header>
<div class="mobile-menu" id="mobile-menu" data-mobile-menu hidden>
  <nav aria-label="Mobile"><ul>${mobile}</ul></nav>
  <div class="mobile-menu__foot">
    <p class="mobile-menu__tag">${site.tagline}.</p>
    <a href="${mailto()}">Email me</a> <a href="${site.instagram}" rel="noopener" target="_blank">Instagram ↗</a>
  </div>
</div>`;
}

function footer() {
  const ga = site.ga4Id ? `<li><button type="button" class="footer__linkbtn" data-cookie-settings>Cookie settings</button></li>` : "";
  return `
<footer class="footer">
  <div class="footer__statement" data-reveal>
    <p class="footer__big">From my hands<br><em>to your heart.</em></p>
    <div class="footer__actions">
      <a class="btn btn--light" href="${url("/shop/")}">Shop the collection</a>
      <a class="link-line link-line--light" href="${mailto()}">Email me <span aria-hidden="true">→</span></a>
    </div>
  </div>
  ${chain("chain--footer")}
  <div class="footer__cols">
    <div>
      <p class="footer__heading">the shop</p>
      <ul>
        <li><a href="${url("/shop/")}">All pieces</a></li>
        <li><a href="${url("/terms-of-sale/#delivery")}">Delivery</a></li>
        <li><a href="${url("/terms-of-sale/#returns")}">Returns</a></li>
        <li><a href="${url("/contact/#faq")}">Questions</a></li>
      </ul>
    </div>
    <div>
      <p class="footer__heading">the studio</p>
      <ul>
        <li><a href="${url("/about/")}">About Lilly</a></li>
        <li><a href="${url("/resources/blog/")}">Journal</a></li>
        <li><a href="${url("/resources/pattern-guides/")}">Pattern guides</a></li>
        <li><a href="${url("/resources/technical-details/")}">Stitch library</a></li>
        <li><a href="${url("/resources/events/")}">Events</a></li>
      </ul>
    </div>
    <div>
      <p class="footer__heading">say hello</p>
      <ul>
        <li><a href="${mailto()}">Email</a></li>
        <li><a href="${site.instagram}" target="_blank" rel="noopener">Instagram ↗</a></li>
      </ul>
    </div>
  </div>
  <div class="footer__base">
    <a class="wordmark wordmark--light" href="${url("/")}">Made by <em>Lilly</em></a>
    <ul class="footer__legal">
      <li><a href="${url("/terms-of-sale/")}">Terms of sale</a></li>
      <li><a href="${url("/privacy/")}">Privacy</a></li>
      <li><a href="${url("/cookies/")}">Cookies</a></li>
      ${ga}
    </ul>
    <p class="footer__meta">© ${new Date().getFullYear()} Made by Lilly · Handmade in the UK · UK delivery only</p>
    <p class="footer__credit">Site by <span>otobrothers</span></p>
  </div>
</footer>`;
}

function layout({ title, description, path: p, body, active = "", image = "lilly-hero", type = "website", jsonLd = [], bodyClass = "" }) {
  if (!description || description.length < 50) throw new Error(`Weak meta description on ${p}`);
  if (p !== "/404.html") sitemap.push(p);
  const ld = jsonLd.length ? `<script type="application/ld+json">${JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : { "@context": "https://schema.org", "@graph": jsonLd })}</script>` : "";
  const ga = site.ga4Id
    ? `<meta name="ga4-id" content="${esc(site.ga4Id)}">\n<script src="${url("/js/consent.js")}?v=${BUILD_VERSION}" defer></script>`
    : "";
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(p)}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${site.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(p)}">
<meta property="og:image" content="${imgAbs(image)}">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FBF6EE">
<link rel="icon" href="${url("/favicon.svg")}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=DM+Serif+Display:ital@0;1&family=Italiana&display=swap">
<link rel="stylesheet" href="${url("/css/site.css")}?v=${BUILD_VERSION}">
<script>document.documentElement.classList.add("js")</script>
<script src="${url("/js/site.js")}?v=${BUILD_VERSION}" defer></script>
${ga}
${ld}
</head>
<body class="${bodyClass}">
${header(active)}
<main id="main">
${body}
</main>
${footer()}
</body>
</html>`;
}

function write(p, html) {
  const file = p.endsWith(".html") ? path.join(OUT, p) : path.join(OUT, p, "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function crumbs(items) {
  const html = `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items
    .map((c, i) => (i === items.length - 1 ? `<li aria-current="page">${esc(c.label)}</li>` : `<li><a href="${url(c.href)}">${esc(c.label)}</a></li>`))
    .join("")}</ol></nav>`;
  const ld = {
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: abs(c.href) })),
  };
  return { html, ld };
}

function pageHead({ eyebrow, title, lede, crumbsHtml = "", cls = "" }) {
  return `<header class="page-head ${cls}">
  ${crumbsHtml}
  <p class="eyebrow" data-reveal>${eyebrow}</p>
  <h1 class="page-head__title" data-reveal>${title}</h1>
  ${lede ? `<p class="page-head__lede" data-reveal>${lede}</p>` : ""}
</header>`;
}

/* ---------- components ---------- */

function statusTag(p) {
  return p.sold ? `<span class="tag tag--sold">In the archive</span>` : `<span class="tag">One of a kind</span>`;
}

function productCard(p, { size = "", sizes = "(min-width: 900px) 45vw, 100vw" } = {}) {
  return `<article class="piece ${size} ${p.sold ? "is-sold" : ""}" data-reveal>
  <a class="piece__link" href="${url(`/shop/${p.slug}/`)}">
    <div class="piece__media">${img(p.image, p.alt, { sizes })}${statusTag(p)}</div>
    <div class="piece__meta">
      <span class="piece__no">No. ${p.no}</span>
      <h3 class="piece__name">${esc(p.name)}</h3>
      <p class="piece__summary">${esc(p.summary)}</p>
      <p class="piece__row"><span>${esc(p.type)} · ${esc(p.material)}</span><b>${p.sold ? "Sold" : price(p.price)}</b></p>
    </div>
  </a>
</article>`;
}

const productLd = (p) => ({
  "@type": "Product",
  name: p.name,
  description: p.description.join(" "),
  image: imgAbs(p.image),
  url: abs(`/shop/${p.slug}/`),
  brand: { "@type": "Brand", name: site.name },
  material: p.material,
  color: p.colour,
  offers: {
    "@type": "Offer",
    price: String(p.price),
    priceCurrency: "GBP",
    availability: p.sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
    itemCondition: "https://schema.org/NewCondition",
    url: abs(`/shop/${p.slug}/`),
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: "0", currency: "GBP" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "GB" },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "GB",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 14,
      returnFees: "https://schema.org/FreeReturn",
      returnMethod: "https://schema.org/ReturnByMail",
    },
  },
});

const faqs = [
  ["Is every piece really one of a kind?", "Yes. Each finished piece has its own combination of fibre, colour, stitch and hand-finished details. When a piece sells, it is not remade exactly."],
  ["What is the difference between a shawl and an oversized scarf?", "A shawl is designed to drape across the shoulders. An oversized scarf is longer and narrower, made for wrapping, looping and layering."],
  ["How much is delivery?", `Nothing extra. UK delivery is included in every price, and orders are dispatched ${site.dispatch}.`],
  ["Do you deliver outside the UK?", "Not at the moment. Made by Lilly delivers within the UK only."],
  ["Can I return a piece?", "Yes. You have 14 days from delivery to change your mind, and return postage is on me. Your refund is made within 14 days of the piece arriving back with me."],
  ["How do I care for a hand-crocheted shawl?", "Gentle hand washing in cool water and drying flat keeps handmade crochet in shape. There is a full care guide in the journal."],
  ["How do I pay?", "Checkout is handled securely by Stripe. I never see or store your card details."],
];

/* ---------- pages ---------- */

function home() {
  const featured = products.filter((p) => !p.sold).slice(0, 3);
  const latest = blog[0];
  const body = `
<section class="hero" data-hero>
  <div class="hero__copy">
    <p class="eyebrow hero__eyebrow" data-reveal>Hand-crocheted in the UK</p>
    <h1 class="hero__title" aria-label="From my hands to your heart">
      <span class="mask"><span data-line style="--d:0">From my hands</span></span>
      <span class="mask"><span data-line style="--d:1">to your <em>heart.</em></span></span>
    </h1>
    <p class="hero__lede" data-reveal style="--d:3">One-of-a-kind shawls and oversized scarves, made slowly, one stitch at a time. Each piece exists once, and then it's yours.</p>
    <div class="hero__actions" data-reveal style="--d:4">
      <a class="btn" href="${url("/shop/")}">Shop the collection</a>
      <a class="link-line" href="${url("/about/")}">Meet Lilly <span aria-hidden="true">→</span></a>
    </div>
    <dl class="hero__meta" data-reveal style="--d:5">
      <div><dt>Editions</dt><dd>One of each</dd></div>
      <div><dt>Delivery</dt><dd>Free across the UK</dd></div>
    </dl>
  </div>
  <div class="hero__art">
    <div class="hero__sun" aria-hidden="true" data-parallax="-0.12"></div>
    <figure class="hero__arch" data-parallax="0.06">
      ${img("lilly-hero", "A hand-crocheted triangular shawl in plum with bands of coral and saffron, worn over a cream linen dress by a sunny window", { sizes: "(min-width: 900px) 48vw, 100vw", eager: true })}
    </figure>
    <div class="badge" aria-hidden="true">
      <svg viewBox="0 0 200 200" class="badge__ring" data-spin>
        <defs><path id="badge-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"/></defs>
        <text textLength="486" lengthAdjust="spacing"><textPath href="#badge-circle" textLength="486" lengthAdjust="spacing">one of a kind · made slowly · by hand · </textPath></text>
      </svg>
      <svg viewBox="0 0 24 24" class="badge__heart"><path d="${heartPath}"/></svg>
    </div>
    <p class="hero__note" aria-hidden="true">made to be <em>noticed</em></p>
  </div>
</section>

<div class="marquee" aria-hidden="true">
  <div class="marquee__track">
    ${Array.from({ length: 2 }, () => `<span>Shawls</span><i>✦</i><span><em>Oversized scarves</em></span><i>✦</i><span>One of a kind</span><i>✦</i><span><em>From my hands to your heart</em></span><i>✦</i><span>Free UK delivery</span><i>✦</i>`).join("")}
  </div>
</div>

<section class="statement">
  <p class="eyebrow" data-reveal>The making</p>
  <p class="statement__text" data-reveal>There is no production line here. Just thoughtful yarn, <em>bold colour</em>, intricate stitches and the lovely slowness of making something <em>by hand.</em></p>
  ${chain()}
</section>

<section class="featured">
  <div class="section-head">
    <div>
      <p class="eyebrow" data-reveal>Available now</p>
      <h2 class="display-md" data-reveal>Made once. <em>Worn forever.</em></h2>
    </div>
    <a class="link-line" href="${url("/shop/")}" data-reveal>See every piece <span aria-hidden="true">→</span></a>
  </div>
  <div class="index-grid">
    ${featured.map((p, i) => productCard(p, { size: ["piece--lead", "piece--tall", "piece--wide"][i] || "", sizes: i === 0 ? "(min-width: 900px) 58vw, 100vw" : "(min-width: 900px) 40vw, 100vw" })).join("\n")}
  </div>
</section>

<section class="story scallop">
  <div class="story__media" data-reveal>
    ${img("plum-orchard-shawl", "Close view of an open-mesh crochet shawl shading from plum through coral to saffron, draped over a linen armchair", { sizes: "(min-width: 900px) 50vw, 100vw" })}
  </div>
  <div class="story__copy">
    <p class="eyebrow eyebrow--light" data-reveal>About Lilly</p>
    <h2 class="display-md" data-reveal>Every stitch has a little more <em>to say.</em></h2>
    <p data-reveal>Made by Lilly is a small, personal crochet practice built around slow making. A handmade variation isn't a flaw to be ironed out. It's the point. Every piece carries its own texture, drape and character.</p>
    <a class="link-line link-line--light" href="${url("/about/")}" data-reveal>Read Lilly's story <span aria-hidden="true">→</span></a>
  </div>
</section>

<section class="promises" aria-label="Shopping with Made by Lilly">
  <ol>
    <li data-reveal><span class="promises__no">i.</span><h3>One of a kind</h3><p>Every piece is made once. When it's gone, it moves to the archive.</p></li>
    <li data-reveal style="--d:1"><span class="promises__no">ii.</span><h3>Free UK delivery</h3><p>Postage is included in the price. What you see is what you pay.</p></li>
    <li data-reveal style="--d:2"><span class="promises__no">iii.</span><h3>14 days to decide</h3><p>Changed your mind? Send it back within 14 days. Return postage is on me.</p></li>
  </ol>
</section>

<section class="journal-teaser">
  <div class="section-head">
    <div>
      <p class="eyebrow" data-reveal>From the journal</p>
      <h2 class="display-md" data-reveal>Threads, texture &amp; <em>tiny rituals.</em></h2>
    </div>
    <a class="link-line" href="${url("/resources/")}" data-reveal>All resources <span aria-hidden="true">→</span></a>
  </div>
  <div class="journal-teaser__grid">
    <a class="feature-post" href="${url(`/resources/blog/${latest.slug}/`)}" data-reveal>
      <div class="feature-post__media">${img(latest.image, latest.alt, { sizes: "(min-width: 900px) 55vw, 100vw" })}</div>
      <div class="feature-post__body">
        <p class="meta">${fmtDate(latest.date)} · ${readMins(latest.words)} min read</p>
        <h3>${esc(latest.title)}</h3>
        <p>${esc(latest.description)}</p>
        <span class="link-line">Read the post <span aria-hidden="true">→</span></span>
      </div>
    </a>
    <ul class="mini-list">
      ${[
        ...guides.slice(0, 1).map((g) => ({ href: `/resources/pattern-guides/${g.slug}/`, kicker: "Pattern guide", title: g.title })),
        ...technical.slice(0, 1).map((t) => ({ href: `/resources/technical-details/${t.slug}/`, kicker: "Stitch library", title: t.title })),
        ...blog.slice(1, 2).map((b) => ({ href: `/resources/blog/${b.slug}/`, kicker: "Journal", title: b.title })),
      ].map((x, i) => `<li data-reveal style="--d:${i}"><a href="${url(x.href)}"><span class="meta">${x.kicker}</span><span class="mini-list__title">${esc(x.title)}</span><span class="mini-list__arrow" aria-hidden="true">→</span></a></li>`).join("")}
    </ul>
  </div>
</section>

<section class="insta">
  <p class="eyebrow" data-reveal>From the studio</p>
  <p class="insta__text" data-reveal>Works in progress, new pieces before they reach the shop, and the odd tangle, on <a href="${site.instagram}" target="_blank" rel="noopener">Instagram <em>${site.instagramHandle}</em> ↗</a></p>
</section>`;
  write("/", layout({
    title: `${site.name} | Hand-crocheted shawls & scarves, made in the UK`,
    description: site.description,
    path: "/",
    body,
    bodyClass: "page-home",
    jsonLd: [
      { "@type": "WebSite", name: site.name, url: abs("/") },
      { "@type": "Organization", name: site.name, url: abs("/"), email: site.email, sameAs: [site.instagram], logo: abs("/favicon.svg") },
    ],
  }));
}

function shop() {
  const c = crumbs([{ label: "Home", href: "/" }, { label: "Shop", href: "/shop/" }]);
  const ordered = [...products.filter((p) => !p.sold), ...products.filter((p) => p.sold)];
  const available = products.filter((p) => !p.sold).length;
  const body = `
${pageHead({
  crumbsHtml: c.html,
  eyebrow: `${available} piece${available === 1 ? "" : "s"} available`,
  title: `The <em>collection.</em>`,
  lede: "Shawls and oversized scarves, each made once, by hand. UK delivery is included in every price, and you have 14 days to change your mind.",
})}
<section class="shop-grid">
  ${ordered.map((p, i) => productCard(p, { size: i % 3 === 0 ? "piece--lead" : "", sizes: "(min-width: 900px) 50vw, 100vw" })).join("\n")}
</section>
<section class="shop-note">
  ${chain()}
  <p data-reveal>Looking for something you saw at a craft fair, or a colour you don't see here? <a href="${mailto("A question about a piece")}">Email me</a> and I'll let you know what's on the hook.</p>
</section>`;
  write("/shop/", layout({
    title: `Shop hand-crocheted shawls & oversized scarves | ${site.name}`,
    description: "Browse every Made by Lilly piece: one-of-a-kind hand-crocheted shawls and oversized scarves in wool blends, with free UK delivery and 14-day returns.",
    path: "/shop/",
    active: "shop",
    body,
    jsonLd: [c.ld, { "@type": "CollectionPage", name: "The collection", url: abs("/shop/") }],
  }));
}

function productPage(p) {
  const c = crumbs([{ label: "Home", href: "/" }, { label: "Shop", href: "/shop/" }, { label: p.name, href: `/shop/${p.slug}/` }]);
  const others = products.filter((o) => o.slug !== p.slug && !o.sold).slice(0, 3);
  let action;
  if (p.sold) {
    action = `<div class="buy buy--sold"><p><strong>This piece has found its home.</strong> Every piece is made once, so this one won't be remade exactly, but something similar may be on the hook.</p><a class="btn btn--ghost" href="${mailto(`Something like the ${p.name}`)}">Ask about something similar</a></div>`;
  } else if (p.stripe) {
    action = `<div class="buy"><a class="btn btn--buy" href="${p.stripe}" rel="noopener">Buy now · ${price(p.price)}</a><p class="buy__secure"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V7a6 6 0 1 1 12 0v3h1v11H5V10h1zm2 0h8V7a4 4 0 1 0-8 0v3z"/></svg>Secure checkout with Stripe</p></div>`;
  } else {
    action = `<div class="buy"><a class="btn btn--buy" href="${mailto(`I'd like to buy the ${p.name}`)}">Email to buy · ${price(p.price)}</a><p class="buy__secure">Online checkout for this piece is coming soon. Email me and I'll send you a secure payment link.</p></div>`;
  }
  const rows = [
    ["Type", p.type],
    ["Fibre", p.material],
    ["Colours", p.colour],
    p.size && ["Size", p.size],
    ["Care", p.care],
    ["Delivery", `Free UK delivery, dispatched ${site.dispatch}`],
  ].filter(Boolean);
  const body = `
<div class="product-top">${c.html}</div>
<article class="product">
  <div class="product__media">
    <figure class="product__figure" data-reveal>${img(p.image, p.alt, { sizes: "(min-width: 900px) 55vw, 100vw", eager: true })}</figure>
  </div>
  <div class="product__info">
    <p class="eyebrow" data-reveal>No. ${p.no} · ${esc(p.type)}</p>
    <h1 class="product__title" data-reveal>${esc(p.name)}</h1>
    <p class="product__price" data-reveal>${p.sold ? `<s>${price(p.price)}</s> <span>Sold</span>` : `${price(p.price)} <span>incl. UK delivery</span>`}</p>
    <ul class="product__tags" data-reveal>
      <li>${p.sold ? "In the archive" : "One of a kind"}</li>
      <li>Ready-made</li>
      <li>Handmade in the UK</li>
    </ul>
    <div class="product__desc" data-reveal>${p.description.map((d) => `<p>${esc(d)}</p>`).join("")}</div>
    <div data-reveal>${action}</div>
    ${p.sold ? "" : `<aside class="notice" data-reveal>
      <p class="notice__title">Ready-made piece: your right to cancel</p>
      <p>This piece is finished and ready to post, so the standard 14-day cancellation right applies. If it's not for you, let me know within 14 days of delivery and send it back. <strong>Return postage is on me.</strong> Your refund is made within 14 days of the piece arriving back. <a href="${url("/terms-of-sale/#returns")}">Full returns policy</a></p>
    </aside>`}
    <dl class="specs" data-reveal>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    <div class="product__links" data-reveal>
      ${p.instagram ? `<a class="link-line" href="${p.instagram}" target="_blank" rel="noopener">Watch it move on Instagram ↗</a>` : ""}
      <a class="link-line" href="${mailto(`A question about the ${p.name}`)}">Ask about this piece <span aria-hidden="true">→</span></a>
    </div>
  </div>
</article>
${others.length ? `<section class="more">
  ${chain()}
  <div class="section-head"><h2 class="display-md" data-reveal>More <em>pieces.</em></h2><a class="link-line" href="${url("/shop/")}" data-reveal>The whole collection <span aria-hidden="true">→</span></a></div>
  <div class="more__grid">${others.map((o) => productCard(o, { sizes: "(min-width: 900px) 30vw, 100vw" })).join("")}</div>
</section>` : ""}`;
  const typeWord = p.type.toLowerCase();
  write(`/shop/${p.slug}/`, layout({
    title: `${p.name}, hand-crocheted ${typeWord} in ${p.colour.toLowerCase()} | ${site.name}`,
    description: `${p.sold ? "Archive: " : ""}${p.name}, a one-of-a-kind hand-crocheted ${typeWord} in ${p.material.toLowerCase()}, ${p.colour.toLowerCase()}. ${p.sold ? "This piece has sold." : `${price(p.price)} with free UK delivery and 14-day returns.`}`,
    path: `/shop/${p.slug}/`,
    active: "shop",
    image: p.image,
    type: "product",
    body,
    bodyClass: "page-product",
    jsonLd: [c.ld, productLd(p)],
  }));
}

function about() {
  const c = crumbs([{ label: "Home", href: "/" }, { label: "About", href: "/about/" }]);
  const body = `
<section class="about-hero">
  <div class="about-hero__copy">
    ${c.html}
    <p class="eyebrow" data-reveal>About Lilly</p>
    <h1 class="page-head__title" data-reveal>The hands behind <em>the stitches.</em></h1>
    <p class="page-head__lede" data-reveal>Made by Lilly is one person, a hook, and a basket of yarn that is always slightly too full.</p>
  </div>
  <figure class="about-hero__media" data-reveal>
    ${img("lilly-hero", "Lilly's triangular crochet shawl in plum, coral and saffron, worn by a window in soft daylight", { sizes: "(min-width: 900px) 45vw, 100vw", eager: true })}
  </figure>
</section>
<section class="prose-wide">
  <div class="dropcap" data-reveal>
    <p>Every Made by Lilly piece starts the same way: with a colour that won't leave me alone. A plum I saw in an orchard, the gold of a late afternoon, the grey of a sea that can't decide what it wants to be. From there it becomes a question of yarn, of stitch, and of patience.</p>
    <p>I work slowly and on purpose. A shawl can take many evenings to make, and I would rather make one piece I'm proud of than ten I'm not. The small variations you'll find in a handmade piece aren't mistakes to be hidden. They're the record of the time and the hands that made it.</p>
    <p>Each finished piece is made once. When it sells, it moves to the archive, and the next one will be different. That's the promise behind everything here: <em>from my hands to your heart.</em></p>
  </div>
</section>
<section class="values">
  ${chain()}
  <ol>
    <li data-reveal><h2>Made slowly</h2><p>No production line, no shortcuts. Every stitch is worked by hand, and every piece is checked and finished by hand before it leaves me.</p></li>
    <li data-reveal style="--d:1"><h2>Made once</h2><p>No two pieces are the same. Colour, fibre and stitch come together in a way that won't be repeated exactly.</p></li>
    <li data-reveal style="--d:2"><h2>Made to be worn</h2><p>These aren't for saving for "best". They're for coats, cool evenings, train journeys and garden chairs.</p></li>
  </ol>
</section>
<section class="cta-band">
  <p class="cta-band__text" data-reveal>Find the one that's <em>yours.</em></p>
  <a class="btn" href="${url("/shop/")}" data-reveal>Shop the collection</a>
</section>`;
  write("/about/", layout({
    title: `About Lilly, the maker behind the stitches | ${site.name}`,
    description: "Meet Lilly, the UK crochet maker behind Made by Lilly: why every shawl and scarf is made slowly, made once and made to be worn, from my hands to your heart.",
    path: "/about/",
    active: "about",
    body,
    jsonLd: [c.ld, { "@type": "AboutPage", name: "About Lilly", url: abs("/about/") }],
  }));
}

const RESOURCES = [
  { key: "pattern-guides", title: "Pattern guides", label: "Pattern guides", blurb: "Plain-English guides to reading patterns, choosing yarn and getting started.", items: () => guides },
  { key: "blog", title: "Journal", label: "Journal", blurb: "Notes from the studio: care, styling and the stories behind the pieces.", items: () => blog },
  { key: "technical-details", title: "Stitch library", label: "Stitch library", blurb: "A growing library of the stitches and structures behind the work, and beyond it.", items: () => technical },
  { key: "events", title: "Events", label: "Events", blurb: "Craft fairs, markets and workshops where you can see the pieces in person.", items: () => events },
];

function resourcesHub() {
  const c = crumbs([{ label: "Home", href: "/" }, { label: "Resources", href: "/resources/" }]);
  const body = `
${pageHead({ crumbsHtml: c.html, eyebrow: "Resources", title: `Learn, read &amp; <em>make.</em>`, lede: "Guides, notes and a library of stitches. Whether you wear crochet or make it, there's something here for you." })}
<section class="hub">
  ${RESOURCES.map((r, i) => {
    const n = r.items().length;
    return `<a class="hub__item" href="${url(`/resources/${r.key}/`)}" data-reveal style="--d:${i}">
      <span class="hub__no">0${i + 1}</span>
      <span class="hub__title">${r.title}</span>
      <span class="hub__blurb">${r.blurb}</span>
      <span class="hub__count">${r.key === "events" && !n ? "Dates coming soon" : `${n} ${n === 1 ? "entry" : "entries"}`}</span>
      <span class="hub__arrow" aria-hidden="true">→</span>
    </a>`;
  }).join("")}
</section>`;
  write("/resources/", layout({
    title: `Crochet resources: guides, journal, stitch library & events | ${site.name}`,
    description: "Crochet pattern guides, a journal from the studio, a stitch library of techniques and upcoming events, from UK maker Made by Lilly.",
    path: "/resources/",
    active: "resources",
    body,
    jsonLd: [c.ld],
  }));
}

function blogPages() {
  const base = [{ label: "Home", href: "/" }, { label: "Resources", href: "/resources/" }, { label: "Journal", href: "/resources/blog/" }];
  const c = crumbs(base);
  const [lead, ...rest] = blog;
  const card = (b, cls = "") => `<a class="post-card ${cls}" href="${url(`/resources/blog/${b.slug}/`)}" data-reveal>
    <div class="post-card__media">${img(b.image, b.alt, { sizes: cls ? "(min-width: 900px) 60vw, 100vw" : "(min-width: 900px) 40vw, 100vw" })}</div>
    <p class="meta">${fmtDate(b.date)} · ${readMins(b.words)} min read</p>
    <h2>${esc(b.title)}</h2>
    <p>${esc(b.description)}</p>
  </a>`;
  write("/resources/blog/", layout({
    title: `Journal: crochet care, styling & studio notes | ${site.name}`,
    description: "The Made by Lilly journal: how to care for hand-crocheted wool, ways to wear shawls and oversized scarves, and notes on slow, handmade making.",
    path: "/resources/blog/",
    active: "resources",
    body: `${pageHead({ crumbsHtml: c.html, eyebrow: "Journal", title: `Notes from <em>the studio.</em>`, lede: "Care, styling and the slow business of making things by hand." })}
<section class="post-grid">${lead ? card(lead, "post-card--lead") : ""}${rest.map((b) => card(b)).join("")}</section>`,
    jsonLd: [c.ld, { "@type": "Blog", name: "Made by Lilly Journal", url: abs("/resources/blog/") }],
  }));
  for (const b of blog) {
    const pc = crumbs([...base, { label: b.title, href: `/resources/blog/${b.slug}/` }]);
    const next = blog[(blog.indexOf(b) + 1) % blog.length];
    write(`/resources/blog/${b.slug}/`, layout({
      title: `${b.title} | ${site.name} Journal`,
      description: b.description,
      path: `/resources/blog/${b.slug}/`,
      active: "resources",
      image: b.image,
      type: "article",
      body: articleShell({
        crumbsHtml: pc.html,
        eyebrow: "Journal",
        title: b.title,
        meta: `${fmtDate(b.date)} · ${readMins(b.words)} min read`,
        lede: b.description,
        hero: img(b.image, b.alt, { sizes: "(min-width: 1100px) 1100px, 100vw", eager: true }),
        html: b.html,
        next: next !== b ? { href: `/resources/blog/${next.slug}/`, label: "Next in the journal", title: next.title } : null,
      }),
      jsonLd: [pc.ld, { "@type": "BlogPosting", headline: b.title, description: b.description, datePublished: b.date, image: imgAbs(b.image), author: { "@type": "Person", name: "Lilly" }, publisher: { "@type": "Organization", name: site.name }, mainEntityOfPage: abs(`/resources/blog/${b.slug}/`) }],
    }));
  }
}

function articleShell({ crumbsHtml, eyebrow, title, meta, lede, hero = "", html, aside = "", next = null }) {
  return `<article class="article">
  <header class="article__head">
    ${crumbsHtml}
    <p class="eyebrow" data-reveal>${eyebrow}</p>
    <h1 class="article__title" data-reveal>${esc(title)}</h1>
    <p class="article__lede" data-reveal>${esc(lede)}</p>
    <p class="meta" data-reveal>${meta}</p>
  </header>
  ${hero ? `<figure class="article__hero" data-reveal>${hero}</figure>` : chain()}
  <div class="article__body ${aside ? "article__body--aside" : ""}">
    ${aside}
    <div class="prose">${html}</div>
  </div>
  ${next ? `<a class="next-link" href="${url(next.href)}"><span class="meta">${next.label}</span><span class="next-link__title">${esc(next.title)} <span aria-hidden="true">→</span></span></a>` : ""}
</article>`;
}

function guidePages() {
  const base = [{ label: "Home", href: "/" }, { label: "Resources", href: "/resources/" }, { label: "Pattern guides", href: "/resources/pattern-guides/" }];
  const c = crumbs(base);
  write("/resources/pattern-guides/", layout({
    title: `Crochet pattern guides for beginners & improvers | ${site.name}`,
    description: "Plain-English crochet pattern guides from Made by Lilly: how to read a pattern, UK and US stitch terms, and how to choose the right yarn for a shawl.",
    path: "/resources/pattern-guides/",
    active: "resources",
    body: `${pageHead({ crumbsHtml: c.html, eyebrow: "Pattern guides", title: `Patterns, <em>untangled.</em>`, lede: "Clear, practical guides for the parts of crochet that trip people up." })}
<section class="ledger">${guides.map((g, i) => `<a class="ledger__row" href="${url(`/resources/pattern-guides/${g.slug}/`)}" data-reveal>
  <span class="ledger__no">${String(i + 1).padStart(2, "0")}</span>
  <span class="ledger__title">${esc(g.title)}</span>
  <span class="ledger__desc">${esc(g.description)}</span>
  <span class="ledger__tag">${esc(g.level || "")} · ${readMins(g.words)} min</span>
</a>`).join("")}</section>`,
    jsonLd: [c.ld],
  }));
  for (const g of guides) {
    const pc = crumbs([...base, { label: g.title, href: `/resources/pattern-guides/${g.slug}/` }]);
    const next = guides[(guides.indexOf(g) + 1) % guides.length];
    write(`/resources/pattern-guides/${g.slug}/`, layout({
      title: `${g.title}: a crochet pattern guide | ${site.name}`,
      description: g.description,
      path: `/resources/pattern-guides/${g.slug}/`,
      active: "resources",
      type: "article",
      body: articleShell({
        crumbsHtml: pc.html,
        eyebrow: `Pattern guide · ${esc(g.level || "")}`,
        title: g.title,
        meta: `${readMins(g.words)} min read`,
        lede: g.description,
        html: g.html,
        next: next !== g ? { href: `/resources/pattern-guides/${next.slug}/`, label: "Next guide", title: next.title } : null,
      }),
      jsonLd: [pc.ld, { "@type": "HowTo", name: g.title, description: g.description, url: abs(`/resources/pattern-guides/${g.slug}/`) }],
    }));
  }
}

function technicalPages() {
  const base = [{ label: "Home", href: "/" }, { label: "Resources", href: "/resources/" }, { label: "Stitch library", href: "/resources/technical-details/" }];
  const c = crumbs(base);
  write("/resources/technical-details/", layout({
    title: `Crochet stitch library: techniques & technical notes | ${site.name}`,
    description: "A crochet stitch library with technical notes on V-stitch, moss stitch, granny stripe, shell stitch and more, with UK and US terms, fabric and best uses.",
    path: "/resources/technical-details/",
    active: "resources",
    body: `${pageHead({ crumbsHtml: c.html, eyebrow: "Technical details", title: `The stitch <em>library.</em>`, lede: "Technical notes on the stitches and structures behind crochet, including many that go beyond what's in the shop." })}
<section class="stitch-table-wrap" data-reveal>
  <table class="stitch-table">
    <thead><tr><th scope="col">Stitch</th><th scope="col">Level</th><th scope="col">Fabric</th><th scope="col">Best for</th></tr></thead>
    <tbody>${technical.map((t) => `<tr><th scope="row"><a href="${url(`/resources/technical-details/${t.slug}/`)}">${esc(t.title)}</a></th><td>${esc(t.difficulty)}</td><td>${esc(t.fabric)}</td><td>${esc(t.uses)}</td></tr>`).join("")}</tbody>
  </table>
</section>`,
    jsonLd: [c.ld],
  }));
  for (const t of technical) {
    const pc = crumbs([...base, { label: t.title, href: `/resources/technical-details/${t.slug}/` }]);
    const next = technical[(technical.indexOf(t) + 1) % technical.length];
    const aside = `<aside class="spec-card" aria-label="At a glance"><p class="spec-card__title">At a glance</p><dl>
      <div><dt>Level</dt><dd>${esc(t.difficulty)}</dd></div>
      <div><dt>Fabric</dt><dd>${esc(t.fabric)}</dd></div>
      <div><dt>Best for</dt><dd>${esc(t.uses)}</dd></div>
    </dl></aside>`;
    write(`/resources/technical-details/${t.slug}/`, layout({
      title: `${t.title}: crochet stitch technical notes | ${site.name}`,
      description: t.description,
      path: `/resources/technical-details/${t.slug}/`,
      active: "resources",
      type: "article",
      body: articleShell({
        crumbsHtml: pc.html,
        eyebrow: "Stitch library",
        title: t.title,
        meta: `${esc(t.difficulty)} · ${readMins(t.words)} min read`,
        lede: t.description,
        html: t.html,
        aside,
        next: next !== t ? { href: `/resources/technical-details/${next.slug}/`, label: "Next stitch", title: next.title } : null,
      }),
      jsonLd: [pc.ld, { "@type": "TechArticle", headline: t.title, description: t.description, url: abs(`/resources/technical-details/${t.slug}/`) }],
    }));
  }
}

function eventsPage() {
  const c = crumbs([{ label: "Home", href: "/" }, { label: "Resources", href: "/resources/" }, { label: "Events", href: "/resources/events/" }]);
  const upcoming = events.filter((e) => e.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date));
  const list = upcoming.length
    ? `<ol class="events">${upcoming.map((e) => {
        const d = new Date(e.date + "T12:00:00Z");
        return `<li class="event" data-reveal>
        <p class="event__date"><span>${d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" })}</span>${d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}</p>
        <div><h2>${esc(e.title)}</h2><p class="meta">${esc(e.time || "")}${e.time ? " · " : ""}${esc(e.location)}</p>${e.agenda ? `<p>${esc(e.agenda)}</p>` : ""}</div>
      </li>`;
      }).join("")}</ol>`
    : `<div class="empty" data-reveal>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${heartPath}"/></svg>
        <h2>No dates announced <em>just yet.</em></h2>
        <p>Craft fairs, markets and workshops will be listed here as soon as they're booked. New dates go on Instagram first.</p>
        <a class="btn btn--ghost" href="${site.instagram}" target="_blank" rel="noopener">Follow on Instagram ↗</a>
      </div>`;
  const ld = upcoming.map((e) => ({ "@type": "Event", name: e.title, startDate: e.date, location: { "@type": "Place", name: e.location, address: e.location }, eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", organizer: { "@type": "Organization", name: site.name, url: abs("/") } }));
  write("/resources/events/", layout({
    title: `Events: craft fairs, markets & workshops | ${site.name}`,
    description: "Where to find Made by Lilly in person: upcoming craft fairs, makers' markets and crochet workshops in the UK, with dates, locations and what to expect.",
    path: "/resources/events/",
    active: "resources",
    body: `${pageHead({ crumbsHtml: c.html, eyebrow: "Events", title: `Come and see <em>in person.</em>`, lede: "Crochet is best understood up close. Here's where you can find the pieces, and me." })}
<section class="events-wrap">${list}</section>`,
    jsonLd: [c.ld, ...ld],
  }));
}

function contact() {
  const c = crumbs([{ label: "Home", href: "/" }, { label: "Contact", href: "/contact/" }]);
  const body = `
${pageHead({ crumbsHtml: c.html, eyebrow: "Contact", title: `Say <em>hello.</em>`, lede: "A question about a piece, a gift, or something you saw at a fair? Email is the best way to reach me." })}
<section class="contact">
  <div class="contact__card" data-reveal>
    <p class="eyebrow">Email</p>
    <a class="btn btn--oval" href="${mailto("Hello from the website")}">Email Me</a>
  </div>
  <div class="contact__side" data-reveal style="--d:1">
    <p class="eyebrow">Instagram</p>
    <a class="contact__insta" href="${site.instagram}" target="_blank" rel="noopener" aria-label="Lilly on Instagram (opens in a new tab)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor"/></svg></a>
    <p>New pieces, works in progress and event dates are shared there first.</p>
  </div>
</section>
<section class="faq" id="faq">
  ${chain()}
  <div class="faq__grid">
    <div><p class="eyebrow" data-reveal>Good to know</p><h2 class="display-md" data-reveal>Questions, <em>answered.</em></h2></div>
    <div class="faq__list">${faqs.map(([q, a]) => `<details class="faq__item" data-reveal><summary>${esc(q)}<span aria-hidden="true"></span></summary><p>${esc(a)}</p></details>`).join("")}</div>
  </div>
</section>`;
  write("/contact/", layout({
    title: `Contact Lilly: questions, gifts & orders | ${site.name}`,
    description: "Get in touch with Made by Lilly by email about a piece, a gift or an order, and find answers to common questions on delivery, returns and caring for crochet.",
    path: "/contact/",
    active: "contact",
    body,
    jsonLd: [c.ld, { "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }],
  }));
}

function legalPage({ p, title, metaTitle, description, sections }) {
  const c = crumbs([{ label: "Home", href: "/" }, { label: title, href: p }]);
  const toc = sections.map((s) => `<li><a href="#${s.id}">${s.h}</a></li>`).join("");
  const body = `
${pageHead({ crumbsHtml: c.html, eyebrow: `Last updated ${fmtDate(site.policyUpdated)}`, title, cls: "page-head--legal" })}
<div class="legal">
  <nav class="legal__toc" aria-label="On this page"><p class="eyebrow">On this page</p><ol>${toc}</ol></nav>
  <div class="prose">${sections.map((s) => `<section id="${s.id}"><h2>${s.h}</h2>${s.html}</section>`).join("")}</div>
</div>`;
  write(p, layout({ title: metaTitle, description, path: p, body, jsonLd: [c.ld] }));
}

function legal() {
  const email = `<a href="${mailto()}">${site.email}</a>`;
  legalPage({
    p: "/terms-of-sale/",
    title: "Terms of sale",
    metaTitle: `Terms of sale, delivery & returns | ${site.name}`,
    description: "Made by Lilly terms of sale: free UK delivery, prices without VAT, secure Stripe checkout, your 14-day right to cancel and free returns on ready-made pieces.",
    sections: [
      { id: "about", h: "Who you're buying from", html: `<p>You're buying from Made by Lilly, a small handmade crochet business based in the UK. You can reach me at ${email}.</p>` },
      { id: "pieces", h: "The pieces", html: `<p>Every piece is handmade and ready-made: it's finished before it's listed, and there is only one of each. Because each piece is made by hand, small variations in stitch and tension are part of its character. Photos are as accurate as I can make them, but colours can look slightly different on different screens.</p>` },
      { id: "prices", h: "Prices and payment", html: `<p>Prices are in pounds sterling and are the full price you pay. UK delivery is included. Made by Lilly is not VAT-registered, so no VAT is charged.</p><p>Payment is taken by Stripe at checkout. Your order is confirmed when payment succeeds and you receive an email receipt. If a piece sells in person before your online order is processed, I'll let you know straight away and refund you in full.</p>` },
      { id: "delivery", h: "Delivery", html: `<p>I deliver to UK addresses only. Delivery is free, and orders are dispatched ${site.dispatch}. If anything is going to delay your order, I'll email you.</p>` },
      { id: "returns", h: "Your right to cancel and returns", html: `<p>You can change your mind about any piece. You have <strong>14 days from the day you receive it</strong> to tell me you want to cancel, without giving a reason.</p><ol><li>Email me at ${email} to let me know.</li><li>I'll arrange the return postage. <strong>Returns are free: I pay for the return postage.</strong></li><li>Send the piece back within 14 days of telling me. Please return it unworn and in the condition you received it.</li><li>I refund you in full, to your original payment method, within 14 days of the piece arriving back with me.</li></ol><p>If a returned piece has been worn or damaged beyond what's needed to look at it and try it on, I may reduce the refund to reflect that.</p>` },
      { id: "faulty", h: "If something is wrong", html: `<p>If a piece arrives damaged or faulty, please email me as soon as you can. Your legal rights under the Consumer Rights Act 2015 apply, and they're in addition to your right to cancel above.</p>` },
      { id: "law", h: "The law", html: `<p>These terms are governed by the law of England and Wales. They don't affect your statutory rights as a consumer.</p>` },
    ],
  });
  const analytics = site.ga4Id
    ? `<p>If you agree to analytics cookies, the site uses Google Analytics to understand, in aggregate, how people use the site: which pages are visited and roughly where visitors come from. Google Analytics is not loaded unless you choose to allow it. The legal basis is your consent, which you can withdraw at any time using "Cookie settings" at the bottom of every page.</p>`
    : `<p>The site does not currently use analytics or tracking. If that changes, this policy will be updated first, and nothing will run without your consent.</p>`;
  legalPage({
    p: "/privacy/",
    title: "Privacy policy",
    metaTitle: `Privacy policy | ${site.name}`,
    description: "How Made by Lilly collects, uses and protects your personal data under UK GDPR: orders through Stripe, emails, analytics consent, retention and your rights.",
    sections: [
      { id: "who", h: "Who I am", html: `<p>Made by Lilly is a small handmade business in the UK and is the controller of the personal data described here. You can contact me about anything in this policy at ${email}.</p>` },
      { id: "what", h: "What I collect and why", html: `<ul><li><strong>Orders.</strong> When you buy, Stripe collects your name, email, delivery address and payment details so the payment can be taken and the piece delivered. I receive your name, email and delivery address to post your order. I never see or store your card details. The legal basis is contract: I need this to fulfil your order.</li><li><strong>Emails.</strong> If you email me, I receive your email address and anything you choose to include, so I can reply. The legal basis is my legitimate interest in answering your question, or contract if it's about an order.</li></ul><h3>Analytics</h3>${analytics}` },
      { id: "who-else", h: "Who else handles your data", html: `<ul><li><strong>Stripe</strong> processes payments. Stripe is an independent controller for payment data, and its own privacy policy applies.</li><li><strong>Microsoft</strong> hosts my email (Outlook).</li>${site.ga4Id ? "<li><strong>Google</strong> provides Google Analytics, only if you consent.</li>" : ""}<li><strong>GitHub</strong> hosts this website. Like any web host, it may process technical data such as your IP address to deliver pages securely.</li><li><strong>Royal Mail or another UK courier</strong> receives your name and address to deliver your order.</li></ul><p>I never sell your data, and I don't use it for marketing unless you've asked me to.</p>` },
      { id: "keep", h: "How long I keep it", html: `<p>I keep order details and email correspondence for ${site.dataRetention}, then delete them. Stripe keeps its own payment records as required by financial regulations.</p>` },
      { id: "rights", h: "Your rights", html: `<p>You have the right to ask for a copy of your data, to have it corrected or deleted, to object to or restrict how it's used, and to withdraw consent at any time. Just email ${email}. I'll respond within one month.</p>` },
      { id: "complain", h: "How to complain", html: `<p>If you're unhappy with how your data has been handled, please tell me first so I can put it right. You also have the right to complain to the Information Commissioner's Office (ICO), the UK's data protection regulator, at <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">ico.org.uk/make-a-complaint</a> or on 0303 123 1113.</p>` },
    ],
  });
  legalPage({
    p: "/cookies/",
    title: "Cookie policy",
    metaTitle: `Cookie policy | ${site.name}`,
    description: "Which cookies the Made by Lilly website uses, why, and how to control them, including how Google Analytics runs only after you have given consent.",
    sections: site.ga4Id
      ? [
          { id: "summary", h: "In short", html: `<p>This site only sets analytics cookies if you say yes. Nothing is tracked before you choose, and you can change your mind at any time using "Cookie settings" at the bottom of every page.</p>` },
          { id: "analytics", h: "Analytics cookies (optional)", html: `<p>If you accept, Google Analytics sets cookies named <code>_ga</code> and <code>_ga_*</code>, which last up to 2 years. They tell me, in aggregate, which pages are visited and how people find the site.</p>` },
          { id: "choice", h: "Remembering your choice", html: `<p>Your cookie choice is saved in your browser's local storage, so the banner doesn't appear on every page. It stays on your device and isn't sent to anyone.</p>` },
          { id: "checkout", h: "Checkout", html: `<p>When you click "Buy now", you move to Stripe's secure checkout, which sets its own strictly necessary cookies for payment security and fraud prevention. Stripe's cookie policy applies there.</p>` },
        ]
      : [
          { id: "summary", h: "In short", html: `<p>This website doesn't set any cookies and doesn't use analytics or tracking.</p>` },
          { id: "checkout", h: "Checkout", html: `<p>When you click "Buy now", you move to Stripe's secure checkout, which sets its own strictly necessary cookies for payment security and fraud prevention. Stripe's cookie policy applies there.</p>` },
          { id: "changes", h: "If this changes", html: `<p>If analytics are added in future, this policy will be updated first, and analytics cookies will only be set after you've agreed to them.</p>` },
        ],
  });
}

function notFound() {
  write("/404.html", layout({
    title: `Page not found | ${site.name}`,
    description: "This page has unravelled. Head back to the Made by Lilly shop, journal or home page to find hand-crocheted shawls and oversized scarves.",
    path: "/404.html",
    body: `<section class="lost">
  <p class="eyebrow">Error 404</p>
  <h1 class="page-head__title">This page has <em>unravelled.</em></h1>
  <p class="page-head__lede">The link may be old, or the piece may have moved. Let's pick up the thread somewhere else.</p>
  <div class="hero__actions"><a class="btn" href="${url("/shop/")}">Shop the collection</a><a class="link-line" href="${url("/")}">Back to home <span aria-hidden="true">→</span></a></div>
</section>`,
  }));
}

function extras() {
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((p) => `  <url><loc>${abs(p)}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), xml);
  fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`);
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
}

/* ---------- run ---------- */

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(STATIC, OUT, { recursive: true });
home();
shop();
products.forEach(productPage);
about();
resourcesHub();
blogPages();
guidePages();
technicalPages();
eventsPage();
contact();
legal();
notFound();
extras();

// Guard: every <title> and meta description must be unique (SEO requirement).
const seen = { title: new Map(), desc: new Map() };
for (const p of [...sitemap]) {
  const html = fs.readFileSync(path.join(OUT, p, "index.html"), "utf8");
  const t = html.match(/<title>(.*?)<\/title>/)[1];
  const d = html.match(/<meta name="description" content="(.*?)">/)[1];
  for (const [k, v] of [["title", t], ["desc", d]]) {
    if (seen[k].has(v)) throw new Error(`Duplicate ${k} on ${p} and ${seen[k].get(v)}`);
    seen[k].set(v, p);
  }
}
console.log(`Built ${sitemap.length} pages into _site/`);
