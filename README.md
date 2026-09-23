# Volume Booster

A lightweight cross-browser WebExtension that amplifies HTML audio and video beyond the normal 100% level using the Web Audio API.

## Browser targets

The repository now has explicit browser-specific targets while keeping the runtime code shared:

```text
volume-booster/
├── common/
│   ├── content.js
│   ├── popup.html
│   └── popup.js
├── chrome/
│   └── manifest.json
├── firefox/
│   └── manifest.json
├── icons/
├── scripts/
│   └── build.py
├── dist/                 # generated; ignored by Git
├── README.md
├── PRIVACY.md
└── CHANGELOG.md
```

The shared JavaScript selects the Promise-based `browser.*` namespace on Firefox and `chrome.*` on Chromium, so both browsers use the same runtime implementation. Browser-specific differences stay in their manifests.

## Build

No Node.js dependencies or external build tools are required. Python 3 is enough:

```bash
python scripts/build.py
```

The build validates both manifests, checks the shared files and required icons, then creates:

```text
dist/
├── chrome/
├── firefox/
├── volume-booster-chrome-1.3.0.zip
└── volume-booster-firefox-1.3.0.zip
```

### Test in Chrome / Chromium

1. Run `python scripts/build.py`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select `dist/chrome/`.

### Test in Firefox

1. Run `python scripts/build.py`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on…**.
4. Select `dist/firefox/manifest.json`.

The Firefox target requires Firefox 140 or later, contains a dedicated Gecko extension ID, and declares that the extension does not collect or transmit data.

## Features

- Gain control from 0% to 1000%.
- Global volume plus per-site overrides.
- Presets for common boost levels.
- Limiter-style compression above 100% to reduce clipping peaks.
- Automatic detection of dynamically added `<audio>` and `<video>` elements.
- Support for media inside open Shadow DOM roots.
- No accounts, analytics, ads, remote code, or external services.

## Safety

High gain can become unexpectedly loud and can damage hearing or speakers. Increase the level gradually. The limiter reduces peaks but cannot make extreme amplification safe or distortion-free.

## How it works

Compatible media is routed locally through:

```text
HTMLMediaElement
      |
MediaElementAudioSourceNode
      |
GainNode
      |
DynamicsCompressorNode
      |
AudioContext.destination
```

At 100% and below, the compressor ratio is 1:1 so normal playback is not intentionally compressed. Above 100%, high-ratio compression is enabled near 0 dB to reduce clipping peaks.

The `AudioContext` is created lazily only after compatible media is found.

## Global and per-site settings

Settings are stored locally with the WebExtensions storage API.

- **Global enabled:** the slider edits the global gain.
- **Global disabled:** the current site receives its own override.
- **Reset site:** removes that override and returns to the global value.
- **Reset global:** resets the global value to 100%.

No settings are sent to a server.

## Permissions

Both builds request:

- `storage`: stores gain settings locally.
- `activeTab`: lets the popup identify and message the tab where the user invoked the extension.

A declarative content script runs on normal webpages because media can appear on any website. Restricted browser pages cannot be modified.

## Known limitations

The current implementation works at the HTML media/Web Audio layer rather than processing the final tab output. Some sources therefore cannot be boosted reliably, including certain:

- cross-origin media without CORS support;
- DRM-protected players;
- custom audio pipelines;
- media inside closed Shadow DOM roots;
- browser-internal or otherwise restricted pages.

For detectable cross-origin media without CORS, the extension avoids Web Audio routing when doing so could silence playback.

A future major version may evaluate a tab-capture architecture for browsers that support it appropriately.

## Privacy

Volume Booster does not collect or transmit browsing history, audio, page content, personal information, or usage analytics. See [PRIVACY.md](PRIVACY.md).

## Development

Source changes should normally be made in `common/`. Browser-specific changes belong in `chrome/manifest.json` or `firefox/manifest.json`.

After editing:

```bash
python scripts/build.py
```

Then reload the corresponding generated directory in the browser.
