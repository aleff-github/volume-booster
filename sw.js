chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "SET_GAIN_NOW") return;

  const tabId = msg.tabId;
  const gainPercent = Number(msg.gainPercent);

  if (!tabId || !Number.isFinite(gainPercent)) return;

  chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    args: [gainPercent],
    func: (gp) => {
      window.postMessage({ __VB_SET_GAIN: gp }, "*");
    }
  });
});
