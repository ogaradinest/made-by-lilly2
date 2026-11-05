// Handmade by Lilly — progressive enhancement. The site works fully without this file.
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Headline mask reveal once fonts are ready (avoids a jump when the display font swaps in).
  const loaded = () => document.body.classList.add("is-loaded");
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(loaded));
  setTimeout(loaded, 1200);

  // Stagger the loops in each chain divider.
  document.querySelectorAll(".chain ellipse").forEach((el, i) => el.style.setProperty("--i", i % 32));

  // Reveal on scroll.
  const targets = document.querySelectorAll("[data-reveal], .chain");
  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    targets.forEach((el) => io.observe(el));
  }

  // Masthead: solid once scrolled, tucks away when scrolling down, returns when scrolling up.
  const mast = document.querySelector("[data-masthead]");
  const parallax = [...document.querySelectorAll("[data-parallax]")];
  const spinner = document.querySelector("[data-spin]");
  let lastY = window.scrollY, ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    if (mast && !document.body.classList.contains("menu-open")) {
      mast.classList.toggle("is-scrolled", y > 12);
      mast.classList.toggle("is-compact", y > 40);
      mast.classList.toggle("is-hidden", y > 420 && y > lastY + 4);
      if (y < lastY - 4) mast.classList.remove("is-hidden");
    }
    if (!reduce) {
      parallax.forEach((el) => {
        const target = el.matches("figure") ? el.querySelector("img") : el;
        target.style.setProperty("--py", `${(y * parseFloat(el.dataset.parallax)).toFixed(1)}px`);
      });
      if (spinner) spinner.style.setProperty("--spin", `${(y * -0.25).toFixed(1)}deg`);
    }
    lastY = y; ticking = false;
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // Hero badge: spins anticlockwise while the mouse is over it, then eases to a stop where it is.
  // It runs even with "reduce motion" on: it only moves while the visitor deliberately hovers it.
  const badge = spinner && spinner.closest(".badge");
  if (badge) {
    let angle = 0, speed = 0, target = 0, last = 0, running = false;
    const tick = (t) => {
      const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
      last = t;
      speed += (target - speed) * Math.min(dt * 4, 1);
      angle = (angle + speed * dt) % 360;
      spinner.style.setProperty("--hover-spin", `${angle.toFixed(2)}deg`);
      if (target || Math.abs(speed) > 0.5) requestAnimationFrame(tick);
      else { running = false; last = 0; }
    };
    const go = (on) => {
      target = on ? -36 : 0; // degrees per second; negative = anticlockwise, so the text reads in order
      if (!running) { running = true; requestAnimationFrame(tick); }
    };
    badge.addEventListener("pointerenter", () => go(true));
    badge.addEventListener("pointerleave", () => go(false));
  }

  // Mobile menu.
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");
  if (toggle && menu) {
    const label = toggle.querySelector(".menu-toggle__label");
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      label.textContent = open ? "Close" : "Menu";
      menu.hidden = !open;
      document.body.classList.toggle("menu-open", open);
      if (!open) onScroll();
      if (open) { mast.classList.remove("is-hidden"); mast.classList.add("is-compact"); menu.querySelector("a").focus(); }
    };
    toggle.addEventListener("click", () => setOpen(menu.hidden));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) { setOpen(false); toggle.focus(); }
    });
    window.matchMedia("(min-width: 901px)").addEventListener("change", (m) => { if (m.matches) setOpen(false); });
  }

  // Shop category filter. Without JavaScript every piece simply shows and the dropdown stays hidden.
  const filter = document.querySelector("[data-shop-filter]");
  if (filter) {
    const select = filter.querySelector("select");
    const grid = document.querySelector("[data-shop-grid]");
    const pieces = [...grid.querySelectorAll(".piece")];
    const status = filter.querySelector("[data-shop-status]");
    const apply = (cat, announce) => {
      let shown = 0;
      pieces.forEach((p) => {
        const match = !cat || p.dataset.category === cat;
        p.hidden = !match;
        if (match) { shown++; p.classList.add("is-in"); }
      });
      if (announce) status.textContent = `Showing ${shown} ${shown === 1 ? "piece" : "pieces"}${cat ? " in " + cat : ""}.`;
      const u = new URL(location.href);
      if (cat) u.searchParams.set("category", cat); else u.searchParams.delete("category");
      history.replaceState(null, "", u);
    };
    const initial = new URLSearchParams(location.search).get("category") || "";
    if ([...select.options].some((o) => o.value === initial)) select.value = initial;
    filter.hidden = false;
    apply(select.value, false);
    select.addEventListener("change", () => apply(select.value, true));
  }

  // Keep only one FAQ answer open at a time.
  const faqs = document.querySelectorAll(".faq__item");
  faqs.forEach((d) => d.addEventListener("toggle", () => {
    if (d.open) faqs.forEach((o) => { if (o !== d) o.open = false; });
  }));
})();
