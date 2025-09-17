// Utility: shortcut for getElementById
const $ = (id) => document.getElementById(id);

console.log("[CTH] popup.js loaded");

// Get the active tab ID
async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log("[CTH] Active tab:", tab);
  return tab?.id;
}

// Send a message to the active tab
async function sendToTab(msg) {
  const tabId = await getActiveTabId();
  if (!tabId) {
    console.warn("[CTH] No active tab found. Message not sent:", msg);
    return;
  }
  console.log("[CTH] Sending message to tab", tabId, ":", msg);
  try {
    const response = await chrome.tabs.sendMessage(tabId, msg);
    console.log("[CTH] Got response from content script:", response);
  } catch (err) {
    console.error("[CTH] Error sending message:", err);
  }
}

// Init: load saved preferences
(async function init() {
  console.log("[CTH] Initializing popup…");
  try {
    const { myName = "Caporuscio, James", autoMyName = true } =
      await chrome.storage.sync.get({
        myName: "Caporuscio, James",
        autoMyName: true
      });

    console.log("[CTH] Loaded prefs:", { myName, autoMyName });

    if ($("myName")) $("myName").value = myName;
    if ($("autoMyName")) $("autoMyName").checked = autoMyName;
  } catch (err) {
    console.error("[CTH] Error loading prefs:", err);
  }
})();

// Save preferences button
$("savePrefs")?.addEventListener("click", async () => {
  const newPrefs = {
    myName: $("myName")?.value.trim(),
    autoMyName: $("autoMyName")?.checked
  };
  console.log("[CTH] Saving prefs:", newPrefs);
  await chrome.storage.sync.set(newPrefs);
});

// Run “pick name” button
$("runPickName")?.addEventListener("click", async () => {
  const name = $("pickName")?.value.trim();
  console.log("[CTH] runPickName clicked. Name:", name);
  if (!name) return;
  await sendToTab({ type: "PICK_NAME", name });
});

// Run “sequence” button
$("runSeq")?.addEventListener("click", async () => {
  const seq = $("sequence")?.value;
  console.log("[CTH] runSeq clicked. Sequence:", seq);
  if (!seq) return;
  await sendToTab({ type: "FILL_SEQUENCE", seq });
});

// Clear sequence box
$("clearSeq")?.addEventListener("click", () => {
  console.log("[CTH] clearSeq clicked");
  if ($("sequence")) $("sequence").value = "";
});

// Save on-page form
$("saveForm")?.addEventListener("click", async () => {
  console.log("[CTH] saveForm clicked");
  await sendToTab({ type: "SAVE_FORM" });
});
