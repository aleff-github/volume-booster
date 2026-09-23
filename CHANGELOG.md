# Changelog

## 1.3.0

### Cross-browser packaging

- Added dedicated `chrome/` and `firefox/` targets.
- Moved shared runtime code to `common/` to avoid maintaining duplicate browser implementations.
- Added a zero-dependency Python build script that validates both targets and creates unpacked directories plus ZIP packages.
- Added a Firefox Manifest V3 Gecko ID and explicit `data_collection_permissions: { required: ["none"] }` declaration for AMO.
- Added a small WebExtensions namespace compatibility layer (`browser` on Firefox, `chrome` on Chromium).

### Changed

- Replaced page-level `window.postMessage` control messages with Chrome extension messaging.
- Removed the runtime `scripting.executeScript()` dependency.
- Reduced manifest permissions and removed packaged Web Store metadata from source control.
- Made `AudioContext` creation lazy so pages without compatible media do not create audio graphs.
- Made the limiter effectively transparent at 100% and below, and enabled high-ratio limiting only above 100%.
- Reduced full-document fallback scanning from every 2.5 seconds to every 15 seconds and only while the document is visible.
- Improved handling of dynamically inserted media and open Shadow DOM roots.
- Reuse `MediaElementAudioSourceNode` instances when media elements are removed and reinserted.
- Avoid routing detectable cross-origin media without CORS through Web Audio to reduce the risk of silent playback.
- Fixed Global/per-site switching so creating a site override inherits the current effective value.
- Fixed site reset so the UI immediately returns to Global mode.
- Improved popup keyboard focus states and control labels.

### Removed

- Unused `sw.js` service worker file.
- Chrome Web Store `_metadata` files.
- Manifest `key`, `update_url`, `scripting`, and broad `host_permissions` entries that were not needed by the revised implementation.
