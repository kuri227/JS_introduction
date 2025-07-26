# ブラウザでリアルタイム物体検出！TensorFlow.jsとWebカメラ活用術

このプロジェクトは、**JavaScript**と**TensorFlow.js**を使って、Webブラウザ上でリアルタイムに物体検出を体験できるデモサイトです。  
TensorFlow.jsは、AIモデルの学習・推論をどちらもWebブラウザ上で実行できる唯一の本格的ライブラリであり、サーバーや専用アプリを使わずにAIをWebサイト上で直接動かすことができます。

---

## 主な仕様

- **TensorFlow.js**によるCOCO-SSD物体検出モデルを利用
- **Webカメラ**の映像を取得し、リアルタイムで物体検出
- 検出結果をHTML5 `<canvas>` 上にバウンディングボックスとラベルで可視化
- すべての処理は**ブラウザ内で完結**し、映像データは外部送信されません
- レスポンシブデザイン対応
- 主要な技術解説（async/await, getUserMedia, requestAnimationFrame, Canvas API）付き
- カスタマイズ例や倫理的配慮事項も記載

---

## ファイル構成

- `index.html` : メインのHTMLファイル
- `main.css` : デザイン・レイアウト用CSS
- `script.js` : 物体検出・UI制御用JavaScript
- `js-logo.png` : JavaScriptロゴ画像
- `tfjs-logo.png` : TensorFlow.jsロゴ画像

---

## 使い方

1. このリポジトリをクローンまたはダウンロード
2. `index.html` をブラウザで開く
3. 「カメラを開始」ボタンを押すと、Webカメラ映像上で物体検出が始まります

---

## 注意事項

- TensorFlow, the TensorFlow logo and any related marks are trademarks of Google Inc.
- 本デモは学習・研究・教育目的での利用を想定しています。
- プライバシーや倫理に十分配慮してご利用ください。