# ReqSmith

[中文](/README.md) | [English](/README_EN.md)

轻量级请求拦截与 Mock 插件，支持多规则、提示与自定义响应。

## 功能
- URL 规则拦截（支持 `*` 通配符与 `re:` 正则）
- 按 HTTP Method 过滤（ANY/GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS）
- 自定义返回 JSON 与状态码（页面拦截场景下生效）
- 多规则管理（新增/修改/删除/启用）
- 拦截提示（可选）
- Debug 模式输出请求与响应信息
- 可选“阻止真实请求”（DNR block）

## 安装与使用
1. 打开 `chrome://extensions`，开启「开发者模式」。
2. 点击「加载已解压的扩展程序」，选择本目录。
3. 点击扩展图标打开配置界面，新增/保存规则。
4. 刷新目标页面使规则生效。

## 规则说明
- **规则名称**：用于列表显示与提示。
- **HTTP Method**：只拦截指定方法（ANY 表示全部）。
- **URL 规则**：支持 `*` 通配符或 `re:` 前缀正则，例如：
  - `https://api.example.com/v1/*`
  - `re:^https://log\.example\.com/clientlog/web(\?.*)?$`
- **返回 JSON**：命中时返回的响应体。
- **状态码**：在页面拦截模式下有效。
- **阻止真实请求**：命中规则时直接阻断网络请求（Network 中可能显示 `ERR_BLOCKED_BY_CLIENT`）。
- **拦截弹框**：页面右下角 toast 提示。
- **Debug 输出**：控制台打印拦截详情（请求/响应）。

## Debug 输出内容
当勾选 Debug 输出时，控制台会输出：
- 原始 URL / 解析后的 URL
- Method
- 请求 body（可读取的情况下）
- 返回状态码与响应体（截断显示）

## 重要限制
- **页面拦截模式**：只对页面 JS 发起的 `fetch / XHR / sendBeacon` 生效。
- **浏览器/Service Worker/Worker 发起的请求**：无法直接返回自定义响应体，只能阻断或重定向。
- **抓包工具看不到请求**：页面内拦截会直接返回，不经过网络层。

如需“请求可抓包 + 自定义响应体”，可扩展为 **代理模式**（本地 mock server + Chrome 代理）。

## 文件结构
- `manifest.json`：扩展配置（MV3）
- `popup.html` / `popup.js`：配置 UI
- `background.js`：DNR 规则管理、通知
- `content-script.js` / `inject.js`：页面内拦截逻辑

## 发布到 GitHub（建议流程）
1. 更新版本号：修改 `manifest.json` 中的 `version`。
2. 更新说明：在 `README.md` 增加本次变更摘要（可加 `CHANGELOG`）。
3. 选择许可证：添加 `LICENSE`（常见如 MIT/Apache-2.0）。
4. 打标签发布：
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
5. 在 GitHub Releases 创建同名版本并填写变更说明。

## 开发提示
修改后需要在 `chrome://extensions` 里点击「重新加载」。
