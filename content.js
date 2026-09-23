// Volume Booster content script (all frames)

let audioCtx = null;
let preGain = null;
let compressor = null;

const sources = new Map(); // HTMLMediaElement -> MediaElementAudioSourceNode

const KEY_GLOBAL = "gainPercent::GLOBAL";
const keyForHost = (h) => `gainPercent::HOST::${h}`;
const MAX_GAIN_MULT = 10.0; // 1000%

function getHost() {
  try { return location.hostname || ""; } catch { return ""; }
}

function ensureGraph() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  preGain = audioCtx.createGain();
  preGain.gain.value = 1.0;

  compressor = audioCtx.createDynamicsCompressor();
  // "Limiter-ish" (riduce i picchi quando alzi tanto)
  compressor.threshold.value = -12;
  compressor.knee.value = 0;
  compressor.ratio.value = 20;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;

  preGain.connect(compressor);
  compressor.connect(audioCtx.destination);
}

function setGainPercent(gainPercent) {
  ensureGraph();

  const g = Math.max(0, Math.min(MAX_GAIN_MULT, Number(gainPercent) / 100));
  preGain.gain.setValueAtTime(g, audioCtx.currentTime);

  // Prova a "resume" (spesso su YouTube funziona perché l'utente ha già interagito)
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

function attachMedia(el) {
  if (!(el instanceof HTMLMediaElement)) return;
  if (sources.has(el)) return;

  ensureGraph();

  try {
    // Nota: per lo stesso <video>/<audio> si può chiamare SOLO una volta
    const src = audioCtx.createMediaElementSource(el);
    src.connect(preGain);
    sources.set(el, src);
  } catch {
    // CORS/DRM/limitazioni player: non sempre reindirizzabile
  }
}

function detachMedia(el) {
  const src = sources.get(el);
  if (!src) return;
  try { src.disconnect(); } catch {}
  sources.delete(el);
}

function scanTree(root) {
  root.querySelectorAll?.("audio, video").forEach(attachMedia);

  // Shadow DOM "open"
  root.querySelectorAll?.("*").forEach((el) => {
    if (el.shadowRoot) scanTree(el.shadowRoot);
  });
}

async function loadInitialGain() {
  const host = getHost();
  const data = await chrome.storage.local.get([KEY_GLOBAL, keyForHost(host)]);
  const v = data[keyForHost(host)] ?? data[KEY_GLOBAL] ?? 100;
  setGainPercent(v);
}

// 1) Scansione iniziale + valore iniziale
scanTree(document);
loadInitialGain();

// 2) Nuovi media dinamici
const mo = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const n of m.addedNodes) {
      if (n instanceof HTMLMediaElement) attachMedia(n);
      else if (n instanceof HTMLElement) scanTree(n);
    }
    for (const n of m.removedNodes) {
      if (n instanceof HTMLMediaElement) detachMedia(n);
      else if (n instanceof HTMLElement) {
        n.querySelectorAll?.("audio, video").forEach(detachMedia);
      }
    }
  }
});
mo.observe(document.documentElement, { childList: true, subtree: true });

// 3) Fallback: alcuni siti cambiano player senza mutazioni “pulite”
setInterval(() => scanTree(document), 2500);

// 4) Effetto IMMEDIATO: ricevi i messaggi dal popup (iniettati con executeScript)
window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  const d = e.data;
  if (d && d.__VB_SET_GAIN != null) {
    setGainPercent(Number(d.__VB_SET_GAIN));
  }
});

// 5) Persistenza: se cambia storage (anche da altri tab), aggiorna
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  const host = getHost();
  const hostKey = keyForHost(host);

  if (changes[hostKey]) {
    setGainPercent(changes[hostKey].newValue ?? 100);
    return;
  }

  if (changes[KEY_GLOBAL]) {
    // applica globale solo se non esiste override per-sito
    chrome.storage.local.get([hostKey]).then((data) => {
      if (data[hostKey] == null) {
        setGainPercent(changes[KEY_GLOBAL].newValue ?? 100);
      }
    });
  }
});
