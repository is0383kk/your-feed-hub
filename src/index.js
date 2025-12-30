import 'dotenv/config';
import fs from 'fs/promises';
import { addArticlesToCategory, generateIndex, getAllArticleIds, cleanupUnusedDataFiles } from './dataManager.js';
import { postMultipleArticles } from './discordPoster.js';
import { collectFeed } from './feedCollector.js';
import { addToHistory, filterNewArticles, loadHistory, saveHistory } from './historyManager.js';

const FILTER_DAYS = 30; // 初回実行時に遡る日数

/**
 * メイン処理
 */
async function main() {
  console.log('情報収集処理を開始します...');

  try {
    // カテゴリ設定を読み込む
    const categoriesData = await fs.readFile('categories.json', 'utf-8');
    const { categories } = JSON.parse(categoriesData);

    // 投稿履歴を読み込む
    const postedIds = await loadHistory();
    const isFirstRun = postedIds.size === 0;

    if (isFirstRun) {
      console.log(FILTER_DAYS + '日前以降の記事のみを対象とします');
    }

    for (const category of categories) {
      console.log(`\n[${category.name}] カテゴリの処理を開始します...`);

      try {
        // RSSフィードから記事を収集
        console.log(`RSSフィードを取得中: ${category.feedUrl}`);
        let articles = await collectFeed(category.feedUrl);
        console.log(`${articles.length}件の記事を取得しました`);

        // 初回実行時は（FILTER_DAYS）日前以降の記事のみをフィルタリング
        if (isFirstRun) {
          const numDayAgo = new Date();
          numDayAgo.setDate(numDayAgo.getDate() - FILTER_DAYS);

          const filteredArticles = articles.filter(article => {
            const articleDate = new Date(article.pubDate);
            return articleDate >= numDayAgo;
          });

          console.log(`初回実行: ${articles.length}件中${filteredArticles.length}件が${FILTER_DAYS}日前以降の記事です`);
          articles = filteredArticles;
        }

        // 未投稿の記事をフィルタリング
        const newArticles = filterNewArticles(articles, postedIds);

        if (newArticles.length === 0) {
          console.log('新しい記事はありません');
        } else {
          console.log(`${newArticles.length}件の新しい記事があります`);

          // Discord Webhook URLを取得
          const webhookUrl = process.env[category.webhookEnvKey];

          if (!webhookUrl) {
            console.warn(`⚠ Discord Webhook用環境変数が設定されていないため、Discord投稿をスキップします`);
          } else {
            // Discordに投稿
            console.log('Discordへの投稿を開始します...');
            await postMultipleArticles(webhookUrl, newArticles, category.name);

            // 投稿履歴に追加
            addToHistory(postedIds, newArticles);

            console.log(`${newArticles.length}件の記事をDiscordに投稿しました`);
          }
        }

        // データをJSONファイルに保存（全記事、新旧問わず）
        console.log('データを保存中...');
        await addArticlesToCategory(category.id, category.name, articles, category.siteName);

      } catch (error) {
        console.error(`[${category.name}] カテゴリの処理中にエラーが発生しました:`, error);
        // エラーが発生しても他のカテゴリの処理は継続
      }
    }

    // 投稿履歴を保存（90日以内の記事のみ）
    const validIds = await getAllArticleIds(categories);
    await saveHistory(postedIds, validIds);

    // インデックスファイルを生成（GitHub Pages用）
    await generateIndex(categories);

    // 未使用のデータファイルを削除
    await cleanupUnusedDataFiles(categories);

    console.log('\n情報収集処理が完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行
main();
