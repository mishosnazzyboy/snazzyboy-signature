// Cart store. Vanilla port of src/stores/cartStore.ts with the same
// Shopify Storefront mutations, localStorage persistence and a tiny
// pub/sub so UI code can subscribe to changes.

import {
  storefrontApiRequest,
  CART_QUERY,
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_LINES_REMOVE_MUTATION,
} from "./shopify.js";

const STORAGE_KEY = "snazzyboy-cart";

const state = {
  items: [],
  cartId: null,
  checkoutUrl: null,
  isLoading: false,
  isSyncing: false,
};

const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try { fn(getSnapshot()); } catch (e) { console.error(e); }
  }
}

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ items: state.items, cartId: state.cartId, checkoutUrl: state.checkoutUrl })
    );
  } catch (e) { /* localStorage might be disabled */ }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state.items = Array.isArray(parsed.items) ? parsed.items : [];
      state.cartId = parsed.cartId ?? null;
      state.checkoutUrl = parsed.checkoutUrl ?? null;
    }
  } catch (e) { /* ignore corrupted state */ }
}

function set(patch) {
  Object.assign(state, patch);
  persist();
  notify();
}

function getSnapshot() {
  return {
    items: state.items.slice(),
    cartId: state.cartId,
    checkoutUrl: state.checkoutUrl,
    isLoading: state.isLoading,
    isSyncing: state.isSyncing,
    totalItems: state.items.reduce((s, i) => s + i.quantity, 0),
    totalPrice: state.items.reduce((s, i) => s + parseFloat(i.price.amount) * i.quantity, 0),
    currency: state.items[0]?.price.currencyCode || "",
  };
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(getSnapshot());
  return () => listeners.delete(fn);
}

function formatCheckoutUrl(checkoutUrl) {
  try {
    const url = new URL(checkoutUrl);
    url.searchParams.set("channel", "online_store");
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}

function isCartNotFoundError(userErrors = []) {
  return userErrors.some(
    (e) =>
      e.message?.toLowerCase().includes("cart not found") ||
      e.message?.toLowerCase().includes("does not exist")
  );
}

async function createShopifyCart(item) {
  const data = await storefrontApiRequest(CART_CREATE_MUTATION, {
    input: { lines: [{ quantity: item.quantity, merchandiseId: item.variantId }] },
  });
  if (!data) return null;
  if (data?.data?.cartCreate?.userErrors?.length > 0) return null;
  const cart = data?.data?.cartCreate?.cart;
  if (!cart?.checkoutUrl) return null;
  const lineId = cart.lines.edges[0]?.node?.id;
  if (!lineId) return null;
  return { cartId: cart.id, checkoutUrl: formatCheckoutUrl(cart.checkoutUrl), lineId };
}

async function addLineToShopifyCart(cartId, item) {
  const data = await storefrontApiRequest(CART_LINES_ADD_MUTATION, {
    cartId,
    lines: [{ quantity: item.quantity, merchandiseId: item.variantId }],
  });
  if (!data) return { success: false };
  const userErrors = data?.data?.cartLinesAdd?.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };
  const lines = data?.data?.cartLinesAdd?.cart?.lines?.edges || [];
  const newLine = lines.find((l) => l.node.merchandise.id === item.variantId);
  return { success: true, lineId: newLine?.node?.id };
}

async function updateShopifyCartLine(cartId, lineId, quantity) {
  const data = await storefrontApiRequest(CART_LINES_UPDATE_MUTATION, {
    cartId,
    lines: [{ id: lineId, quantity }],
  });
  if (!data) return { success: false };
  const userErrors = data?.data?.cartLinesUpdate?.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };
  return { success: true };
}

async function removeLineFromShopifyCart(cartId, lineId) {
  const data = await storefrontApiRequest(CART_LINES_REMOVE_MUTATION, {
    cartId,
    lineIds: [lineId],
  });
  if (!data) return { success: false };
  const userErrors = data?.data?.cartLinesRemove?.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };
  return { success: true };
}

export async function addItem(item) {
  const existing = state.items.find((i) => i.variantId === item.variantId);
  set({ isLoading: true });
  try {
    if (!state.cartId) {
      const result = await createShopifyCart({ ...item, lineId: null });
      if (result) {
        set({
          cartId: result.cartId,
          checkoutUrl: result.checkoutUrl,
          items: [{ ...item, lineId: result.lineId }],
        });
      }
    } else if (existing) {
      const newQuantity = existing.quantity + item.quantity;
      if (!existing.lineId) return;
      const result = await updateShopifyCartLine(state.cartId, existing.lineId, newQuantity);
      if (result.success) {
        set({
          items: state.items.map((i) =>
            i.variantId === item.variantId ? { ...i, quantity: newQuantity } : i
          ),
        });
      } else if (result.cartNotFound) {
        clearCart();
      }
    } else {
      const result = await addLineToShopifyCart(state.cartId, { ...item, lineId: null });
      if (result.success) {
        set({ items: [...state.items, { ...item, lineId: result.lineId ?? null }] });
      } else if (result.cartNotFound) {
        clearCart();
      }
    }
  } catch (error) {
    console.error("Failed to add item:", error);
  } finally {
    set({ isLoading: false });
  }
}

export async function updateQuantity(variantId, quantity) {
  if (quantity <= 0) {
    await removeItem(variantId);
    return;
  }
  const item = state.items.find((i) => i.variantId === variantId);
  if (!item?.lineId || !state.cartId) return;
  set({ isLoading: true });
  try {
    const result = await updateShopifyCartLine(state.cartId, item.lineId, quantity);
    if (result.success) {
      set({
        items: state.items.map((i) =>
          i.variantId === variantId ? { ...i, quantity } : i
        ),
      });
    } else if (result.cartNotFound) {
      clearCart();
    }
  } catch (error) {
    console.error("Failed to update quantity:", error);
  } finally {
    set({ isLoading: false });
  }
}

export async function removeItem(variantId) {
  const item = state.items.find((i) => i.variantId === variantId);
  if (!item?.lineId || !state.cartId) return;
  set({ isLoading: true });
  try {
    const result = await removeLineFromShopifyCart(state.cartId, item.lineId);
    if (result.success) {
      const newItems = state.items.filter((i) => i.variantId !== variantId);
      if (newItems.length === 0) clearCart();
      else set({ items: newItems });
    } else if (result.cartNotFound) {
      clearCart();
    }
  } catch (error) {
    console.error("Failed to remove item:", error);
  } finally {
    set({ isLoading: false });
  }
}

export function clearCart() {
  set({ items: [], cartId: null, checkoutUrl: null });
}

export function getCheckoutUrl() {
  return state.checkoutUrl;
}

export async function syncCart() {
  if (!state.cartId || state.isSyncing) return;
  set({ isSyncing: true });
  try {
    const data = await storefrontApiRequest(CART_QUERY, { id: state.cartId });
    if (!data) return;
    const cart = data?.data?.cart;
    if (!cart || cart.totalQuantity === 0) clearCart();
  } catch (error) {
    console.error("Failed to sync cart:", error);
  } finally {
    set({ isSyncing: false });
  }
}

// Initialise immediately so callers see persisted state synchronously.
load();
notify();

// Re-sync when the page becomes visible again (matches useCartSync.ts).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncCart();
  });
  // Initial sync on first script run.
  syncCart();
}
