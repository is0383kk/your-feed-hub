# your-feed-hub

<div align="center" style="margin-bottom: 2rem;">
<a href="./README.md">English</a> | <a href="./README_ja.md">日本語</a>
</div>

## １．機能概要

![](https://github.com/is0383kk/your-feed-hub/blob/main/img/yourfeedhub.png)

RSS フィードから自動収集した記事を GitHub Pages で一覧表示するツールです。

https://is0383kk.github.io/your-feed-hub/

- RSS フィードから記事を自動収集
- GitHub Pages での記事一覧表示
- 90 日間のデータ保持（古いデータは自動削除）
- （オプション）Discord Hook 機能を使って Discord チャンネルに投稿することも可能です

## ２．使い方

### ■ リポジトリをフォーク

このリポジトリをフォークして、自分の GitHub アカウントにコピーします。

### ■ GitHub Pages の有効化

フォークしたリポジトリの **Settings > Pages** で以下を設定します：

- Source: GitHub Actions

### ■ カテゴリの設定

フォークしたリポジトリの [`categories.json`](https://github.com/is0383kk/your-feed-hub/blob/main/categories.json) を編集して、収集したい RSS フィードを設定します。

**注意:** リポジトリには `categories.json` がサンプルとして含まれていますが、これは`is0383kk`の個人設定です。必ず自分の RSS フィードに編集してください。

#### `categories.json` の例

```json
{
  "categories": [
    {
      "name": "General",
      "id": "general",
      "feedUrl": "https://example.com/feed.xml",
      "webhookEnvKey": "DISCORD_WEBHOOK_GENERAL"
    },
    {
      "name": "AWS",
      "id": "aws",
      "feedUrl": "https://aws.amazon.com/jp/about-aws/whats-new/recent/feed/",
      "webhookEnvKey": "DISCORD_WEBHOOK_AWS"
    }
  ]
}
```

**各項目の説明:**

- `name`: 表示用のカテゴリ名
- `id`: カテゴリの識別子（英数字とアンダースコアのみ、データファイル名に使用される）
- `feedUrl`: RSS フィードの URL
- `webhookEnvKey`: Discord Webhook 用環境変数の名前（オプション）

### ■ 環境変数の設定（オプション）

Discord に通知させる場合は、フォークしたリポジトリの **Settings > Secrets and variables > Actions** で新しいシークレットを追加します。

- Name: `DISCORD_WEBHOOK_AWS`
- Secret: Discord Webhook URL

`.github/workflows/collect.yml` 上で シークレットを参照できるようにします。

```yaml
env:
  DISCORD_WEBHOOK_AWS: ${{ secrets.DISCORD_WEBHOOK_AWS }}
  DISCORD_WEBHOOK_GENERAL: ${{ secrets.DISCORD_WEBHOOK_GENERAL }}
```

### ■ ワークフローの実行

`categories.json` を編集してコミット・プッシュすると、GitHub Actions が自動実行されます。  
または、**Actions > feed-collector-and-poster > Run workflow** でワークフローを手動実行することも可能です。  
ワークフロー実行後、GitHub Pages 上にデプロイされた WEB ページを確認します。

## ３．ローカル環境下での動作確認

### ■ 依存関係のインストール

```bash
npm install
```

### ■ 情報収集と Discord への投稿

ローカルで実行して動作確認する場合は下記コマンドを実行します
`docs/data`配下に収集結果が格納されます

```bash
npm start
```

### ■ WEB ページのローカルプレビュー

収集した記事一覧情報をブラウザで確認する場合は、ローカルサーバーを起動します。

```bash
npm run preview
```

ブラウザで `http://localhost:3000` を開くと、GitHub Pages と同じページが表示されます。

**注意:** 直接 `docs/index.html` をブラウザで開くと CORS エラーが発生するため、必ずローカルサーバーを使用してください。

## ４．その他

### ■ 実行間隔の変更

`.github/workflows/collect.yml` の `cron` 設定を変更します。

```yaml
schedule:
  - cron: "0 0,6,12 * * *"
```

### ■ データ保持期間の変更

`src/dataManager.js` の定数を変更します。

```javascript
const RETENTION_DAYS = 90; // 日数を変更
```

### ■ Discord 投稿のカスタマイズ

`src/discordPoster.js` の `postToDiscord` 関数内の embed オブジェクトを編集します。

### ■ 初回実行時の挙動

初回実行時の投稿数を変更する場合は `src\index.js` の定数を変更します。

```javascript
const FILTER_DAYS = 30; // 初回実行時に遡る日数
```

### ■ ディレクトリ構造

```
your-feed-hub/
├── .github/
│   └── workflows/
│       └── collect.yml          # GitHub Actions ワークフロー
├── docs/                         # GitHub Pages 公開ディレクトリ
│   ├── data/                     # 記事データ（90日間保持、自動更新）
│   │   ├── {categoryId}.json   # カテゴリ別記事データ
│   │   └── index.json           # カテゴリ一覧インデックス
│   ├── index.html               # メインページ
│   ├── app.js                   # フロントエンドロジック
│   └── style.css                # スタイルシート
├── src/                         # バックエンドソースコード
│   ├── index.js                 # メイン処理（オーケストレーション）
│   ├── feedCollector.js         # RSS収集
│   ├── dataManager.js           # データ管理（90日保持ポリシー）
│   ├── historyManager.js        # 投稿履歴管理（重複投稿防止）
│   └── discordPoster.js         # Discord通知
├── categories.json              # カテゴリ・RSSフィード設定（ユーザー作成）
├── post-history.json            # Discord投稿履歴（90日間保持、リポジトリ管理）
├── server.js                    # ローカルプレビューサーバー
└── package.json                 # npm設定・依存関係
```

**重要なポイント:**

- `docs/` 配下のみが GitHub Pages で公開されます
- 記事データと投稿履歴は両方とも 90 日間のみ保持され、リポジトリ肥大化を防ぎます
