const STORAGE_KEY = 'mockRules';

let currentRules = [];
let currentRuleIds = [];
const lastNotified = new Map();
let isUpdatingRules = false;
let pendingRules = null;

function generateId(usedIds) {
  let nextId = Math.floor(Math.random() * 2000000000) + 1;
  let attempts = 0;
  while (usedIds.has(nextId) && attempts < 5) {
    nextId = Math.floor(Math.random() * 2000000000) + 1;
    attempts += 1;
  }
  return nextId;
}

function normalizeRule(rule) {
  const parsedId = Number.parseInt(rule && rule.id, 10);
  const inRange = Number.isInteger(parsedId) && parsedId > 0 && parsedId <= 2147483647;
  const usedIds = normalizeRule.usedIds || new Set();
  let safeId = inRange ? parsedId : generateId(usedIds);
  while (usedIds.has(safeId)) {
    safeId = generateId(usedIds);
  }
  usedIds.add(safeId);
  normalizeRule.usedIds = usedIds;
  return {
    id: safeId,
    enabled: Boolean(rule && rule.enabled),
    name: (rule && rule.name) || '',
    method: (rule && rule.method) || 'ANY',
    urlPattern: (rule && rule.urlPattern) || '',
    statusCode: (rule && rule.statusCode) || '',
    body: (rule && rule.body) || '',
    notify: Boolean(rule && rule.notify),
    blockNetwork: rule ? rule.blockNetwork !== false : true,
    debug: Boolean(rule && rule.debug)
  };
}

function normalizeRules(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  normalizeRule.usedIds = new Set();
  const normalized = list.map((item) => normalizeRule(item));
  normalizeRule.usedIds = null;
  return normalized;
}

function loadRule() {
  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const rawRules = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    currentRules = normalizeRules(rawRules);
    const normalizedString = JSON.stringify(currentRules);
    const rawString = JSON.stringify(rawRules);
    if (normalizedString !== rawString) {
      chrome.storage.sync.set({ [STORAGE_KEY]: currentRules });
    }
    syncRules(currentRules);
  });
}

function buildMatcher(pattern) {
  if (!pattern) {
    return null;
  }
  if (pattern.startsWith('re:')) {
    return { type: 'regex', value: pattern.slice(3) };
  }
  if (pattern.includes('*')) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regexText = `^${escaped.replace(/\\\*/g, '.*')}$`;
    return { type: 'regex', value: regexText };
  }
  return { type: 'urlFilter', value: pattern };
}

function buildDataUrl(bodyText) {
  const payload = bodyText || '{"ok":true}';
  return `data:application/json;charset=utf-8,${encodeURIComponent(payload)}`;
}

function buildRule(rule, dynamicId) {
  if (!rule.enabled || !rule.urlPattern) {
    return null;
  }
  if (!rule.blockNetwork) {
    return null;
  }
  const matcher = buildMatcher(rule.urlPattern);
  if (!matcher) {
    return null;
  }
  const condition = {};
  if (matcher.type === 'regex') {
    condition.regexFilter = matcher.value;
  } else {
    condition.urlFilter = matcher.value;
  }
  return {
    id: dynamicId,
    priority: 1,
    action: {
      type: 'block'
    },
    condition
  };
}

function syncRules(rules) {
  pendingRules = rules;
  if (isUpdatingRules) {
    return;
  }
  isUpdatingRules = true;
  applyRules();
}

function applyRules() {
  const rules = pendingRules || [];
  pendingRules = null;
  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    const existingIds = Array.isArray(existingRules) ? existingRules.map((rule) => rule.id) : [];
    const nextRules = [];
    let dynamicId = 1;
    rules.forEach((rule) => {
      const built = buildRule(rule, dynamicId);
      if (built) {
        nextRules.push(built);
        dynamicId += 1;
      }
    });
    const removeRuleIds = Array.from(new Set([...existingIds, ...currentRuleIds]));
    const update = {
      removeRuleIds,
      addRules: nextRules
    };
    chrome.declarativeNetRequest.updateDynamicRules(update, () => {
      currentRuleIds = nextRules.map((rule) => rule.id);
      isUpdatingRules = false;
      if (pendingRules) {
        applyRules();
      }
    });
  });
}

function matchForNotify(url, rule) {
  const matcher = buildMatcher(rule.urlPattern);
  if (!matcher) {
    return false;
  }
  if (matcher.type === 'regex') {
    try {
      return new RegExp(matcher.value).test(url);
    } catch (error) {
      return false;
    }
  }
  return url.includes(matcher.value);
}

function maybeNotify(rule, url) {
  if (!rule.notify) {
    return;
  }
  const now = Date.now();
  const key = `${rule.id}:${url}`;
  const lastTime = lastNotified.get(key) || 0;
  if (now - lastTime < 2000) {
    return;
  }
  lastNotified.set(key, now);
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: '请求已拦截',
    message: url
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== 'MOCK_HIT') {
    return;
  }
  const url = message.url || '';
  const rule = currentRules.find((item) => item.id === message.ruleId) || { notify: true, id: message.ruleId };
  maybeNotify(rule, url);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') {
    return;
  }
  if (changes[STORAGE_KEY]) {
    const rawRules = Array.isArray(changes[STORAGE_KEY].newValue)
      ? changes[STORAGE_KEY].newValue
      : [];
    currentRules = normalizeRules(rawRules);
    const normalizedString = JSON.stringify(currentRules);
    const rawString = JSON.stringify(rawRules);
    if (normalizedString !== rawString) {
      chrome.storage.sync.set({ [STORAGE_KEY]: currentRules });
    }
    syncRules(currentRules);
  }
});

loadRule();
