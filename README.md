# Pro Map：曼報公司地圖（非官方）

把[曼報 Pro](https://pro.manny-li.com/join) 談過的公司整理成一張可互動的產業地圖：點一家公司，就能看到它的產品簡介、創辦人與關鍵人物、和其他公司的關係，以及曼報 Pro 文章、Pro Podcast 與曼報 Podcast 裡談到它的每一篇。

**網站：<https://aiwlulu.github.io/manny-pro-map/>**　·　**使用導覽：<https://aiwlulu.github.io/manny-pro-map/guide>**

- **找文章**：想起某家公司，直接搜尋就能找到曼報寫過的所有相關內容
- **看關係**：收購、投資、競爭、供應鏈，點了就會在地圖上亮起來
- **對人名**：人物索引把執行長、創辦人與「巨人之聲」介紹過的人物對回公司
- **看上下游**：產業鏈檢視可以跨產業，沿著供應鏈一路點下去

## 這不是什麼

這是讀者自行整理的**非官方索引**，與曼報（Manny Li）無隸屬關係。repo 裡**不含**任何文章或節目內容，只有標題、日期與連結；公司簡介依公開資料撰寫。想讀內容，請[訂閱曼報 Pro](https://pro.manny-li.com/join) 支持作者；訂閱時輸入折扣碼 `love250`，首年即可折抵 250 元。想先了解曼報 Pro 在寫什麼，可以逛逛[免費導覽版](https://tour.manny-li.com/index.html)。

## 一起維護

每家公司是 `data/companies/` 底下的一個 YAML 檔，詳見 [CONTRIBUTING.md](CONTRIBUTING.md)。PR 會由 CI 自動驗證格式與連結。

```bash
npm ci && npm run dev
```

## 授權

- 程式碼：[MIT](LICENSE)
- 社群撰寫的資料：[CC BY 4.0](LICENSE-DATA.md)
- 曼報的文章與節目著作權屬原作者
