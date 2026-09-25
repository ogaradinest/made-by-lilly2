// Cookie consent + Google Analytics 4.
// Only included on pages when a GA4 ID is set in content/site.json.
// Nothing is sent to Google until the visitor clicks "Accept".
(() => {
  const id = document.querySelector('meta[name="ga4-id"]')?.content;
  if (!id) return;
  const KEY = "mbl-consent";
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch { /* private mode: ask again next time */ } };

  let loaded = false;
  function loadGA() {
    if (loaded) return;
    loaded = true;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", id, { anonymize_ip: true });
  }

  function clearGACookies() {
    document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => n === "_ga" || n.startsWith("_ga_")).forEach((n) => {
      const host = location.hostname;
      document.cookie = `${n}=; Max-Age=0; path=/`;
      document.cookie = `${n}=; Max-Age=0; path=/; domain=${host}`;
      document.cookie = `${n}=; Max-Age=0; path=/; domain=.${host}`;
    });
  }

  function banner() {
    if (document.querySelector(".consent")) return;
    const base = document.querySelector('link[rel="canonical"]').href.replace(/^https?:\/\/[^/]+/, "").match(/^\/[^/]+/)?.[0] || "";
    const el = document.createElement("section");
    el.className = "consent";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-labelledby", "consent-title");
    el.innerHTML = `<h2 id="consent-title">A quick question about cookies</h2>
      <p>May I use analytics cookies to see which pages people visit? It helps me improve the site. Nothing is tracked unless you say yes. <a href="${base}/cookies/">Cookie policy</a></p>
      <div class="consent__actions">
        <button class="btn" type="button" data-choice="granted">Accept</button>
        <button class="btn btn--ghost" type="button" data-choice="denied">Reject</button>
      </div>`;
    document.body.appendChild(el);
    el.querySelectorAll("[data-choice]").forEach((b) => b.addEventListener("click", () => {
      const choice = b.dataset.choice;
      save(choice);
      el.remove();
      if (choice === "granted") loadGA();
      else if (loaded) { clearGACookies(); location.reload(); }
      else clearGACookies();
    }));
    el.querySelector("[data-choice]").focus({ preventScroll: true });
  }

  const choice = read();
  if (choice === "granted") loadGA();
  else if (choice !== "denied") document.addEventListener("DOMContentLoaded", banner);
  document.addEventListener("click", (e) => { if (e.target.closest("[data-cookie-settings]")) banner(); });
})();
