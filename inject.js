(() => {
  const state = {
    rules: []
  };
  const toastState = {
    timerId: null,
    lastAt: 0
  };

  function normalizeRule(rule) {
    return {
      id: rule && typeof rule.id === 'number' ? rule.id : 0,
      enabled: Boolean(rule && rule.enabled),
      name: (rule && rule.name) || '',
      method: (rule && rule.method) || 'ANY',
      debug: Boolean(rule && rule.debug),
      urlPattern: (rule && rule.urlPattern) || '',
      statusCode: rule && rule.statusCode ? Number(rule.statusCode) : 200,
      body: (rule && rule.body) || '',
      notify: Boolean(rule && rule.notify)
    };
  }

  function normalizeRules(list) {
    if (!Array.isArray(list)) {
      return [];
    }
    return list.map((item) => normalizeRule(item));
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
    return { type: 'substring', value: pattern };
  }

  function matchUrl(url, pattern) {
    const matcher = buildMatcher(pattern);
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

  function resolveUrl(rawUrl) {
    if (!rawUrl) {
      return '';
    }
    try {
      return new URL(rawUrl, window.location.href).href;
    } catch (error) {
      return String(rawUrl);
    }
  }

  function methodMatches(rule, method) {
    if (!rule.method || rule.method === 'ANY') {
      return true;
    }
    return rule.method === String(method || '').toUpperCase();
  }

  function findRule(url, method) {
    const resolved = resolveUrl(url);
    return state.rules.find((rule) =>
      rule.enabled && methodMatches(rule, method) && matchUrl(resolved, rule.urlPattern)
    );
  }

  function notifyHit(rule, url) {
    if (!rule.notify) {
      return;
    }
    const label = rule.name ? `已拦截: ${rule.name}` : `已拦截: ${url}`;
    showToast(label);
    window.postMessage({
      source: 'mock-inject',
      type: 'MOCK_HIT',
      url,
      ruleId: rule.id
    }, '*');
  }

  function showToast(message) {
    const now = Date.now();
    if (now - toastState.lastAt < 800) {
      return;
    }
    toastState.lastAt = now;
    let toast = document.getElementById('mock-ext-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mock-ext-toast';
      toast.style.cssText = [
        'position: fixed',
        'right: 16px',
        'bottom: 16px',
        'z-index: 2147483647',
        'max-width: 320px',
        'padding: 10px 12px',
        'border-radius: 10px',
        'background: rgba(30, 30, 30, 0.92)',
        'color: #fff',
        'font-size: 12px',
        'line-height: 1.4',
        'box-shadow: 0 6px 18px rgba(0,0,0,0.25)',
        'opacity: 0',
        'transform: translateY(6px)',
        'transition: opacity 0.2s ease, transform 0.2s ease'
      ].join(';');
      document.documentElement.appendChild(toast);
    }
    toast.textContent = message;
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    window.clearTimeout(toastState.timerId);
    toastState.timerId = window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
    }, 1800);
  }

  function truncatePayload(payload, limit) {
    const safeLimit = typeof limit === 'number' ? limit : 500;
    if (typeof payload !== 'string') {
      return payload;
    }
    if (payload.length <= safeLimit) {
      return payload;
    }
    return `${payload.slice(0, safeLimit)}...(${payload.length})`;
  }

  function describeBody(body) {
    if (body === undefined || body === null) {
      return null;
    }
    if (typeof body === 'string') {
      return body;
    }
    if (body instanceof URLSearchParams) {
      return body.toString();
    }
    if (body instanceof FormData) {
      const entries = [];
      for (const [key, value] of body.entries()) {
        if (value instanceof File) {
          entries.push([key, { name: value.name, size: value.size, type: value.type }]);
        } else {
          entries.push([key, value]);
        }
      }
      return entries;
    }
    if (body instanceof Blob) {
      return { type: body.type, size: body.size };
    }
    if (body instanceof ArrayBuffer) {
      return { byteLength: body.byteLength };
    }
    if (ArrayBuffer.isView(body)) {
      return { byteLength: body.byteLength };
    }
    if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
      return '[ReadableStream]';
    }
    if (typeof body === 'object') {
      try {
        return JSON.stringify(body);
      } catch (error) {
        return Object.prototype.toString.call(body);
      }
    }
    return String(body);
  }

  function debugLog(rule, data) {
    if (!rule || !rule.debug) {
      return;
    }
    const resolved = resolveUrl(data.url);
    const name = rule.name ? ` ${rule.name}` : '';
    console.groupCollapsed(`[mock-ext][debug]${name} ${data.method} ${resolved}`);
    console.log('rule', {
      id: rule.id,
      name: rule.name,
      pattern: rule.urlPattern,
      method: rule.method
    });
    console.log('request', {
      rawUrl: data.url,
      resolvedUrl: resolved,
      method: data.method,
      body: data.body
    });
    console.log('response', data.response);
    console.groupEnd();
  }

  function buildResponse(rule) {
    const payload = rule.body || '{"ok":true}';
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Mock-Ext': '1',
      'X-Mock-Rule': String(rule.id || '')
    });
    return new Response(payload, {
      status: Number.isFinite(rule.statusCode) ? rule.statusCode : 200,
      statusText: 'OK',
      headers
    });
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function fetch(input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method =
        String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const rule = findRule(url, method);
      if (rule) {
        const payload = rule.body || '{"ok":true}';
        const responseInfo = {
          status: Number.isFinite(rule.statusCode) ? rule.statusCode : 200,
          body: truncatePayload(payload)
        };
        const bodyInfo = init && Object.prototype.hasOwnProperty.call(init, 'body')
          ? describeBody(init.body)
          : '[Request body not available]';
        debugLog(rule, { url, method, body: bodyInfo, response: responseInfo });
        notifyHit(rule, url);
        return Promise.resolve(buildResponse(rule));
      }
      return originalFetch.apply(this, arguments);
    };
  }

  const originalSendBeacon = navigator.sendBeacon;
  if (typeof originalSendBeacon === 'function') {
    navigator.sendBeacon = function sendBeacon(url, data) {
      const rule = findRule(url, 'POST');
      if (rule) {
        const payload = rule.body || '{"ok":true}';
        debugLog(rule, {
          url,
          method: 'POST',
          body: describeBody(data),
          response: {
            status: Number.isFinite(rule.statusCode) ? rule.statusCode : 200,
            body: truncatePayload(payload),
            note: 'sendBeacon has no response body'
          }
        });
        notifyHit(rule, url);
        return true;
      }
      return originalSendBeacon.apply(this, arguments);
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  function safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  function buildXhrResponse(rule, responseType) {
    const payload = rule.body || '{"ok":true}';
    if (responseType === 'json') {
      return safeJsonParse(payload);
    }
    if (responseType === 'arraybuffer') {
      const encoder = new TextEncoder();
      return encoder.encode(payload).buffer;
    }
    if (responseType === 'blob') {
      return new Blob([payload], { type: 'application/json' });
    }
    return payload;
  }

  function defineReadonly(target, key, value) {
    try {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        get() {
          return value;
        }
      });
    } catch (error) {
      try {
        target[key] = value;
      } catch (ignored) {
        // Ignore assignment errors for read-only fields.
      }
    }
  }

  XMLHttpRequest.prototype.open = function open(method, url) {
    this.__mockUrl = resolveUrl(url);
    this.__mockMethod = method;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function send(body) {
    const url = this.__mockUrl || '';
    const method = String(this.__mockMethod || 'GET').toUpperCase();
    const rule = findRule(url, method);
    if (rule) {
      const payload = rule.body || '{"ok":true}';
      const status = Number.isFinite(rule.statusCode) ? rule.statusCode : 200;
      const responseType = this.responseType || '';
      debugLog(rule, {
        url,
        method,
        body: describeBody(body),
        response: { status, body: truncatePayload(payload) }
      });
      notifyHit(rule, url);
      defineReadonly(this, 'readyState', 4);
      defineReadonly(this, 'status', status);
      defineReadonly(this, 'statusText', 'OK');
      if (responseType === '' || responseType === 'text' || responseType === 'json') {
        defineReadonly(this, 'responseText', payload);
      }
      defineReadonly(this, 'response', buildXhrResponse(rule, responseType));
      defineReadonly(this, 'responseURL', url);
      try {
        this.getAllResponseHeaders = () => 'content-type: application/json\r\nx-mock-ext: 1\r\n';
        this.getResponseHeader = (name) => {
          if (!name) {
            return null;
          }
          const key = String(name).toLowerCase();
          if (key === 'content-type') {
            return 'application/json';
          }
          if (key === 'x-mock-ext') {
            return '1';
          }
          if (key === 'x-mock-rule') {
            return String(rule.id || '');
          }
          return null;
        };
      } catch (error) {
        // Ignore header overrides if browser blocks them.
      }
      if (typeof this.onreadystatechange === 'function') {
        this.onreadystatechange(new Event('readystatechange'));
      }
      if (typeof this.onload === 'function') {
        this.onload(new Event('load'));
      }
      this.dispatchEvent(new Event('readystatechange'));
      this.dispatchEvent(new Event('load'));
      this.dispatchEvent(new Event('loadend'));
      return;
    }
    return originalSend.apply(this, arguments);
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'mock-ext') {
      return;
    }
    if (event.data.type === 'MOCK_RULES') {
      state.rules = normalizeRules(event.data.rules);
    }
  });

  window.postMessage({ source: 'mock-inject', type: 'MOCK_READY' }, '*');
})();
