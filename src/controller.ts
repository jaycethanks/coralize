import * as vscode from 'vscode';
import { Customizations, normalizeColor, Targets, windowColors } from './colors';

export class ColorController {
  private queue: Promise<unknown> = Promise.resolve();
  private internal = false;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;

  get state() {
    const config = vscode.workspace.getConfiguration('coralize');
    return {
      color: normalizeColor(config.get('color')) ?? null,
      targets: { title: config.get('applyToTitleBar', true), activity: config.get('applyToSideBar', false), status: config.get('applyToStatusBar', true) },
      workspace: vscode.workspace.name ?? 'No workspace open',
      enabled: !!(vscode.workspace.workspaceFolders?.length || vscode.workspace.workspaceFile) && vscode.workspace.isTrusted,
    };
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    const run = this.queue.then(async () => {
      this.internal = true;
      try { await work(); } finally { this.internal = false; this.changed.fire(); }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async apply(value: unknown, targets: Targets): Promise<void> {
    const color = normalizeColor(value);
    if (!color) { throw new Error('Enter a valid HEX color, such as #F16B55.'); }
    if (!targets || ['title', 'activity', 'status'].some(k => typeof targets[k as keyof Targets] !== 'boolean')) {
      throw new Error('Invalid color targets.');
    }
    return this.enqueue(async () => {
      this.requireWorkspace();
      const config = vscode.workspace.getConfiguration('coralize');
      // Persist intent first. If a settings write fails, the next reconcile can safely retry.
      if (config.get('color') !== color) {
        await config.update('color', color, vscode.ConfigurationTarget.Workspace);
      }
      for (const [key, enabled] of Object.entries({ applyToTitleBar: targets.title, applyToSideBar: targets.activity, applyToStatusBar: targets.status })) {
        if (config.get(key) !== enabled) {
          await config.update(key, enabled, vscode.ConfigurationTarget.Workspace);
        }
      }
      await this.reconcile();
    });
  }

  reset(): Promise<void> {
    return this.enqueue(async () => {
      this.requireWorkspace();
      await vscode.workspace.getConfiguration('coralize').update('color', null, vscode.ConfigurationTarget.Workspace);
      await this.reconcile(true);
    });
  }

  refresh(event?: vscode.ConfigurationChangeEvent): Promise<void> {
    if (this.internal || (event && !event.affectsConfiguration('coralize'))) { return Promise.resolve(); }
    return this.enqueue(async () => {
      // An unconfigured workspace must not lose its colors just by opening VS Code.
      if (this.state.enabled && (this.state.color || event?.affectsConfiguration('coralize.color'))) {
        await this.reconcile(!!event?.affectsConfiguration('coralize.color'));
      }
    });
  }

  private requireWorkspace() {
    if (!this.state.enabled) { throw new Error('Open a trusted folder or workspace to apply a color.'); }
  }

  private async reconcile(clearWhenUnset = false) {
    const raw = vscode.workspace.getConfiguration('coralize').get('color');
    if (raw !== null && raw !== undefined && !normalizeColor(raw)) {
      throw new Error('coralize.color must be a 3- or 6-digit HEX color. Existing colors were left unchanged.');
    }
    const config = vscode.workspace.getConfiguration();
    const current = config.inspect<Customizations>('workbench.colorCustomizations')?.workspaceValue ?? {};
    if (!this.state.color && !clearWhenUnset) { return; }
    const next = windowColors(this.state.color, this.state.targets);
    // Coralize owns the entire workspace value: no merge, backup, or restoration.
    if ((!this.state.color && clearWhenUnset) || JSON.stringify(current) !== JSON.stringify(next)) {
      await config.update('workbench.colorCustomizations', Object.keys(next).length ? next : undefined, vscode.ConfigurationTarget.Workspace);
    }
  }

  dispose() { this.changed.dispose(); }
}
