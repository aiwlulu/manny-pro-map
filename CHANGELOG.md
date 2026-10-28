# 更新紀錄

版本號採 [語意化版本](https://semver.org/lang/zh-TW/)：

- **大版本**：資料格式（`data/*.yaml`）有不相容的改動，貢獻者需要調整
- **中版本**：新功能，或新增一批公司資料
- **小版本**：修正錯誤、調整資料

## [2.4.0] - 2026-10-28

### 資料
- 收錄 2026 年 10 月的 5 篇文章與 2 集 Podcast：PHP2Shell 事件、CoreWeave（Mike Intrator）、Skydance 併購、Glanbia（Hugh McGuire）、9 月你問我答，以及 Live Nation、AI 代理人電商兩集 Podcast
- 新增 Glanbia（含營收結構）、Wiz、Snyk、Calif 四家公司
- 新增關係：CoreWeave 供應 Meta 算力（至多約 142 億美元）、Paramount Skydance 收購 Warner Bros. Discovery、Google 收購 Wiz、BC Partners 收購 Springer Science+Business Media
- 補上 CoreWeave 執行長 Mike Intrator、Glanbia 執行長 Hugh McGuire，更新 David Ellison 職稱與 Skydance 別名

## [2.3.0] - 2026-10-18

### 新功能
- 資金循環改為環狀圖：箭頭一律代表錢的流向，自動找出兩方與三方循環（例如 NVIDIA 投資 OpenAI → OpenAI 向 Oracle 租算力 → Oracle 向 NVIDIA 買 GPU），標出每段的金額，下方依序列出每一段與來源；兩方循環另以長條比較投資與回流金額
- 新增「AI 產業的資金循環」總覽頁（`#/loops`），一次看完全部 17 組循環，從各公司產業鏈的資金區也能進入
- 資金區以圖示與顏色區分關係：母公司／旗下事業（組織圖示、深色框、100% 持股環）、少數股權投資（錢幣圖示、金色框）、資金循環（循環圖示、金底標籤與外框），並依母公司、投資方、投資對象、旗下事業分組；持股比例以圓環呈現

### 改善
- 文章面板重新排版：標題使用整個寬度，日期併入類別列，「到曼報閱讀」改為滿版主要按鈕

## [2.2.0] - 2026-10-18

### 新功能
- 資金回流改成視覺化圖：每組畫出投資方 ⇄ 被投資方的投資與採購箭頭，下方以同一比例尺的長條比較投資金額與回流金額，標出倍數、承諾性質（承諾採購、合約總額）與期間，並附投資、採購兩個來源；金額只採官方或主流媒體公開的數字，未公開者明確標示
- 新增採購金額：OpenAI 對 Azure 2,500 億美元、對 AWS 1,380 億美元，Anthropic 對 Azure 300 億美元、對 AWS 逾 1,000 億美元；補上 AWS → OpenAI、CoreWeave → NVIDIA（算力承購 63 億美元）兩條關係，並更新 Google、Amazon 對 Anthropic 的 2026 年投資承諾
- Logo 滑過時的動態：色譜滑動、掠光、光暈與星芒，只在滑鼠裝置播放一次、不循環，鍵盤聚焦時同樣有效，減少動態設定下只保留顏色變化
- 搜尋結果的類型標籤分色（公司、人物、文章），延伸公司加上「延伸」標籤

### 修正
- 搜尋結果標題被套上資金回流標記的樣式，長標題與日期重疊

## [2.1.0] - 2026-10-18

### 新功能
- 資金回流：「A 投資 B，B 又向 A（或其子公司）採購」自動標成 ⟲ 資金回流，投資卡片列出錢怎麼流回來並附投資、採購兩個來源；資金區開頭有摘要，上下游卡片也標出「也投資」「互為客戶」
- 延伸公司：曼報尚未談過、但對上下游或投資很重要的公司可加 `extended: true`，以虛線框與「延伸」標籤顯示，只出現在產業鏈、搜尋與公司卡，不進產業地圖與氣泡圖，也不計入公司數
- 新增 Oracle、SoftBank、SK hynix、Samsung Electronics、Micron 五家延伸公司與營收結構，補上 Oracle ⇄ OpenAI、AMD／Broadcom → OpenAI、Microsoft → Anthropic、HBM 供應 NVIDIA、SoftBank 投資 OpenAI 等 20 條關係

### 修正
- 在產業鏈畫面中搜尋時，結果清單被畫面蓋住而無法點選

## [2.0.0] - 2026-10-18

### 新功能
- 產業鏈依「流動的是什麼」分類：硬體、軟體與 AI、雲端算力、服務與數據、內容授權，連線與標籤依類型上色，上方可點選篩選（選擇會被記住）
- 營收結構：44 家上市公司依最近一個完整財年年報加上約略營收佔比，公司卡與產業鏈中心卡顯示比例條並附財報連結
- 下游依本公司的營收區塊分組（例如 Sony 的音樂 → Spotify、影像感測 → Apple），上游卡片標出供應方對應的營收區塊與佔比；財報具名揭露的客戶營收佔比（如微軟佔 CoreWeave 約 67%）一併顯示
- 資金與股權：產業鏈新增投資方、投資對象與旗下事業，含金額、持股、年份與來源；新增 74 筆投資關係，只有投資或股權關係的公司也能打開產業鏈

### 資料格式（不相容）
- `supplier`／`customer` 關係必須加上 `kind`；可選填 `segment`（供應方營收區塊）與 `share`（財報揭露的客戶佔比）
- 公司新增選填 `revenue`；`invested` 關係可填 `amount`、`stake`、`year`、`detail`、`source`
- 營收佔比取整數、低於 3% 併入「其他」，看結構不求精確；超過兩個財年的資料 build 會提醒更新

### 維護
- CONTRIBUTING 說明新欄位與收錄標準；字型子集補上新字

## [1.14.2] - 2026-10-12

### 修正
- 手機上圖片一閃一閃：重新繪製畫面時，已載入過的 logo 與人物照片直接顯示，不再重新淡入；圖片載入前的佔位改成靜止的縮寫底色，不再不停閃爍或掃光，載入完成後只淡入一次

## [1.14.1] - 2026-10-12

### 修正
- 手機瀏覽器的分頁圖示改抓 Pro Map 自己的圖示：補上 `favicon.ico`、PNG、`apple-touch-icon` 與 `site.webmanifest`，不再退回 `aiwlulu.github.io` 根目錄的 favicon

## [1.14.0] - 2026-10-12

### 改善
- 產業鏈資料重新審核：刪除品牌上架通路、平台上架、證據薄弱或過時的關係（129 → 84 條），保留的每一條都附上公開來源（公司新聞稿、SEC 文件、官方客戶案例或主流媒體）、一句證據說明與年份
- 公司卡的上下游每條關係都有「來源」連結；沒有上下游的公司不再顯示產業鏈區塊或按鈕，直接開產業鏈網址會導回公司卡
- 產業鏈全螢幕檢視預設只顯示直接關係，「顯示間接關係」開關可再往外看一層（選擇會被記住），第二層最多 8 家
- 供應關係不再重複出現在「關係」區塊

### 維護
- CI 要求 `supplier`／`customer` 關係必須附 https 來源；CONTRIBUTING 說明收錄標準
- 導覽頁說明與產業鏈短片更新；字型子集補上新字

## [1.13.1] - 2026-10-11

### 改善
- 首頁網址不再顯示 `#/`：回到首頁、關閉公司卡、切回產業地圖時網址為乾淨的 `/manny-pro-map/`；公司、人物等深層連結仍用 `#/c/…` 以便在靜態主機上分享
- `/` 固定為產業地圖、`#/bubbles` 為氣泡圖，同一網址永遠是同一畫面；點 Logo 改為站內切換，不重新載入

### 維護
- GitHub Actions 升級：checkout v7、setup-node v7、upload-pages-artifact v5、deploy-pages v5
- CI 改為每個分支獨立的 concurrency 群組，PR 檢查不再互相取消

## [1.13.0] - 2026-10-11

### 改善
- 字型改為自行託管：Noto Sans TC 與 Figtree 子集化為網站實際用到的字（1,479 個中文字），三檔共 532KB，不再連線 Google Fonts；`scripts/subset-fonts.py` 可重新產生，build 會提醒缺字
- Lighthouse（手機、慢速 4G）：無障礙、最佳實踐、SEO 皆達 100，版面位移 CLS 由 0.105 降為 0
  - 骨架畫面與實際版面等高（產業導覽列、欄目篩選）
  - 標題層級改為 h1 → h2（產業）→ h3（區段）
  - 篇數小標提高對比；產業鏈按鈕加大為 26px；手機最小字級提高到 12px
  - 移除標題數字的跳動動畫，避免拖慢 LCP
  - 預先載入 data.json 與 JS 模組；第一個產業列的 logo 優先載入

### 資安
- Wikimedia 圖片以 `crossorigin="anonymous"` 載入，不再帶上或寫入第三方 cookie
- CSP 收緊：字型只允許本站
- 新增 SECURITY.md、啟用 GitHub 私密漏洞回報、Dependabot 每月檢查套件與 Actions

## [1.12.0] - 2026-10-11

### 移除
- 已讀追蹤：文章勾選框、閱讀進度、「只看未讀」、已讀標記；地圖定位為索引與導覽，舊版存在瀏覽器的已讀紀錄會自動清除

### 資安
- 社群資料的 `links` 只接受 http(s) 網址（CI 驗證，前端也再擋一次），避免 `javascript:` 連結
- 圖片作者標示與連結名稱補上跳脫；404 推薦清單改用完整跳脫
- 三個頁面加上 Content-Security-Policy（inline script 以 sha256 雜湊白名單，CI 檢查是否過期）與 Referrer-Policy
- 外部文章連結加上 `noreferrer`

### 效能
- Commons 圖片改用 build 時算好的直連縮圖網址，省去每張兩次轉址；縮圖不存在時自動退回原網址
- 搜尋與人物過濾加上 60 字上限與輸入防抖

### 改善
- 導覽短片重新錄製，關於頁與文件移除已讀相關說明

## [1.11.0] - 2026-10-11

### 新增
- 自訂 404 頁：依打錯的網址推薦最接近的公司或人物（可容錯拼字，例如 /nvdia → NVIDIA），附搜尋框、回到地圖、使用導覽，以及訂閱連結與折扣碼

## [1.10.2] - 2026-10-11

### 改善
- 導覽頁網址統一為不含副檔名的 `/guide`；`/guide/` 會轉址過去，舊的 `guide.html` 連結仍可使用

## [1.10.1] - 2026-10-11

### 改善
- 產業地圖的 Pro 篇數改為卡片內的低調小標（文件圖示＋數字），只標 2 篇以上，避免滿版的「1」
- 上中下游標題列右側加上圖例「＝曼報 Pro 談過的篇數」，滑鼠移上數字也有說明

## [1.10.0] - 2026-10-11

### 新增
- 使用導覽頁 `guide.html`：7 段實際操作短片（產業地圖、公司資料、產業鏈、氣泡圖、搜尋、人物、手機版），捲到才載入與播放
- 主站頂部與關於頁加上「使用導覽」入口
- `scripts/record-guide.mjs`：用 Playwright 重新錄製導覽短片

### 修正
- 同一組關係從兩邊都有記錄時只顯示一次；移除方向標錯的 NVIDIA ↔ TSMC 客戶關係

## [1.9.3] - 2026-10-11

### 改善
- 人物列表卡片移除「巨人之聲」標籤與強調邊框，改由欄目篩選呈現（公司與人物詳細資訊中仍保留說明）

## [1.9.2] - 2026-10-11

### 修正
- 「最常被曼報提及」卡片：照片與名字之間加大間距；滑鼠移上時卡片上浮不再切到邊框

## [1.9.1] - 2026-10-11

### 改善
- 折扣碼複製按鈕加上 Lucide 圖示：複製時顯示 copy 圖示，成功後切換為綠色勾勾與「已複製」

## [1.9.0] - 2026-10-11

### 新增
- 人物頁精選區改為「最常被曼報提及」前 8 名，依提到此人的文章與節目篇數排序（巨人之聲改由欄目篩選查看，避免重複）
- 人物卡新增「提到他的文章與節目」清單，並標示 Pro／Pro Podcast／Podcast 類型
- 新增 `data/people-sources.json`：每位人物被哪些文章提及（僅書目 id）

### 改善
- 人物的主要身分改為顯示曼報談最多的那家公司

## [1.8.0] - 2026-10-11

### 新增
- 訂閱區塊加上 Manny 的免費導覽版連結（tour.manny-li.com），README 同步補上

### 改善
- 篩選區分單選與開關：欄目改為附圓形單選鈕的「欄目」群組；「只看未讀」「跨多家公司」改為切換開關，放在「條件」群組
- 產業地圖頁標題卡改為頂端對齊

## [1.7.0] - 2026-10-11

### 新增
- 關於頁新增「訂閱曼報 Pro」區塊：訂閱連結 https://pro.manny-li.com/join 與折扣碼 love250（訂閱時輸入，首年折抵 250 元），可一鍵複製
- 公司側欄底部附上訂閱連結與折扣碼

## [1.6.0] - 2026-10-11

### 新增
- 依欄目篩選：全部、商業解碼、科技曼讀、巨人之聲、曼報俱樂部、Pro Podcast、曼報 Podcast；產業地圖、氣泡圖與人物頁共用，並記住上次的選擇

### 改善
- 人物頁移除「有照片」篩選；「跨多家公司」改為可與欄目併用的開關
- 篩選結果在 24 人以內時改為單一網格，不再拆成很多字母段
- 桌機人物頁工具列改為兩行，搜尋框不再被擠壓
- 內文超連結改用藍色並加底線；「請到 曼報 Pro」補上空格

## [1.5.1] - 2026-10-11

### 修正
- 「曼報訪談過」與「受訪」標籤改為「巨人之聲」：這些人物是 Pro「巨人之聲」專欄整理過其訪談或演講，並非曼報本人訪問
- 只有名字出現在巨人之聲文章標題的人才標記（26 → 14 位），僅被引用的不再算入

## [1.5.0] - 2026-10-11

### 新增
- 人物頁重新設計：頁首說明、「曼報訪談過」精選照片列、卡片網格（由左到右閱讀）、公司標籤附 logo 與職稱
- 人物頁可依人名或公司過濾，新增「有照片」篩選

### 改善
- 人物照片與公司 logo 載入前先顯示首字母佔位，不再是空白
- 產業鏈提示改為「試試看」與「知道了，不再顯示」兩個按鈕；打開過一次產業鏈後自動不再提示
- 人物頁工具列改為不透明背景；手機上篩選與 A–Z 改為單行橫向滑動

## [1.4.1] - 2026-10-11

### 改善
- 關於頁改為 2×2 卡片並加上圖示，結尾新增「一起維護」區塊與 GitHub、更新紀錄按鈕
- 產業鏈提示只在地圖頁出現

## [1.4.0] - 2026-10-11

### 新增
- 公司卡在簡介下方加上「查看產業鏈」入口，顯示上下游家數
- 產業地圖卡片右下角的產業鏈按鈕，可直接打開全螢幕產業鏈
- 第一次造訪時的產業鏈功能提示（可關閉，不再出現）

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

[1.14.2]: https://github.com/aiwlulu/manny-pro-map/compare/v1.14.1...v1.14.2
[1.14.1]: https://github.com/aiwlulu/manny-pro-map/compare/v1.14.0...v1.14.1
[1.14.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.13.1...v1.14.0
[1.13.1]: https://github.com/aiwlulu/manny-pro-map/compare/v1.13.0...v1.13.1
[1.13.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.10.2...v1.11.0
[1.10.2]: https://github.com/aiwlulu/manny-pro-map/compare/v1.10.1...v1.10.2
[1.10.1]: https://github.com/aiwlulu/manny-pro-map/compare/v1.10.0...v1.10.1
[1.10.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.9.3...v1.10.0
[1.9.3]: https://github.com/aiwlulu/manny-pro-map/compare/v1.9.2...v1.9.3
[1.9.2]: https://github.com/aiwlulu/manny-pro-map/compare/v1.9.1...v1.9.2
[1.9.1]: https://github.com/aiwlulu/manny-pro-map/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/aiwlulu/manny-pro-map/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/aiwlulu/manny-pro-map/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.3.2...v1.4.0
[1.3.2]: https://github.com/aiwlulu/manny-pro-map/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/aiwlulu/manny-pro-map/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/aiwlulu/manny-pro-map/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/aiwlulu/manny-pro-map/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/aiwlulu/manny-pro-map/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/aiwlulu/manny-pro-map/releases/tag/v0.1.0
