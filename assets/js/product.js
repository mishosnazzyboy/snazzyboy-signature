// Product page logic. Reads ?handle= from the URL, fetches the product
// from Shopify and renders the gallery + option pickers + Add-to-Bag.
// Direct port of src/pages/Product.tsx.

import { storefrontApiRequest, PRODUCT_BY_HANDLE_QUERY } from "./shopify.js";
import { addItem } from "./cart.js";
import { showToast } from "./ui.js";

let product = null;
let activeImageIndex = 0;
let selectedVariantId = null;

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCurrentVariant() {
  if (!product) return null;
  return product.variants.edges.find((v) => v.node.id === selectedVariantId)?.node || null;
}

function findMatchingVariant(targetOptionName, targetValue) {
  if (!product) return null;
  const current = getCurrentVariant();

  // For multi-option products try to match every selected option except the
  // one we're changing; for single-option products just find any match.
  return product.variants.edges.find((v) => {
    const node = v.node;
    if (product.options.length === 1) {
      return node.selectedOptions.some(
        (so) => so.name === targetOptionName && so.value === targetValue
      );
    }
    return node.selectedOptions.every((so) => {
      if (so.name === targetOptionName) return so.value === targetValue;
      return current?.selectedOptions.find((c) => c.name === so.name)?.value === so.value;
    });
  })?.node;
}

function render() {
  const target = document.querySelector("[data-product-content]");
  if (!target) return;

  if (!product) {
    target.innerHTML = `<div class="empty-state"><p>Product not found.</p><a class="btn btn--gold" href="shop.html">Browse the shop</a></div>`;
    return;
  }

  document.title = `${product.title} — Snazzyboy Signature`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && product.description) {
    metaDesc.setAttribute("content", product.description.slice(0, 160));
  }

  const variant = getCurrentVariant();
  const images = product.images.edges;
  const main = images[activeImageIndex]?.node;
  const price = variant?.price || product.priceRange.minVariantPrice;

  const optionsHtml = product.options
    .map((opt) => {
      const valuesHtml = opt.values
        .map((val) => {
          const matching = findMatchingVariant(opt.name, val);
          const isActive = variant?.selectedOptions.find((so) => so.name === opt.name)?.value === val;
          return `<button class="option-pill${isActive ? " is-active" : ""}" type="button" data-option-name="${escapeHtml(opt.name)}" data-option-value="${escapeHtml(val)}" ${matching ? "" : "disabled"}>${escapeHtml(val)}</button>`;
        })
        .join("");
      return `
        <div class="option-group">
          <p class="option-group__label">${escapeHtml(opt.name)}</p>
          <div class="option-values">${valuesHtml}</div>
        </div>`;
    })
    .join("");

  const thumbsHtml =
    images.length > 1
      ? `<div class="product-thumbs">${images
          .map(
            (img, i) => `
              <button type="button" data-thumb-index="${i}" class="${i === activeImageIndex ? "is-active" : ""}" aria-label="Image ${i + 1}">
                <img src="${escapeHtml(img.node.url)}" alt="" loading="lazy" />
              </button>`
          )
          .join("")}</div>`
      : "";

  const isAvailable = !!variant?.availableForSale;
  const addLabel = isAvailable ? "Add to Bag" : "Sold Out";

  target.innerHTML = `
    <div class="product-grid">
      <div class="product-gallery">
        <div class="product-main-img">
          ${main ? `<img src="${escapeHtml(main.url)}" alt="${escapeHtml(main.altText || product.title)}" />` : ""}
        </div>
        ${thumbsHtml}
      </div>
      <div class="product-detail">
        <h1>${escapeHtml(product.title)}</h1>
        <p class="product-price">${escapeHtml(price.currencyCode)} ${parseFloat(price.amount).toFixed(2)}</p>
        ${optionsHtml}
        <button class="btn btn--gold btn--lg btn--block" type="button" data-add-bag ${isAvailable ? "" : "disabled"}>${addLabel}</button>
        ${
          product.description
            ? `<div class="product-description">
                 <p class="product-description__label">Description</p>
                 <p>${escapeHtml(product.description)}</p>
               </div>`
            : ""
        }
      </div>
    </div>`;

  target.querySelectorAll("[data-thumb-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeImageIndex = parseInt(btn.getAttribute("data-thumb-index"), 10) || 0;
      render();
    });
  });

  target.querySelectorAll("[data-option-name]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-option-name");
      const val = btn.getAttribute("data-option-value");
      const match = findMatchingVariant(name, val);
      if (match) {
        selectedVariantId = match.id;
        render();
      }
    });
  });

  target.querySelector("[data-add-bag]")?.addEventListener("click", async () => {
    const v = getCurrentVariant();
    if (!product || !v) return;
    await addItem({
      product: { node: product },
      variantId: v.id,
      variantTitle: v.title,
      price: v.price,
      quantity: 1,
      selectedOptions: v.selectedOptions || [],
    });
    showToast("Added to bag", { description: product.title, variant: "success" });
  });
}

async function load() {
  const params = new URLSearchParams(location.search);
  const handle = params.get("handle");
  const target = document.querySelector("[data-product-content]");
  if (!handle) {
    if (target) target.innerHTML = `<div class="empty-state"><p>No product specified.</p><a class="btn btn--gold" href="shop.html">Browse the shop</a></div>`;
    return;
  }

  try {
    const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
    product = data?.data?.productByHandle || null;
    if (product) {
      selectedVariantId = product.variants.edges[0]?.node?.id || null;
    }
  } catch (e) {
    console.error(e);
    product = null;
  }

  render();
}

document.addEventListener("DOMContentLoaded", load);
