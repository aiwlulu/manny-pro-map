# 更新紀錄

版本號採 [語意化版本](https://semver.org/lang/zh-TW/)：

- **大版本**：資料格式（`data/*.yaml`）有不相容的改動，貢獻者需要調整
- **中版本**：新功能，或新增一批公司資料
- **小版本**：修正錯誤、調整資料

## [1.3.2] - 2026-10-11

### 修正
- 氣泡圖的「顯示全部」按鈕改用重設圖示，避免被誤認為全螢幕；三個縮放按鈕加上提示文字

## [1.3.1] - 2026-10-11

### 修正
- 從氣泡圖或人物頁進站時，載入中顯示對應檢視的骨架畫面，不再一律顯示產業地圖

## [1.3.0] - 2026-10-11

### 新增
- 載入骨架畫面；logo 載入後淡入，失效的圖片自動隱藏
- 搜尋框清除按鈕
- 從 Wikipedia 條目補上 logo 與人物照片（只收 Commons 自由授權檔案）

## [1.2.0] - 2026-10-11

### 新增
- 公司卡新增「產業鏈」：上游供應商、下游客戶，以及在產業中的位置
- 產業鏈全螢幕檢視（`#/chain/<公司>`）：延伸兩層上下游，可跨產業探索
- 129 條經審核的供應關係
- 手機版：產業快速導覽列、全寬搜尋、人物 A–Z 與篩選

### 修正
- 氣泡圖中被選取與相關的公司，無論縮放多少都顯示 logo 與名稱

## [1.1.0] - 2026-10-11

### 新增
- 產業地圖（預設檢視）：依產業與上中下游排列的 logo 卡片
- 人物卡：同一人跨多家公司合併呈現
- 官網圖示作為 logo 備援；人物照片由 50 張增加到 214 張

### 改善
- 氣泡圖縮放效能：手勢中只移動合成圖層，卡頓畫格由 60 降到 2

### 修正
- 合併同一人的不同寫法（例如 J.W. Marriott 與 J. Willard Marriott）

## [1.0.0] - 2026-10-11

### 新增
- 第一批資料：322 家公司、233 篇曼報 Pro 文章與節目、人物與公司關係
- 公司簡介依 Wikipedia 撰寫；成立年、總部、官網取自 Wikidata

## [0.2.0] - 2026-10-11

### 新增
- 可縮放的產業氣泡地圖、亮暗模式切換、SVG 圖示

## [0.1.0] - 2026-10-11

### 新增
- 網站骨架、YAML 資料格式與 CI 驗證、GitHub Pages 部署

[1.3.2]: https://github.com/aiwlulu/manny-pro-map/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/aiwlulu/manny-pro-map/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/aiwlulu/manny-pro-map/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/aiwlulu/manny-pro-map/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/aiwlulu/manny-pro-map/releases/tag/v0.1.0
