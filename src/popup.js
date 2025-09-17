// ========== popup.js ==========
const $ = (id) => document.getElementById(id);

console.log("[CTH] popup.js loaded");

// Active tab id
async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// Safe send to tab (handles closed channel)
async function sendToTab(msg) {
  const tabId = await getActiveTabId();
  if (!tabId) {
    console.warn("[CTH] No active tab. Not sending:", msg);
    return;
  }
  try {
    const response = await chrome.tabs.sendMessage(tabId, msg);
    console.log("[CTH] Response:", response);
    return response;
  } catch (err) {
    console.warn("[CTH] sendMessage error (content script not ready yet?):", err);
    // Try to inject a no-op ping to wake perms (optional)
    return null;
  }
}

// Init: load saved preferences
(async function init() {
  try {
    const { myName = "Caporuscio, James", autoMyName = true, defaultDate = "" } =
      await chrome.storage.sync.get({
        myName: "Caporuscio, James",
        autoMyName: true,
        defaultDate: ""
      });

    if ($("myName")) $("myName").value = myName;
    if ($("autoMyName")) $("autoMyName").checked = autoMyName;
    if ($("dateISO")) $("dateISO").value = defaultDate;
  } catch (err) {
    console.error("[CTH] Error loading prefs:", err);
  }
})();

// Save preferences
$("savePrefs")?.addEventListener("click", async () => {
  const newPrefs = {
    myName: $("myName")?.value.trim(),
    autoMyName: $("autoMyName")?.checked,
    defaultDate: $("dateISO")?.value || ""
  };
  await chrome.storage.sync.set(newPrefs);
  console.log("[CTH] Saved prefs:", newPrefs);
});

// Run “pick name”
$("runPickName")?.addEventListener("click", async () => {
  const name = $("pickName")?.value.trim();
  if (!name) return;
  await sendToTab({ type: "PICK_NAME", name });
});

// Run “sequence”
$("runSeq")?.addEventListener("click", async () => {
  const seq = $("sequence")?.value;
  if (!seq) return;
  await sendToTab({ type: "FILL_SEQUENCE", seq });
});

// Set date (single date to both from/to for convenience)
$("setDate")?.addEventListener("click", async () => {
  const d = $("dateISO")?.value;
  if (!d) return;
  await sendToTab({ type: "SET_DATE", date: d });
});

// Save form on page
$("saveForm")?.addEventListener("click", async () => {
  await sendToTab({ type: "SAVE_FORM" });
});

// ---------- ENTER key handlers ----------
function clickOnEnter(inputEl, buttonEl) {
  if (!inputEl || !buttonEl) return;
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      buttonEl.click();
    }
  });
}

clickOnEnter($("pickName"), $("runPickName"));
clickOnEnter($("sequence"), $("runSeq"));
clickOnEnter($("dateISO"), $("setDate"));
clickOnEnter($("myName"), $("savePrefs"));

// Optional: allow Ctrl/⌘+Enter on textarea for sequence
$("sequence")?.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    $("runSeq")?.click();
  }
});
