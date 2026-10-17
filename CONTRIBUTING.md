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
people:                         # 選填，創辦人、執行長等關鍵人物；interviewed: true 代表 Pro「巨人之聲」專欄標題介紹過此人
  - { name: Patrick Collison, role: 共同創辦人暨執行長 }
  - { name: John Collison, role: 共同創辦人暨總裁 }
relations:                      # 選填，target 是另一家公司的檔名
  - { type: acquired, target: openrouter, note: 2026 年 }
sources:                        # 必填，至少一筆，id 見 data/sources.yaml（延伸公司除外，見下方）
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

`supplier`（供應給）與 `customer` 是產業鏈圖的上下游，**必須附上來源**，CI 會檢查：

```yaml
  - { type: supplier, target: nvidia, kind: hardware, segment: wafer, note: 晶圓代工, detail: 為 NVIDIA 代工 GPU 晶片, year: 2020, source: "https://…" }
```

來源請用公司新聞稿、財報或主流媒體，不要用部落格或論壇；只收主要、具代表性的供應關係，品牌在通路上架、平台上架這類不算。

| 欄位 | 必填 | 說明 |
|---|---|---|
| `kind` | ✓ | 流動的是什麼：`hardware` 硬體（晶片、設備、零組件、整機）、`software` 軟體與 AI（授權、模型、引擎）、`cloud` 雲端算力、`service` 服務與數據（支付、數據、網路、物流、發射）、`content` 內容授權 |
| `segment` | | 這筆生意屬於**供應方**哪個營收區塊，填供應方 `revenue.segments` 的 id |
| `share` | | 供應方財報**具名揭露**的客戶營收佔比：`{ pct: 62, fy: FY2024, source: "https://…" }`，沒具名揭露就不要填 |

### 營收結構 `revenue`

依最近一個完整財年的年報（10-K、20-F、年報或全年財報新聞稿）填寫，用公司自己揭露的事業部或產品線，**不要用地區別**；2–7 項。目的是看出結構，不必精確：`share` 取整數百分比、加總 100，低於 3% 的併入「其他」（有上下游指向的區塊除外）。財報更新時不必追著改，build 會提醒超過兩個財年的資料。

```yaml
revenue:
  fy: FY2026                  # 財年標示
  total: 220                  # 總營收約略規模，單位：十億（billion），取兩位有效數字
  currency: USD               # USD | TWD | JPY | EUR | KRW | GBP | SEK | CNY | HKD | CAD
  source: "https://…"         # 年報或官方財報頁
  segments:
    - { id: data-center, name: 資料中心, share: 90 }
    - { id: gaming, name: 遊戲, share: 7 }
    - { id: other, name: 其他, share: 3 }
```

### 投資 `invested`

```yaml
  - { type: invested, target: openai, amount: 130 億美元, stake: 約 27%, year: 2019, detail: 多輪投資並取得營利部門股權, source: "https://…" }
```

`amount`、`stake` 只填公開報導過的數字。投資、母公司（`parent`）會畫在產業鏈的「資金與股權」區。

「A 投資 B，B 又向 A（或 A 旗下公司）採購」會自動標成**資金回流**，不需要另外填。

### 延伸公司 `extended`

曼報沒談過、但對上下游或投資關係很重要的公司（例如 Oracle、SoftBank），可以加 `extended: true`。延伸公司不填 `sources`，但至少要有一條附來源的上下游或投資關係；它只出現在產業鏈、搜尋與公司卡，以虛線樣式標示，不會放進產業地圖與氣泡圖，也不算在公司數裡。

```yaml
name: Oracle
extended: true
industry: software
segment: infra
summary: …
relations:
  - { type: supplier, target: openai, kind: cloud, note: 雲端算力, detail: …, year: 2025, source: "https://…" }
```

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

## 字型

字型只包含網站用到的字。build 提示缺字時，從 [google/fonts](https://github.com/google/fonts) 取得 `NotoSansTC[wght].ttf`、`Figtree[wght].ttf`、`Figtree-Italic[wght].ttf`，執行 `python3 scripts/subset-fonts.py <字型資料夾>`（需要 `pip install fonttools brotli`）。

## 頁面裡的 inline script

頁面有 Content-Security-Policy。改了 `index.html`、`guide.html`、`404.html` 裡的 `<script>` 之後，執行 `npm run csp` 更新雜湊，否則 CI 會失敗。

## 版本

發佈新版時更新 `package.json` 的 `version` 與 `CHANGELOG.md`，並打上 `vX.Y.Z` tag；push tag 後 GitHub Actions 會用 CHANGELOG 該版段落自動建立 Release。版本號規則見 CHANGELOG 開頭。

## 重新錄製導覽短片

介面有明顯改動時，在本機起伺服器（`python3 -m http.server 4174 -d site`）後執行 `node scripts/record-guide.mjs`，需要 Playwright 與 ffmpeg。

## 本機預覽

```bash
npm ci
npm run dev     # 驗證資料、產生 site/data.json，並開本機伺服器
```
