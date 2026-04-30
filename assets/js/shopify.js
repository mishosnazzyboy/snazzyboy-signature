// Thin Shopify Storefront API client. Mirrors the helpers and queries that
// were in src/lib/shopify.ts so the rest of the site can call into it
// without having to know about Shopify internals.

import { SHOPIFY } from "./config.js";

export async function storefrontApiRequest(query, variables = {}) {
  const response = await fetch(SHOPIFY.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY.storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 402) {
    // Shopify billing not active — surface a friendly message but don't crash.
    const event = new CustomEvent("shopify:payment-required");
    window.dispatchEvent(event);
    return null;
  }

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Shopify error: ${data.errors.map((e) => e.message).join(", ")}`);
  }
  return data;
}

export const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      edges {
        node {
          id title description handle
          priceRange { minVariantPrice { amount currencyCode } }
          images(first: 5) { edges { node { url altText } } }
          variants(first: 25) {
            edges {
              node {
                id title
                price { amount currencyCode }
                availableForSale
                selectedOptions { name value }
              }
            }
          }
          options { name values }
        }
      }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query GetProduct($handle: String!) {
    productByHandle(handle: $handle) {
      id title description handle
      priceRange { minVariantPrice { amount currencyCode } }
      images(first: 8) { edges { node { url altText } } }
      variants(first: 50) {
        edges {
          node {
            id title
            price { amount currencyCode }
            availableForSale
            selectedOptions { name value }
          }
        }
      }
      options { name values }
    }
  }
`;

export const CART_QUERY = `query cart($id: ID!) { cart(id: $id) { id totalQuantity } }`;

export const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id checkoutUrl
        lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } }
      }
      userErrors { field message }
    }
  }`;

export const CART_LINES_ADD_MUTATION = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } }
      }
      userErrors { field message }
    }
  }`;

export const CART_LINES_UPDATE_MUTATION = `
  mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { id } userErrors { field message } }
  }`;

export const CART_LINES_REMOVE_MUTATION = `
  mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { id } userErrors { field message } }
  }`;
