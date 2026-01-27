(function () {
  const STORAGE_KEY = 'mockRules';

  function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = () => {
      script.remove();
      sendRules();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  function sendRules(rules) {
    if (!rules) {
      chrome.storage.sync.get(STORAGE_KEY, (data) => {
        const list = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
        window.postMessage({ source: 'mock-ext', type: 'MOCK_RULES', rules: list }, '*');
      });
      return;
    }
    window.postMessage({ source: 'mock-ext', type: 'MOCK_RULES', rules }, '*');
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[STORAGE_KEY]) {
      return;
    }
    const list = Array.isArray(changes[STORAGE_KEY].newValue) ? changes[STORAGE_KEY].newValue : [];
    sendRules(list);
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'mock-inject') {
      return;
    }
    if (event.data.type === 'MOCK_READY') {
      sendRules();
      return;
    }
    if (event.data.type === 'MOCK_HIT') {
      if (!chrome.runtime || !chrome.runtime.id) {
        return;
      }
      try {
        chrome.runtime.sendMessage({
          type: 'MOCK_HIT',
          url: event.data.url,
          ruleId: event.data.ruleId
        }, () => {
          if (chrome.runtime.lastError) {
            // Extension reloaded; ignore message failures.
          }
        });
      } catch (error) {
        // Extension context invalidated; ignore.
      }
    }
  });

  injectScript();
})();
