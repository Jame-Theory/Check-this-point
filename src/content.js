// ========== DEBUG LOADED ==========
console.log("[CTH/content] content.js loaded");

// ---------- helpers for selects ----------
function dispatchSelectEvents(sel) {
  console.log("[CTH/content] dispatching events for", sel);
  sel.dispatchEvent(new Event("input", { bubbles: true }));
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectOptionByText(selectEl, targetText) {
  const t = (targetText || "").trim().toLowerCase();
  const opts = Array.from(selectEl?.options || []);
  const found = opts.find(
    o => (o.textContent || o.label || "").trim().toLowerCase() === t
  );
  console.log("[CTH/content] selectOptionByText:", {
    targetText,
    found: !!found,
    selectEl,
    optionsCount: opts.length
  });
  if (!found) return false;
  selectEl.value = found.value;
  dispatchSelectEvents(selectEl);
  return true;
}

function looksLikePeopleSelect(sel) {
  const opts = Array.from(sel.options);
  if (opts.length < 5) return false;
  const hasCommaNames =
    opts.filter(o => (o.textContent || "").includes(",")).length >= 3;
  const hasDashSelect = opts.some(o =>
    (o.textContent || "").includes("- select")
  );
  return hasCommaNames || hasDashSelect;
}

function getParaProSelects() {
  const byName = document.querySelectorAll('select[name$="[1820][data]"]'); // ParaPro
  const all = Array.from(document.querySelectorAll("select"));
  const peopleish = all.filter(looksLikePeopleSelect);
  const set = new Set([...byName, ...peopleish]);
  const result = Array.from(set);
  console.log("[CTH/content] getParaProSelects ->", {
    byName: byName.length,
    peopleish: peopleish.length,
    total: result.length
  });
  return result;
}

function getOneToFourSelects() {
  const ok = [];
  document.querySelectorAll("select").forEach(sel => {
    const texts = new Set(
      Array.from(sel.options).map(o => (o.textContent || "").trim())
    );
    const cleaned = new Set(
      [...texts].filter(t => t && !t.startsWith("- select"))
    );
    const allowed = new Set(["1", "2", "3", "4"]);
    if (cleaned.size > 0 && [...cleaned].every(t => allowed.has(t)))
      ok.push(sel);
  });
  console.log("[CTH/content] getOneToFourSelects ->", ok.length, "select(s)");
  return ok;
}

// ---------- features ----------
async function pickMyNameIfEnabled() {
  try {
    const { myName = "Caporuscio, James", autoMyName = true } =
      await chrome.storage.sync.get({
        myName: "Caporuscio, James",
        autoMyName: true
      });

    console.log("[CTH/content] pickMyNameIfEnabled:", { myName, autoMyName });
    if (!autoMyName) return;

    const sels = getParaProSelects();
    for (const sel of sels) {
      if (sel.value) {
        console.log("[CTH/content] skip (already set):", sel);
        continue;
      }
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
  const digits = Array.from(seqStr || "")
    .filter(ch => /[1-4]/.test(ch))
    .map(d => Number(d));
  console.log("[CTH/content] parseSequence:", { seqStr, digits });
  return digits;
}

function fillSequence(seqStr) {
  const nums = parseSequence(seqStr);
  if (!nums.length) {
    console.warn("[CTH/content] fillSequence: no digits 1-4 found");
    return { filled: 0, total: 0 };
  }

  const selects = getOneToFourSelects();
  let filled = 0;

  for (let i = 0; i < selects.length && i < nums.length; i++) {
    const sel = selects[i];
    const want = String(nums[i]); // "1".."4"
    const opt = Array.from(sel.options).find(
      o => (o.textContent || "").trim() === want
    );
    if (opt) {
      sel.value = opt.value;
      dispatchSelectEvents(sel);
      filled++;
      console.log("[CTH/content] set select", i, "to", want);
    } else {
      console.warn("[CTH/content] no option with text", want, "at select index", i);
    }
  }
  const res = { filled, total: Math.min(selects.length, nums.length) };
  console.log("[CTH/content] fillSequence result:", res);
  return res;
}

// ---------- NEW: Auto-select Hadley ----------
function setResidenceHadley() {
  const radios = document.querySelectorAll('input[type="radio"][name="answers[gensec][location]"]');
  if (!radios.length) {
    console.warn("[CTH/content] No residence radios found");
    return;
  }
  const hadley = Array.from(radios).find(r =>
    (r.closest("label")?.textContent || "").includes("Hadley Village")
  );
  if (hadley) {
    hadley.checked = true;
    dispatchSelectEvents(hadley);
    console.log("[CTH/content] Auto-selected Hadley Village");
  } else {
    console.warn("[CTH/content] Hadley option not found");
  }
}

// ---------- NEW: Date setter ----------
function setFormDate(dateStr) {
  const dateInputs = document.querySelectorAll('input[type="date"][name^="answers[gensec][form_date]"]');
  if (!dateInputs.length) {
    console.warn("[CTH/content] No date inputs found");
    return;
  }
  dateInputs.forEach(inp => {
    inp.value = dateStr;
    dispatchSelectEvents(inp);
  });
  console.log("[CTH/content] Set date to", dateStr);
}

// ---------- NEW: Resident name search ----------
function findResidentSearchBox() {
  return document.querySelector('input[aria-label="Search for people or form #"]');
}

function typeLikeHuman(el, text) {
  el.focus();
  el.value = "";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  [...text].forEach((ch, i) => {
    setTimeout(() => {
      el.value += ch;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, i * 80);
  });
}

async function setResidentName(query) {
  const box = findResidentSearchBox();
  if (!box) {
    console.warn("[CTH/content] Resident search box not found");
    return false;
  }
  typeLikeHuman(box, query);
  console.log("[CTH/content] Typed resident name:", query);
  return true;
}

// ---------- boot + listeners ----------
let booted = false;
async function bootOnce() {
  if (booted) return;
  booted = true;
  console.log("[CTH/content] bootOnce");
  setTimeout(() => {
    pickMyNameIfEnabled();
    setResidenceHadley();
  }, 500);
}
bootOnce();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log("[CTH/content] onMessage:", msg);

  if (msg?.type === "PICK_NAME") {
    setResidentName(msg.name);
    sendResponse?.({ ok: true });
    return false;

  } else if (msg?.type === "FILL_SEQUENCE") {
    const res = fillSequence(msg.seq);
    sendResponse?.(res);
    return false;

  } else if (msg?.type === "SET_DATE") {
    setFormDate(msg.date);
    sendResponse?.({ ok: true });
    return false;

  } else if (msg?.type === "RUN_FILL") {
    pickMyNameIfEnabled();
    setResidenceHadley();
    sendResponse?.({ ok: true });
    return false;
  }

  return false;
});
