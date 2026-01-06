# your-feed-hub

<div align="center" style="font-size: 1.1rem; margin-bottom: 1rem;"><sub>
<a href="./README.md">English</a> | <a href="./README_ja.md">日本語</a>
</sub></div>

## 1. Features

![](https://github.com/is0383kk/your-feed-hub/blob/main/img/yourfeedhub.png)

A tool for automatically collecting articles from RSS feeds and displaying them on GitHub Pages.

https://is0383kk.github.io/your-feed-hub/

- Automatic article collection from RSS feeds
- Article list display on GitHub Pages
- 90-day data retention (old data is automatically deleted)
- (Optional) Discord channel posting via Discord Webhook

## 2. Setup

### ■ Fork the Repository

Fork this repository to copy it to your own GitHub account.

### ■ Enable GitHub Pages

Configure the following in **Settings > Pages** of your forked repository:

- Source: GitHub Actions

### ■ Configure Categories

Edit [`categories.json`](https://github.com/is0383kk/your-feed-hub/blob/main/categories.json) in your forked repository to configure the RSS feeds you want to collect.

**Note:** The repository includes `categories.json` as a sample, but this contains `is0383kk`'s personal configuration. Be sure to edit it with your own RSS feeds.

#### Example `categories.json`

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

**Field Descriptions:**

- `name`: Category name for display
- `id`: Category identifier (alphanumeric and underscores only, used for data file names)
- `feedUrl`: RSS feed URL
- `webhookEnvKey`: Environment variable name for Discord Webhook (optional)

### ■ Configure Environment Variables (Optional)

To enable Discord notifications, add a new secret in **Settings > Secrets and variables > Actions** of your forked repository.

- Name: `DISCORD_WEBHOOK_AWS`
- Secret: Discord Webhook URL

Reference the secrets in `.github/workflows/collect.yml`:

```yaml
env:
  DISCORD_WEBHOOK_AWS: ${{ secrets.DISCORD_WEBHOOK_AWS }}
  DISCORD_WEBHOOK_GENERAL: ${{ secrets.DISCORD_WEBHOOK_GENERAL }}
```

### ■ Run the Workflow

When you edit `categories.json` and commit/push, GitHub Actions will automatically execute.  
Alternatively, you can manually execute the workflow at **Actions > feed-collector-and-poster > Run workflow**.  
After the workflow execution, check the web page deployed on GitHub Pages.

## 3. Local Environment Testing

### ■ Install Dependencies

```bash
npm install
```

### ■ Data Collection and Discord Posting

To run and test locally, execute the following command.  
The collection results will be stored in `docs/data`.

```bash
npm start
```

### ■ Local Web Page Preview

To view the collected article list in a browser, start the local server:

```bash
npm run preview
```

Open `http://localhost:3000` in your browser to see the same page as GitHub Pages.

**Note:** Opening `docs/index.html` directly in a browser will cause CORS errors, so be sure to use the local server.

## 4. Additional Configuration

### ■ Change Execution Interval

Modify the `cron` setting in `.github/workflows/collect.yml`:

```yaml
schedule:
  - cron: "0 0,6,12 * * *"
```

### ■ Change Data Retention Period

Modify the constant in `src/dataManager.js`:

```javascript
const RETENTION_DAYS = 90; // Change the number of days
```

### ■ Customize Discord Posts

Edit the embed object in the `postToDiscord` function in `src/discordPoster.js`.

### ■ Initial Execution Behavior

To change the number of posts on initial execution, modify the constant in `src\index.js`:

```javascript
const FILTER_DAYS = 30; // Number of days to look back on initial execution
```

### ■ Directory Structure

```
your-feed-hub/
├── .github/
│   └── workflows/
│       └── collect.yml          # GitHub Actions workflow
├── docs/                         # GitHub Pages publication directory
│   ├── data/                     # Article data (retained for 90 days, automatically updated)
│   │   ├── {categoryId}.json   # Category-specific article data
│   │   └── index.json           # Category list index
│   ├── index.html               # Main page
│   ├── app.js                   # Frontend logic
│   └── style.css                # Stylesheet
├── src/                         # Backend source code
│   ├── index.js                 # Main processing (orchestration)
│   ├── feedCollector.js         # RSS collection
│   ├── dataManager.js           # Data management (90-day retention policy)
│   ├── historyManager.js        # Post history management (duplicate post prevention)
│   └── discordPoster.js         # Discord notification
├── categories.json              # Category & RSS feed configuration (user-created)
├── post-history.json            # Discord post history (retained for 90 days, repository-managed)
├── server.js                    # Local preview server
└── package.json                 # npm configuration & dependencies
```

**Important Points:**

- Only the `docs/` directory is published on GitHub Pages
- Both article data and post history are retained for only 90 days to prevent repository bloat
