// Quote form logic. Direct port of src/pages/Quote.tsx — same fields, same
// validation, same Supabase insert + storage upload, same success state.
// Falls back to a mailto: link with the form contents if Supabase fails.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?bundle";
import { SUPABASE, CONTACT } from "./config.js";
import { showToast } from "./ui.js";

const supabase = createClient(SUPABASE.url, SUPABASE.anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_FILES = 8;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const state = {
  files: [],
  submitting: false,
};

function validate(form) {
  const errors = [];
  if (!form.name) errors.push("Name is required");
  else if (form.name.length > 100) errors.push("Name is too long");

  if (!form.email) errors.push("Email is required");
  else if (form.email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.push("Invalid email");

  if (!form.category) errors.push("Select a category");

  if (!form.message || form.message.length < 10) errors.push("Tell us a little more");
  else if (form.message.length > 2000) errors.push("Message is too long");

  return errors;
}

function readForm() {
  const f = document.getElementById("quote-form");
  const data = new FormData(f);
  const obj = {};
  for (const [k, v] of data.entries()) obj[k] = (typeof v === "string" ? v.trim() : v);
  return obj;
}

function renderFiles() {
  const list = document.querySelector("[data-file-list]");
  if (!list) return;
  list.innerHTML = state.files
    .map((file, i) => `
      <li class="file-row">
        <span class="file-row__name">${escapeHtml(file.name)} <span class="file-row__size">(${(file.size / 1024).toFixed(0)} KB)</span></span>
        <button type="button" class="file-row__remove" data-remove-file="${i}" aria-label="Remove file">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </li>`)
    .join("");
  list.querySelectorAll("[data-remove-file]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-remove-file"), 10);
      if (Number.isFinite(idx)) {
        state.files.splice(idx, 1);
        renderFiles();
      }
    });
  });
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMailtoFallback(form) {
  const lines = [
    `Name: ${form.name}`,
    `Email: ${form.email}`,
    form.phone   ? `Phone: ${form.phone}`     : null,
    form.company ? `Company: ${form.company}` : null,
    "",
    `Category: ${form.category}`,
    form.garment_type ? `Garment: ${form.garment_type}` : null,
    form.quantity     ? `Quantity: ${form.quantity}`    : null,
    form.sizes        ? `Sizes: ${form.sizes}`          : null,
    form.deadline     ? `Deadline: ${form.deadline}`    : null,
    "",
    form.branding_method    ? `Branding method: ${form.branding_method}`       : null,
    form.branding_placement ? `Branding placement: ${form.branding_placement}` : null,
    form.branding_colors    ? `Branding colours: ${form.branding_colors}`      : null,
    "",
    "Brief:",
    form.message,
  ].filter((l) => l !== null);
  const subject = encodeURIComponent(`Quote request — ${form.name}`);
  const body = encodeURIComponent(lines.join("\n"));
  return `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
}

async function uploadFiles() {
  const urls = [];
  for (const file of state.files) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(SUPABASE.bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data: pub } = supabase.storage.from(SUPABASE.bucket).getPublicUrl(path);
    urls.push(pub.publicUrl);
  }
  return urls;
}

async function submit(e) {
  e.preventDefault();
  if (state.submitting) return;

  const form = readForm();
  const errors = validate(form);
  if (errors.length) {
    showToast(errors[0], { variant: "error" });
    return;
  }

  state.submitting = true;
  const btn = document.querySelector("[data-submit-btn]");
  if (btn) {
    btn.disabled = true;
    btn.dataset.label = btn.textContent;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spinner spinner-sm" aria-hidden="true"><line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/></svg>`;
  }

  try {
    const image_urls = await uploadFiles();
    const { error } = await supabase.from(SUPABASE.table).insert([{
      name: form.name,
      email: form.email,
      message: form.message,
      category: form.category,
      phone: form.phone || null,
      company: form.company || null,
      garment_type: form.garment_type || null,
      quantity: form.quantity || null,
      sizes: form.sizes || null,
      deadline: form.deadline || null,
      branding_method: form.branding_method || null,
      branding_placement: form.branding_placement || null,
      branding_colors: form.branding_colors || null,
      image_urls,
    }]);
    if (error) throw error;

    document.querySelector('[data-quote-stage="form"]').hidden = true;
    const success = document.querySelector('[data-quote-stage="success"]');
    if (success) {
      success.hidden = false;
      const nameEl = success.querySelector("[data-success-name]");
      const emailEl = success.querySelector("[data-success-email]");
      if (nameEl) nameEl.textContent = form.name.split(" ")[0] || form.name;
      if (emailEl) emailEl.textContent = form.email;
    }
    showToast("Quote request received", { variant: "success" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    const fallback = buildMailtoFallback(form);
    showToast("Couldn't submit online", {
      description: "Opening email instead — or WhatsApp us at 062 795 1658.",
      variant: "error",
      duration: 6000,
    });
    setTimeout(() => { window.location.href = fallback; }, 600);
  } finally {
    state.submitting = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || "Submit Quote Request";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("q-files");
  fileInput?.addEventListener("change", (e) => {
    const selected = Array.from(e.target.files || []);
    const isPdf = (f) =>
      f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    const pdfs = selected.filter(isPdf);
    if (pdfs.length < selected.length) {
      showToast("Only PDF files are allowed", { variant: "error" });
    }
    const valid = pdfs.filter((f) => f.size <= MAX_FILE_SIZE);
    if (valid.length < pdfs.length) {
      showToast("Some files exceed 10MB and were skipped", { variant: "error" });
    }
    state.files = state.files.concat(valid).slice(0, MAX_FILES);
    e.target.value = "";
    renderFiles();
  });

  document.getElementById("quote-form")?.addEventListener("submit", submit);
});
