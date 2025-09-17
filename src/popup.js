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
    console.warn("[CTH] sendMessage error:", err);
    return null;
  }
}

// Init: load saved preferences
(async function init() {
  try {
    const { myName = "Caporuscio, James", autoMyName = true, dateFrom = "", dateTo = "" } =
      await chrome.storage.sync.get({
        myName: "Caporuscio, James",
        autoMyName: true,
        dateFrom: "",
        dateTo: ""
      });

    $("myName")?.setAttribute("value", myName);
    if ($("myName")) $("myName").value = myName;
    if ($("autoMyName")) $("autoMyName").checked = autoMyName;
    if ($("dateFrom")) $("dateFrom").value = dateFrom;
    if ($("dateTo"))   $("dateTo").value = dateTo;
  } catch (err) {
    console.error("[CTH] Error loading prefs:", err);
  }
})();

// Save preferences
$("savePrefs")?.addEventListener("click", async () => {
  const newPrefs = {
    myName: $("myName")?.value.trim(),
    autoMyName: $("autoMyName")?.checked,
  };
  await chrome.storage.sync.set(newPrefs);
  console.log("[CTH] Saved prefs:", newPrefs);
});

// Run “pick resident”
$("runPickName")?.addEventListener("click", async () => {
  const name = $("pickName")?.value.trim();
  if (!name) return;
  await sendToTab({ type: "PICK_NAME", name });
});

// Set date RANGE
$("setDateRange")?.addEventListener("click", async () => {
  const from = $("dateFrom")?.value;
  const to   = $("dateTo")?.value;
  if (!from) return;
  await chrome.storage.sync.set({ dateFrom: from, dateTo: to });
  await sendToTab({ type: "SET_DATE_RANGE", from, to });
});

// Run “sequence”
$("runSeq")?.addEventListener("click", async () => {
  const seq = $("sequence")?.value;
  if (!seq) return;
  await sendToTab({ type: "FILL_SEQUENCE", seq });
});

// Save form on page
$("saveForm")?.addEventListener("click", async () => {
  await sendToTab({ type: "SAVE_FORM" });
});

// ---------- ENTER key helpers ----------
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
clickOnEnter($("dateFrom"), $("setDateRange"));
clickOnEnter($("dateTo"), $("setDateRange"));
clickOnEnter($("myName"), $("savePrefs"));

// Allow Ctrl/⌘+Enter for textarea
$("sequence")?.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    $("runSeq")?.click();
  }
});
