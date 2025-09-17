// ========== DEBUG ==========
console.log("[CTH/content] loaded");

// ---------- event helpers ----------
function fire(el, type) {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
}
function dispatchSelectEvents(el) {
  fire(el, "input");
  fire(el, "change");
}
function dispatchInputChange(el) {
  fire(el, "input");
  fire(el, "change");
}
function key(el, type, key, code) {
  el.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true }));
}

// ---------- people-select helpers (ParaPro) ----------
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
  const byName = document.querySelectorAll('select[name$="[1820][data]"]'); // ParaPro field
  const all = Array.from(document.querySelectorAll("select"));
  const peopleish = all.filter(looksLikePeopleSelect);
  const set = new Set([...byName, ...peopleish]);
  return Array.from(set);
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

// ---------- Residence + Dates ----------
const HADLEY_ENTITY_ID = "1748"; // Hadley Village

function setResidenceHadley() {
  const radio =
    document.querySelector(`input[type="radio"][name="answers[gensec][location]"][value="${HADLEY_ENTITY_ID}"]`) ||
    Array.from(document.querySelectorAll('input[type="radio"][name="answers[gensec][location]"]'))
      .find(r => (r.value === HADLEY_ENTITY_ID || /hadley\s+village/i.test(r.closest("label")?.textContent || "")));

  if (!radio) {
    console.warn("[CTH/content] Hadley radio not found");
    return false;
  }
  if (!radio.checked) {
    radio.checked = true;
    dispatchInputChange(radio);
  }
  console.log("[CTH/content] Residence set to Hadley Village");
  return true;
}

function setDateRangeISO(fromISO, toISO) {
  const from = document.querySelector('input[name="answers[gensec][form_date][from]"]');
  const to   = document.querySelector('input[name="answers[gensec][form_date][to]"]');

  let ok = true;

  if (from) {
    try {
      from.value = fromISO;
      if ("valueAsDate" in from) {
        const d = new Date(fromISO + "T00:00:00");
        if (!isNaN(d)) from.valueAsDate = d;
      }
      dispatchInputChange(from);
    } catch { ok = false; }
  } else {
    console.warn("[CTH/content] From date input not found");
    ok = false;
  }

  if (to) {
    try {
      to.value = toISO;
      if ("valueAsDate" in to) {
        const d2 = new Date(toISO + "T00:00:00");
        if (!isNaN(d2)) to.valueAsDate = d2;
      }
      dispatchInputChange(to);
    } catch { ok = false; }
  } else {
    console.warn("[CTH/content] To date input not found");
    ok = false;
  }

  console.log("[CTH/content] setDateRangeISO", { fromISO, toISO, ok });
  return ok;
}

// ---------- NEW: Resident Name autocomplete ----------
function findResidentInput() {
  // Specific name from the page structure + accessible fallbacks
  return (
    document.querySelector('input[name$="[1769][data]"]') || // exact StudentQuestion input
    document.querySelector('#questions_new270026921_1769_data input[type="text"]') ||
    document.querySelector('input[aria-label*="Resident" i]') ||
    document.querySelector('input[placeholder*="Resident" i]') ||
    null
  );
}

// common option containers used by various autocompletes (jQuery UI, ARIA, custom)
const RES_OPT_QUERIES = [
  'ul[role="listbox"] li[role="option"]',
  'ul[role="listbox"] li',
  '.ui-autocomplete li',
  '.ui-menu-item',
  '.tt-menu .tt-suggestion',
  '.dropdown-menu li',
  '[role="option"]',
  '.autocomplete-suggestion',
];

function queryAll(sel) { return Array.from(document.querySelectorAll(sel)); }

function getResidentOptions() {
  for (const q of RES_OPT_QUERIES) {
    const items = queryAll(q).filter(el => el.offsetParent !== null);
    if (items.length) return items;
  }
  return [];
}

function normalize(s) { return (s || "").trim().replace(/\s+/g, " ").toLowerCase(); }

// Type into the resident input, wait for list, choose a match
async function setResidentName(name, timeoutMs = 3000) {
  const input = findResidentInput();
  if (!input) {
    console.warn("[CTH/content] Resident input not found");
    return false;
  }

  // focus + type
  input.focus();
  input.value = name;
  dispatchInputChange(input);
  key(input, "keydown", "a", "KeyA");
  key(input, "keyup", "a", "KeyA");

  const want = normalize(name);

  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const items = getResidentOptions();
    if (items.length) {
      // Try exact (case-insensitive) text match first
      let choice = items.find(li => normalize(li.textContent) === want)
              || items.find(li => normalize(li.textContent).includes(want))
              || items[0];

      if (choice) {
        choice.click(); // most autocompletes accept click
        // also try keyboard confirm (for components that require it)
        key(input, "keydown", "Enter", "Enter");
        key(input, "keyup", "Enter", "Enter");
        dispatchInputChange(input);
        console.log("[CTH/content] Resident selected:", choice.textContent?.trim());
        return true;
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.warn("[CTH/content] No resident suggestions appeared for:", name);
  return false;
}

// ---------- your existing features ----------
async function pickMyNameIfEnabled() {
  try {
    const { myName = "Caporuscio, James", autoMyName = true } =
      await chrome.storage.sync.get({ myName: "Caporuscio, James", autoMyName: true });

    if (!autoMyName) return;

    const sels = getParaProSelects();
    for (const sel of sels) {
      if (sel.value) continue;
      if (selectOptionByText(sel, myName)) {
        console.log("[CTH/content] selected myName on", sel);
        break;
      }
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
    const want = String(nums[i]); // "1".."4"
    const opt = Array.from(sel.options).find(o => (o.textContent || "").trim() === want);
    if (opt) {
      sel.value = opt.value;
      dispatchSelectEvents(sel);
      filled++;
    }
  }
  return { filled, total: Math.min(selects.length, nums.length) };
}

// ---------- save button (with fallbacks) ----------
function clickSaveButton() {
  const btn = document.querySelector(
    '#submit_form,' +
    'button#submit_form,' +
    'button[name="save"],' +
    'button[type="submit"],' +
    'input[type="submit"]'
  );

  if (btn) {
    btn.click(); // preserves handlers
    return { ok: true, method: "button" };
  }

  const form = document.querySelector('form#incident_form, form[action*="FormView"], form');
  if (form) {
    form.submit(); // fallback
    return { ok: true, method: "form.submit" };
  }

  return { ok: false, reason: "not_found" };
}

// ---------- boot ----------
let booted = false;
function bootOnce() {
  if (booted) return;
  booted = true;
  setTimeout(() => {
    setResidenceHadley();     // default residence
    pickMyNameIfEnabled();    // ParaPro auto-pick (if enabled)
  }, 250);
}
bootOnce();

// ---------- message bridge ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg?.type === "PICK_NAME") {
      // 1) Try ParaPro <select> pick first
      const sels = getParaProSelects();
      let ok = false;
      for (const sel of sels) {
        if (selectOptionByText(sel, msg.name)) { ok = true; break; }
      }
      if (!ok) {
        // 2) If that failed, try Resident autocomplete
        //    (works for the screenshoted search box)
        // Note: returns a Promise → we must reply async
        setResidentName(msg.name).then(done => sendResponse?.({ ok: !!done }));
        return true; // async response
      }
      sendResponse?.({ ok: true, via: "select" });
      return false;

    } else if (msg?.type === "FILL_SEQUENCE") {
      const res = fillSequence(msg.seq);
      sendResponse?.(res);
      return false;

    } else if (msg?.type === "SAVE_FORM") {
      const res = clickSaveButton();
      sendResponse?.(res);
      return false;

    } else if (msg?.type === "SET_DATE") {
      const ok = setDateRangeISO(msg.from, msg.to || msg.from);
      sendResponse?.({ ok });
      return false;

    } else if (msg?.type === "RUN_FILL") {
      pickMyNameIfEnabled();
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
