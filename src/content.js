// ========== DEBUG ==========
console.log("[CTH/content] loaded");

// ---------- tiny event utils ----------
const fire = (el, type, opts = {}) =>
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, ...opts }));
const key = (el, type, k, code = k) =>
  el.dispatchEvent(new KeyboardEvent(type, { key: k, code, bubbles: true }));
const clickLikeHuman = (el) => {
  const r = el.getBoundingClientRect();
  const cx = r.left + Math.min(5, Math.max(1, r.width / 2));
  const cy = r.top + Math.min(5, Math.max(1, r.height / 2));
  for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: cx, clientY: cy }));
  }
};
const dispatchChange = (el) => { fire(el, "input"); fire(el, "change"); };

// ---------- helpers you already use ----------
function dispatchSelectEvents(el) { dispatchChange(el); }
function selectOptionByText(selectEl, targetText) {
  const t = (targetText || "").trim().toLowerCase();
  const opts = Array.from(selectEl?.options || []);
  const found = opts.find(o => (o.textContent || o.label || "").trim().toLowerCase() === t);
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
  const byName = document.querySelectorAll('select[name$="[1820][data]"]');
  const all = Array.from(document.querySelectorAll("select"));
  const peopleish = all.filter(looksLikePeopleSelect);
  return Array.from(new Set([...byName, ...peopleish]));
}
function getOneToFourSelects() {
  const ok = [];
  document.querySelectorAll("select").forEach(sel => {
    const texts = new Set(Array.from(sel.options).map(o => (o.textContent || "").trim()));
    const cleaned = new Set([...texts].filter(t => t && !t.toLowerCase().startsWith("- select")));
    const allowed = new Set(["1", "2", "3", "4"]);
    if (cleaned.size > 0 && [...cleaned].every(t => allowed.has(t))) ok.push(sel);
  });
  return ok;
}

// ---------- Residence: make it STICK to Hadley ----------
const HADLEY_ENTITY_ID = "1748";

function findHadleyRadio() {
  return (
    document.querySelector(`input[type="radio"][name="answers[gensec][location]"][value="${HADLEY_ENTITY_ID}"]`) ||
    Array.from(document.querySelectorAll('input[type="radio"][name="answers[gensec][location]"]'))
      .find(r => r.value === HADLEY_ENTITY_ID || /hadley\s+village/i.test(r.closest("label")?.textContent || ""))
  );
}

function forceSelectHadley() {
  const radio = findHadleyRadio();
  if (!radio) return false;

  const label = document.querySelector(`label[for="${radio.id}"]`) || radio.closest("label") || radio;
  if (!radio.checked) {
    label.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    clickLikeHuman(label); // trigger their handlers
  }
  // Some UIs need an explicit change after click
  if (!radio.checked) {
    radio.checked = true;
    dispatchChange(radio);
  }
  return radio.checked;
}

// keep trying for a few seconds and also on DOM mutations
function stickyHadley(seconds = 6) {
  const end = Date.now() + seconds * 1000;
  let stableMs = 0;
  const trySet = () => {
    const ok = forceSelectHadley();
    if (ok) stableMs += 200;
    if (Date.now() < end && stableMs < 1200) setTimeout(trySet, 200);
  };
  trySet();

  // Re-apply if radios re-render
  const mo = new MutationObserver(() => {
    const r = findHadleyRadio();
    if (!r || !r.checked) forceSelectHadley();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  // stop after some time to avoid infinite observing
  setTimeout(() => mo.disconnect(), seconds * 1000);
}

// ---------- Dates ----------
function setDateRangeISO(fromISO, toISO) {
  const from = document.querySelector('input[name="answers[gensec][form_date][from]"]');
  const to   = document.querySelector('input[name="answers[gensec][form_date][to]"]');
  let ok = true;

  if (from) {
    from.value = fromISO;
    if ("valueAsDate" in from) { const d = new Date(fromISO + "T00:00:00"); if (!isNaN(d)) from.valueAsDate = d; }
    dispatchChange(from);
  } else { ok = false; }

  if (to) {
    to.value = toISO;
    if ("valueAsDate" in to) { const d2 = new Date(toISO + "T00:00:00"); if (!isNaN(d2)) to.valueAsDate = d2; }
    dispatchChange(to);
  } else { ok = false; }

  return ok;
}

// ---------- NEW: Resident Name autocomplete ----------
function findResidentInput() {
  // Most specific first, then ARIA/placeholder fallbacks
  return (
    document.querySelector('input[name$="[1769][data]"]') ||         // StudentQuestion text input
    document.querySelector('#questions_new270026921_1769_data input[type="text"]') ||
    document.querySelector('input[role="combobox"][aria-label*="Resident" i]') ||
    document.querySelector('input[placeholder*="Resident" i]') ||
    document.querySelector('input[aria-label*="Student" i]') ||
    null
  );
}

const RES_OPT_QUERIES = [
  'ul[role="listbox"] li[role="option"]',
  'ul[role="listbox"] li',
  '.ui-autocomplete li',
  '.ui-menu-item',
  '.tt-menu .tt-suggestion',
  '.dropdown-menu li',
  '[role="option"]',
  '.autocomplete-suggestion'
];
const normalize = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

function visibleOptions() {
  for (const q of RES_OPT_QUERIES) {
    const items = Array.from(document.querySelectorAll(q)).filter(el => el.offsetParent !== null);
    if (items.length) return items;
  }
  return [];
}

// Tip for the user in case it helps:
const NAME_TIP = "Use 'Last, First' (e.g., 'Doe, Jane'). Partial last name works too.";

// Type query, wait for list, click best match
async function setResidentName(query, timeoutMs = 4000) {
  const input = findResidentInput();
  if (!input) {
    console.warn("[CTH/content] Resident input not found");
    return { ok: false, reason: "input_not_found", tip: NAME_TIP };
  }

  // Focus and type the query
  input.focus();
  input.value = query;
  dispatchChange(input);
  key(input, "keydown", "a", "KeyA"); key(input, "keyup", "a", "KeyA"); // wake listeners

  const want = normalize(query);
  const start = performance.now();

  while (performance.now() - start < timeoutMs) {
    const items = visibleOptions();
    if (items.length) {
      // exact (case-insensitive) → startsWith → contains → first
      let choice =
        items.find(li => normalize(li.textContent) === want) ||
        items.find(li => normalize(li.textContent).startsWith(want)) ||
        items.find(li => normalize(li.textContent).includes(want)) ||
        items[0];

      if (choice) {
        choice.scrollIntoView({ block: "center", inline: "nearest" });
        clickLikeHuman(choice);
        // confirm for combobox components that want Enter on input
        key(input, "keydown", "Enter", "Enter");
        key(input, "keyup", "Enter", "Enter");
        dispatchChange(input);
        return { ok: true, chosen: (choice.textContent || "").trim() };
      }
    }
    await new Promise(r => setTimeout(r, 120));
  }

  return { ok: false, reason: "no_suggestions", tip: NAME_TIP };
}

// ---------- your existing automations ----------
async function pickMyNameIfEnabled() {
  try {
    const { myName = "Caporuscio, James", autoMyName = true } =
      await chrome.storage.sync.get({ myName: "Caporuscio, James", autoMyName: true });

    if (!autoMyName) return;

    const sels = getParaProSelects();
    for (const sel of sels) {
      if (sel.value) continue;
      if (selectOptionByText(sel, myName)) { break; }
    }
  } catch (e) { console.error("[CTH/content] pickMyNameIfEnabled error:", e); }
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

// ---------- Save button with fallbacks ----------
function clickSaveButton() {
  const btn = document.querySelector(
    '#submit_form, button#submit_form, button[name="save"], button[type="submit"], input[type="submit"]'
  );
  if (btn) { clickLikeHuman(btn); return { ok: true, method: "button" }; }
  const form = document.querySelector('form#incident_form, form[action*="FormView"], form');
  if (form) { form.submit(); return { ok: true, method: "form.submit" }; }
  return { ok: false, reason: "not_found" };
}

// ---------- boot ----------
let booted = false;
function bootOnce() {
  if (booted) return;
  booted = true;
  // Give their JS a moment to render, then keep Hadley sticky for a bit
  setTimeout(() => {
    stickyHadley(8);
    pickMyNameIfEnabled();
  }, 300);
}
bootOnce();

// ---------- message bridge ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg?.type === "PICK_NAME") {
      // Try ParaPro selects first; if not, use Resident autocomplete
      const sels = getParaProSelects();
      let ok = false;
      for (const sel of sels) { if (selectOptionByText(sel, msg.name)) { ok = true; break; } }
      if (ok) { sendResponse?.({ ok: true, via: "select" }); return false; }

      // Autocomplete is async
      setResidentName(msg.name).then(res => sendResponse?.(res));
      return true; // async

    } else if (msg?.type === "FILL_SEQUENCE") {
      sendResponse?.(fillSequence(msg.seq)); return false;

    } else if (msg?.type === "SAVE_FORM") {
      sendResponse?.(clickSaveButton()); return false;

    } else if (msg?.type === "SET_DATE") {
      sendResponse?.({ ok: setDateRangeISO(msg.from, msg.to || msg.from) }); return false;

    } else if (msg?.type === "RUN_FILL") {
      pickMyNameIfEnabled(); sendResponse?.({ ok: true }); return false;
    }
  } catch (e) {
    console.error("[CTH/content] handler error:", e);
    sendResponse?.({ ok: false, error: String(e) });
    return false;
  }
  return false;
});
