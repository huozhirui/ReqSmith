const STORAGE_KEY = 'mockRules';
const DNS_STORAGE_KEY = 'dnsRules';

const elements = {
  tabMock: document.getElementById('tabMock'),
  tabDns: document.getElementById('tabDns'),
  panelMock: document.getElementById('panelMock'),
  panelDns: document.getElementById('panelDns'),
  ruleList: document.getElementById('ruleList'),
  ruleName: document.getElementById('ruleName'),
  method: document.getElementById('method'),
  urlPattern: document.getElementById('urlPattern'),
  statusCode: document.getElementById('statusCode'),
  enabled: document.getElementById('enabled'),
  notify: document.getElementById('notify'),
  blockNetwork: document.getElementById('blockNetwork'),
  debug: document.getElementById('debug'),
  body: document.getElementById('body'),
  add: document.getElementById('add'),
  save: document.getElementById('save'),
  remove: document.getElementById('remove'),
  status: document.getElementById('status'),
  dnsRuleList: document.getElementById('dnsRuleList'),
  dnsTestUrl: document.getElementById('dnsTestUrl'),
  dnsTest: document.getElementById('dnsTest'),
  dnsRuleName: document.getElementById('dnsRuleName'),
  dnsMatchType: document.getElementById('dnsMatchType'),
  dnsEnabled: document.getElementById('dnsEnabled'),
  dnsSource: document.getElementById('dnsSource'),
  dnsSourcePort: document.getElementById('dnsSourcePort'),
  dnsSourcePortWrap: document.getElementById('dnsSourcePortWrap'),
  dnsTargetHost: document.getElementById('dnsTargetHost'),
  dnsTargetPort: document.getElementById('dnsTargetPort'),
  dnsTargetScheme: document.getElementById('dnsTargetScheme'),
  dnsAdd: document.getElementById('dnsAdd'),
  dnsSave: document.getElementById('dnsSave'),
  dnsRemove: document.getElementById('dnsRemove'),
  dnsDump: document.getElementById('dnsDump'),
  dnsRulesView: document.getElementById('dnsRulesView'),
  dnsStatus: document.getElementById('dnsStatus')
};

let rules = [];
let selectedRuleId = null;
let dnsRules = [];
let selectedDnsRuleId = null;

function generateId(usedIds) {
  let nextId = Math.floor(Math.random() * 2000000000) + 1;
  let attempts = 0;
  while (usedIds.has(nextId) && attempts < 5) {
    nextId = Math.floor(Math.random() * 2000000000) + 1;
    attempts += 1;
  }
  return nextId;
}

function normalizeRule(rule, usedIds) {
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
  const usedIds = new Set();
  return list.map((item) => normalizeRule(item, usedIds));
}

function renderRuleList() {
  elements.ruleList.innerHTML = '';
  rules.forEach((rule) => {
    const btn = document.createElement('button');
    const label = rule.name || rule.urlPattern || `规则 ${rule.id}`;
    btn.textContent = label;
    btn.className = rule.id === selectedRuleId ? '' : 'secondary';
    btn.addEventListener('click', () => {
      selectRule(rule.id);
    });
    elements.ruleList.appendChild(btn);
  });
}

function selectRule(ruleId) {
  selectedRuleId = ruleId;
  const rule = rules.find((item) => item.id === ruleId);
  if (!rule) {
    return;
  }
  elements.urlPattern.value = rule.urlPattern;
  elements.method.value = rule.method || 'ANY';
  elements.ruleName.value = rule.name;
  elements.statusCode.value = rule.statusCode;
  elements.enabled.checked = rule.enabled;
  elements.body.value = rule.body;
  elements.notify.checked = rule.notify;
  elements.blockNetwork.checked = rule.blockNetwork;
  elements.debug.checked = rule.debug;
  renderRuleList();
}

function loadRule() {
  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    rules = normalizeRules(data[STORAGE_KEY]);
    if (rules.length === 0) {
      const usedIds = new Set();
      const rule = normalizeRule({}, usedIds);
      rules.push(rule);
      selectedRuleId = rule.id;
    } else {
      selectedRuleId = rules[0].id;
    }
    renderRuleList();
    selectRule(selectedRuleId);
  });
}

function saveRule() {
  const index = rules.findIndex((item) => item.id === selectedRuleId);
  if (index === -1) {
    showStatus('未找到规则');
    return;
  }
  const usedIds = new Set(rules.filter((item) => item.id !== selectedRuleId).map((item) => item.id));
  rules[index] = normalizeRule({
    id: selectedRuleId,
    enabled: elements.enabled.checked,
    name: elements.ruleName.value.trim(),
    method: elements.method.value || 'ANY',
    urlPattern: elements.urlPattern.value.trim(),
    statusCode: elements.statusCode.value ? Number(elements.statusCode.value) : '',
    body: elements.body.value.trim(),
    notify: elements.notify.checked,
    blockNetwork: elements.blockNetwork.checked,
    debug: elements.debug.checked
  }, usedIds);
  chrome.storage.sync.set({ [STORAGE_KEY]: rules });
  renderRuleList();
  showStatus('修改成功');
}

function addRule() {
  const usedIds = new Set(rules.map((item) => item.id));
  const rule = normalizeRule({ id: generateId(usedIds), blockNetwork: true }, usedIds);
  rules.push(rule);
  selectedRuleId = rule.id;
  chrome.storage.sync.set({ [STORAGE_KEY]: rules });
  renderRuleList();
  selectRule(rule.id);
  showStatus('新增成功');
}

function removeRule() {
  if (!selectedRuleId) {
    showStatus('请先选择规则');
    return;
  }
  if (rules.length <= 1) {
    showStatus('至少保留一条规则');
    return;
  }
  const confirmed = window.confirm('确认删除当前规则？删除后无法恢复。');
  if (!confirmed) {
    showStatus('已取消删除');
    return;
  }
  rules = rules.filter((item) => item.id !== selectedRuleId);
  selectedRuleId = rules[0].id;
  chrome.storage.sync.set({ [STORAGE_KEY]: rules });
  renderRuleList();
  selectRule(selectedRuleId);
  showStatus('已删除');
}

function showStatus(message) {
  elements.status.textContent = message;
  window.clearTimeout(showStatus.timerId);
  showStatus.timerId = window.setTimeout(() => {
    elements.status.textContent = '';
  }, 1500);
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

function renderDnsRuleList() {
  elements.dnsRuleList.innerHTML = '';
  dnsRules.forEach((rule) => {
    const btn = document.createElement('button');
    const label = rule.name || rule.source || `规则 ${rule.id}`;
    btn.textContent = label;
    btn.className = rule.id === selectedDnsRuleId ? '' : 'secondary';
    btn.addEventListener('click', () => {
      selectDnsRule(rule.id);
    });
    elements.dnsRuleList.appendChild(btn);
  });
}

function selectDnsRule(ruleId) {
  selectedDnsRuleId = ruleId;
  const rule = dnsRules.find((item) => item.id === ruleId);
  if (!rule) {
    return;
  }
  elements.dnsRuleName.value = rule.name;
  elements.dnsMatchType.value = rule.matchType || 'domain';
  elements.dnsEnabled.checked = rule.enabled;
  elements.dnsSource.value = rule.source;
  elements.dnsSourcePort.value = rule.sourcePort;
  elements.dnsTargetHost.value = rule.targetHost;
  elements.dnsTargetPort.value = rule.targetPort;
  elements.dnsTargetScheme.value = rule.targetScheme || 'keep';
  updateDnsMatchTypeUI();
  renderDnsRuleList();
}

function updateDnsMatchTypeUI() {
  const isDomainPort = elements.dnsMatchType.value === 'domainPort';
  elements.dnsSourcePortWrap.style.display = isDomainPort ? 'block' : 'none';
}

function loadDnsRules() {
  chrome.storage.sync.get(DNS_STORAGE_KEY, (data) => {
    dnsRules = normalizeDnsRules(data[DNS_STORAGE_KEY]);
    if (dnsRules.length === 0) {
      const usedIds = new Set();
      const rule = normalizeDnsRule({}, usedIds);
      dnsRules.push(rule);
      selectedDnsRuleId = rule.id;
    } else {
      selectedDnsRuleId = dnsRules[0].id;
    }
    renderDnsRuleList();
    selectDnsRule(selectedDnsRuleId);
  });
}

function saveDnsRule() {
  const index = dnsRules.findIndex((item) => item.id === selectedDnsRuleId);
  if (index === -1) {
    showDnsStatus('未找到规则');
    return;
  }
  const source = elements.dnsSource.value.trim();
  const targetHost = elements.dnsTargetHost.value.trim();
  const matchType = elements.dnsMatchType.value || 'domain';
  const sourcePort = elements.dnsSourcePort.value ? String(elements.dnsSourcePort.value) : '';
  if (!source || !targetHost) {
    showDnsStatus('请填写源与目标 Host/IP');
    return;
  }
  if (matchType === 'domainPort' && !sourcePort) {
    showDnsStatus('请填写源端口');
    return;
  }
  const usedIds = new Set(dnsRules.filter((item) => item.id !== selectedDnsRuleId).map((item) => item.id));
  dnsRules[index] = normalizeDnsRule({
    id: selectedDnsRuleId,
    enabled: elements.dnsEnabled.checked,
    name: elements.dnsRuleName.value.trim(),
    matchType,
    source,
    sourcePort,
    targetHost,
    targetPort: elements.dnsTargetPort.value ? String(elements.dnsTargetPort.value) : '',
    targetScheme: elements.dnsTargetScheme.value || 'keep'
  }, usedIds);
  chrome.storage.sync.set({ [DNS_STORAGE_KEY]: dnsRules });
  renderDnsRuleList();
  showDnsStatus('修改成功');
}

function addDnsRule() {
  const usedIds = new Set(dnsRules.map((item) => item.id));
  const rule = normalizeDnsRule({ id: generateId(usedIds) }, usedIds);
  dnsRules.push(rule);
  selectedDnsRuleId = rule.id;
  chrome.storage.sync.set({ [DNS_STORAGE_KEY]: dnsRules });
  renderDnsRuleList();
  selectDnsRule(rule.id);
  showDnsStatus('新增成功');
}

function removeDnsRule() {
  if (!selectedDnsRuleId) {
    showDnsStatus('请先选择规则');
    return;
  }
  if (dnsRules.length <= 1) {
    showDnsStatus('至少保留一条规则');
    return;
  }
  const confirmed = window.confirm('确认删除当前规则？删除后无法恢复。');
  if (!confirmed) {
    showDnsStatus('已取消删除');
    return;
  }
  dnsRules = dnsRules.filter((item) => item.id !== selectedDnsRuleId);
  selectedDnsRuleId = dnsRules[0].id;
  chrome.storage.sync.set({ [DNS_STORAGE_KEY]: dnsRules });
  renderDnsRuleList();
  selectDnsRule(selectedDnsRuleId);
  showDnsStatus('已删除');
}

function showDnsStatus(message) {
  elements.dnsStatus.textContent = message;
  window.clearTimeout(showDnsStatus.timerId);
  showDnsStatus.timerId = window.setTimeout(() => {
    elements.dnsStatus.textContent = '';
  }, 1500);
}

function setActiveTab(name) {
  const isMock = name === 'mock';
  elements.tabMock.classList.toggle('active', isMock);
  elements.tabDns.classList.toggle('active', !isMock);
  elements.panelMock.classList.toggle('active', isMock);
  elements.panelDns.classList.toggle('active', !isMock);
}

elements.tabMock.addEventListener('click', () => setActiveTab('mock'));
elements.tabDns.addEventListener('click', () => setActiveTab('dns'));

updateDnsMatchTypeUI();

elements.save.addEventListener('click', saveRule);
elements.add.addEventListener('click', addRule);
elements.remove.addEventListener('click', removeRule);

elements.dnsMatchType.addEventListener('change', () => {
  updateDnsMatchTypeUI();
});

elements.dnsSave.addEventListener('click', saveDnsRule);
elements.dnsAdd.addEventListener('click', addDnsRule);
elements.dnsRemove.addEventListener('click', removeDnsRule);

if (elements.dnsDump) {
  elements.dnsDump.addEventListener('click', () => {
    if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.getDynamicRules) {
      showDnsStatus('当前环境无法读取规则');
      return;
    }
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        showDnsStatus('读取失败');
        return;
      }
      const view = rules && rules.length ? JSON.stringify(rules, null, 2) : '当前没有动态规则';
      if (elements.dnsRulesView) {
        elements.dnsRulesView.textContent = view;
      }
    });
  });
}

if (elements.dnsTest) {
  elements.dnsTest.addEventListener('click', () => {
    const url = elements.dnsTestUrl ? elements.dnsTestUrl.value.trim() : '';
    if (!url) {
      showDnsStatus('请填写测试 URL');
      return;
    }
    if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.testMatchOutcome) {
      showDnsStatus('当前环境不支持测试');
      return;
    }
    const types = ['main_frame', 'xmlhttprequest', 'sub_frame', 'other'];
    const results = [];
    let pending = types.length;
    types.forEach((type) => {
      chrome.declarativeNetRequest.testMatchOutcome({
        url,
        type,
        method: 'get'
      }, (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          pending -= 1;
          if (pending === 0) {
            showDnsStatus('测试失败');
          }
          return;
        }
        if (result && result.matchedRules && result.matchedRules.length) {
          results.push({ type, matchedRules: result.matchedRules });
        }
        pending -= 1;
        if (pending === 0) {
          const view = results.length
            ? JSON.stringify(results, null, 2)
            : '未命中任何规则';
          if (elements.dnsRulesView) {
            elements.dnsRulesView.textContent = view;
          }
        }
      });
    });
  });
}

loadRule();
loadDnsRules();
