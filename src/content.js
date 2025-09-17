// ========== content.js (deterministic resident select) ==========
console.log("[CTH/content] loaded");

// ----------------- small utils -----------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fire = (el, type, init = {}) =>
  el?.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, ...init }));
function dispatchChange(el) { fire(el, "input"); fire(el, "change"); }
const normalize = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

// Wait for an element (by selector) to appear under root (or document)
function waitForElement(selector, { root = document, timeout = 8000, pollMs = 100 } = {}) {
  const found = root.querySelector(selector);
  if (found) return Promise.resolve(found);
  return new Promise((resolve, reject) => {
    const obs = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) { obs.disconnect(); resolve(el); }
    });
    obs.observe(root, { childList: true, subtree: true });
    const t = setTimeout(() => { obs.disconnect(); reject(new Error("timeout")); }, timeout);
    (async function poll() {
      for (let i = 0; i < timeout / pollMs; i++) {
        const el = root.querySelector(selector);
        if (el) { clearTimeout(t); obs.disconnect(); return resolve(el); }
        await sleep(pollMs);
      }
    })();
  });
}

// ----------------- select helpers you had -----------------
function dispatchSelectEvents(sel) { dispatchChange(sel); }

function selectOptionByText(selectEl, targetText) {
  const t = normalize(targetText);
  const opts = Array.from(selectEl?.options || []);
  const found = opts.find(o => normalize(o.textContent || o.label) === t);
  if (!found) return false;
  selectEl.value = found.value;
  dispatchSelectEvents(selectEl);
  return true;
}

function looksLikePeopleSelect(sel) {
  const opts = Array.from(sel.options);
  if (opts.length < 5) return false;
  const hasCommaNames = opts.filter(o => (o.textContent || "").includes(",")).length >= 3;
  const hasDashSelect = opts.some(o => (o.textContent || "").toLowerCase().includes("- select"));
  return hasCommaNames || hasDashSelect;
}

function getParaProSelects() {
  const byName = document.querySelectorAll('select[name$="[1820][data]"]'); // ParaPro field
  const all = Array.from(document.querySelectorAll("select"));
  const peopleish = all.filter(looksLikePeopleSelect);
  return Array.from(new Set([...byName, ...peopleish]));
}

function getOneToFourSelects() {
  const ok = [];
  document.querySelectorAll("select").forEach(sel => {
    const texts = new Set(Array.from(sel.options).map(o => (o.textContent || "").trim()));
    const cleaned = new Set([...texts].filter(t => t && !t.toLowerCase().startsWith("- select")));
    const allowed = new Set(["1","2","3","4"]);
    if (cleaned.size > 0 && [...cleaned].every(t => allowed.has(t))) ok.push(sel);
  });
  return ok;
}

// ----------------- Hadley: keep it selected -----------------
const HADLEY_ENTITY_ID = "1748";

function findHadleyRadio() {
  return (
    document.querySelector(`input[type="radio"][name="answers[gensec][location]"][value="${HADLEY_ENTITY_ID}"]`) ||
    Array.from(document.querySelectorAll('input[type="radio"][name="answers[gensec][location]"]'))
      .find(r => r.value === HADLEY_ENTITY_ID || /hadley\s+village/i.test(r.closest("label")?.textContent || ""))
  );
}

function ensureHadley() {
  const radio = findHadleyRadio();
  if (!radio) return false;
  // Prefer clicking label so site logic runs
  const label = document.querySelector(`label[for="${radio.id}"]`) || radio.closest("label");
  if (label) label.click();
  if (!radio.checked) { radio.checked = true; dispatchSelectEvents(radio); }
  return radio.checked;
}

function keepHadleySelected(durationMs = 12000) {
  const end = Date.now() + durationMs;
  (async () => {
    for (let i = 0; i < 30 && Date.now() < end; i++) {
      if (ensureHadley()) break;
      await sleep(150);
    }
  })();
  const mo = new MutationObserver(() => {
    const r = findHadleyRadio();
    if (!r || !r.checked) ensureHadley();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), durationMs);
}

// ----------------- Dates -----------------
function setDateRangeISO(fromISO, toISO) {
  const from = document.querySelector('input[name="answers[gensec][form_date][from]"]');
  const to   = document.querySelector('input[name="answers[gensec][form_date][to]"]');
  let ok = true;

  if (from) {
    from.value = fromISO;
    if ("valueAsDate" in from) { const d = new Date(fromISO + "T00:00:00"); if (!isNaN(d)) from.valueAsDate = d; }
    dispatchSelectEvents(from);
  } else ok = false;

  if (to) {
    to.value = toISO;
    if ("valueAsDate" in to) { const d2 = new Date(toISO + "T00:00:00"); if (!isNaN(d2)) to.valueAsDate = d2; }
    dispatchSelectEvents(to);
  } else ok = false;

  console.log("[CTH/content] setDateRangeISO:", { fromISO, toISO, ok });
  return ok;
}

// ----------------- Resident Name: API-based selection -----------------
const STUDENT_QID = 1769;

// Find the Resident question block (beneath ParaPro)
function findResidentQuestionRoot() {
  return (
    document.getElementById("questions_new270026921_1769_data") ||
    document.querySelector('div[id^="questions_"][id*="_1769_"][id$="_data"]') ||
    null
  );
}

// Hidden input where the selected student ID must go
function findResidentHiddenInput() {
  return (
    document.querySelector('input[type="hidden"][name$="[1769][data]"]') ||
    document.querySelector('input[type="hidden"][name*="[1769][data]"]') ||
    null
  );
}

// Visible search input (for UX only; we will still set hidden field deterministically)
function findResidentSearchInput() {
  const root = findResidentQuestionRoot();
  return (
    root?.querySelector('.student-select-search-bar input[type="text"][aria-label="Search people"][placeholder="Search people"]') ||
    root?.querySelector('.student-select-search-bar input[type="text"]') ||
    document.querySelector('.student-select-search-bar input[type="text"][aria-label="Search people"][placeholder="Search people"]') ||
    null
  );
}

// Try to pull the search URL from the page's big data-context JSON
function getStudentSearchUrlFromContext() {
  try {
    const table = document.querySelector('table.form_table.ereztable.form-display');
    const raw = table?.getAttribute("data-context");
    if (!raw) return null;
    const ctx = JSON.parse(raw); // the browser decodes &quot; already
    // Deep search for StudentQuestion with our qid
    const stack = [ctx];
    while (stack.length) {
      const cur = stack.pop();
      if (cur && typeof cur === "object") {
        if (cur.component === "StudentQuestion" && (cur.question_id === STUDENT_QID || cur.id?.includes?.(`_${STUDENT_QID}_`))) {
          const url = cur.component_props?.search_url;
          if (url) return url;
        }
        for (const k in cur) {
          const v = cur[k];
          if (Array.isArray(v)) v.forEach(x => stack.push(x));
          else if (v && typeof v === "object") stack.push(v);
        }
      }
    }
  } catch (e) {
    console.warn("[CTH/content] cannot parse data-context for search_url:", e);
  }
  return null;
}

// Build likely search URLs
function buildStudentSearchUrls(query) {
  const fromCtx = getStudentSearchUrlFromContext(); // e.g., "/reslife/student-select/?question_id=1769"
  const base = fromCtx || "/reslife/student-select/?question_id=1769";
  const sep = base.includes("?") ? "&" : "?";
  return [
    `${base}${sep}term=${encodeURIComponent(query)}`, // jQuery UI style
    `${base}${sep}q=${encodeURIComponent(query)}`,    // select2 style
  ];
}

// Normalize various result shapes into {id, text}
function toIdTextList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    const id =
      item.id ?? item.value ?? item.pk ?? item.user_id ?? item.person_id ?? item.student_id ??
      (typeof item.value === "object" ? item.value?.id : undefined);
    const text =
      item.text ?? item.label ?? item.name ?? item.display ?? item.full_name ??
      (typeof item.value === "string" ? item.value : "");
    return id != null && text ? { id: String(id), text: String(text) } : null;
  }).filter(Boolean);
}

async function fetchStudentResults(query) {
  const urls = buildStudentSearchUrls(query);
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (!/json/i.test(ct)) continue;
      const data = await res.json();
      const list = toIdTextList(data);
      if (list.length) {
        return list;
      }
    } catch (e) {
      console.warn("[CTH/content] fetch failed", url, e);
    }
  }
  return [];
}

function pickBestMatch(results, query) {
  const want = normalize(query);
  return (
    results.find(r => normalize(r.text) === want) ||
    results.find(r => normalize(r.text).startsWith(want)) ||
    results.find(r => normalize(r.text).includes(want)) ||
    results[0]
  );
}

async function setResidentByLookup(query) {
  // Ensure the question is rendered (so the hidden input exists)
  try { await waitForElement('div[id^="questions_"][id*="_1769_"][id$="_data"]', { timeout: 8000 }); } catch {}
  const hidden = findResidentHiddenInput();
  if (!hidden) {
    console.warn("[CTH/content] hidden resident input not found");
    return { ok: false, reason: "hidden_input_missing" };
  }

  const results = await fetchStudentResults(query);
  if (!results.length) {
    console.warn("[CTH/content] no student results from API for:", query);
    return { ok: false, reason: "no_results" };
  }

  const best = pickBestMatch(results, query);
  if (!best) return { ok: false, reason: "no_match" };

  // Set the hidden id deterministically
  hidden.value = best.id;
  dispatchChange(hidden);

  // (Optional) update visible text box so it looks selected
  const vis = findResidentSearchInput();
  if (vis) { vis.value = best.text; dispatchChange(vis); }

  console.log("[CTH/content] resident set via API:", best);
  return { ok: true, id: best.id, label: best.text };
}

// ----------------- your other features -----------------
async function pickMyNameIfEnabled() {
  try {
    const { myName = "Caporuscio, James", autoMyName = true } =
      await chrome.storage.sync.get({ myName: "Caporuscio, James", autoMyName: true });
    if (!autoMyName) return;
    const sels = getParaProSelects();
    for (const sel of sels) {
      if (sel.value) continue;
      if (selectOptionByText(sel, myName)) break;
    }
  } catch (e) {
    console.error("[CTH/content] pickMyNameIfEnabled error:", e);
  }
}

function parseSequence(seqStr) {
  return Array.from(seqStr || "").filter(ch => /[1-4]/.test(ch)).map(d => Number(d));
}

function fillSequence(seqStr) {
  const nums = parseSequence(seqStr);
  if (!nums.length) return { filled: 0, total: 0 };
  const selects = getOneToFourSelects();
  let filled = 0;
  for (let i = 0; i < selects.length && i < nums.length; i++) {
    const sel = selects[i];
    const want = String(nums[i]);
    const opt = Array.from(sel.options).find(o => (o.textContent || "").trim() === want);
    if (opt) { sel.value = opt.value; dispatchSelectEvents(sel); filled++; }
  }
  return { filled, total: Math.min(selects.length, nums.length) };
}

// Save button with fallbacks
function clickSaveButton() {
  const btn = document.querySelector(
    '#submit_form, button#submit_form, button[name="save"], button[type="submit"], input[type="submit"]'
  );
  if (btn) { btn.click(); return { ok: true, method: "button" }; }
  const form = document.querySelector('form#incident_form, form[action*="FormView"], form');
  if (form) { form.submit(); return { ok: true, method: "form.submit" }; }
  return { ok: false, reason: "not_found" };
}

// ----------------- boot -----------------
let booted = false;
function bootOnce() {
  if (booted) return;
  booted = true;
  setTimeout(() => {
    keepHadleySelected(12000);
    pickMyNameIfEnabled();
  }, 350);
}
bootOnce();

// ----------------- message bridge -----------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg?.type === "PICK_NAME") {
      // Deterministic: query API and set hidden id
      setResidentByLookup(msg.name).then(res => sendResponse?.(res));
      return true; // async

    } else if (msg?.type === "FILL_SEQUENCE") {
      sendResponse?.(fillSequence(msg.seq)); return false;

    } else if (msg?.type === "SAVE_FORM") {
      sendResponse?.(clickSaveButton()); return false;

    } else if (msg?.type === "SET_DATE") {
      const from = msg.from || msg.date;
      const to   = msg.to   || msg.date || msg.from;
      sendResponse?.({ ok: setDateRangeISO(from, to || from) });
      return false;

    } else if (msg?.type === "RUN_FILL") {
      pickMyNameIfEnabled();
      keepHadleySelected(8000);
      sendResponse?.({ ok: true });
      return false;
    }
  } catch (e) {
    console.error("[CTH/content] handler error:", e);
    sendResponse?.({ ok: false, error: String(e) });
    return false;
  }
  return false;
});
