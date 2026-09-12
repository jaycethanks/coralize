const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tools = require('../media/color-tools');
const core = require('../out/colors');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../media/palette.js'), 'utf8'), context);
const colors = context.window.CORALIZE_COLORS;

test('webview validation and foreground match the extension for the original palette', () => {
  for (const color of colors) {
    assert.equal(tools.normalize(color.hex), core.normalizeColor(color.hex));
    assert.equal(tools.foreground(color.hex), core.foreground(color.hex));
  }
  assert.equal(tools.normalize('#AbC'), '#aabbcc');
  for (const value of ['red', '#ff', '#12345678', null, 1]) { assert.equal(tools.normalize(value), null); }
});

test('color families have deterministic hue and neutral boundaries', () => {
  for (const [hex, group] of Object.entries({ '#ff0000': 'red', '#ffff00': 'yellow', '#00ff00': 'green', '#0000ff': 'blue', '#888888': 'neutral', '#000000': 'neutral', '#ffffff': 'neutral', '#8800ff': 'blue', '#ff00ff': 'red' })) {
    assert.equal(tools.family(hex), group);
  }
});

test('random stays within the chosen family and avoids immediate repeats', () => {
  for (const group of ['red', 'yellow', 'green', 'blue', 'neutral']) {
    let current;
    for (let i = 0; i < 100; i++) {
      const color = tools.randomColor(colors, group, current, () => i / 100);
      assert.ok(color, group + ' must have candidates');
      assert.equal(tools.family(color.hex), group);
      assert.notEqual(color.hex, current);
      current = color.hex;
    }
  }
});

test('neighboring hues on each family boundary do not fall into a catch-all group', () => {
  for (const [hex, expected] of Object.entries({
    '#ff6a00': 'red', '#ff6b00': 'yellow', '#d5ff00': 'yellow', '#d4ff00': 'green',
    '#00fffe': 'green', '#00feff': 'blue', '#fe00ff': 'blue', '#ff00fe': 'red',
  })) { assert.equal(tools.family(hex), expected, hex); }
});

test('every displayed color is reachable by random with no hidden alternate pool', () => {
  for (const group of ['all', ...tools.families, 'light', 'dark']) {
    const pool = tools.colorSet(colors, group);
    for (let i = 0; i < pool.length; i++) {
      assert.equal(tools.randomColor(colors, group, null, () => (i + .5) / pool.length), pool[i]);
    }
  }
  assert.equal(colors.length, 526);
  assert.equal(tools.randomColor([], 'all'), undefined);
});

test('original calligraphy font is copied without modification', () => {
  assert.ok(fs.readFileSync(require.resolve('../media/calligraphy.woff2')).equals(fs.readFileSync(require.resolve('../template/dist/public/fonts-compressed.woff2'))));
});

test('light and dark selections cover five families and random uses the displayed pool', () => {
  for (const group of ['light', 'dark']) {
    const pool = tools.colorSet(colors, group);
    assert.ok(pool.length >= 25 && pool.length <= 30);
    assert.equal(new Set(pool.map(c => c.hex)).size, pool.length);
    assert.deepEqual([...new Set(pool.map(c => tools.family(c.hex)))].sort(), [...tools.families].sort());
    for (const c of pool) {
      const l = tools.luminance(c.hex);
      assert.ok(group === 'light' ? l >= .42 && l <= .88 : l >= .018 && l <= .12);
      assert.equal(tools.foreground(c.hex), group === 'light' ? '#000000' : '#ffffff');
    }
    let previous;
    for (let i = 0; i < 100; i++) {
      const next = tools.randomColor(colors, group, previous, () => i / 100);
      assert.ok(pool.includes(next));
      assert.notEqual(next.hex, previous);
      previous = next.hex;
    }
  }
});

test('all colors interleave five columns without losing or duplicating palette entries', () => {
  const all = tools.colorSet(colors, 'all');
  assert.equal(all.length, colors.length);
  assert.equal(new Set(all).size, colors.length);
  assert.ok(colors.every(color => all.includes(color)));
  assert.deepEqual(all.slice(0, 5).map(c => tools.columnFamily(c.hex)), tools.families);
  assert.ok(colors.every(c => tools.families.includes(tools.family(c.hex))));
});

test('named palette regressions distinguish pink, warm purple, cool violet and blue', () => {
  const expected = {
    '品红': 'red', '淡绛红': 'red', '凤仙花红': 'red', '夹竹桃红': 'red',
    '喜蛋红': 'red', '兔眼红': 'red', '紫荆红': 'red', '葡萄酒红': 'red',
    '景泰蓝': 'blue', '清水蓝': 'blue', '靛青': 'blue', '藤萝紫': 'blue',
    '竹绿': 'green', '美蝶绿': 'green', '苹果绿': 'green',
    '杏仁黄': 'yellow', '佛手黄': 'yellow', '雪白': 'neutral', '中灰': 'neutral',
  };
  for (const [name, group] of Object.entries(expected)) {
    const c = colors.find(c => c.name === name);
    assert.ok(c, name);
    assert.equal(tools.family(c.hex), group, name + ' ' + c.hex);
    for (const tab of tools.families) {
      assert.equal(tools.colorSet(colors, tab).includes(c), tab === group, name + ' in ' + tab);
    }
  }
});

test('all 526 colors have exactly one family with independent RGB constraints', () => {
  const groups = tools.families.map(group => tools.colorSet(colors, group));
  for (const c of colors) {
    assert.equal(groups.filter(group => group.includes(c)).length, 1, c.name);
    const [r, g, b] = [1, 3, 5].map(i => parseInt(c.hex.slice(i, i + 2), 16));
    const group = tools.family(c.hex);
    if (group === 'blue') { assert.ok(b >= r && b >= g, c.name + ' blue must not be red-dominant'); }
    if (group === 'red') { assert.ok(r >= b && r >= g, c.name + ' red must be red-dominant'); }
    if (group === 'green') { assert.ok(g >= r && g >= b, c.name + ' green must be green-dominant'); }
    if (group === 'yellow') { assert.ok(r > b && g > b, c.name + ' yellow must exceed blue'); }
  }
});
