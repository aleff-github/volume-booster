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
const keyForHost = (h) => `gainPercent::HOST::${h}`;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function getActiveHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";
  try {
    return { tabId: tab?.id, host: new URL(url).hostname || "—" };
  } catch {
    return { tabId: tab?.id, host: "—" };
  }
}

function updateVisuals(v) {
  const vv = clamp(Number(v), 0, 1000);
  val.textContent = `${vv}%`;
  mult.textContent = `x${(vv / 100).toFixed(2)}`;

  const p = (vv / 1000) * 100; // percent fill
  slider.style.setProperty("--p", `${p}%`);

  switchEl.dataset.on = useGlobal.checked ? "true" : "false";
}

async function applyImmediatelyToTab(tabId, gainPercent) {
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      args: [gainPercent],
      func: (gp) => window.postMessage({ __VB_SET_GAIN: gp }, "*")
    });
  } catch {
    // Pagine speciali (chrome://, webstore) => ignora
  }
}

async function saveAndApply() {
  const { tabId, host } = await getActiveHost();
  const gainPercent = clamp(Number(slider.value), 0, 1000);

  updateVisuals(gainPercent);

  if (useGlobal.checked) {
    await chrome.storage.local.set({ [KEY_GLOBAL]: gainPercent });
  } else {
    await chrome.storage.local.set({ [keyForHost(host)]: gainPercent });
  }

  await applyImmediatelyToTab(tabId, gainPercent);
}

async function loadUI() {
  const { tabId, host } = await getActiveHost();
  hostEl.textContent = host;

  const data = await chrome.storage.local.get([KEY_GLOBAL, keyForHost(host)]);
  const hostValue = data[keyForHost(host)];
  const globalValue = data[KEY_GLOBAL];

  // se non esiste override per-sito => usa globale
  useGlobal.checked = hostValue == null;

  const initialValue = (useGlobal.checked ? globalValue : hostValue) ?? 100;
  slider.value = clamp(Number(initialValue), 0, 1000);

  updateVisuals(slider.value);
  await applyImmediatelyToTab(tabId, Number(slider.value));
}

slider.addEventListener("input", saveAndApply);

useGlobal.addEventListener("change", async () => {
  switchEl.dataset.on = useGlobal.checked ? "true" : "false";

  const { tabId, host } = await getActiveHost();
  const data = await chrome.storage.local.get([KEY_GLOBAL, keyForHost(host)]);
  const v = (useGlobal.checked ? data[KEY_GLOBAL] : data[keyForHost(host)]) ?? 100;

  slider.value = clamp(Number(v), 0, 1000);
  updateVisuals(slider.value);

  await saveAndApply();
  await applyImmediatelyToTab(tabId, Number(slider.value));
});

minusBtn.addEventListener("click", () => {
  slider.value = clamp(Number(slider.value) - 10, 0, 1000);
  saveAndApply();
});

plusBtn.addEventListener("click", () => {
  slider.value = clamp(Number(slider.value) + 10, 0, 1000);
  saveAndApply();
});

snap100Btn.addEventListener("click", () => {
  slider.value = 100;
  saveAndApply();
});

// Preset buttons
document.querySelectorAll("[data-preset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = Number(btn.getAttribute("data-preset"));
    slider.value = clamp(v, 0, 1000);
    saveAndApply();
  });
});

resetSiteBtn.addEventListener("click", async () => {
  const { tabId, host } = await getActiveHost();
  await chrome.storage.local.remove(keyForHost(host));

  if (!useGlobal.checked) {
    const data = await chrome.storage.local.get([KEY_GLOBAL]);
    const v = clamp(Number(data[KEY_GLOBAL] ?? 100), 0, 1000);
    slider.value = v;
    updateVisuals(v);
    await applyImmediatelyToTab(tabId, v);
  }
});

resetGlobalBtn.addEventListener("click", async () => {
  const { tabId } = await getActiveHost();
  await chrome.storage.local.remove(KEY_GLOBAL);

  if (useGlobal.checked) {
    slider.value = 100;
    updateVisuals(100);
    await applyImmediatelyToTab(tabId, 100);
  }
});

loadUI();
