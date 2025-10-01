# NutriChef Box ― レシピ＆栄養 要件定義

## 区分: 目的
レシピ、在庫、買い物リストをローカルで管理し栄養計算

## 区分: 機能
- レシピ入力 (Markdown 可)
- 在庫連動買い物リスト
- 栄養素グラフ

## 区分: 非機能
- 500 レシピ操作で UI 遅延 ≤ 300 ms

## 区分: セキュリティ
- IndexedDB → オプション暗号化
- File System Access でバックアップ ZIP

## 共通技術スタック
- UI: HTML5 + CSS3 + jQuery (または Vanilla JS)
- データ保存: IndexedDB／localStorage／File System Access API
- オフライン化: Service Worker + PWA Manifest
- 暗号化: WebCrypto (AES-GCM, PBKDF2, SubtleCrypto)
- パッケージ配布:
  - そのまま “ローカル HTML ファイル” として配る
  - Electron / Tauri / NW.js でデスクトップ化（全部 JS で書ける）
