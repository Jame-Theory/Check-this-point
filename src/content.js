// ---------- helpers for selects ----------
function dispatchSelectEvents(sel) {
  sel.dispatchEvent(new Event("input", { bubbles: true }));
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectOptionByText(selectEl, targetText) {
  const t = targetText.trim().toLowerCase();
  const opts = Array.from(selectEl.options);
  const found = opts.find(o => (o.textContent || o.label || "").trim().toLowerCase() === t);
  if (!found) return false;
  selectEl.value = found.value;
  dispatchSelectEvents(selectEl);
  return true;
}

function looksLikePeopleSelect(sel) {
  // Heuristic: many options AND lots with a comma (Last, First) OR id-ish numeric values
  const opts = Array.from(sel.options);
  if (opts.length < 5) return false;
  const hasCommaNames = opts.filter(o => (o.textContent || "").includes(",")).length >= 3;
  const hasDashSelect = opts.some(o => o.textContent?.includes("- select"));
  return hasCommaNames || hasDashSelect;
}

function getParaProSelects() {
  // Specific to your form — also keep it generic
  const byName = document.querySelectorAll('select[name$="[1820][data]"]'); // ParaPro field in your HTML
  const all = Array.from(document.querySelectorAll("select"));
  const peopleish = all.filter(looksLikePeopleSelect);
  const set = new Set([...byName, ...peopleish]);
  return Array.from(set);
}

function getOneToFourSelects() {
  // Finds selects whose *visible* option texts are exclusively subset of {1,2,3,4}
  const ok = [];
  document.querySelectorAll("select").forEach(sel => {
    const texts = new Set(Array.from(sel.options).map(o => (o.textContent || "").trim()));
    // Remove blanks like "- select one -"
    const cleaned = new Set([...texts].filter(t => t && !t.startsWith("- select")));
    const allowed = new Set(["1","2","3","4"]);
    if (cleaned.size > 0 && [...cleaned].every(t => allowed.has(t))) {
      ok.push(sel);
    }
  });
  return ok;
}

// ---------- features ----------
async function pickMyNameIfEnabled() {
  const { myName = "Caporuscio, James", autoMyName = true } = await chrome.storage.sync.get({
    myName: "Caporuscio, James",
    autoMyName: true
  });
  if (!autoMyName) return;

  const sels = getParaProSelects();
  for (const sel of sels) {
    if (sel.value) continue; // already set
    if (selectOptionByText(sel, myName)) break;
  }
}

function pickNameNow(name) {
  const sels = getParaProSelects();
  for (const sel of sels) {
    if (selectOptionByText(sel, name)) return true;
  }
  return false;
}

function parseSequence(seqStr) {
  // Accepts "4 4 3 2 1", "44321", "4,3,2,1", etc.
  const digits = Array.from(seqStr).filter(ch => /[1-4]/.test(ch)).map(d => Number(d));
  return digits;
}

function fillSequence(seqStr) {
  const nums = parseSequence(seqStr);
  if (!nums.length) return { filled: 0, total: 0 };

  const selects = getOneToFourSelects();
  let filled = 0;

  for (let i = 0; i < selects.length && i < nums.length; i++) {
    const sel = selects[i];
    const want = String(nums[i]); // "1"-"4" matches visible text
    // Find option whose *text* equals want, then set its value
    const opt = Array.from(sel.options).find(o => (o.textContent || "").trim() === want);
    if (opt) {
      sel.value = opt.value;
      dispatchSelectEvents(sel);
      filled++;
    }
  }
  return { filled, total: Math.min(selects.length, nums.length) };
}

// ---------- boot + listeners ----------
let booted = false;
async function bootOnce() {
  if (booted) return;
  booted = true;
  // slight delay so the form renders
  setTimeout(pickMyNameIfEnabled, 250);
}
bootOnce();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "PICK_NAME") {
    const ok = pickNameNow(msg.name);
    sendResponse?.({ ok });
  } else if (msg?.type === "FILL_SEQUENCE") {
    const res = fillSequence(msg.seq);
    sendResponse?.(res);
  } else if (msg?.type === "RUN_FILL") {
    // keep your previous handler; optionally also re-apply my-name
    pickMyNameIfEnabled();
  }
});