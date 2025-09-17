// ========== content.js (CTH) ==========
console.log("[CTH/content] loaded");

// ---------- tiny utils ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fire = (el, type, init = {}) =>
  el?.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, ...init }));
const key = (el, type, k, code = k) =>
  el?.dispatchEvent(new KeyboardEvent(type, { key: k, code, bubbles: true, cancelable: true }));
const clickLikeHuman = (el) => {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = r.left + Math.min(Math.max(4, r.width / 2), r.width - 4);
  const y = r.top + Math.min(Math.max(4, r.height / 2), r.height - 4);
  for (const t of ["pointerdown", "mousedown", "mouseup", "click"]) {
    el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }
};
const normalize = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

// Generic element waiter (scoped)
function waitForElement(selector, { root = document, timeout = 6000, pollMs = 100 } = {}) {
  const found = root.querySelector(selector);
  if (found) return Promise.resolve(found);
  return new Promise((resolve, reject) => {
    const obs = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) { obs.disconnect(); resolve(el); }
    });
    obs.observe(root, { subtree: true, childList: true });
    const t = setTimeout(() => { obs.disconnect(); reject(new Error("timeout")); }, timeout);
    // also poll in case mutations are throttled
    (async function poll() {
      for (let i = 0; i < timeout / pollMs; i++) {
        const el = root.querySelector(selector);
        if (el) { clearTimeout(t); obs.disconnect(); return resolve(el); }
        await sleep(pollMs);
      }
    })();
  });
}

// ---------- select helpers (original logic) ----------
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
  const byName = document.querySelectorAll('select[name$="[1820][data]"]'); // ParaPro
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

// ---------- Auto-select Hadley (sticky) ----------
const HADLEY_ENTITY_ID = "1748"; // Hadley Village (from page data)

function findResidenceContainer() {
  // ID from page dump; fallback to nearest table row containing the question label
  return document.getElementById("gensec_location") ||
         document.querySelector('[name="answers[gensec][location]"]')?.closest("table,fieldset,div") ||
         document;
}

function findHadleyRadio(container = document) {
  return (
    container.querySelector(`input[type="radio"][name="answers[gensec][location]"][value="${HADLEY_ENTITY_ID}"]`) ||
    Array.from(container.querySelectorAll('input[type="radio"][name="answers[gensec][location]"]'))
      .find(r => r.value === HADLEY_ENTITY_ID || /hadley\s+village/i.test(r.closest("label")?.textContent || ""))
  );
}

async function stickHadley({ durationMs = 8000, root = null } = {}) {
  const container = root || findResidenceContainer();
  try {
    // Wait for the radios to actually exist
    await waitForElement('input[type="radio"][name="answers[gensec][location]"]', { root: container, timeout: 8000 });
  } catch {}
  const until = Date.now() + durationMs;

  const trySet = () => {
    const radio = findHadleyRadio(container);
    if (!radio) return false;
    const label = document.querySelector(`label[for="${radio.id}"]`) || radio.closest("label") || radio;
    if (!radio.checked) {
      // Click label to trigger framework handlers
      label && clickLikeHuman(label);
      // Safety net: ensure checked + change
      if (!radio.checked) { radio.checked = true; dispatchSelectEvents(radio); }
    }
    return radio.checked;
  };

  // initial attempts with small backoff
  let ok = false;
  for (let i = 0; i < 10 && Date.now() < until; i++) {
    ok = trySet();
    if (ok) break;
    await sleep(150);
  }

  // Watch for re-renders within the window and re-apply if needed
  const mo = new MutationObserver(() => {
    const r = findHadleyRadio(container);
    if (!r || !r.checked) trySet();
  });
  mo.observe(container === document ? document.documentElement : container, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), durationMs);

  console.log("[CTH/content] Hadley selected:", ok);
  return ok;
}

// ---------- Date range setter ----------
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

// ---------- Resident Name (beneath ParaPro, qid: 1769) ----------
function findResidentQuestionRoot() {
  // Exact id from your dump, plus a flexible fallback that matches *_1769_*_data
  return (
    document.getElementById("questions_new270026921_1769_data") ||
    document.querySelector('div[id^="questions_"][id*="_1769_"][id$="_data"]') ||
    null
  );
}

function findResidentInput() {
  const root = findResidentQuestionRoot();
  if (!root) return null;
  return (
    // typical text input
    root.querySelector('input[type="text"]') ||
    // ARIA combobox flavors
    root.querySelector('input[role="combobox"]') ||
    root.querySelector('input[aria-autocomplete]') ||
    // any input inside the question row
    root.querySelector("input")
  );
}

function visibleOptionsNear(root) {
  // search *near the question root* first, then global fallback
  const NEAR_QUERIES = [
    'ul[role="listbox"] li[role="option"]',
    'ul[role="listbox"] li',
    '.ui-autocomplete li',
    '.ui-menu-item',
    '.select2-results__option',
    '.dropdown-menu li',
    '[role="option"]',
    '.autocomplete-suggestion'
  ];
  for (const q of NEAR_QUERIES) {
    const within = Array.from(root.querySelectorAll(q)).filter(el => el.offsetParent !== null);
    if (within.length) return within;
  }
  // global fallback if the widget renders the list outside of the question subtree
  for (const q of NEAR_QUERIES) {
    const global = Array.from(document.querySelectorAll(q)).filter(el => el.offsetParent !== null);
    if (global.length) return global;
  }
  return [];
}

async function setResidentName(query, timeoutMs = 5000) {
  const root = findResidentQuestionRoot();
  const input = findResidentInput();
  if (!root || !input) {
    console.warn("[CTH/content] Resident field not found near qid 1769");
    return { ok: false, reason: "input_not_found" };
  }

  // Focus + type
  input.focus();
  input.value = query;
  fire(input, "input"); fire(input, "change");
  // nudge listeners
  key(input, "keydown", "a", "KeyA"); key(input, "keyup", "a", "KeyA");

  const want = normalize(query);
  const start = performance.now();

  while (performance.now() - start < timeoutMs) {
    // Prefer clicking a visible suggestion close to the question
    const items = visibleOptionsNear(root);
    if (items.length) {
      let choice =
        items.find(el => normalize(el.textContent) === want) ||
        items.find(el => normalize(el.textContent).startsWith(want)) ||
        items.find(el => normalize(el.textContent).includes(want)) ||
        items[0];
      if (choice) {
        choice.scrollIntoView({ block: "center", inline: "nearest" });
        clickLikeHuman(choice);
        // some widgets need Enter on input to commit
        key(input, "keydown", "Enter", "Enter");
        key(input, "keyup", "Enter", "Enter");
        fire(input, "input"); fire(input, "change");
        return { ok: true, via: "list", chosen: (choice.textContent || "").trim() };
      }
    }

    // Keyboard-first fallback (works on many ARIA comboboxes)
    key(input, "keydown", "ArrowDown", "ArrowDown");
    key(input, "keyup", "ArrowDown", "ArrowDown");
    key(input, "keydown", "Enter", "Enter");
    key(input, "keyup", "Enter", "Enter");
    fire(input, "input"); fire(input, "change");

    // Heuristic: if input value changed or focus moved, consider it committed
    if (document.activeElement !== input || normalize(input.value) !== normalize(query)) {
      return { ok: true, via: "kbd", value: input.value };
    }

    await sleep(120);
  }

  console.warn("[CTH/content] Resident selection did not commit");
  return { ok: false, reason: "no_commit" };
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
  // Give the site time to render, then keep Hadley sticky for a bit
  setTimeout(() => {
    stickHadley({ durationMs: 9000 });
    pickMyNameIfEnabled();
  }, 350);
}
bootOnce();

// ---------- bridge ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg?.type === "PICK_NAME") {
      // Prefer the Resident field under ParaPro first
      setResidentName(msg.name).then(res => {
        if (res?.ok) return sendResponse?.(res);
        // fallback: try ParaPro selects if resident field wasn't found/committed
        const sels = getParaProSelects();
        for (const sel of sels) { if (selectOptionByText(sel, msg.name)) return sendResponse?.({ ok: true, via: "select" }); }
        sendResponse?.({ ok: false });
      });
      return true; // async

    } else if (msg?.type === "FILL_SEQUENCE") {
      sendResponse?.(fillSequence(msg.seq)); return false;

    } else if (msg?.type === "SAVE_FORM") {
      sendResponse?.(clickSaveButton()); return false;

    } else if (msg?.type === "SET_DATE") {
      // Accept either {from,to} or {date}
      const from = msg.from || msg.date;
      const to   = msg.to   || msg.date || msg.from;
      sendResponse?.({ ok: setDateRangeISO(from, to || from) });
      return false;

    } else if (msg?.type === "RUN_FILL") {
      pickMyNameIfEnabled();
      stickHadley({ durationMs: 6000 });
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
