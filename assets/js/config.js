// One-stop config. Edit these values to point the site at a different
// Shopify store, Supabase project or contact channel. All values are
// already client-side in the original Lovable build, so this is no
// security regression.

export const SHOPIFY = {
  domain: "ura10d-2g.myshopify.com",
  apiVersion: "2025-07",
  storefrontToken: "945880933acfdc6c95977d8b1f3a734f",
};
SHOPIFY.endpoint = `https://${SHOPIFY.domain}/api/${SHOPIFY.apiVersion}/graphql.json`;

export const SUPABASE = {
  url: "https://csaifavswftfemdcuiev.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYWlmYXZzd2Z0ZmVtZGN1aWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTkyNDEsImV4cCI6MjA5Mjg5NTI0MX0.1W4vu5dCi4QDRnfo9XQ0kCMHiDzHeEsmcjhtplmGOKA",
  bucket: "quote-uploads",
  table: "quote_requests",
};

export const CONTACT = {
  email: "info@snazzyboysignature.co.za",
  phoneDisplay: "062 795 1658",
  phoneTel: "+27627951658",
  whatsApp: "https://wa.me/27627951658",
};
