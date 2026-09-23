# Volume Booster

A lightweight Chrome/Chromium extension that amplifies HTML audio and video above the normal 100% level using the Web Audio API.

## Features

- Gain control from 0% to 1000%.
- Global volume level plus per-site overrides.
- Presets for common boost levels.
- Limiter-style compression above 100% to reduce clipping peaks.
- Automatic detection of dynamically added `<audio>` and `<video>` elements.
- Support for media inside open Shadow DOM roots.
- No accounts, analytics, ads, remote code, or external services.

## Safety

High gain can become unexpectedly loud and can damage hearing or speakers. Increase the level gradually. The limiter reduces peaks but cannot make extreme amplification safe or distortion-free.

## How it works

The content script detects compatible `HTMLMediaElement` instances and routes them through a Web Audio graph:

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

At 100% and below, the compressor ratio is set to 1:1 so normal playback is not intentionally compressed. Above 100%, a high-ratio compressor is enabled near 0 dB to reduce clipping peaks.

The extension creates an `AudioContext` lazily, only after a compatible media element is found.

## Per-site and global settings

Settings are stored locally with `chrome.storage.local`.

- **Global enabled:** the slider edits the global gain.
- **Global disabled:** the current site receives its own override.
- **Reset site:** removes the site override and returns the site to the global value.
- **Reset global:** returns the global value to 100%.

No settings are transmitted to a server.

## Browser permissions

The extension requests:

- `storage` to save the global value and per-site overrides locally.
- `activeTab` so the popup can identify the tab the user invoked the extension on.

The content script uses `<all_urls>` because media can appear on any normal website. Restricted browser pages such as `chrome://` pages cannot be modified.

## Known limitations

The current implementation operates on page media elements rather than the final audio output of the browser tab. As a result, some sources cannot be boosted, including certain:

- cross-origin media without CORS support;
- DRM-protected players;
- custom audio pipelines;
- media inside closed Shadow DOM roots;
- browser-internal/restricted pages.

For cross-origin media without CORS, the extension deliberately avoids Web Audio routing when it can detect that doing so could silence playback.

A future architecture may use `chrome.tabCapture` to process the final audio stream of the active tab instead.

## Development

1. Clone this repository.
2. Open `chrome://extensions` in Chrome or Chromium.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository directory.

After changing extension files, reload the extension from `chrome://extensions` and reload the test page.

## Project structure

```text
volume-booster/
├── content.js       # Media discovery and Web Audio processing
├── popup.html       # Popup interface
├── popup.js         # Popup state, storage and extension messaging
├── manifest.json    # Manifest V3 configuration
├── icons/           # Extension icons
├── PRIVACY.md       # Privacy information
└── CHANGELOG.md     # Release notes
```

## Privacy

Volume Booster does not collect or transmit browsing history, audio, page content, personal information, or usage analytics. See [PRIVACY.md](PRIVACY.md).

## Contributing

Bug reports and focused pull requests are welcome. For audio bugs, include the affected site, browser version, whether the media is embedded in an iframe, and whether the problem occurs at 100% or only above 100%.
