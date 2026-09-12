import * as vscode from 'vscode';
import { ColorController } from './controller';
import { normalizeColor } from './colors';
import { ColorsView } from './view';

export function activate(context: vscode.ExtensionContext): void {
  const controller = new ColorController();
  const provider = new ColorsView(context.extensionUri, controller);
  const run = async (operation: () => Promise<unknown>) => {
    try { await operation(); }
    catch (error) { void vscode.window.showErrorMessage('Coralize: ' + (error instanceof Error ? error.message : String(error))); }
  };
  context.subscriptions.push(
    controller, provider,
    vscode.window.registerWebviewViewProvider('coralize-view', provider),
    vscode.commands.registerCommand('coralize.open', () => vscode.commands.executeCommand('workbench.view.extension.coralize-view')),
    vscode.commands.registerCommand('coralize.setColor', () => run(async () => {
      const input = await vscode.window.showInputBox({
        title: 'Coralize：设置工作区颜色',
        prompt: '覆盖工作区配色，用户级设置不变。',
        value: controller.state.color ?? '#f04a3a',
        placeHolder: '#F16B55',
        validateInput: value => normalizeColor(value) ? undefined : '请输入 3 位或 6 位 HEX。',
      });
      if (input !== undefined) { await controller.apply(input, controller.state.targets); }
    })),
    vscode.commands.registerCommand('coralize.reset', () => run(() => controller.reset())),
    vscode.workspace.onDidChangeConfiguration(event => { void run(() => controller.refresh(event)); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => { void run(() => controller.refresh()); }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => { void run(() => controller.refresh()); }),
  );
  void run(() => controller.refresh());
}

export function deactivate(): void {}
