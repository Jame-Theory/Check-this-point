// Utility
const $ = (id) => document.getElementById(id);
const TODAY_ISO = (() => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
})();

// Active tab helper
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Robust message sender (injects content.js if needed)
async function sendToTab(msg) {
  const tab = await getActiveTab();
  if (!tab || !/^https?:/i.test(tab.url || "")) return null;

  try {
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    // try injection then retry
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    });
    return await chrome.tabs.sendMessage(tab.id, msg);
  }
}

// ---------- init (prefs + dates) ----------
(async function init() {
  const {
    myName = "Caporuscio, James",
    autoMyName = true,
    lastDates = { from: TODAY_ISO, to: TODAY_ISO }
  } = await chrome.storage.sync.get(["myName", "autoMyName", "lastDates"]);

  $("myName").value = myName;
  $("autoMyName").checked = autoMyName;

  $("dateFrom").value = lastDates?.from || TODAY_ISO;
  $("dateTo").value = lastDates?.to || lastDates?.from || TODAY_ISO;
})();

// ---------- prefs ----------
$("savePrefs").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    myName: $("myName").value.trim(),
    autoMyName: $("autoMyName").checked
  });
});

// ---------- pick name ----------
$("runPickName").addEventListener("click", async () => {
  const name = $("pickName").value.trim();
  if (name) await sendToTab({ type: "PICK_NAME", name });
});

// ---------- sequence ----------
$("runSeq").addEventListener("click", async () => {
  const seq = $("sequence").value;
  if (seq.trim()) await sendToTab({ type: "FILL_SEQUENCE", seq });
});
$("clearSeq").addEventListener("click", () => $("sequence").value = "");

// ---------- dates ----------
$("setDate").addEventListener("click", async () => {
  const from = $("dateFrom").value || TODAY_ISO;
  const to = $("dateTo").value || from;
  await chrome.storage.sync.set({ lastDates: { from, to } });
  await sendToTab({ type: "SET_DATE", from, to });
});

// ---------- save form ----------
$("saveForm").addEventListener("click", async () => {
  await sendToTab({ type: "SAVE_FORM" });
});
