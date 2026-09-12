(() => {
  'use strict';
  const vscode = acquireVsCodeApi();
  const colors = window.CORALIZE_COLORS;
  const { normalize, foreground, columnFamily, colorSet, families, randomColor } = window.CoralizeColor;
  const $ = id => document.getElementById(id);
  const groupNames = { all: '全部', red: '朱', yellow: '金', green: '青', blue: '蓝', neutral: '墨', light: '明', dark: '暗' };
  let group = 'all';
  let host = { color: null, targets: { title: true, activity: false, status: true }, enabled: false };
  let selected = '#f04a3a';
  let busy = false;
  let ready = false;
  let editing = false;
  const savedGroup = vscode.getState()?.group;
  let locateFrame;
  function locateSelected() {
    window.cancelAnimationFrame(locateFrame);
    locateFrame = window.requestAnimationFrame(() => {
      const card = Array.from(document.querySelectorAll('[data-color]')).find(button => button.dataset.color === selected);
      if (!card) { return; }
      // Cards are direct children of the palette or an independently scrolling family column.
      // Never ask scrollIntoView to move ancestor containers or the webview viewport.
      const container = card.parentElement;
      const cardBounds = card.getBoundingClientRect();
      const containerBounds = container.getBoundingClientRect();
      const center = container.scrollTop + cardBounds.top - containerBounds.top - container.clientTop
        + (cardBounds.height - container.clientHeight) / 2;
      const top = Math.max(0, Math.min(center, container.scrollHeight - container.clientHeight));
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      container.scrollTo({ top, behavior: reducedMotion ? 'instant' : 'smooth' });
    });
  }
  const targets = () => ({ title: $('target-title').checked, activity: $('target-activity').checked, status: $('target-status').checked });
  function error(text = '') {
    for (const id of ['feedback', 'settings-feedback']) { $(id).textContent = text; $(id).hidden = !text; }
  }

  function render() {
    const valid = normalize($('hex').value);
    const target = targets();
    $('hex').setAttribute('aria-invalid', String(!valid));
    const disabled = !ready || busy || !host.enabled;
    $('hex').disabled = disabled;
    $('targets').disabled = disabled;
    $('shuffle').disabled = disabled;
    $('saving').textContent = busy ? '正在换色' : '';
    document.querySelector('main').setAttribute('aria-busy', String(busy));
    const name = colors.find(c => c.hex === selected)?.name || '自选色';
    $('color-name').textContent = name;
    $('color-name').title = name;
    $('color-name').style.setProperty('--title-accent', 'var(--tone-' + columnFamily(selected) + ')');
    for (const key of ['title', 'activity', 'status']) {
      $('preview-' + key).style.backgroundColor = target[key] ? selected : '';
    }
    document.querySelectorAll('[data-color]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.color === selected));
      button.disabled = disabled;
    });
    const shuffleLabel = group === 'all' ? '随机换色' : (group === 'light' ? '明亮配色' : group === 'dark' ? '深色配色' : groupNames[group] + '色系') + '随机换色';
    $('shuffle').title = shuffleLabel;
    $('shuffle').setAttribute('aria-label', shuffleLabel);
    document.querySelectorAll('[data-family]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.family === group)));
  }

  function renderPalette() {
    const visible = colorSet(colors, group);
    const shuffle = $('shuffle');
    shuffle.dataset.tone = group;
    $('palette').dataset.layout = group === 'all' ? 'columns' : 'grid';
    const createCard = (color, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.dataset.color = color.hex;
      if (color.name.length >= 4) { button.className += ' swatch-long'; }
      if (color.name.length > 4) { button.className += ' swatch-longest'; }
      button.title = color.name + ' · ' + color.hex.toUpperCase() + ' · 点击应用';
      button.setAttribute('aria-label', color.name + ' ' + color.hex.toUpperCase());
      button.style.setProperty('--swatch', color.hex);
      button.style.setProperty('--on-swatch', foreground(color.hex));
      if (group === 'all' ? index < 4 : index < 24) {
        button.className += ' swatch-enter';
        button.style.setProperty('--enter-delay', Math.min(index, 8) * 14 + 'ms');
      }
      const name = document.createElement('span');
      name.textContent = color.name;
      button.append(name);
      button.addEventListener('click', () => choose(color.hex));
      return button;
    };
    if (group === 'all') {
      const columns = families.map(tone => {
        const column = document.createElement('div');
        column.className = 'palette-column';
        column.dataset.column = tone;
        column.tabIndex = 0;
        column.setAttribute('role', 'region');
        column.setAttribute('aria-label', groupNames[tone] + '色系列表');
        column.replaceChildren(...colorSet(colors, tone).map(createCard));
        return column;
      });
      $('palette').replaceChildren(...columns);
    } else {
      $('palette').replaceChildren(...visible.map(createCard));
    }
    $('palette').scrollTop = 0;
    render();
    locateSelected();
  }

  function sync(state, replaceDraft = false) {
    const initializing = !ready;
    const previous = selected;
    host = state; ready = true;
    if (!busy && (!editing || replaceDraft)) {
      selected = host.color || '#f04a3a'; editing = false;
      $('hex').value = selected.toUpperCase();
      for (const key of ['title', 'activity', 'status']) { $('target-' + key).checked = host.targets[key]; }
    }
    if (!host.enabled) { error('请先打开受信任的文件夹或工作区。'); }
    if (initializing || previous !== selected) {
      if (initializing) {
        const canRestore = Object.hasOwn(groupNames, savedGroup) && colorSet(colors, savedGroup).some(c => c.hex === selected);
        group = canRestore ? savedGroup : host.color ? columnFamily(selected) : 'all';
      } else if (!colorSet(colors, group).some(c => c.hex === selected)) {
        group = host.color ? columnFamily(selected) : 'all';
      }
      vscode.setState({ group });
      renderPalette();
    }
    render();
  }

  function send(type) {
    if (busy || !ready || !host.enabled) { return; }
    const color = normalize($('hex').value);
    if (type === 'apply' && !color) { error('请输入 3 位或 6 位 HEX。'); render(); return; }
    busy = true; error(); render();
    vscode.postMessage({ type, color, targets: targets() });
  }

  function choose(hex) {
    if (busy || !ready || !host.enabled) { return; }
    selected = hex; editing = false;
    $('hex').value = hex.toUpperCase();
    send('apply');
  }

  $('hex').addEventListener('input', () => {
    editing = true;
    const hex = normalize($('hex').value);
    if (hex) { selected = hex; }
    error(hex ? '' : '请输入 3 位或 6 位 HEX。');
    render();
  });
  $('hex-form').addEventListener('submit', event => { event.preventDefault(); send('apply'); });
  $('hex').addEventListener('keydown', event => {
    if (event.key === 'Escape') { editing = false; error(); sync(host, true); }
  });
  $('targets').addEventListener('change', () => {
    if (host.color) { choose(host.color); } else { render(); }
  });
  $('shuffle').addEventListener('click', () => {
    const next = randomColor(colors, group, selected);
    if (next) { choose(next.hex); locateSelected(); }
  });
  $('settings-open').addEventListener('click', () => $('settings-dialog').showModal());
  $('settings-close').addEventListener('click', () => $('settings-dialog').close());
  $('settings-dialog').addEventListener('click', event => {
    const bounds = $('settings-dialog').getBoundingClientRect();
    if (event.target === $('settings-dialog') && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
      $('settings-dialog').close();
    }
  });
  document.querySelectorAll('[data-family]').forEach(button => button.addEventListener('click', () => {
    group = button.dataset.family;
    vscode.setState({ group });
    renderPalette();
  }));
  window.addEventListener('message', event => {
    const message = event.data;
    if (!message || !message.state) { return; }
    if (message.type === 'state') { sync(message.state); }
    if (message.type === 'result') {
      busy = false;
      sync(message.state, true);
      error(message.ok ? '' : message.error);
    }
  });
  renderPalette();
  vscode.postMessage({ type: 'ready' });
})();
