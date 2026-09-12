export interface Targets { title: boolean; activity: boolean; status: boolean }
export type Customizations = Record<string, unknown>;

export function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') { return undefined; }
  const hex = value.trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(hex)) { return '#' + [...hex].map(c => c + c).join('').toLowerCase(); }
  return /^[\da-f]{6}$/i.test(hex) ? '#' + hex.toLowerCase() : undefined;
}

export function foreground(color: string): string {
  const linear = [1, 3, 5].map(i => {
    const channel = parseInt(color.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

export function windowColors(color: string | null, targets: Targets): Record<string, string> {
  if (!color) { return {}; }
  const ink = foreground(color);
  return {
    ...(targets.title ? {
      'titleBar.activeBackground': color, 'titleBar.activeForeground': ink,
      'titleBar.inactiveBackground': color, 'titleBar.inactiveForeground': ink + 'b3',
    } : {}),
    ...(targets.activity ? {
      'activityBar.background': color, 'activityBar.foreground': ink,
      'activityBar.activeBackground': color,
      'activityBar.inactiveForeground': ink + '99', 'activityBar.activeBorder': ink,
    } : {}),
    ...(targets.status ? {
      'statusBar.background': color, 'statusBar.foreground': ink,
      'statusBar.noFolderBackground': color, 'statusBar.noFolderForeground': ink,
      'statusBarItem.hoverBackground': ink + '26', 'statusBarItem.hoverForeground': ink,
      'statusBarItem.prominentBackground': color, 'statusBarItem.prominentForeground': ink,
      'statusBarItem.prominentHoverBackground': ink + '26', 'statusBarItem.prominentHoverForeground': ink,
      'statusBarItem.remoteBackground': color, 'statusBarItem.remoteForeground': ink,
    } : {}),
  };
}
