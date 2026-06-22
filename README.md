# 司法調證工具

這是一個用於輔助我進行日常司法調證工作的小工具，旨在簡化調證信息的錄入、調證結果的輸出以及案件數據的分析。
工具支援多檔 XLSX 文件的上傳與整合，並內建多條區塊鏈地址與交易 ID (TXID) 格式的驗證，方便快速辨識有效資訊。

## 技術棧

- **React 18**: 現代化的前端框架
- **TypeScript**: 類型安全的開發
- **Vite**: 快速的構建工具
- **Tailwind CSS**: 現代化的 UI 樣式框架
- **SheetJS (XLSX)**: Excel 文件處理
- **jsPDF**: PDF 報告生成
- **libphonenumber-js**: 電話號碼解析

## 開發

### 安裝依賴

```bash
npm install
```

### 開發模式

```bash
npm run dev
```

這會啟動 Vite 開發服務器，支持熱模塊替換（HMR），當您修改源代碼時會自動重新編譯並刷新瀏覽器。

### 構建

```bash
npm run build
```

這會：
1. 編譯 TypeScript 源代碼
2. 使用 Vite 構建並優化項目
3. 輸出到 `dist/` 目錄

### 預覽構建結果

```bash
npm run preview
```

這會在本地預覽構建後的結果。

### 本地測試

#### 方法 1: 開發模式（推薦）

```bash
npm run dev
```

這會啟動開發服務器，通常運行在 `http://localhost:5173`

#### 方法 2: 構建後預覽

```bash
npm run build
npm run preview
```

## 部署到 GitHub Pages

### 方法 1: 使用 GitHub Actions (推薦)

1. 確保您的倉庫已啟用 GitHub Pages
   - 前往倉庫的 Settings > Pages
   - 選擇 Source 為 "GitHub Actions"

2. 推送代碼到 `main` 或 `master` 分支

3. GitHub Actions 會自動構建並部署到 GitHub Pages

### 方法 2: 手動部署

```bash
npm run build
npm run deploy
```

這會使用 `gh-pages` 將 `dist/` 目錄部署到 GitHub Pages。

**注意**: 如果您的倉庫名稱不是 `legal_enforcement_tools`，請在 `vite.config.ts` 中設置正確的 `base` 路徑。

## 目錄結構

```
.
├── src/                    # 源代碼
│   ├── components/         # React 組件
│   │   ├── Navbar.tsx
│   │   ├── InputSection.tsx
│   │   ├── OutputSection.tsx
│   │   └── AnalysisSection.tsx
│   ├── utils/              # 工具函數
│   │   ├── validations.ts
│   │   └── analysis.ts
│   ├── types/              # TypeScript 類型定義
│   │   └── index.ts
│   ├── App.tsx             # 主應用組件
│   ├── main.tsx            # 入口文件
│   └── index.css           # 全局樣式
├── dist/                   # 構建輸出（構建後生成）
├── .github/workflows/      # GitHub Actions 工作流
├── index.html              # HTML 模板
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
├── tailwind.config.js      # Tailwind CSS 配置
└── package.json            # 項目配置
```

## 功能簡介

本工具主要提供三大區塊：

1. **調證信息錄入**  
   - 支援單筆與批量新增調證信息
   - 格式檢查功能（可檢查地址、TXID 等格式是否有效）
   - 支援保存文件、導入文件、複製及刪除所有資料等操作
   - 現代化的 UI 設計，響應式布局

2. **調證結果輸出**  
   - 支援一次上傳多個 XLSX 文件，並統整、去重後顯示分析結果
   - 可複製所有去重後的 UID，以及 TXID 與充值地址（合併去重）的資料
   - 顯示上傳檔案清單與分析後的資料總數與涉案 UID 數
   - 清晰的表格展示

3. **案件數據分析**  
   - 根據上傳的 XLSX 文件數據進行分析，並統計案件數量與異常增長百分比等資訊
   - 可生成統計報告，並提供複製功能
   - 支援 PDF 報告導出
   - 直觀的數據可視化

此外，工具內建深色模式切換功能，提供更佳的使用體驗。

## 特色功能

- **多區塊鏈地址與 TXID 驗證**  
  支援以下公鏈：
  - **BTC**：Legacy (P2PKH)、Nested Segwit (P2SH-P2WPKH)、Native Segwit (P2WPKH) 及 Taproot (P2TR)
  - **EVM**：例如 ETH、BSC、Base、OP
  - **LTC、TRON、SOL、XMR、Kaspa、Sui、Aptos、ADA**

- **文件操作**  
  - 支援 XLSX 文件的匯出與導入
  - 多檔上傳後統整、去重，並在前端以表格形式呈現
  - 一鍵複製功能：可複製所有測試資料、一鍵複製所有 UID 或 TXID 與充值地址（均排除重複）

- **現代化 UI 設計**  
  - 使用 Tailwind CSS 構建，響應式設計
  - 支持深色模式
  - 流暢的動畫和過渡效果
  - 清晰的視覺層次和用戶體驗

## 版本

當前版本：v2.0

## 開發注意事項

- 使用 `npm run dev` 進行開發時，Vite 會自動處理熱更新
- 所有組件都使用 TypeScript 編寫，確保類型安全
- 樣式使用 Tailwind CSS，支持深色模式
- 構建後的靜態文件可以直接部署到任何靜態網站託管服務
