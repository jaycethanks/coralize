import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { ColorController } from './controller';

export function viewHtml(webview: vscode.Webview, root: vscode.Uri): string {
  const resource = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(root, 'media', name)).toString();
  const nonce = randomBytes(18).toString('base64');
  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${resource('main.css')}"><title>Coralize</title>
</head><body>
<main>
  <header>
    <div class="color-heading"><h1 id="color-name">珊瑚红</h1><div class="actions">
      <form id="hex-form"><label class="sr-only" for="hex">HEX，回车应用</label><input id="hex" value="#F04A3A" maxlength="7" spellcheck="false" autocomplete="off" title="输入 HEX，回车应用；覆盖工作区配色" aria-describedby="feedback" disabled><span id="saving" class="sr-only" role="status" aria-live="polite"></span></form>
      <button id="settings-open" aria-label="配色设置" title="配色设置" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg></button>
    </div></div>
  </header>
  <dialog id="settings-dialog" aria-labelledby="settings-title">
  <div class="dialog-heading"><h2 id="settings-title">应用区域</h2><div class="actions"><button id="settings-close" aria-label="关闭设置" title="关闭"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div></div>
  <div class="window-preview" role="img" aria-label="颜色应用区域示意">
    <div id="preview-title"></div><div class="preview-body"><div id="preview-activity"></div><div class="preview-editor"></div></div><div id="preview-status"></div>
  </div>
  <fieldset id="targets" disabled><legend class="sr-only">应用区域</legend><label><input type="checkbox" id="target-title" checked>标题栏</label><label><input type="checkbox" id="target-activity">活动栏</label><label><input type="checkbox" id="target-status" checked>状态栏</label></fieldset>
  <p id="settings-feedback" role="status" aria-live="polite" hidden></p>
  </dialog>
  <p id="feedback" role="status" aria-live="polite" hidden></p>
  <nav id="families" aria-label="色系">
    <button data-family="all" aria-pressed="true" aria-label="全部颜色" title="全部颜色，按五个色系分列"><span class="all-stripes" aria-hidden="true"></span></button><button data-family="red" aria-pressed="false">朱</button><button data-family="yellow" aria-pressed="false">金</button><button data-family="green" aria-pressed="false">青</button><button data-family="blue" aria-pressed="false">蓝</button><button data-family="neutral" aria-pressed="false">墨</button><button data-family="light" aria-pressed="false" title="明亮配色">明</button><button data-family="dark" aria-pressed="false" title="深色配色">暗</button>
  </nav>
  <button id="shuffle" class="random-card" type="button" aria-label="随机换色" title="当前色系随机换色" disabled></button>
  <section id="palette" class="palette" aria-label="传统色，点击即应用" title="点击即应用，覆盖当前工作区配色"></section>
</main>
<script nonce="${nonce}" src="${resource('palette.js')}"></script>
<script nonce="${nonce}" src="${resource('color-tools.js')}"></script>
<script nonce="${nonce}" src="${resource('main.js')}"></script>
</body></html>`;
}

export class ColorsView implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private listeners: vscode.Disposable[] = [];
  private readonly subscription: vscode.Disposable;
  constructor(private readonly root: vscode.Uri, private readonly controller: ColorController) {
    this.subscription = controller.onDidChange(() => this.sync());
  }
  resolveWebviewView(view: vscode.WebviewView): void {
    this.listeners.forEach(listener => listener.dispose());
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.root, 'media')] };
    this.listeners = [view.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!message || typeof message !== 'object') { return; }
      const data = message as Record<string, unknown>;
      if (data.type === 'ready') { this.sync(); return; }
      if (data.type !== 'apply' && data.type !== 'reset') { return; }
      try {
        if (data.type === 'reset') { await this.controller.reset(); }
        else { await this.controller.apply(data.color, data.targets as Parameters<ColorController['apply']>[1]); }
        void view.webview.postMessage({ type: 'result', ok: true, action: data.type, state: this.controller.state });
      } catch (error) {
        void view.webview.postMessage({ type: 'result', ok: false, error: error instanceof Error ? error.message : 'Unable to update workspace colors.', state: this.controller.state });
      }
    }), view.onDidChangeVisibility(() => { if (view.visible) { this.sync(); } })];
    view.webview.html = viewHtml(view.webview, this.root);
  }
  private sync() { void this.view?.webview.postMessage({ type: 'state', state: this.controller.state }); }
  dispose() { this.subscription.dispose(); this.listeners.forEach(listener => listener.dispose()); }
}
