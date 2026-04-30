// Shop page logic: fetch products from Shopify, render the category filter
// and the product grid, hover-to-add buttons, loading + empty states.
// Direct port of src/pages/Shop.tsx + src/components/ProductCard.tsx.

import { storefrontApiRequest, PRODUCTS_QUERY } from "./shopify.js";
import { addItem } from "./cart.js";
import { showToast } from "./ui.js";

const CATEGORIES = [
  { key: "all",      label: "All",            match: () => true },
  { key: "ppe",      label: "PPE",            match: (p) => /ppe|protective|hard ?hat|glove|mask|goggle|boot/i.test(p.node.title + " " + p.node.description) },
  { key: "safety",   label: "Safety Wear",    match: (p) => /safety|hi[- ]?vis|reflect|workwear|overall/i.test(p.node.title + " " + p.node.description) },
  { key: "uniforms", label: "Uniforms",       match: (p) => /uniform|corporate|school|shirt|trouser|skirt|blazer/i.test(p.node.title + " " + p.node.description) },
  { key: "custom",   label: "Custom Apparel", match: (p) => /custom|embroider|print|branded|tee|hoodie|cap/i.test(p.node.title + " " + p.node.description) },
];

let allProducts = [];
let activeKey = "all";

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderFilter() {
  const filter = document.querySelector("[data-filter]");
  if (!filter) return;
  filter.innerHTML = CATEGORIES.map(
    (c) => `<button class="chip${activeKey === c.key ? " is-active" : ""}" data-filter-key="${c.key}" type="button">${c.label}</button>`
  ).join("");
  filter.querySelectorAll("[data-filter-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeKey = btn.getAttribute("data-filter-key");
      renderFilter();
      renderGrid();
    });
  });
}

function productCardHtml(product) {
  const variant = product.node.variants.edges[0]?.node;
  const image = product.node.images.edges[0]?.node;
  const price = product.node.priceRange.minVariantPrice;
  const handle = encodeURIComponent(product.node.handle);
  const variantSerialized = variant
    ? encodeURIComponent(JSON.stringify({ variantId: variant.id, variantTitle: variant.title, price: variant.price, selectedOptions: variant.selectedOptions || [] }))
    : "";

  return `
    <a class="product-card" href="product.html?handle=${handle}">
      <div class="product-card__media">
        ${
          image
            ? `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.altText || product.node.title)}" loading="lazy" decoding="async" />`
            : `<div class="product-card__noimg">No image</div>`
        }
        <div class="product-card__add">
          <button class="btn" type="button" data-add-handle="${handle}" data-add-variant="${variantSerialized}" data-add-title="${escapeHtml(product.node.title)}" ${variant ? "" : "disabled"}>
            Add to Bag
          </button>
        </div>
      </div>
      <h3 class="product-card__title">${escapeHtml(product.node.title)}</h3>
      <p class="product-card__price">${escapeHtml(price.currencyCode)} ${parseFloat(price.amount).toFixed(2)}</p>
    </a>`;
}

function renderGrid() {
  const target = document.querySelector("[data-shop-content]");
  if (!target) return;

  const cat = CATEGORIES.find((c) => c.key === activeKey) ?? CATEGORIES[0];
  const filtered = allProducts.filter(cat.match);

  if (filtered.length === 0) {
    target.innerHTML = `
      <div class="empty-state">
        <p>No products in this category yet.</p>
        <a class="btn btn--gold" href="quote.html">Request a custom quote</a>
      </div>`;
    return;
  }

  target.innerHTML = `<div class="products-grid">${filtered.map(productCardHtml).join("")}</div>`;

  target.querySelectorAll("[data-add-handle]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const handle = decodeURIComponent(btn.getAttribute("data-add-handle"));
      const variantStr = btn.getAttribute("data-add-variant");
      if (!variantStr) return;
      let variant;
      try { variant = JSON.parse(decodeURIComponent(variantStr)); } catch { return; }
      const product = allProducts.find((p) => p.node.handle === handle);
      if (!product || !variant) return;
      await addItem({
        product,
        variantId: variant.variantId,
        variantTitle: variant.variantTitle,
        price: variant.price,
        quantity: 1,
        selectedOptions: variant.selectedOptions || [],
      });
      showToast("Added to bag", { description: btn.getAttribute("data-add-title"), variant: "success" });
    });
  });
}

async function load() {
  const target = document.querySelector("[data-shop-content]");
  try {
    const data = await storefrontApiRequest(PRODUCTS_QUERY, { first: 100, query: null });
    if (data?.data?.products?.edges) {
      allProducts = data.data.products.edges;
    } else {
      allProducts = [];
    }
  } catch (e) {
    console.error(e);
    allProducts = [];
    if (target) {
      target.innerHTML = `
        <div class="empty-state">
          <p>We couldn't load the shop right now. Please try again or reach out directly.</p>
          <a class="btn btn--gold" href="quote.html">Request a quote</a>
        </div>`;
    }
    return;
  }
  renderGrid();
}

document.addEventListener("DOMContentLoaded", () => {
  renderFilter();
  load();
});
