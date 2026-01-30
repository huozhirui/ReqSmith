const STORAGE_KEY = 'dnsRules';

const elements = {
  ruleList: document.getElementById('ruleList'),
  ruleName: document.getElementById('ruleName'),
  matchType: document.getElementById('matchType'),
  enabled: document.getElementById('enabled'),
  source: document.getElementById('source'),
  sourcePort: document.getElementById('sourcePort'),
  sourcePortWrap: document.getElementById('sourcePortWrap'),
  targetHost: document.getElementById('targetHost'),
  targetPort: document.getElementById('targetPort'),
  targetScheme: document.getElementById('targetScheme'),
  add: document.getElementById('add'),
  save: document.getElementById('save'),
  remove: document.getElementById('remove'),
  openMock: document.getElementById('openMock'),
  status: document.getElementById('status')
};

let rules = [];
let selectedRuleId = null;

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
    matchType: (rule && rule.matchType) || 'domain',
    source: (rule && rule.source) || '',
    sourcePort: (rule && rule.sourcePort) || '',
    targetHost: (rule && rule.targetHost) || '',
    targetPort: (rule && rule.targetPort) || '',
    targetScheme: (rule && rule.targetScheme) || 'keep'
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
    const label = rule.name || rule.source || `规则 ${rule.id}`;
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
  elements.ruleName.value = rule.name;
  elements.matchType.value = rule.matchType || 'domain';
  elements.enabled.checked = rule.enabled;
  elements.source.value = rule.source;
  elements.sourcePort.value = rule.sourcePort;
  elements.targetHost.value = rule.targetHost;
  elements.targetPort.value = rule.targetPort;
  elements.targetScheme.value = rule.targetScheme || 'keep';
  updateMatchTypeUI();
  renderRuleList();
}

function updateMatchTypeUI() {
  const isDomainPort = elements.matchType.value === 'domainPort';
  elements.sourcePortWrap.style.display = isDomainPort ? 'block' : 'none';
}

function loadRules() {
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
  const source = elements.source.value.trim();
  const targetHost = elements.targetHost.value.trim();
  const matchType = elements.matchType.value || 'domain';
  const sourcePort = elements.sourcePort.value ? String(elements.sourcePort.value) : '';
  if (!source || !targetHost) {
    showStatus('请填写源与目标 Host/IP');
    return;
  }
  if (matchType === 'domainPort' && !sourcePort) {
    showStatus('请填写源端口');
    return;
  }
  const usedIds = new Set(rules.filter((item) => item.id !== selectedRuleId).map((item) => item.id));
  rules[index] = normalizeRule({
    id: selectedRuleId,
    enabled: elements.enabled.checked,
    name: elements.ruleName.value.trim(),
    matchType,
    source,
    sourcePort,
    targetHost,
    targetPort: elements.targetPort.value ? String(elements.targetPort.value) : '',
    targetScheme: elements.targetScheme.value || 'keep'
  }, usedIds);
  chrome.storage.sync.set({ [STORAGE_KEY]: rules });
  renderRuleList();
  showStatus('修改成功');
}

function addRule() {
  const usedIds = new Set(rules.map((item) => item.id));
  const rule = normalizeRule({ id: generateId(usedIds) }, usedIds);
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

elements.matchType.addEventListener('change', () => {
  updateMatchTypeUI();
});

elements.remove.addEventListener('click', removeRule);

if (elements.openMock) {
  elements.openMock.addEventListener('click', () => {
    window.open(chrome.runtime.getURL('popup.html'));
  });
}

updateMatchTypeUI();
loadRules();
