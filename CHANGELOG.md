# Change Log

All notable changes to the "coralize" extension will be documented in this file.

## [2.0.0] - 2026-09-13

- Limited automatic positioning to the palette or the selected family column, preventing ancestor scrolling from moving the header, tabs and random strip.
- Kept the header and family tabs visible while browsing. All-color columns scroll independently. Every tab uses one fixed random strip with flat, single-direction diagonal stripes and a contrasting gradient.
- Random selection, initialization and tab switching smoothly reveal the active swatch after layout, respecting reduced-motion preferences. Initialization restores the last tab when it contains the active color, otherwise selects the corresponding family; failed writes restore the actual host selection.
- Fixed pink/magenta entries incorrectly grouped as blue. Tabs, all-color columns, title colors and random selection now share one exhaustive hue classification, with all-palette checks and named/boundary regression tests.
- Refined cards into vertical calligraphy labels with a diagonal-textured random wash, top-right contrast selection dots, and short entrance/hover/dialog animations that respect reduced-motion preferences.
- Added cross-family light/dark selections, representative tab/title colors, and five-column all-colors browsing with a five-stripe tab icon.
- Active activity-bar items and prominent status-bar items now follow the selected workspace color, with matching hover contrast. Error, warning, and debugging colors remain theme-controlled.
- Rebuilt the color panel with the original calligraphy font, one-click color switching, family-specific random colors, and custom HEX input. Region preview and target controls live in a settings dialog; Reset is available only as a command.
- Added command palette entries to open the studio, set a color, and reset workspace colors.
- Applying replaces the complete workspace color customizations object; resetting removes it. User-level settings are never written.
- Retained existing color and target setting keys. Improved HEX validation, foreground contrast, message validation, and serialized configuration writes.
- Replaced the legacy template runtime with dependency-free webview assets and added focused automated tests.


## [1.0.1] - Sun May 07 2023

### Fixed
- 当用户修改设置时实时更新

## [1.0.0] - Sun May 07 2023
### Added 
- 支持自定义指定 Coralize 将影响的部分

## [0.3.1] - Sun May 07 2023
### Fixed
- vscode random 颜色 set

## [0.3.0] - Sun May 07 2023
### Added
- 新增随机深色按钮
- UI 细节优化

## [0.2.2] - Sun May 07 2023

### Added

- 支持状态同步
### Changed

- 代码优化

## [0.2.0] - Sun May 07 2023 

### Added
- 优化用户体验, 减少transition效果
- 新增喜蛋红色锚点

### Deprecated

- 移除颜色 copy 到 clipboard
