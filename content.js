// Volume Booster content script (all frames)

const KEY_GLOBAL = "gainPercent::GLOBAL";
const keyForHost = (host) => `gainPercent::HOST::${host}`;
const MAX_GAIN_PERCENT = 1000;

let audioCtx = null;
let preGain = null;
let limiter = null;
let desiredGainPercent = 100;

// Keep the MediaElementAudioSourceNode associated with each media element.
// Reusing the same node avoids trying to recreate a source for an element
// that was removed and later reinserted into the DOM.
const sources = new WeakMap();
const monitoredMedia = new WeakSet();
const observedRoots = new WeakSet();

function getHost() {
  // Use the top-level site when possible so media in embedded frames follows
  // the same per-site override as the page the user sees.
  if (window === window.top) {
    return location.hostname || "";
  }

  try {
    return window.top.location.hostname || location.hostname || "";
  } catch {
    // Cross-origin frames cannot read window.top.location. document.referrer
    // normally exposes at least the embedding origin, which is sufficient for
    // first-level embeds. Fall back to the frame's own hostname otherwise.
    try {
      return new URL(document.referrer).hostname || location.hostname || "";
    } catch {
      return location.hostname || "";
    }
  }
}

function sanitizeGain(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(MAX_GAIN_PERCENT, n));
}

function ensureGraph() {
  if (audioCtx) return;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  audioCtx = new AudioContextCtor();
  preGain = audioCtx.createGain();
  limiter = audioCtx.createDynamicsCompressor();

  // Near-transparent at <= 100%, limiter-like behavior above 100%.
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = desiredGainPercent > 100 ? 20 : 1;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;

  preGain.gain.value = desiredGainPercent / 100;
  preGain.connect(limiter);
  limiter.connect(audioCtx.destination);
}

function updateGraphGain() {
  if (!audioCtx || !preGain || !limiter) return;

  const gain = desiredGainPercent / 100;
  preGain.gain.setValueAtTime(gain, audioCtx.currentTime);
  limiter.ratio.setValueAtTime(desiredGainPercent > 100 ? 20 : 1, audioCtx.currentTime);

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

function setGainPercent(value) {
  desiredGainPercent = sanitizeGain(value);
  updateGraphGain();
}

function canRouteThroughWebAudio(element) {
  if (element.srcObject) return true;

  const rawSource = element.currentSrc || element.getAttribute("src") || "";
  if (!rawSource) return false;

  try {
    const sourceUrl = new URL(rawSource, location.href);

    if (sourceUrl.protocol === "blob:" || sourceUrl.protocol === "data:") {
      return true;
    }

    if (sourceUrl.origin === location.origin) {
      return true;
    }

    // Cross-origin media without CORS can become silent when routed through
    // MediaElementAudioSourceNode. Only try it when the element explicitly
    // requests CORS-enabled media.
    return Boolean(element.crossOrigin);
  } catch {
    return false;
  }
}

function attachMedia(element) {
  if (!(element instanceof HTMLMediaElement)) return;

  const existing = sources.get(element);
  if (existing) {
    ensureGraph();
    if (!preGain) return;

    if (!existing.connected) {
      try {
        existing.node.connect(preGain);
        existing.connected = true;
      } catch {
        // Ignore players that cannot be reconnected.
      }
    }
    return;
  }

  if (!canRouteThroughWebAudio(element)) return;

  ensureGraph();
  if (!audioCtx || !preGain) return;

  try {
    const node = audioCtx.createMediaElementSource(element);
    node.connect(preGain);
    sources.set(element, { node, connected: true });
    updateGraphGain();
  } catch {
    // Some cross-origin, DRM, or custom players cannot be redirected
    // through Web Audio. Leave their normal playback untouched.
  }
}


function monitorMedia(element) {
  if (!(element instanceof HTMLMediaElement)) return;

  if (!monitoredMedia.has(element)) {
    monitoredMedia.add(element);

    element.addEventListener("loadedmetadata", () => attachMedia(element));
    element.addEventListener("play", () => {
      attachMedia(element);
      if (audioCtx?.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    });
  }

  attachMedia(element);
}

function detachMedia(element) {
  const record = sources.get(element);
  if (!record?.connected) return;

  try {
    record.node.disconnect();
    record.connected = false;
  } catch {
    // Best-effort cleanup only.
  }
}

function observeRoot(root) {
  if (!root || observedRoots.has(root)) return;
  observedRoots.add(root);

  try {
    observer.observe(root, { childList: true, subtree: true });
  } catch {
    // A root may disappear between discovery and observation.
  }
}

function discoverShadowRoots(root) {
  root.querySelectorAll?.("*").forEach((element) => {
    if (!element.shadowRoot) return;
    observeRoot(element.shadowRoot);
    scanTree(element.shadowRoot);
  });
}

function scanTree(root) {
  if (!root) return;

  if (root instanceof HTMLMediaElement) {
    monitorMedia(root);
  }

  root.querySelectorAll?.("audio, video").forEach(monitorMedia);
  discoverShadowRoots(root);
}

function handleAddedNode(node) {
  if (node instanceof HTMLMediaElement) {
    monitorMedia(node);
    return;
  }

  if (!(node instanceof Element)) return;

  node.querySelectorAll?.("audio, video").forEach(monitorMedia);

  if (node.shadowRoot) {
    observeRoot(node.shadowRoot);
    scanTree(node.shadowRoot);
  }

  discoverShadowRoots(node);
}

function handleRemovedNode(node) {
  if (node instanceof HTMLMediaElement) {
    detachMedia(node);
    return;
  }

  if (node instanceof Element) {
    node.querySelectorAll?.("audio, video").forEach(detachMedia);
  }
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(handleAddedNode);
    mutation.removedNodes.forEach(handleRemovedNode);
  }
});

async function loadInitialGain() {
  const host = getHost();
  const hostKey = keyForHost(host);

  try {
    const data = await chrome.storage.local.get([KEY_GLOBAL, hostKey]);
    setGainPercent(data[hostKey] ?? data[KEY_GLOBAL] ?? 100);
  } catch {
    setGainPercent(100);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "VB_SET_GAIN") return;
  setGainPercent(message.gainPercent);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  const hostKey = keyForHost(getHost());

  if (changes[hostKey]) {
    setGainPercent(changes[hostKey].newValue ?? 100);
    return;
  }

  if (changes[KEY_GLOBAL]) {
    chrome.storage.local.get([hostKey]).then((data) => {
      if (data[hostKey] == null) {
        setGainPercent(changes[KEY_GLOBAL].newValue ?? 100);
      }
    }).catch(() => {});
  }
});

observeRoot(document.documentElement);
scanTree(document);
loadInitialGain();

// Low-frequency fallback for players that create open shadow roots in ways
// the main document observer cannot reliably discover.
setInterval(() => {
  if (document.visibilityState === "visible") {
    scanTree(document);
  }
}, 15000);
