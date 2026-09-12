const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { windowColors } = require('../out/colors');

function setup(initial = {}, options = {}) {
  const values = { ...initial };
  const global = { 'workbench.colorCustomizations': { 'editor.background': '#998877' } };
  const writes = [];
  const listeners = [];
  let failNext = false;
  const mock = {
    ConfigurationTarget: { Workspace: 2 },
    EventEmitter: class {
      event = listener => { listeners.push(listener); return { dispose() {} }; };
      fire() { listeners.forEach(listener => listener()); }
      dispose() {}
    },
    workspace: {
      name: 'test-workspace', workspaceFolders: options.empty ? [] : [{}], workspaceFile: options.workspaceFile,
      isTrusted: options.trusted !== false,
      getConfiguration(section) {
        const full = key => section ? section + '.' + key : key;
        return {
          get(key, fallback) { const value = values[full(key)]; return value === undefined ? fallback : value; },
          inspect(key) { return { workspaceValue: values[full(key)], globalValue: global[full(key)] }; },
          async update(key, value, target) {
            assert.equal(target, 2);
            if (failNext) { failNext = false; throw Error('Simulated settings write failure'); }
            await new Promise(resolve => setImmediate(resolve));
            writes.push({ key: full(key), value });
            if (value === undefined) { delete values[full(key)]; } else { values[full(key)] = value; }
          },
        };
      },
    },
  };
  const load = Module._load;
  Module._load = function(id, ...args) { return id === 'vscode' ? mock : load.call(this, id, ...args); };
  const path = require.resolve('../out/controller');
  delete require.cache[path];
  let ColorController;
  try { ({ ColorController } = require(path)); } finally { Module._load = load; }
  const controller = new ColorController();
  return { controller, values, writes, global, fail: () => { failNext = true; } };
}
const targets = { title: true, activity: false, status: true };

test('apply completely replaces workspace colors, including manual and theme overrides', async () => {
  const { controller, values, global } = setup({ 'workbench.colorCustomizations': {
    'editor.background': '#123456', 'titleBar.activeBackground': '#abcdef', '[Default Dark+]': { 'activityBar.background': '#112233' },
  } });
  await controller.apply('#abc', targets);
  assert.equal(values['coralize.color'], '#aabbcc');
  assert.deepEqual(values['workbench.colorCustomizations'], windowColors('#aabbcc', targets));
  assert.deepEqual(global['workbench.colorCustomizations'], { 'editor.background': '#998877' });
});

test('reset deletes the entire workspace override and sets color to null', async () => {
  const { controller, values } = setup({ 'workbench.colorCustomizations': { 'editor.foreground': '#fff' }, 'coralize.color': '#123456' });
  await controller.reset();
  assert.ok(!('workbench.colorCustomizations' in values));
  assert.equal(values['coralize.color'], null);
});

test('reset removes an explicitly empty override too', async () => {
  const { controller, values } = setup({ 'workbench.colorCustomizations': {} });
  await controller.reset();
  assert.ok(!('workbench.colorCustomizations' in values));
});

test('startup with no Coralize color does not clear workspace customizations', async () => {
  const { controller, writes } = setup({ 'workbench.colorCustomizations': { 'editor.background': '#123456' } });
  await controller.refresh();
  assert.equal(writes.length, 0);
});

test('legacy settings are reapplied and do not loop on workbench writes', async () => {
  const { controller, values, writes } = setup({ 'coralize.color': '#246', 'coralize.applyToSideBar': true });
  await controller.refresh();
  assert.equal(values['workbench.colorCustomizations']['activityBar.background'], '#224466');
  const count = writes.length;
  await controller.refresh({ affectsConfiguration: key => key === 'workbench.colorCustomizations' });
  await controller.refresh();
  assert.equal(writes.length, count);
});

test('invalid values and targets never write settings', async () => {
  const { controller, writes } = setup();
  await assert.rejects(controller.apply('red', targets), /HEX/);
  await assert.rejects(controller.apply('#123456', { title: 'yes' }), /targets/);
  assert.equal(writes.length, 0);
});

test('invalid external setting leaves existing colors untouched', async () => {
  const { controller, writes } = setup({ 'coralize.color': 'invalid' });
  await assert.rejects(controller.refresh({ affectsConfiguration: () => true }), /HEX/);
  assert.equal(writes.length, 0);
});

test('empty and untrusted workspaces cannot write, saved empty workspaces can', async () => {
  for (const options of [{ empty: true }, { trusted: false }]) {
    const { controller, writes } = setup({}, options);
    await assert.rejects(controller.apply('#123456', targets), /trusted/);
    await assert.rejects(controller.reset(), /trusted/);
    assert.equal(writes.length, 0);
  }
  const { controller } = setup({}, { empty: true, workspaceFile: {} });
  await controller.apply('#123456', targets);
});

test('rapid operations are serialized; last selection wins without storing history', async () => {
  const { controller, values } = setup();
  await Promise.all([controller.apply('#123456', targets), controller.apply('#abcdef', targets), controller.apply('#123456', targets)]);
  assert.equal(values['coralize.color'], '#123456');
  assert.equal(values['workbench.colorCustomizations']['statusBar.background'], '#123456');
  assert.ok(!('recent' in controller.state));
});

test('failed operation is reported and does not poison the queue', async () => {
  const { controller, values, fail } = setup();
  fail();
  await assert.rejects(controller.apply('#123456', targets), /write failure/);
  await controller.apply('#abcdef', targets);
  assert.equal(values['workbench.colorCustomizations']['statusBar.background'], '#abcdef');
});
