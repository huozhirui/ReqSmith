const STORAGE_KEY = 'mockRules';
const DNS_KEY = 'dnsRules';

let currentRules = [];
let currentDnsRules = [];
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

function normalizeMockRule(rule) {
  const parsedId = Number.parseInt(rule && rule.id, 10);
  const inRange = Number.isInteger(parsedId) && parsedId > 0 && parsedId <= 2147483647;
  const usedIds = normalizeMockRule.usedIds || new Set();
  let safeId = inRange ? parsedId : generateId(usedIds);
  while (usedIds.has(safeId)) {
    safeId = generateId(usedIds);
  }
  usedIds.add(safeId);
  normalizeMockRule.usedIds = usedIds;
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

function normalizeMockRules(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  normalizeMockRule.usedIds = new Set();
  const normalized = list.map((item) => normalizeMockRule(item));
  normalizeMockRule.usedIds = null;
  return normalized;
}

function normalizeDnsRule(rule, usedIds) {
  const parsedId = Number.parseInt(rule && rule.id, 10);
  const inRange = Number.isInteger(parsedId) && parsedId > 0 && parsedId <= 2147483647;
  let safeId = inRange ? parsedId : generateId(usedIds);
  while (usedIds.has(safeId)) {
    safeId = generateId(usedIds);
  }
  usedIds.add(safeId);
  return {
    id: safeId,
    enabled: Boolean(rule && rule.enabled),
    name: (rule && rule.name) || '',
    matchType: (rule && rule.matchType) || 'domain',
    source: (rule && rule.source) || '',
    sourcePort: (rule && rule.sourcePort) || '',
    targetHost: (rule && rule.targetHost) || '',
    targetPort: (rule && rule.targetPort) || '',
    targetScheme: (rule && rule.targetScheme) || 'keep'
  };
}

function normalizeDnsRules(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const usedIds = new Set();
  return list.map((item) => normalizeDnsRule(item, usedIds));
}

function loadRules() {
  chrome.storage.sync.get([STORAGE_KEY, DNS_KEY], (data) => {
    const rawRules = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    const rawDnsRules = Array.isArray(data[DNS_KEY]) ? data[DNS_KEY] : [];
    currentRules = normalizeMockRules(rawRules);
    currentDnsRules = normalizeDnsRules(rawDnsRules);
    const updates = {};
    if (JSON.stringify(currentRules) !== JSON.stringify(rawRules)) {
      updates[STORAGE_KEY] = currentRules;
    }
    if (JSON.stringify(currentDnsRules) !== JSON.stringify(rawDnsRules)) {
      updates[DNS_KEY] = currentDnsRules;
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.sync.set(updates);
    }
    syncRules();
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

function buildBlockRule(rule, dynamicId) {
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

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDnsCondition(rule) {
  if (rule.matchType === 'url') {
    const source = String(rule.source || '').trim();
    if (!source) {
      return null;
    }
    if (!source.startsWith('re:') && !source.includes('*') && (/^https?:\/\//i).test(source)) {
      const escaped = escapeRegex(source);
      return { regexFilter: `^${escaped}(/|$)` };
    }
    const matcher = buildMatcher(source);
    if (!matcher) {
      return null;
    }
    if (matcher.type === 'regex') {
      return { regexFilter: matcher.value };
    }
    return { urlFilter: matcher.value };
  }
  const domain = String(rule.source || '').trim();
  if (!domain) {
    return null;
  }
  const port = String(rule.sourcePort || '').trim();
  if (rule.matchType === 'domainPort') {
    if (!port) {
      return null;
    }
    return { urlFilter: `${domain}:${port}` };
  }
  return { urlFilter: domain };
}


function buildDnsRule(rule, dynamicId) {
  if (!rule.enabled) {
    return null;
  }
  const targetHost = String(rule.targetHost || '').trim();
  if (!targetHost) {
    return null;
  }
  const condition = buildDnsCondition(rule);
  if (!condition) {
    return null;
  }
  const transform = {
    host: targetHost
  };
  if (rule.targetScheme && rule.targetScheme !== 'keep') {
    transform.scheme = rule.targetScheme;
  }
  if (rule.targetPort) {
    transform.port = String(rule.targetPort);
  }
  return {
    id: dynamicId,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: { transform }
    },
    condition: {
      ...condition,
      resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'other']
    }
  };
}

function syncRules() {
  pendingRules = {
    mock: currentRules,
    dns: currentDnsRules
  };
  if (isUpdatingRules) {
    return;
  }
  isUpdatingRules = true;
  applyRules();
}

function applyRules() {
  const rules = pendingRules || { mock: currentRules, dns: currentDnsRules };
  pendingRules = null;
  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    const existingIds = Array.isArray(existingRules) ? existingRules.map((rule) => rule.id) : [];
    const nextRules = [];
    let dynamicId = 1;
    rules.mock.forEach((rule) => {
      const built = buildBlockRule(rule, dynamicId);
      if (built) {
        nextRules.push(built);
        dynamicId += 1;
      }
    });
    rules.dns.forEach((rule) => {
      const built = buildDnsRule(rule, dynamicId);
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
    currentRules = normalizeMockRules(rawRules);
    const normalizedString = JSON.stringify(currentRules);
    const rawString = JSON.stringify(rawRules);
    if (normalizedString !== rawString) {
      chrome.storage.sync.set({ [STORAGE_KEY]: currentRules });
    }
    syncRules();
  }
  if (changes[DNS_KEY]) {
    const rawDnsRules = Array.isArray(changes[DNS_KEY].newValue) ? changes[DNS_KEY].newValue : [];
    currentDnsRules = normalizeDnsRules(rawDnsRules);
    const normalizedDnsString = JSON.stringify(currentDnsRules);
    const rawDnsString = JSON.stringify(rawDnsRules);
    if (normalizedDnsString !== rawDnsString) {
      chrome.storage.sync.set({ [DNS_KEY]: currentDnsRules });
    }
    syncRules();
  }
});

loadRules();
