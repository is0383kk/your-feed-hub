import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = 'docs/data';
const RETENTION_DAYS = 90;

/**
 * カテゴリ別のデータファイルパスを取得
 * @param {string} categoryId - カテゴリID
 * @returns {string} データファイルのパス
 */
function getDataFilePath(categoryId) {
  return path.join(DATA_DIR, `${categoryId}.json`);
}

/**
 * カテゴリのデータを読み込む
 * @param {string} categoryId - カテゴリID
 * @returns {Promise<Array>} 保存されている記事の配列
 */
export async function loadCategoryData(categoryId) {
  try {
    const filePath = getDataFilePath(categoryId);
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.articles || [];
  } catch (error) {
    // ファイルが存在しない場合は空の配列を返す
    return [];
  }
}

/**
 * カテゴリのデータを保存する
 * @param {string} categoryId - カテゴリID
 * @param {string} categoryName - カテゴリ名
 * @param {Array} articles - 保存する記事の配列
 */
export async function saveCategoryData(categoryId, categoryName, articles) {
  try {
    // ディレクトリが存在しない場合は作成
    await fs.mkdir(DATA_DIR, { recursive: true });

    const data = {
      categoryId,
      categoryName,
      articles,
      lastUpdated: new Date().toISOString(),
    };

    const filePath = getDataFilePath(categoryId);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`データを保存しました: ${filePath}`);
  } catch (error) {
    console.error('データの保存に失敗しました:', error);
    throw error;
  }
}

/**
 * 新しい記事を既存のデータに追加する
 * @param {string} categoryId - カテゴリID
 * @param {string} categoryName - カテゴリ名
 * @param {Array} newArticles - 追加する記事の配列
 * @param {string} siteName - サイト名
 */
export async function addArticlesToCategory(categoryId, categoryName, newArticles, siteName = '') {
  const existingArticles = await loadCategoryData(categoryId);

  // 重複を避けるため、IDでマージする
  const articleMap = new Map();

  // 既存の記事を追加
  existingArticles.forEach(article => {
    articleMap.set(article.id, article);
  });

  // 新しい記事を追加（既存のものは上書きされる）
  newArticles.forEach(article => {
    // サイト名を追加
    const articleWithSiteName = {
      ...article,
      siteName: siteName || article.siteName // 既存のsiteNameがあればそれを保持
    };
    articleMap.set(article.id, articleWithSiteName);
  });

  // Map を配列に変換し、日付でソート（新しい順）
  const allArticles = Array.from(articleMap.values()).sort((a, b) => {
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  // 90日間のデータ保持: 古いデータを削除
  const filteredArticles = filterOldArticles(allArticles);

  await saveCategoryData(categoryId, categoryName, filteredArticles);
}

/**
 * 90日より古い記事を除外する
 * @param {Array} articles - 記事の配列
 * @returns {Array} フィルタリングされた記事の配列
 */
function filterOldArticles(articles) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  return articles.filter(article => {
    const articleDate = new Date(article.pubDate);
    return articleDate >= cutoffDate;
  });
}

/**
 * 全カテゴリの記事IDを取得（90日以内の記事のみ）
 * @param {Array} categories - カテゴリ情報の配列
 * @returns {Promise<Set>} 全記事IDのセット
 */
export async function getAllArticleIds(categories) {
  const allIds = new Set();

  for (const category of categories) {
    const articles = await loadCategoryData(category.id);
    articles.forEach(article => {
      allIds.add(article.id);
    });
  }

  return allIds;
}

/**
 * 全カテゴリのデータをまとめたインデックスファイルを生成
 * @param {Array} categories - カテゴリ情報の配列
 */
export async function generateIndex(categories) {
  try {
    const index = {
      categories: [],
      generatedAt: new Date().toISOString(),
    };

    for (const category of categories) {
      const articles = await loadCategoryData(category.id);
      index.categories.push({
        id: category.id,
        name: category.name,
        articleCount: articles.length,
        dataFile: `${category.id}.json`,
      });
    }

    const indexPath = path.join(DATA_DIR, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    console.log(`インデックスファイルを生成しました: ${indexPath}`);
  } catch (error) {
    console.error('インデックスファイルの生成に失敗しました:', error);
    throw error;
  }
}

/**
 * 未使用のデータファイルを削除する
 * @param {Array} categories - カテゴリ情報の配列
 */
export async function cleanupUnusedDataFiles(categories) {
  try {
    // 許可されたカテゴリIDのセットを作成
    const allowedFiles = new Set(categories.map(category => `${category.id}.json`));
    allowedFiles.add('index.json'); // index.jsonは除外対象

    // データディレクトリ内のファイル一覧を取得
    const files = await fs.readdir(DATA_DIR);

    // 未使用ファイルを削除
    for (const file of files) {
      // .jsonファイルのみを対象とする
      if (!file.endsWith('.json')) {
        continue;
      }

      if (!allowedFiles.has(file)) {
        const filePath = path.join(DATA_DIR, file);
        console.log(`未使用のデータファイルを削除します: ${filePath}`);
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    console.error('データファイルのクリーンアップに失敗しました:', error);
    // エラーが発生しても処理は継続
  }
}
