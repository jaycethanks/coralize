const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { normalizeColor, foreground, windowColors } = require('../out/colors');

test('HEX validation accepts shorthand and rejects invalid input', () => {
  assert.equal(normalizeColor('  #AbC  '), '#aabbcc');
  assert.equal(normalizeColor('F16B55'), '#f16b55');
  for (const value of [null, {}, 123, '', '#12', '#abcd', '#12345678', 'red', '<script>']) {
    assert.equal(normalizeColor(value), undefined);
  }
});

test('foreground chooses readable black or white', () => {
  assert.equal(foreground('#ffffff'), '#000000');
  assert.equal(foreground('#000000'), '#ffffff');
  assert.equal(foreground('#f7e8aa'), '#000000');
  assert.equal(foreground('#126e82'), '#ffffff');
});

test('each area is independently controlled and disabled areas are absent', () => {
  for (let mask = 0; mask < 8; mask++) {
    const target = { title: !!(mask & 1), activity: !!(mask & 2), status: !!(mask & 4) };
    const result = windowColors('#123456', target);
    assert.equal('titleBar.activeBackground' in result, target.title);
    assert.equal('activityBar.background' in result, target.activity);
    assert.equal('activityBar.activeBackground' in result, target.activity);
    assert.equal('statusBar.background' in result, target.status);
    for (const key of ['prominentBackground', 'prominentForeground', 'prominentHoverBackground', 'prominentHoverForeground', 'hoverForeground']) {
      assert.equal('statusBarItem.' + key in result, target.status);
    }
    assert.ok(Object.values(result).every(value => /^#[\da-f]{6}([\da-f]{2})?$/.test(value)));
    assert.ok(!('tab.activeBorder' in result));
  }
  assert.deepEqual(windowColors(null, { title: true, activity: true, status: true }), {});
});

test('active and prominent items follow the workspace color with readable interaction states', () => {
  for (const color of ['#66c18c', '#126e82', '#ffffff', '#000000']) {
    const result = windowColors(color, { title: true, activity: true, status: true });
    const ink = foreground(color);
    assert.equal(result['activityBar.activeBackground'], color);
    assert.equal(result['activityBar.activeBorder'], ink);
    assert.equal(result['statusBarItem.prominentBackground'], color);
    assert.equal(result['statusBarItem.prominentForeground'], ink);
    assert.equal(result['statusBarItem.prominentHoverBackground'], result['statusBarItem.hoverBackground']);
    assert.equal(result['statusBarItem.prominentHoverForeground'], ink);
    assert.equal(result['statusBarItem.hoverForeground'], ink);
    assert.ok(!Object.keys(result).some(key => /error|warning|debugging/i.test(key)));
  }
});

test('original traditional palette is preserved with valid data', () => {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(require.resolve('../media/palette.js'), 'utf8'), context);
  assert.equal(context.window.CORALIZE_COLORS.length, 526);
  assert.ok(context.window.CORALIZE_COLORS.every(color => normalizeColor(color.hex) && color.name && color.pinyin));
});

test('webview script parses without a transpiler', () => {
  new vm.Script(readFileSync(require.resolve('../media/main.js'), 'utf8'));
});

test('fixed random strip locates selection, and tabs restore active colors without losing their family', () => {
  const tools = require('../media/color-tools');
  function element() {
    return {
      dataset: {}, children: [], handlers: {}, style: { setProperty() {} },
      setAttribute(key, value) { this[key] = value; },
      addEventListener(key, handler) { this.handlers[key] = handler; },
      append(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; children.forEach(child => { child.parentElement = this; }); },
      scrollTop: 0, clientTop: 0, clientHeight: 400, scrollHeight: 2000,
      getBoundingClientRect() { return { top: this.dataset.color ? 600 : 100, height: this.dataset.color ? 92 : 400 }; },
      scrollTo(options) { this.scrolled = options; },
      scrollIntoView() { throw new Error('Must not scroll ancestor containers'); },
    };
  }
  const ids = Object.fromEntries(['hex', 'targets', 'shuffle', 'saving', 'color-name', 'feedback', 'settings-feedback', 'palette', 'hex-form', 'settings-open', 'settings-close', 'settings-dialog', 'target-title', 'target-activity', 'target-status', 'preview-title', 'preview-activity', 'preview-status'].map(id => [id, element()]));
  ids.hex.value = '#F04A3A';
  const tabs = ['all', 'red', 'yellow', 'green', 'blue', 'neutral', 'light', 'dark'].map(group => Object.assign(element(), { dataset: { family: group } }));
  const messages = [];
  let persisted;
  let reducedMotion = false;
  const context = {
    window: {
      CoralizeColor: tools, addEventListener(type, handler) { this[type] = handler; },
      requestAnimationFrame(callback) { callback(); return 1; }, cancelAnimationFrame() {},
      matchMedia: () => ({ matches: reducedMotion }),
    },
    acquireVsCodeApi: () => ({ postMessage: message => messages.push(message), getState: () => persisted, setState: value => { persisted = value; } }),
    document: {
      getElementById: id => ids[id], createElement: element, querySelector: element,
      querySelectorAll: selector => selector === '[data-family]' ? tabs : ids.palette.children.flatMap(child => child.dataset.column ? child.children : [child]).filter(child => child.dataset.color),
    },
  };
  vm.runInNewContext(readFileSync(require.resolve('../media/palette.js'), 'utf8'), context);
  vm.runInNewContext(readFileSync(require.resolve('../media/main.js'), 'utf8'), context);
  const state = { color: '#f04a3a', targets: { title: true, activity: false, status: true }, enabled: true };
  context.window.message({ data: { type: 'state', state } });
  const cards = () => context.document.querySelectorAll('[data-color]');
  const active = () => cards().find(card => card['aria-pressed'] === 'true');
  assert.equal(persisted.group, 'red');
  assert.equal(active().dataset.color, state.color);
  assert.equal(active().parentElement.scrolled.top, 346);
  assert.equal(active().parentElement.scrolled.behavior, 'smooth');
  for (const tab of tabs) {
    ids.palette.scrollTop = 500;
    tab.handlers.click();
    assert.equal(ids.palette.scrollTop, 0);
    assert.ok(!ids.palette.children.includes(ids.shuffle));
    assert.equal(ids.shuffle.dataset.tone, tab.dataset.family);
    assert.equal(ids.shuffle.dataset.color, undefined);
    if (tab.dataset.family === 'all') {
      assert.equal(ids.palette.children.length, 5);
      ids.palette.children.forEach((column, index) => {
        assert.equal(column.dataset.column, tools.families[index]);
        assert.equal(column.tabIndex, 0);
        assert.deepEqual(column.children.map(card => card.dataset.color), Array.from(tools.colorSet(context.window.CORALIZE_COLORS, tools.families[index]), c => c.hex));
      });
    } else {
      assert.deepEqual(ids.palette.children.map(card => card.dataset.color), Array.from(tools.colorSet(context.window.CORALIZE_COLORS, tab.dataset.family), color => color.hex));
    }
    if (active()) { assert.equal(active().parentElement.scrolled.top, 346); }
    const scrollContainers = [ids.palette, ...ids.palette.children.filter(child => child.dataset.column)];
    const priorScroll = new Map(scrollContainers.map(container => [container, container.scrolled]));
    ids.shuffle.handlers.click();
    const message = messages.at(-1);
    assert.equal(message.type, 'apply');
    assert.ok(tools.colorSet(context.window.CORALIZE_COLORS, tab.dataset.family).some(c => c.hex === message.color));
    assert.equal(ids.shuffle.disabled, true);
    assert.equal(active().dataset.color, message.color);
    assert.equal(active().parentElement.scrolled.top, 346);
    assert.equal(active().parentElement.scrolled.behavior, 'smooth');
    for (const container of scrollContainers) {
      if (container !== active().parentElement) { assert.equal(container.scrolled, priorScroll.get(container)); }
    }
    context.window.message({ data: { type: 'result', ok: true, state: { ...state, color: message.color } } });
    assert.equal(ids.shuffle.disabled, false);
    assert.equal(persisted.group, tab.dataset.family);
    assert.equal(tab['aria-pressed'], 'true');
  }
  // Reload restores a saved overlapping tab and locates the host color.
  const lastColor = messages.at(-1).color;
  vm.runInNewContext(readFileSync(require.resolve('../media/main.js'), 'utf8'), context);
  context.window.message({ data: { type: 'state', state: { ...state, color: lastColor } } });
  assert.equal(persisted.group, 'dark');
  assert.equal(active().dataset.color, lastColor);
  assert.equal(active().parentElement.scrolled.top, 346);
  assert.equal(active().parentElement.scrolled.behavior, 'smooth');
  // External changes resolve a family rather than showing a false selection.
  context.window.message({ data: { type: 'state', state: { ...state, color: '#f04a3a' } } });
  assert.equal(persisted.group, 'red');
  assert.equal(active().dataset.color, '#f04a3a');
  tabs.find(tab => tab.dataset.family === 'blue').handlers.click();
  assert.equal(active(), undefined);
  assert.equal(persisted.group, 'blue');
  // Failed random writes restore and locate the host's actual selected color.
  ids.shuffle.handlers.click();
  context.window.message({ data: { type: 'result', ok: false, error: 'failed', state } });
  assert.equal(active().dataset.color, state.color);
  assert.equal(active().parentElement.scrolled.top, 346);
  reducedMotion = true;
  ids.shuffle.handlers.click();
  assert.equal(active().parentElement.scrolled.behavior, 'instant');
  context.window.message({ data: { type: 'result', ok: true, state: { ...state, color: messages.at(-1).color } } });
  // Clamp both ends, including a list shorter than the viewport.
  ids.palette.scrollHeight = 450;
  ids.shuffle.handlers.click();
  assert.equal(ids.palette.scrolled.top, 50);
  context.window.message({ data: { type: 'result', ok: true, state: { ...state, color: messages.at(-1).color } } });
  ids.palette.scrollHeight = 200;
  ids.shuffle.handlers.click();
  assert.equal(ids.palette.scrolled.top, 0);
});
