// ========== content.js (works with hidden inputs) ==========
console.log("[CTH/content] loaded");

// ---------------- small utils ----------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fire = (el, type, init = {}) =>
  el?.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, ...init }));
const dispatchChange = (el) => { fire(el, "input"); fire(el, "change"); };
const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

// Wait for element utility
function waitFor(selector, { root = document, timeout = 8000, poll = 100 } = {}) {
  const found = root.querySelector(selector);
  if (found) return Promise.resolve(found);
  return new Promise((resolve, reject) => {
    const mo = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) { mo.disconnect(); resolve(el); }
    });
    mo.observe(root, { childList: true, subtree: true });
    const t = setTimeout(() => { mo.disconnect(); reject(new Error("timeout")); }, timeout);
    (async function p() {
      for (let i = 0; i < timeout / poll; i++) {
        const el = root.querySelector(selector);
        if (el) { clearTimeout(t); mo.disconnect(); return resolve(el); }
        await sleep(poll);
      }
    })();
  });
}

// ---------------- select helpers (yours) ----------------
function dispatchSelectEvents(sel) { dispatchChange(sel); }

function selectOptionByText(selectEl, targetText) {
  const t = norm(targetText);
  const opts = Array.from(selectEl?.options || []);
  const found = opts.find(o => norm(o.textContent || o.label) === t);
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

// ---------------- Hadley: keep it selected ----------------
const HADLEY_ENTITY_ID = "1748";

function hadleyRadio() {
  return (
    document.querySelector(`input[type="radio"][name="answers[gensec][location]"][value="${HADLEY_ENTITY_ID}"]`) ||
    Array.from(document.querySelectorAll('input[type="radio"][name="answers[gensec][location]"]'))
      .find(r => r.value === HADLEY_ENTITY_ID || /hadley\s+village/i.test(r.closest("label")?.textContent || ""))
  );
}

function selectHadleyOnce() {
  const r = hadleyRadio();
  if (!r) return false;
  const lbl = document.querySelector(`label[for="${r.id}"]`) || r.closest("label");
  if (lbl) lbl.click();
  if (!r.checked) { r.checked = true; dispatchSelectEvents(r); }
  return r.checked;
}

function keepHadleySelected(ms = 12000) {
  const end = Date.now() + ms;
  (async () => {
    for (let i = 0; i < 30 && Date.now() < end; i++) {
      if (selectHadleyOnce()) break;
      await sleep(150);
    }
  })();
  const mo = new MutationObserver(() => {
    const r = hadleyRadio();
    if (!r || !r.checked) selectHadleyOnce();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), ms);
}

// ---------------- Dates ----------------
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

// ---------------- Resident Name (deterministic via hidden inputs) ----------------
const STUDENT_QID = 1769;

// Find the resident question subtree (beneath ParaPro)
function residentRoot() {
  return (
    document.getElementById("questions_new270026921_1769_data") ||
    document.querySelector('div[id^="questions_"][id*="_1769_"][id$="_data"]') || // flexible
    document.querySelector('.question-type--student') || // generic fallback
    document
  );
}

// Find the two critical hidden inputs in that row
function residentHiddenId(root = residentRoot()) {
  return root.querySelector('input[type="hidden"].student-field-value-hidden[name$="[1769][data]"], input[type="hidden"][name$="[1769][data]"]');
}
function residentSelectedFlag(root = residentRoot()) {
  return root.querySelector('input[type="hidden"].student_selected') || root.querySelector('input[type="hidden"][name$="[selected]"]');
}

// Visible bits (best-effort cosmetic update)
function residentSearchInput(root = residentRoot()) {
  return root.querySelector('.student-select-search-bar input[type="text"][aria-label="Search people"][placeholder="Search people"]')
      || root.querySelector('.student-select-search-bar input[type="text"]');
}
function residentDisplayContainer(root = residentRoot()) {
  return root.querySelector('.student-selected-container') || root.querySelector('#questions_new270026921_1769_data');
}
function clearWarning(root = residentRoot()) {
  const warn = root.querySelector('.alert.alert-warning');
  if (warn) warn.style.display = 'none';
}

// Pull search URL from data-context (authoritative)
function getStudentSearchUrlFromContext() {
  try {
    const table = document.querySelector('table.form_table.ereztable.form-display');
    const raw = table?.getAttribute("data-context");
    if (!raw) return null;
    const ctx = JSON.parse(raw);
    const stack = [ctx];
    while (stack.length) {
      const cur = stack.pop();
      if (cur && typeof cur === "object") {
        if (cur.component === "StudentQuestion" && (cur.question_id === STUDENT_QID)) {
          return cur.component_props?.search_url || null;
        }
        for (const k in cur) {
          const v = cur[k];
          if (Array.isArray(v)) v.forEach(x => stack.push(x));
          else if (v && typeof v === "object") stack.push(v);
        }
      }
    }
  } catch (e) {
    console.warn("[CTH/content] data-context parse failed", e);
  }
  return null;
}

function buildStudentSearchUrls(query) {
  const base = getStudentSearchUrlFromContext() || "/reslife/student-select/?question_id=1769";
  const sep = base.includes("?") ? "&" : "?";
  return [
    `${base}${sep}term=${encodeURIComponent(query)}`,
    `${base}${sep}q=${encodeURIComponent(query)}`
  ];
}

// Normalize API results to {id, text}
function toIdTextList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    const id =
      item.id ?? item.value ?? item.pk ?? item.user_id ?? item.person_id ?? item.student_id ??
      (typeof item.value === "object" ? item.value?.id : undefined);
    const text =
      item.text ?? item.label ?? item.name ?? item.display ?? item.full_name ??
      (typeof item.value === "string" ? item.value : "");
    return (id != null && text) ? { id: String(id), text: String(text) } : null;
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
      if (list.length) return list;
    } catch (e) {
      console.warn("[CTH/content] fetch student failed", url, e);
    }
  }
  return [];
}

function pickBest(results, query) {
  const q = norm(query);
  return (
    results.find(r => norm(r.text) === q) ||
    results.find(r => norm(r.text).startsWith(q)) ||
    results.find(r => norm(r.text).includes(q)) ||
    results[0]
  );
}

function populateResidentFields({ id, text }) {
  const root = residentRoot();
  const hid = residentHiddenId(root);
  const flag = residentSelectedFlag(root);

  if (!hid) {
    console.warn("[CTH/content] resident hidden [1769][data] not found");
    return false;
  }

  hid.value = String(id);
  dispatchChange(hid);

  if (flag) {
    flag.value = "1";
    dispatchChange(flag);
  }

  // Cosmetic: update visible display & input
  const disp = residentDisplayContainer(root);
  if (disp && !disp.querySelector("a")) {
    const a = document.createElement("a");
    // Their links look like /person/lastname-<id>/. We don't know slug, so link to /person/<id>/ fallback:
    a.href = `/person/${id}/`;
    a.target = "_blank";
    a.textContent = text;
    disp.innerHTML = "";
    disp.appendChild(a);
  }
  const vis = residentSearchInput(root);
  if (vis) { vis.value = text; dispatchChange(vis); }

  clearWarning(root);
  console.log("[CTH/content] Resident set:", { id, text });
  return true;
}

async function setResidentByName(query) {
  // ensure the question exists so hidden inputs are in DOM
  try { await waitFor('input[type="hidden"][name$="[1769][data]"]', { timeout: 8000 }); } catch {}
  const results = await fetchStudentResults(query);
  if (!results.length) return { ok: false, reason: "no_results" };
  const best = pickBest(results, query);
  const ok = populateResidentFields(best);
  return ok ? { ok: true, id: best.id, label: best.text } : { ok: false, reason: "populate_failed" };
}

// ---------------- existing features ----------------
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

// ---------------- boot ----------------
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

// ---------------- message bridge ----------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg?.type === "PICK_NAME") {
      setResidentByName(msg.name).then(res => sendResponse?.(res));
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
