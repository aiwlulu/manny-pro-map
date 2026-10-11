# 貢獻指南

謝謝你願意一起維護這張地圖！所有資料都是 `data/` 底下的 YAML，改完送 PR 即可，CI 會自動檢查格式。

## 三條著作權底線（PR 審核時最優先）

1. **不放曼報的內容**：不貼原文、不摘錄段落、不轉述文章的觀點或分析。這裡只記錄「哪篇文章、哪一集談到哪家公司」。
2. **公司簡介依公開資料自己寫**：來源是官網、維基百科、財報、新聞稿等；用自己的話寫，最多 90 字。
3. **不放付費內容的檔案或圖片**：音檔、封面圖、截圖都不收；連結一律指回曼報原站。

## 新增或修改一家公司

一家公司一個檔案：`data/companies/<kebab-case>.yaml`，檔名就是網址上的 id（例如 `#/c/stripe`）。

```yaml
name: Stripe                    # 必填，通用英文名稱
zh: ""                          # 常見中文名，沒有就省略
aliases: [Stripe Inc]           # 選填，搜尋用的別名
industry: payments              # 必填，見 data/industries.yaml 的 id
segment: processing             # 選填，該產業底下 segments 的 id（產業地圖的上中下游位置）
summary: 線上支付基礎設施公司，提供商家收款 API、訂閱計費與企業金融服務。  # 必填，≤ 90 字，自己寫
founded: 2010                   # 選填
hq: 舊金山                      # 選填
links:                          # 選填，公開資料
  website: https://stripe.com
  wikipedia: https://en.wikipedia.org/wiki/Stripe,_Inc.
people:                         # 選填，創辦人、執行長、曼報訪談過的人
  - { name: Patrick Collison, role: 共同創辦人暨執行長 }
  - { name: John Collison, role: 共同創辦人暨總裁 }
relations:                      # 選填，target 是另一家公司的檔名
  - { type: acquired, target: openrouter, note: 2026 年 }
sources:                        # 必填，至少一筆，id 見 data/sources.yaml
  - pro:jkvgret4ww4d
```

### `relations.type`

以「這個檔案的公司」為主詞，另一方向會自動顯示：

| type | 意思 | 對方頁面顯示 |
|---|---|---|
| `acquired` | 收購了 target | 被收購 |
| `invested` | 投資了 target | 獲投資 |
| `competitor` | 與 target 競爭 | 競爭 |
| `partner` | 與 target 合作 | 合作 |
| `supplier` | 供應給 target | 客戶 |
| `parent` | target 是旗下公司 | 母公司 |
| `spinoff` | 分拆出 target | 分拆自 |

只寫公開可查證的關係，同一組關係只要寫在其中一家就好。

## Logo

優先用 Wikimedia Commons 的自由授權圖片（`logo: { file, license, author }`）。沒有的話，維護者會把官網圖示放在 `site/logos/<id>.png`，只用於識別。

## 新增曼報的新文章或新集數

在 `data/sources.yaml` 加一筆（只放標題、日期、網址），再把 id 加到相關公司的 `sources`。

```yaml
- id: pro:<網址最後一段的短 id>
  kind: pro            # pro | pro-podcast | podcast
  column: 科技曼讀
  title: 支付巨頭 Stripe 為什麼花 80 億美元買一家 AI 模型路由公司？
  date: 2026-08-23
  url: https://pro.manny-li.com/posts/...
```

## 版本

發佈新版時更新 `package.json` 的 `version` 與 `CHANGELOG.md`，並打上 `vX.Y.Z` tag。版本號規則見 CHANGELOG 開頭。

## 本機預覽

```bash
npm ci
npm run dev     # 驗證資料、產生 site/data.json，並開本機伺服器
```
