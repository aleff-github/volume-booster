const slider = document.getElementById("gain");
const val = document.getElementById("val");
const mult = document.getElementById("mult");
const hostEl = document.getElementById("host");

const useGlobal = document.getElementById("useGlobal");
const switchEl = document.getElementById("switch");

const minusBtn = document.getElementById("minus");
const plusBtn = document.getElementById("plus");
const snap100Btn = document.getElementById("snap100");
const resetSiteBtn = document.getElementById("resetSite");
const resetGlobalBtn = document.getElementById("resetGlobal");

const KEY_GLOBAL = "gainPercent::GLOBAL";
const keyForHost = (host) => `gainPercent::HOST::${host}`;
const MAX_GAIN_PERCENT = 1000;

let activeTabId = null;
let activeHost = null;

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function updateVisuals(value) {
  const gainPercent = clamp(value, 0, MAX_GAIN_PERCENT);
  val.textContent = `${gainPercent}%`;
  mult.textContent = `x${(gainPercent / 100).toFixed(2)}`;

  const fill = (gainPercent / MAX_GAIN_PERCENT) * 100;
  slider.style.setProperty("--p", `${fill}%`);
  switchEl.dataset.on = useGlobal.checked ? "true" : "false";
}

async function getActiveTabContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id ?? null;

  try {
    const url = new URL(tab?.url || "");
    const host = url.hostname || null;
    return { tabId, host };
  } catch {
    return { tabId, host: null };
  }
}

async function sendGain(gainPercent) {
  if (activeTabId == null) return;

  try {
    await chrome.tabs.sendMessage(activeTabId, {
      type: "VB_SET_GAIN",
      gainPercent: clamp(gainPercent, 0, MAX_GAIN_PERCENT)
    });
  } catch {
    // Restricted pages (chrome://, Chrome Web Store, etc.) do not run the
    // content script. Persisting the setting still works for normal pages.
  }
}

async function persistCurrentValue() {
  const gainPercent = clamp(slider.value, 0, MAX_GAIN_PERCENT);

  if (useGlobal.checked || !activeHost) {
    await chrome.storage.local.set({ [KEY_GLOBAL]: gainPercent });
    return;
  }

  await chrome.storage.local.set({ [keyForHost(activeHost)]: gainPercent });
}

async function setValue(value, { persist = true } = {}) {
  const gainPercent = clamp(value, 0, MAX_GAIN_PERCENT);
  slider.value = String(gainPercent);
  updateVisuals(gainPercent);
  await sendGain(gainPercent);

  if (persist) {
    await persistCurrentValue();
  }
}

async function loadUI() {
  const context = await getActiveTabContext();
  activeTabId = context.tabId;
  activeHost = context.host;

  hostEl.textContent = activeHost || "Restricted page";

  if (!activeHost) {
    useGlobal.checked = true;
    useGlobal.disabled = true;
    switchEl.dataset.disabled = "true";
  }

  const keys = activeHost ? [KEY_GLOBAL, keyForHost(activeHost)] : [KEY_GLOBAL];
  const data = await chrome.storage.local.get(keys);
  const globalValue = data[KEY_GLOBAL];
  const hostValue = activeHost ? data[keyForHost(activeHost)] : null;

  useGlobal.checked = !activeHost || hostValue == null;
  const initialValue = useGlobal.checked ? globalValue : hostValue;

  await setValue(initialValue ?? 100, { persist: false });
}

slider.addEventListener("input", () => {
  updateVisuals(slider.value);
  void sendGain(slider.value);
});

slider.addEventListener("change", () => {
  void persistCurrentValue();
});

useGlobal.addEventListener("change", async () => {
  if (!activeHost) {
    useGlobal.checked = true;
    updateVisuals(slider.value);
    return;
  }

  const hostKey = keyForHost(activeHost);
  const data = await chrome.storage.local.get([KEY_GLOBAL, hostKey]);

  if (useGlobal.checked) {
    await chrome.storage.local.remove(hostKey);
    await setValue(data[KEY_GLOBAL] ?? 100, { persist: false });
    return;
  }

  const inheritedValue = clamp(data[hostKey] ?? data[KEY_GLOBAL] ?? slider.value, 0, MAX_GAIN_PERCENT);
  await chrome.storage.local.set({ [hostKey]: inheritedValue });
  await setValue(inheritedValue, { persist: false });
});

minusBtn.addEventListener("click", () => {
  void setValue(Number(slider.value) - 10);
});

plusBtn.addEventListener("click", () => {
  void setValue(Number(slider.value) + 10);
});

snap100Btn.addEventListener("click", () => {
  void setValue(100);
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    void setValue(Number(button.dataset.preset));
  });
});

resetSiteBtn.addEventListener("click", async () => {
  if (!activeHost) return;

  await chrome.storage.local.remove(keyForHost(activeHost));
  useGlobal.checked = true;

  const data = await chrome.storage.local.get([KEY_GLOBAL]);
  await setValue(data[KEY_GLOBAL] ?? 100, { persist: false });
});

resetGlobalBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(KEY_GLOBAL);

  if (useGlobal.checked) {
    await setValue(100, { persist: false });
  }
});

void loadUI();
