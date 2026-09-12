/* Shared by the webview and Node tests; no dependencies or persistent history. */
(function (root) {
  'use strict';
  function normalize(value) {
    if (typeof value !== 'string') { return null; }
    const hex = value.trim().replace(/^#/, '');
    if (/^[\da-f]{3}$/i.test(hex)) { return '#' + [...hex].map(c => c + c).join('').toLowerCase(); }
    return /^[\da-f]{6}$/i.test(hex) ? '#' + hex.toLowerCase() : null;
  }
  function luminance(hex) {
    const linear = [1, 3, 5].map(i => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
    });
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  }
  function foreground(hex) { return luminance(hex) > .179 ? '#000000' : '#ffffff'; }
  function channels(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    const hue = delta === 0 ? 0 : ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
    return { hue, saturation: max === 0 ? 0 : delta / max, delta };
  }
  function family(hex) {
    const { hue, saturation, delta } = channels(hex);
    if (saturation < .16 || delta < .055) { return 'neutral'; }
    // Five exhaustive groups: warm magenta/pink belongs to red, cool violet to blue.
    if (hue < 25 || hue >= 300) { return 'red'; }
    if (hue < 70) { return 'yellow'; }
    if (hue < 180) { return 'green'; }
    return 'blue';
  }
  function randomColor(colors, group, current, random = Math.random) {
    const pool = colorSet(colors, group);
    const alternatives = pool.filter(c => c.hex !== current);
    const choices = alternatives.length ? alternatives : pool;
    return choices.length ? choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))] : undefined;
  }
  const families = ['red', 'yellow', 'green', 'blue', 'neutral'];
  const columnFamily = family;
  function colorSet(colors, group) {
    if (group === 'all') {
      const columns = families.map(tone => colorSet(colors, tone));
      return Array.from({ length: Math.max(0, ...columns.map(c => c.length)) }, (_, row) => columns.map(column => column[row]).filter(Boolean)).flat();
    }
    if (group !== 'light' && group !== 'dark') {
      const pool = colors.filter(c => family(c.hex) === group);
      return group === 'blue' ? pool.sort((a, b) => channels(a.hex).hue - channels(b.hex).hue) : pool;
    }
    const light = group === 'light';
    const columns = families.map(tone => colors.filter(c => {
      if (family(c.hex) !== tone) { return false; }
      const l = luminance(c.hex);
      const rgb = [1, 3, 5].map(i => parseInt(c.hex.slice(i, i + 2), 16));
      const saturation = (Math.max(...rgb) - Math.min(...rgb)) / (Math.max(...rgb) || 1);
      return (light ? l >= .42 && l <= .88 : l >= .018 && l <= .12) && saturation <= .65;
    }).sort((a, b) => Math.abs(luminance(a.hex) - (light ? .62 : .065)) - Math.abs(luminance(b.hex) - (light ? .62 : .065))).slice(0, 6));
    return Array.from({ length: 6 }, (_, row) => columns.map(column => column[row]).filter(Boolean)).flat();
  }
  const api = { normalize, foreground, luminance, family, columnFamily, colorSet, families, randomColor };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.CoralizeColor = api; }
})(typeof window !== 'undefined' ? window : globalThis);
