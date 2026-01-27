const STORAGE_KEY = 'mockRules';

const elements = {
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

elements.save.addEventListener('click', saveRule);
elements.add.addEventListener('click', addRule);
elements.remove.addEventListener('click', removeRule);

loadRule();
