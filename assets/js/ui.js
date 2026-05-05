// Shared UI for every page: navbar scroll behaviour, mobile menu toggle,
// cart drawer rendering, and toast notifications.

import { iconHtml, icons, injectIcon } from "./icons.js";
import {
  subscribe,
  updateQuantity,
  removeItem,
  syncCart,
  getCheckoutUrl,
  clearCart,
} from "./cart.js";
import { CONTACT } from "./config.js";

/* ---------- Header injection ---------- */
const NAV_LINKS = [
  { href: "index.html#services", label: "Services" },
  { href: "index.html#custom",   label: "Custom Apparel" },
  { href: "index.html#about",    label: "About" },
  { href: "index.html#contact",  label: "Contact" },
  { href: "shop.html",           label: "Shop", separator: true },
];

function buildHeader() {
  const desktopLinks = NAV_LINKS
    .map((l) => {
      const sep = l.separator
        ? `<span class="nav-links__sep" aria-hidden="true">|</span>`
        : "";
      return `${sep}<a href="${l.href}">${l.label}</a>`;
    })
    .join("");
  const mobileLinks = NAV_LINKS
    .map((l) => `<a href="${l.href}">${l.label}</a>`)
    .join("");

  return `
    <header class="site-header" data-header>
      <div class="container nav-row">
        <a class="brand" href="index.html" aria-label="Snazzyboy Signature home">
          <span class="brand__name">Snazzyboy</span>
          <span class="brand__sub">Signature</span>
        </a>
        <nav class="nav-links" aria-label="Primary">
          ${desktopLinks}
        </nav>
        <div class="nav-actions">
          <a class="btn btn--outline nav-quote" href="quote.html">Request a Quote</a>
          <button class="cart-btn" type="button" data-cart-open aria-label="Open cart">
            ${icons.shoppingBag}
            <span class="cart-badge" data-cart-badge aria-hidden="true">0</span>
          </button>
          <button class="btn btn--ghost btn--icon menu-btn" type="button" data-menu-toggle aria-label="Open menu" aria-expanded="false">
            <span data-menu-icon>${icons.menu}</span>
          </button>
        </div>
      </div>
      <nav class="mobile-nav" data-mobile-nav aria-label="Mobile">
        <div class="mobile-nav__inner">
          ${mobileLinks}
          <a class="is-quote" href="quote.html">Request a Quote</a>
        </div>
      </nav>
    </header>`;
}

function buildCartDrawer() {
  return `
    <div class="drawer-backdrop" data-drawer-backdrop hidden></div>
    <aside class="cart-drawer" data-cart-drawer role="dialog" aria-label="Your bag" aria-modal="true" hidden>
      <div class="cart-head">
        <h2>Your Bag</h2>
        <p data-cart-summary>Your bag is empty</p>
        <button class="cart-close" type="button" data-cart-close aria-label="Close cart">${icons.x}</button>
      </div>
      <div class="cart-body" data-cart-body>
        <div class="cart-empty" data-cart-empty>
          ${icons.shoppingBag}
          <p>Your bag is empty</p>
        </div>
      </div>
      <div class="cart-foot" data-cart-foot hidden>
        <div class="cart-total">
          <span class="cart-total__label">Total</span>
          <span class="cart-total__value" data-cart-total>$0.00</span>
        </div>
        <button class="btn btn--gold btn--lg btn--block" type="button" data-cart-checkout>
          ${icons.externalLink}
          <span>Checkout</span>
        </button>
      </div>
    </aside>
  `;
}

function buildFooter() {
  return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-row">
          <a class="brand" href="index.html">
            <span class="brand__name">Snazzyboy</span>
            <span class="brand__sub">Signature</span>
          </a>
          <div class="footer-links">
            <a href="mailto:${CONTACT.email}">${icons.mail}<span>${CONTACT.email}</span></a>
            <a href="tel:${CONTACT.phoneTel}">${icons.phone}<span>${CONTACT.phoneDisplay}</span></a>
            <a href="${CONTACT.whatsApp}" target="_blank" rel="noopener noreferrer">${icons.messageCircle}<span>WhatsApp</span></a>
          </div>
        </div>
        <p class="footer-copy">© <span data-year></span> Snazzyboy Signature. All rights reserved.</p>
        <div class="footer-meta-links">
          <a href="quote.html">Request a Quote</a>
        </div>
      </div>
    </footer>
  `;
}

/* ---------- Toasts ---------- */
function ensureToastContainer() {
  let container = document.querySelector(".toasts");
  if (!container) {
    container = document.createElement("div");
    container.className = "toasts";
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, opts = {}) {
  const container = ensureToastContainer();
  const node = document.createElement("div");
  node.className = `toast${opts.variant ? " is-" + opts.variant : ""}`;
  const titleEl = document.createElement("div");
  titleEl.className = "toast__title";
  titleEl.textContent = message;
  node.appendChild(titleEl);
  if (opts.description) {
    const desc = document.createElement("div");
    desc.className = "toast__desc";
    desc.textContent = opts.description;
    node.appendChild(desc);
  }
  container.appendChild(node);
  const ttl = opts.duration ?? 3500;
  setTimeout(() => {
    node.classList.add("is-out");
    setTimeout(() => node.remove(), 220);
  }, ttl);
}

/* ---------- Cart drawer rendering ---------- */
function renderCart(snapshot) {
  const badge = document.querySelector("[data-cart-badge]");
  if (badge) {
    if (snapshot.totalItems > 0) {
      badge.classList.add("is-visible");
      badge.textContent = snapshot.totalItems > 99 ? "99+" : String(snapshot.totalItems);
    } else {
      badge.classList.remove("is-visible");
    }
  }

  const summary = document.querySelector("[data-cart-summary]");
  if (summary) {
    summary.textContent =
      snapshot.totalItems === 0
        ? "Your bag is empty"
        : `${snapshot.totalItems} item${snapshot.totalItems !== 1 ? "s" : ""} in your bag`;
  }

  const body = document.querySelector("[data-cart-body]");
  const empty = document.querySelector("[data-cart-empty]");
  const foot = document.querySelector("[data-cart-foot]");
  if (!body) return;

  if (snapshot.items.length === 0) {
    body.querySelectorAll(".cart-line").forEach((n) => n.remove());
    if (empty) empty.style.display = "";
    if (foot) foot.hidden = true;
    return;
  }

  if (empty) empty.style.display = "none";
  if (foot) foot.hidden = false;

  body.querySelectorAll(".cart-line").forEach((n) => n.remove());

  const fragment = document.createDocumentFragment();
  for (const item of snapshot.items) {
    const img = item.product?.node?.images?.edges?.[0]?.node;
    const opts = (item.selectedOptions || []).map((o) => o.value).join(" • ");
    const line = document.createElement("div");
    line.className = "cart-line";
    line.innerHTML = `
      <div class="cart-line__img">
        ${img ? `<img src="${img.url}" alt="${escapeHtml(item.product.node.title)}" loading="lazy" />` : ""}
      </div>
      <div class="cart-line__info">
        <p class="cart-line__title">${escapeHtml(item.product?.node?.title || "Item")}</p>
        ${opts ? `<p class="cart-line__opts">${escapeHtml(opts)}</p>` : ""}
        <p class="cart-line__price">${escapeHtml(item.price.currencyCode)} ${parseFloat(item.price.amount).toFixed(2)}</p>
      </div>
      <div class="cart-line__actions">
        <button class="cart-remove" type="button" data-remove="${escapeHtml(item.variantId)}" aria-label="Remove">${icons.trash}</button>
        <div class="cart-line__qty">
          <button class="qty-btn" type="button" data-dec="${escapeHtml(item.variantId)}" aria-label="Decrease">${icons.minus}</button>
          <span class="qty-num">${item.quantity}</span>
          <button class="qty-btn" type="button" data-inc="${escapeHtml(item.variantId)}" aria-label="Increase">${icons.plus}</button>
        </div>
      </div>
    `;
    fragment.appendChild(line);
  }
  body.appendChild(fragment);

  const total = document.querySelector("[data-cart-total]");
  if (total) {
    total.textContent = `${snapshot.currency || ""} ${snapshot.totalPrice.toFixed(2)}`.trim();
  }
}

/* ---------- Helpers ---------- */
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setBodyScrollLock(locked) {
  document.body.classList.toggle("no-scroll", locked);
}

/* ---------- Wire up ---------- */
function mountChrome() {
  const headerSlot = document.querySelector("[data-slot=header]");
  const drawerSlot = document.querySelector("[data-slot=drawer]");
  const footerSlot = document.querySelector("[data-slot=footer]");
  if (headerSlot) headerSlot.outerHTML = buildHeader();
  if (drawerSlot) drawerSlot.outerHTML = buildCartDrawer();
  if (footerSlot) footerSlot.outerHTML = buildFooter();
}

function wireHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;

  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const menuBtn = document.querySelector("[data-menu-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  const menuIcon = document.querySelector("[data-menu-icon]");
  if (menuBtn && mobileNav && menuIcon) {
    menuBtn.addEventListener("click", () => {
      const isOpen = mobileNav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      menuBtn.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
      menuIcon.innerHTML = isOpen ? icons.x : icons.menu;
    });
    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        mobileNav.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
        menuIcon.innerHTML = icons.menu;
      });
    });
  }
}

function wireDrawer() {
  const drawer = document.querySelector("[data-cart-drawer]");
  const backdrop = document.querySelector("[data-drawer-backdrop]");
  if (!drawer || !backdrop) return;

  function open() {
    drawer.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
      drawer.classList.add("is-open");
      backdrop.classList.add("is-open");
    });
    setBodyScrollLock(true);
    syncCart();
  }
  function close() {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    setBodyScrollLock(false);
    setTimeout(() => {
      drawer.hidden = true;
      backdrop.hidden = true;
    }, 320);
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-cart-open]");
    if (t) { e.preventDefault(); open(); }
  });
  document.querySelector("[data-cart-close]")?.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) close();
  });

  document.querySelector("[data-cart-checkout]")?.addEventListener("click", () => {
    const url = getCheckoutUrl();
    if (url) {
      window.open(url, "_blank", "noopener");
      close();
    } else {
      showToast("Checkout unavailable", { description: "Add an item to start checkout.", variant: "error" });
    }
  });

  // Delegate qty / remove buttons on the cart body.
  const body = document.querySelector("[data-cart-body]");
  body?.addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    const rem = e.target.closest("[data-remove]");
    if (inc) {
      const id = inc.getAttribute("data-inc");
      const item = current.items.find((i) => i.variantId === id);
      if (item) updateQuantity(id, item.quantity + 1);
    } else if (dec) {
      const id = dec.getAttribute("data-dec");
      const item = current.items.find((i) => i.variantId === id);
      if (item) updateQuantity(id, item.quantity - 1);
    } else if (rem) {
      removeItem(rem.getAttribute("data-remove"));
    }
  });
}

function wireYear() {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

let current = { items: [] };

document.addEventListener("DOMContentLoaded", () => {
  mountChrome();
  wireHeader();
  wireDrawer();
  wireYear();
  ensureToastContainer();

  subscribe((snapshot) => {
    current = snapshot;
    renderCart(snapshot);
  });

  window.addEventListener("shopify:payment-required", () => {
    showToast("Shop temporarily unavailable", {
      description: "Please reach us via WhatsApp or email to place an order.",
      variant: "error",
      duration: 6000,
    });
  });
});
