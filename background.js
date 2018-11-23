chrome.runtime.onInstalled.addListener((object) => {
  if (chrome.runtime.OnInstalledReason.INSTALL === object.reason) {
    chrome.tabs.create({ url: 'https://www.leadexporter.io/extension-installed' }, (tab) => {
    });
  }
});
