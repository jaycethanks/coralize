# Developing Coralize

Run `npm ci`, then `npm test` to compile, lint, and run the Node tests with a mocked VS Code API.

Launch with `code --new-window --extensionDevelopmentPath=. /path/to/a/test-workspace`, or press F5 using **Run Extension**. Open the Coralize view. Reload the development window after editing.

- `src/colors.ts`: HEX normalization, contrast, and generated VS Code colors.
- Activity-bar active backgrounds and prominent status-bar items follow their area's color and toggle. Keep selected borders and hover feedback readable; do not override error, warning, or debugging colors.
- `src/controller.ts`: workspace-only writes and serial execution. No history is collected.
- `src/view.ts`: webview HTML, CSP, message validation, ready/state handshake.
- `media/`: dependency-free webview scripts, styles, and the original calligraphy font. The original 526-color palette is retained; `color-tools.js` owns one exhaustive classification used by tabs, columns, title colors, and random pools. Never introduce a catch-all hue group mapped wholesale into blue, or a separate random pool.
- `test/`: focused tests. These do not launch VS Code.

Apply replaces the entire workspace `workbench.colorCustomizations` value. Reset removes it. Do not add merge, backup, or restoration behavior. A workspace with no Coralize color is not changed on startup.

Verify click-to-apply, family-specific random selection, HEX input (Enter applies; Escape cancels), target toggles, Reset, font loading, and reopening the panel in an Extension Development Host before release. Use a disposable workspace for destructive settings checks. HEX typing previews locally; choosing a swatch or random color applies immediately. Target toggles apply immediately when a color is already set. All target toggles off clears the workspace override; Reset also clears the saved color. No search, recent-color list, or separate Apply step.

The all-colors tab uses five colored stripes. All colors occupy five independently scrolling family columns (red, yellow, green, blue, neutral). Each column is keyboard-focusable and scrolls without moving neighboring columns. Every tab uses the same fixed full-width 26px random strip outside the scrolling palette, with a contrasting family gradient, flat, single-direction diagonal stripes (CSS gradients, no highlights, shadows, crosshatch or raster assets), and no icon/text. Header and tabs remain visible. Random uses exactly the displayed pool and smoothly reveals the selected card after layout without moving keyboard focus. Initialization and tab positioning share this behavior; position only the card's direct palette/column container with scrollTo (never scrollIntoView), clamp to its scroll range, cancel superseded pending frame requests and use instant positioning when prefers-reduced-motion is enabled. Switching tabs reveals that card if present; otherwise starts at the top with no false selection. Persist only the chosen tab through the VS Code webview state API. Initialization restores that tab if it contains the host color; otherwise selects the color's family (all when unset). A custom color without an exact palette match has no selected card. Failed writes restore and reveal the host color. Verify all eight tabs, random selection, reload restoration, and each column's end in the development host. The header settings button opens the preview/target dialog; verify Escape, backdrop, close button, and focus return. Reset is command-only.

Light/dark tabs are overlapping curated subsets, not extra hue columns. `colorSet` selects up to six colors per family with HSV saturation <= .65, relative luminance .42–.88 for light and .018–.12 for dark, ranked around .62/.065. Interleave families; random must use exactly the displayed pool and avoid immediate repeats. Current counts: 30 light, 29 dark. Preserve all 526 entries in the all-colors layout without duplication. Tabs and color-name titles use representative colors with separate light-theme values.

Classification contract: low chroma (HSV saturation < .16 or RGB range < .055) is neutral; otherwise hue [0,25) and [300,360) is red (including warm pink/magenta), [25,70) yellow, [70,180) green, [180,300) blue (including cool violet). Blue is sorted by hue in both its tab and its column. Color names are not classification rules. Test all palette entries for unique membership and independently check dominant RGB channels, named regression samples, threshold neighbors, and exact random reachability. Current family counts: 203 red, 125 yellow, 49 green, 68 blue, 81 neutral.

Keep the color name, HEX input, and settings on a single compact header row to maximize palette space. The outer VS Code view-container title is host-owned; do not inject workbench CSS to hide it.

Color names use vertical calligraphy; reduce four- and five-character labels to fit the font's actual vertical metrics. Selection uses a 7px black/white contrast dot at the top right, with no selected/hover outline; preserve keyboard focus outlines. Entrance animation is limited to the first 24 colors (first four rows in all-colors layout), 200 ms with delays capped at 112 ms. Hover/press and dialog motion stay inside `prefers-reduced-motion: no-preference`. No continuous animation or color shifts on actual swatches.

The former `template/` runtime and `.src/` archive are not used or packaged. Webview changes need no Sass or separate TypeScript watch process.

Package with `npx @vscode/vsce package --no-dependencies`. This runs the checks first. Inspect package contents and choose a release version above the published version before publishing.
