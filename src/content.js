// ========== content.js ==========
console.log("[CTH/content] loaded");

// ---------- small utils ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fire = (el, type, init = {}) =>
  el?.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, ...init }));
const key = (el, type, k, code = k) =>
  el?.dispatchEvent(new KeyboardEvent(type, { key: k, code, bubbles: true, cancelable: true }));
const normalize = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return !!(el.offsetParent || el.getClientRects().length) && rect.width >= 1 && rect.height >= 1;
}

function clickLikeHuman(el) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = r.left + Math.max(6, Math.min(r.width - 6, r.width / 2));
  const y = r.top + Math.max(6, Math.min(r.height - 6, r.height / 2));
  for (const t of ["pointerdown", "mousedown", "mouseup", "click"]) {
    el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }
}

// ---------- your existing select helpers ----------
function dispatchSelectEvents(el) { fire(el, "input"); fire(el, "change"); }

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

// ---------- Hadley: keep it selected ----------
const HADLEY_ENTITY_ID = "1748";

function findHadleyRadio() {
  return (
    document.querySelector(`input[type="radio"][name="answers[gensec][location]"][value="${HADLEY_ENTITY_ID}"]`) ||
    Array.from(document.querySelectorAll('input[type="radio"][name="answers[gensec][location]"]'))
      .find(r => r.value === HADLEY_ENTITY_ID || /hadley\s+village/i.test(r.closest("label")?.textContent || ""))
  );
}

function trySelectHadley() {
  const radio = findHadleyRadio();
  if (!radio) return false;
  // Prefer clicking the label so the site’s JS runs
  const label = document.querySelector(`label[for="${radio.id}"]`) || radio.closest("label") || radio;
  if (!radio.checked) {
    label && clickLikeHuman(label);
  }
  if (!radio.checked) {
    radio.checked = true;
    dispatchSelectEvents(radio);
  }
  return radio.checked;
}

function keepHadleySelected(durationMs = 15000) {
  const end = Date.now() + durationMs;

  // Initial burst of attempts
  (async () => {
    for (let i = 0; i < 25 && Date.now() < end; i++) {
      if (trySelectHadley()) break;
      await sleep(200);
    }
  })();

  // Watch whole doc for re-renders for a while
  const mo = new MutationObserver(() => {
    const r = findHadleyRadio();
    if (!r || !r.checked) trySelectHadley();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), durationMs);
}

// ---------- Dates ----------
function setDateRangeISO(fromISO, toISO) {
  const from = document.querySelector('input[name="answers[gensec][form_date][from]"]');
  const to   = document.querySelector('input[name="answers[gensec][form_date][to]"]');
  let ok = true;

  if (from) {
    from.value = fromISO;
    if ("valueAsDate" in from) { const d = new Date(fromISO + "T00:00:00"); if (!isNaN(d)) from.valueAsDate = d; }
    dispatchSelectEvents(from);
  } else { ok = false; }

  if (to) {
    to.value = toISO;
    if ("valueAsDate" in to) { const d2 = new Date(toISO + "T00:00:00"); if (!isNaN(d2)) to.valueAsDate = d2; }
    dispatchSelectEvents(to);
  } else { ok = false; }

  console.log("[CTH/content] setDateRangeISO:", { fromISO, toISO, ok });
  return ok;
}

// ---------- Resident Name (the one under ParaPro) ----------
function findResidentQuestionRoot() {
  // Prefer the question id container if present, else fallback to the first student-select near the ParaPro question block
  return (
    document.getElementById("questions_new270026921_1769_data") ||
    document.querySelector('div[id^="questions_"][id*="_1769_"][id$="_data"]') ||
    document.querySelector('.student-select-search-bar')?.closest('[id^="questions_"]') ||
    null
  );
}

function findResidentSearchInput() {
  const root = findResidentQuestionRoot();
  // Exact class & attributes you provided:
  const precise = root?.querySelector('.student-select-search-bar input[type="text"][aria-label="Search people"][placeholder="Search people"]');
  if (precise) return precise;

  // Fallbacks (still scoped to the resident question if we found it)
  return (
    root?.querySelector('.student-select-search-bar input[type="text"]') ||
    root?.querySelector('input[type="text"][aria-label*="Search people" i]') ||
    root?.querySelector('input[type="text"][placeholder*="Search people" i]') ||
    // global last resort
    document.querySelector('.student-select-search-bar input[type="text"][aria-label="Search people"][placeholder="Search people"]') ||
    document.querySelector('.student-select-search-bar input[type="text"]') ||
    null
  );
}

// Find suggestion items *near* the resident field (local first, global fallback)
function getResidentSuggestionItems(root) {
  const queries = [
    // ARIA listbox + options (most robust)
    'ul[role="listbox"] li[role="option"]',
    'ul[role="listbox"] li',
    // common libraries / house classes
    '.student-select-results li',
    '.student-select-results .result',
    '.student-select__results li',
    '.ui-autocomplete li',
    '.ui-menu-item',
    '.select2-results__option',
    '.dropdown-menu li',
    '[role="option"]',
    '.autocomplete-suggestion'
  ];

  // local search inside root/question first
  for (const q of queries) {
    const items = Array.from(root.querySelectorAll(q)).filter(isVisible);
    if (items.length) return items;
  }
  // global fallback
  for (const q of queries) {
    const items = Array.from(document.querySelectorAll(q)).filter(isVisible);
    if (items.length) return items;
  }
  return [];
}

function getResidentHiddenInput(root) {
  return (
    root.querySelector('input[type="hidden"][name*="[1769][data]"]') ||
    root.querySelector('input[type="hidden"][name$="[1769][data]"]') ||
    null
  );
}

async function setResidentName(query, timeoutMs = 5000) {
  const root = findResidentQuestionRoot();
  const input = findResidentSearchInput();
  if (!root || !input) {
    console.warn("[CTH/content] Resident field not found (root or input missing)");
    return { ok: false, reason: "input_not_found" };
  }

  // Focus + type (ensure site handlers fire)
  input.focus();
  input.value = query;
  fire(input, "input"); fire(input, "change");
  // Wake up listeners
  key(input, "keydown", "a", "KeyA"); key(input, "keyup", "a", "KeyA");

  const want = normalize(query);
  const start = performance.now();
  let committed = false;

  while (performance.now() - start < timeoutMs) {
    // Try clicking a visible suggestion near this control
    const items = getResidentSuggestionItems(root);
    if (items.length) {
      let choice =
        items.find(el => normalize(el.textContent) === want) ||
        items.find(el => normalize(el.textContent).startsWith(want)) ||
        items.find(el => normalize(el.textContent).includes(want)) ||
        items[0];

      if (choice) {
        choice.scrollIntoView({ block: "center", inline: "nearest" });
        clickLikeHuman(choice);
        // Also press Enter on input in case the widget expects commit via keyboard
        key(input, "keydown", "Enter", "Enter");
        key(input, "keyup", "Enter", "Enter");
        fire(input, "input"); fire(input, "change");
      }
    } else {
      // No items yet — nudge with ArrowDown/Enter to open/commit first result
      key(input, "keydown", "ArrowDown", "ArrowDown");
      key(input, "keyup", "ArrowDown", "ArrowDown");
      key(input, "keydown", "Enter", "Enter");
      key(input, "keyup", "Enter", "Enter");
      fire(input, "input"); fire(input, "change");
    }

    // Check hidden input value (ideal confirmation)
    const hid = getResidentHiddenInput(root);
    if (hid && hid.value && String(hid.value).trim() !== "" && String(hid.value) !== "0") {
      committed = true;
      break;
    }

    // Heuristic: value changed (widget sometimes replaces input value with chosen name)
    if (normalize(input.value) !== want || document.activeElement !== input) {
      committed = true;
      break;
    }

    await sleep(140);
  }

  console.log("[CTH/content] resident pick:", { query, committed });
  return { ok: committed };
}

// ---------- existing features ----------
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
  setTimeout(() => {
    keepHadleySelected(15000);  // keep reapplying for a while
    pickMyNameIfEnabled();
  }, 350);
}
bootOnce();

// ---------- message bridge ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg?.type === "PICK_NAME") {
      setResidentName(msg.name).then(res => sendResponse?.(res));
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
      keepHadleySelected(12000);
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
