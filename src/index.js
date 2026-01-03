import 'dotenv/config';
import fs from 'fs/promises';
import { addArticlesToCategory, generateIndex, getAllArticleIds, cleanupUnusedDataFiles } from './dataManager.js';
import { postMultipleArticles } from './discordPoster.js';
import { collectFeed } from './feedCollector.js';
import { addToHistory, filterNewArticles, loadHistory, saveHistory } from './historyManager.js';

const FILTER_DAYS = 30; // 初回実行時に遡る日数
const CATEGORIES_FILE = 'categories.json';

/**
 * カテゴリ設定を読み込む
 * @returns {Promise<Array<Object>>} カテゴリ情報の配列
 * @throws {Error} カテゴリ設定の読み込みに失敗した場合
 */
async function loadCategories() {
  try {
    const categoriesData = await fs.readFile(CATEGORIES_FILE, 'utf-8');
    const parsed = JSON.parse(categoriesData);

    if (!parsed || !Array.isArray(parsed.categories)) {
      throw new Error('カテゴリ設定の形式が不正です');
    }

    return parsed.categories;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`カテゴリ設定ファイルが見つかりません: ${CATEGORIES_FILE}`);
    }
    throw new Error(`カテゴリ設定の読み込みに失敗しました: ${error.message}`);
  }
}

/**
 * 指定日数前の日時を取得する
 * @param {number} days - 日数
 * @returns {Date} 日時
 */
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * 初回実行時の記事フィルタリング
 * @param {Array<Object>} articles - 記事の配列
 * @param {number} filterDays - フィルタリングする日数
 * @returns {Array<Object>} フィルタリングされた記事の配列
 */
function filterArticlesByDate(articles, filterDays) {
  const cutoffDate = getDateDaysAgo(filterDays);

  return articles.filter(article => {
    if (!article || !article.pubDate) {
      return false;
    }
    const articleDate = new Date(article.pubDate);
    return articleDate >= cutoffDate;
  });
}

/**
 * カテゴリの記事を処理する
 * @param {Object} category - カテゴリ情報
 * @param {Set<string>} postedIds - 投稿済み記事IDのセット
 * @param {boolean} isFirstRun - 初回実行かどうか
 * @returns {Promise<void>}
 */
async function processCategory(category, postedIds, isFirstRun) {
  console.log(`\n[${category.name}] カテゴリの処理を開始します...`);

  try {
    // RSSフィードから記事を収集
    console.log(`RSSフィードを取得中: ${category.feedUrl}`);
    let articles = await collectFeed(category.feedUrl);
    console.log(`${articles.length}件の記事を取得しました`);

    // 初回実行時は指定日数以内の記事のみをフィルタリング
    if (isFirstRun) {
      const filteredArticles = filterArticlesByDate(articles, FILTER_DAYS);
      console.log(`初回実行: ${articles.length}件中${filteredArticles.length}件が${FILTER_DAYS}日前以降の記事です`);
      articles = filteredArticles;
    }

    // 未投稿の記事をフィルタリング
    const newArticles = filterNewArticles(articles, postedIds);

    if (newArticles.length === 0) {
      console.log('新しい記事はありません');
    } else {
      console.log(`${newArticles.length}件の新しい記事があります`);
      await handleNewArticles(newArticles, category, postedIds);
    }

    // データをJSONファイルに保存（全記事、新旧問わず）
    console.log('データを保存中...');
    await addArticlesToCategory(category.id, category.name, articles, category.siteName);

  } catch (error) {
    console.error(`[${category.name}] カテゴリの処理中にエラーが発生しました:`, error);
    // エラーが発生しても他のカテゴリの処理は継続
  }
}

/**
 * 新しい記事をDiscordに投稿する
 * @param {Array<Object>} newArticles - 新しい記事の配列
 * @param {Object} category - カテゴリ情報
 * @param {Set<string>} postedIds - 投稿済み記事IDのセット
 * @returns {Promise<void>}
 */
async function handleNewArticles(newArticles, category, postedIds) {
  // Discord Webhook URLを取得
  const webhookUrl = category.webhookEnvKey ? process.env[category.webhookEnvKey] : null;

  if (!webhookUrl) {
    console.warn(`⚠ Discord Webhook用環境変数が設定されていないため、Discord投稿をスキップします`);
    return;
  }

  try {
    // Discordに投稿
    console.log('Discordへの投稿を開始します...');
    await postMultipleArticles(webhookUrl, newArticles, category.name);

    // 投稿履歴に追加
    addToHistory(postedIds, newArticles);

    console.log(`${newArticles.length}件の記事をDiscordに投稿しました`);
  } catch (error) {
    console.error('Discord投稿に失敗しました:', error);
    // Discord投稿が失敗してもデータ保存は継続する
  }
}

/**
 * 後処理を実行する
 * @param {Array<Object>} categories - カテゴリ情報の配列
 * @param {Set<string>} postedIds - 投稿済み記事IDのセット
 * @returns {Promise<void>}
 */
async function performCleanup(categories, postedIds) {
  try {
    // 投稿履歴を保存（90日以内の記事のみ）
    const validIds = await getAllArticleIds(categories);
    await saveHistory(postedIds, validIds);

    // インデックスファイルを生成（GitHub Pages用）
    await generateIndex(categories);

    // 未使用のデータファイルを削除
    await cleanupUnusedDataFiles(categories);
  } catch (error) {
    console.error('クリーンアップ処理中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * メイン処理
 * @returns {Promise<void>}
 */
async function main() {
  console.log('情報収集処理を開始します...');

  try {
    // カテゴリ設定を読み込む
    const categories = await loadCategories();
    console.log(`${categories.length}個のカテゴリを読み込みました`);

    // 投稿履歴を読み込む
    const postedIds = await loadHistory();
    const isFirstRun = postedIds.size === 0;

    if (isFirstRun) {
      console.log(`初回実行: ${FILTER_DAYS}日前以降の記事のみを対象とします`);
    }

    // 各カテゴリを処理
    for (const category of categories) {
      await processCategory(category, postedIds, isFirstRun);
    }

    // 後処理（履歴保存、インデックス生成、クリーンアップ）
    await performCleanup(categories, postedIds);

    console.log('\n情報収集処理が完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行
main();
