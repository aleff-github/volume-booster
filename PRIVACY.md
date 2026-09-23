# Privacy Policy

**Volume Booster** processes audio controls locally in the user's browser.

## Data collection

The extension does **not** collect, sell, transmit, or share personal data.

It does not use analytics, advertising SDKs, tracking pixels, remote logging, or external APIs.

## Local storage

The extension uses `chrome.storage.local` only to store:

- the user's global gain percentage; and
- optional gain overrides associated with website hostnames.

These values remain in the browser's extension storage and are not sent to the developer or to third parties by the extension.

## Page access

The extension runs a content script on normal webpages so it can discover compatible HTML `<audio>` and `<video>` elements and apply the selected gain locally.

The extension does not transmit page content or browsing history.

## Audio processing

Compatible media is processed locally with the browser's Web Audio API. The extension does not record, upload, or store audio.

## Changes

If the extension's data practices change in a future release, this document should be updated before that release is distributed.
