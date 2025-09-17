// ========== content.js (UI-driven resident select + date RANGE + stronger select) ==========
console.log("[CTH] content.js loaded");

// ---------- small utils ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm  = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
const fire  = (el, type, init = {}) =>
  el?.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, ...init }));
const change = (el) => { fire(el, "input"); fire(el, "change"); };

function waitFor(selector, { root = document, timeout = 8000, poll = 100 } = {}) {
  const found = root.querySelector(selector);
  if (found) return Promise.resolve(found);
  return new Promise((resolve, reject) => {
    const mo = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) { clearTimeout(t); mo.disconnect(); resolve(el); }
    });
    mo.observe(root, { childList: true, subtree: true });
    const t = setTimeout(() => { mo.disconnect(); reject(new Error("timeout")); }, timeout);
    (async function loop() {
      for (let i = 0; i < timeout / poll; i++) {
        const el = root.querySelector(selector);
        if (el) { clearTimeout(t); mo.disconnect(); return resolve(el); }
        await sleep(poll);
      }
    })();
  });
}

// ---------- selects + helpers ----------
function dispatchSelectEvents(sel) { change(sel); }

function selectOptionByText(selectEl, targetText) {
  const t = norm(targetText);
  const opts = Array.from(selectEl?.options || []);
  const found = opts.find(o => norm(o.textContent || o.label) === t);
  if (!found) return false;
  selectEl.value = found.value; dispatchSelectEvents(selectEl); return true;
}
function looksLikePeopleSelect(sel) {
  const opts = Array.from(sel.options);
  if (opts.length < 5) return false;
  const hasComma = opts.filter(o => (o.textContent || "").includes(",")).length >= 3;
  const hasDash  = opts.some(o => (o.textContent || "").toLowerCase().includes("- select"));
  return hasComma || hasDash;
}
function getParaProSelects() {
  const byName   = document.querySelectorAll('select[name$="[1820][data]"]');
  const all      = Array.from(document.querySelectorAll("select"));
  const peopleish= all.filter(looksLikePeopleSelect);
  return Array.from(new Set([...byName, ...peopleish]));
}
function getOneToFourSelects() {
  const ok = [];
  document.querySelectorAll("select").forEach(sel => {
    const texts   = new Set(Array.from(sel.options).map(o => (o.textContent || "").trim()));
    const cleaned = new Set([...texts].filter(t => t && !t.toLowerCase().startsWith("- select")));
    const allowed = new Set(["1","2","3","4"]);
    if (cleaned.size > 0 && [...cleaned].every(t => allowed.has(t))) ok.push(sel);
  });
  return ok;
}

// ---------- Hadley sticky ----------
const HADLEY_ENTITY_ID = "1748";
function hadleyRadio() {
  return (
    document.querySelector(`input[type="radio"][name="answers[gensec][location]"][value="${HADLEY_ENTITY_ID}"]`) ||
    Array.from(document.querySelectorAll('input[type="radio"][name="answers[gensec][location]"]'))
      .find(r => r.value === HADLEY_ENTITY_ID || /hadley\s+village/i.test(r.closest("label")?.textContent || ""))
  );
}
function selectHadleyOnce() {
  const r = hadleyRadio(); if (!r) return false;
  const lbl = document.querySelector(`label[for="${r.id}"]`) || r.closest("label");
  if (lbl) lbl.click();
  if (!r.checked) { r.checked = true; dispatchSelectEvents(r); }
  return r.checked;
}
function keepHadleySelected(ms = 15000) {
  const end = Date.now() + ms;
  (async () => {
    for (let i = 0; i < 40 && Date.now() < end; i++) {
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

// ---------- Date RANGE ----------
function setDateRangeISO(fromISO, toISO) {
  const from = document.querySelector('input[name="answers[gensec][form_date][from]"]');
  const to   = document.querySelector('input[name="answers[gensec][form_date][to]"]');
  let ok = true;
  if (from) { from.value = fromISO; if ("valueAsDate" in from) from.valueAsDate = new Date(fromISO + "T00:00:00"); change(from); } else ok=false;
  if (to)   { to.value   = toISO;   if ("valueAsDate" in to)   to.valueAsDate   = new Date(toISO   + "T00:00:00"); change(to);   } else ok=false;
  console.log("[CTH/date] setDateRangeISO", { fromISO, toISO, ok });
  return ok;
}

// ---------- Resident selection (UI-driven) ----------
const STUDENT_QID = 1769;
function residentRoot() {
  return (
    document.getElementById("questions_new270026921_1769_data") ||
    document.querySelector('div[id^="questions_"][id*="_1769_"][id$="_data"]') ||
    document.querySelector('.question-type--student') ||
    document
  );
}
function residentHiddenId(root = residentRoot()) {
  // be generous: any hidden whose name ends with [1769][data]
  return root.querySelector('input[type="hidden"][name$="[1769][data]"], input[type="hidden"][name*="[1769]"][name$="[data]"]');
}
function residentSelectedFlag(root = residentRoot()) {
  return root.querySelector('input[type="hidden"].student_selected') || root.querySelector('input[type="hidden"][name$="[selected]"]');
}
function residentDisplayContainer(root = residentRoot()) {
  return root.querySelector('.student-selected-container') || root.querySelector(`#questions_new270026921_${STUDENT_QID}_data`);
}
function residentSearchInput(root = residentRoot()) {
  return root.querySelector('.student-select-search-bar input[type="text"]');
}
function residentDropdownItems(doc = document) {
  return Array.from(doc.querySelectorAll(
    'ul[role="listbox"] li[role="option"], ul[role="listbox"] li, .ui-autocomplete li, .ui-menu-item, .select2-results__option, .dropdown-menu li'
  ));
}
function residentClearButton(root = residentRoot()) {
  return root.querySelector('.action-bar .clear-selected, button.clear-selected');
}
function clearResidentUI(root = residentRoot()) {
  console.log("[CTH/resident] Clearing existing resident UI/hidden values");
  try { residentClearButton(root)?.click(); } catch {}
  const hid  = residentHiddenId(root);       if (hid)  { hid.value = ""; change(hid); }
  const flag = residentSelectedFlag(root);   if (flag) { flag.value = "0"; change(flag); }
  const vis  = residentSearchInput(root);    if (vis)  { vis.value  = ""; change(vis); }
  const disp = residentDisplayContainer(root); if (disp) disp.innerHTML = "";
}

function verifyResidentPicked(query) {
  const root = residentRoot();
  const hid  = residentHiddenId(root);
  const disp = residentDisplayContainer(root);
  const selectedId   = hid?.value || "";
  const selectedText = (disp?.textContent || "").trim();
  const ok = !!selectedId || norm(selectedText).includes(norm(query));
  return { ok, selectedId, selectedText };
}

// Type into the search field, then select the FIRST item (with keyboard, then mouse as fallback)
async function uiPickResidentFirst(query) {
  const root = residentRoot();
  const box  = await waitFor('.student-select-search-bar input[type="text"]', { timeout: 12000 });
  console.log("[CTH/resident] uiPickResidentFirst: got search box", box);

  // focus & type
  box.focus();
  box.value = "";
  change(box);
  await sleep(30);

  box.value = query;
  change(box);

  // Nudge key listeners
  box.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
  box.dispatchEvent(new KeyboardEvent("keyup",   { bubbles: true, key: "a" }));

  // Wait for items
  let items = [];
  for (let tries = 0; tries < 30; tries++) {
    items = residentDropdownItems(document).filter(li => (li.textContent || "").trim());
    if (items.length) break;
    await sleep(100);
  }
  console.log("[CTH/resident] dropdown items:", items.length);

  if (!items.length) return { ok: false, reason: "no_dropdown_results" };

  // 1) Keyboard select: ArrowDown + Enter (some widgets only respect keyboard)
  box.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
  box.dispatchEvent(new KeyboardEvent("keyup",   { bubbles: true, key: "ArrowDown" }));
  await sleep(40);
  box.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  box.dispatchEvent(new KeyboardEvent("keyup",   { bubbles: true, key: "Enter" }));
  await sleep(160);

  let verify = verifyResidentPicked(query);
  console.log("[CTH/resident] verify after keyboard:", verify);
  if (verify.ok) return { ok: true, ...verify };

  // 2) Mouse fallback: click the FIRST item hard (pointerdown/mousedown/click/pointerup/mouseup)
  const first = items[0];
  first.scrollIntoView({ block: "center" });
  const evts = ["pointerdown","mousedown","click","pointerup","mouseup"];
  for (const type of evts) {
    first.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
  }
  await sleep(160);

  verify = verifyResidentPicked(query);
  console.log("[CTH/resident] verify after mouse:", verify);
  if (verify.ok) return { ok: true, ...verify };

  // 3) As a last resort, double-click
  first.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window, buttons: 1 }));
  await sleep(160);

  verify = verifyResidentPicked(query);
  console.log("[CTH/resident] verify after dblclick:", verify);
  return verify.ok ? { ok: true, ...verify } : { ok: false, reason: "verify_failed", ...verify };
}

let residentBusy = false;
async function setResidentByName(query) {
  if (!query || !query.trim()) return { ok: false, reason: "empty_query" };
  while (residentBusy) await sleep(50);
  residentBusy = true;

  console.log("[CTH/resident] === Starting resident lookup ===");
  console.log("[CTH/resident] Raw query:", query);

  try {
    // ensure UI exists
    await Promise.race([
      waitFor('.student-select-search-bar input[type="text"]', { timeout: 12000 }),
      waitFor('input[type="hidden"][name$="[1769][data]"]',     { timeout: 12000 }),
    ]).catch(() => { /* continue anyway */ });
    console.log("[CTH/resident] Resident controls are present");

    clearResidentUI();
    console.log("[CTH/resident] Cleared old resident selection");

    const res = await uiPickResidentFirst(query);
    console.log("[CTH/resident] uiPickResidentFirst result:", res);
    return res;

  } finally {
    console.log("[CTH/resident] === Done resident lookup ===");
    residentBusy = false;
  }
}

// ---------- other features ----------
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
  } catch { /* noop */ }
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
function clickSaveButton() {
  const btn = document.querySelector('#submit_form, button#submit_form, button[name="save"], button[type="submit"], input[type="submit"]');
  if (btn) { btn.click(); return { ok: true, method: "button" }; }
  const form = document.querySelector('form#incident_form, form[action*="FormView"], form');
  if (form) { form.submit(); return { ok: true, method: "form.submit" }; }
  return { ok: false, reason: "not_found" };
}

// ---------- boot ----------
let booted = false;
function bootOnce() {
  if (booted) return; booted = true;
  setTimeout(() => {
    keepHadleySelected(15000);
    pickMyNameIfEnabled();
  }, 350);
}
bootOnce();

// ---------- messaging bridge ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg?.type === "PICK_NAME") {
      setResidentByName(msg.name).then(res => sendResponse?.(res));
      return true; // async
    } else if (msg?.type === "FILL_SEQUENCE") {
      sendResponse?.(fillSequence(msg.seq)); return false;
    } else if (msg?.type === "SAVE_FORM") {
      sendResponse?.(clickSaveButton()); return false;
    } else if (msg?.type === "SET_DATE_RANGE") {
      const { from, to } = msg;
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
