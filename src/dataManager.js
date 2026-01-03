import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = 'docs/data';
const RETENTION_DAYS = 90;
const INDEX_FILENAME = 'index.json';

/**
 * カテゴリ別のデータファイルパスを取得
 * @param {string} categoryId - カテゴリID
 * @returns {string} データファイルのパス
 */
function getDataFilePath(categoryId) {
  return path.join(DATA_DIR, `${categoryId}.json`);
}

/**
 * 指定日数前のカットオフ日時を取得する
 * @param {number} days - 日数
 * @returns {Date} カットオフ日時
 */
function getCutoffDate(days) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  return cutoffDate;
}

/**
 * カテゴリのデータを読み込む
 * @param {string} categoryId - カテゴリID
 * @returns {Promise<Array<Object>>} 保存されている記事の配列
 */
export async function loadCategoryData(categoryId) {
  if (!categoryId || typeof categoryId !== 'string') {
    throw new Error('有効なカテゴリIDが指定されていません');
  }

  try {
    const filePath = getDataFilePath(categoryId);
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);

    if (!parsed || !Array.isArray(parsed.articles)) {
      console.warn(`カテゴリ ${categoryId} のデータ形式が不正です。空の配列を返します。`);
      return [];
    }

    return parsed.articles;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // ファイルが存在しない場合は空の配列を返す（初回実行時）
      return [];
    }
    // その他のエラーの場合は警告を出して空の配列を返す
    console.warn(`カテゴリ ${categoryId} のデータ読み込みに失敗しました:`, error);
    return [];
  }
}

/**
 * カテゴリのデータを保存する
 * @param {string} categoryId - カテゴリID
 * @param {string} categoryName - カテゴリ名
 * @param {Array<Object>} articles - 保存する記事の配列
 * @returns {Promise<void>}
 * @throws {Error} データの保存に失敗した場合
 */
export async function saveCategoryData(categoryId, categoryName, articles) {
  if (!categoryId || typeof categoryId !== 'string') {
    throw new Error('有効なカテゴリIDが指定されていません');
  }

  if (!categoryName || typeof categoryName !== 'string') {
    throw new Error('有効なカテゴリ名が指定されていません');
  }

  if (!Array.isArray(articles)) {
    throw new Error('articles は配列である必要があります');
  }

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
 * 記事を日付でソートする（新しい順）
 * @param {Array<Object>} articles - 記事の配列
 * @returns {Array<Object>} ソートされた記事の配列
 */
function sortArticlesByDate(articles) {
  return articles.sort((a, b) => {
    return new Date(b.pubDate) - new Date(a.pubDate);
  });
}

/**
 * 新しい記事を既存のデータに追加する
 * @param {string} categoryId - カテゴリID
 * @param {string} categoryName - カテゴリ名
 * @param {Array<Object>} newArticles - 追加する記事の配列
 * @param {string} [siteName=''] - サイト名
 * @returns {Promise<void>}
 * @throws {Error} データの保存に失敗した場合
 */
export async function addArticlesToCategory(categoryId, categoryName, newArticles, siteName = '') {
  if (!Array.isArray(newArticles)) {
    throw new Error('newArticles は配列である必要があります');
  }

  const existingArticles = await loadCategoryData(categoryId);

  // 重複を避けるため、IDでマージする
  const articleMap = new Map();

  // 既存の記事を追加
  existingArticles.forEach(article => {
    if (article && article.id) {
      articleMap.set(article.id, article);
    }
  });

  // 新しい記事を追加（既存のものは上書きされる）
  newArticles.forEach(article => {
    if (article && article.id) {
      // サイト名を追加
      const articleWithSiteName = {
        ...article,
        siteName: siteName || article.siteName || '' // 既存のsiteNameがあればそれを保持
      };
      articleMap.set(article.id, articleWithSiteName);
    }
  });

  // Map を配列に変換し、日付でソート（新しい順）
  const allArticles = sortArticlesByDate(Array.from(articleMap.values()));

  // 90日間のデータ保持: 古いデータを削除
  const filteredArticles = filterOldArticles(allArticles);

  await saveCategoryData(categoryId, categoryName, filteredArticles);
}

/**
 * 90日より古い記事を除外する
 * @param {Array<Object>} articles - 記事の配列
 * @returns {Array<Object>} フィルタリングされた記事の配列
 */
function filterOldArticles(articles) {
  const cutoffDate = getCutoffDate(RETENTION_DAYS);

  return articles.filter(article => {
    if (!article || !article.pubDate) {
      return false;
    }
    const articleDate = new Date(article.pubDate);
    return articleDate >= cutoffDate;
  });
}

/**
 * 全カテゴリの記事IDを取得（90日以内の記事のみ）
 * @param {Array<Object>} categories - カテゴリ情報の配列
 * @returns {Promise<Set<string>>} 全記事IDのセット
 */
export async function getAllArticleIds(categories) {
  if (!Array.isArray(categories)) {
    throw new Error('categories は配列である必要があります');
  }

  const allIds = new Set();

  for (const category of categories) {
    if (!category || !category.id) {
      console.warn('無効なカテゴリデータがスキップされました:', category);
      continue;
    }

    const articles = await loadCategoryData(category.id);
    articles.forEach(article => {
      if (article && article.id) {
        allIds.add(article.id);
      }
    });
  }

  return allIds;
}

/**
 * 全カテゴリのデータをまとめたインデックスファイルを生成
 * @param {Array<Object>} categories - カテゴリ情報の配列
 * @returns {Promise<void>}
 * @throws {Error} インデックスファイルの生成に失敗した場合
 */
export async function generateIndex(categories) {
  if (!Array.isArray(categories)) {
    throw new Error('categories は配列である必要があります');
  }

  try {
    const index = {
      categories: [],
      generatedAt: new Date().toISOString(),
    };

    for (const category of categories) {
      if (!category || !category.id || !category.name) {
        console.warn('無効なカテゴリデータがスキップされました:', category);
        continue;
      }

      const articles = await loadCategoryData(category.id);
      index.categories.push({
        id: category.id,
        name: category.name,
        articleCount: articles.length,
        dataFile: `${category.id}.json`,
      });
    }

    const indexPath = path.join(DATA_DIR, INDEX_FILENAME);
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    console.log(`インデックスファイルを生成しました: ${indexPath}`);
  } catch (error) {
    console.error('インデックスファイルの生成に失敗しました:', error);
    throw error;
  }
}

/**
 * 未使用のデータファイルを削除する
 * @param {Array<Object>} categories - カテゴリ情報の配列
 * @returns {Promise<void>}
 */
export async function cleanupUnusedDataFiles(categories) {
  if (!Array.isArray(categories)) {
    console.warn('cleanupUnusedDataFiles: categories が配列ではありません');
    return;
  }

  try {
    // 許可されたカテゴリIDのセットを作成
    const allowedFiles = new Set(
      categories
        .filter(category => category && category.id)
        .map(category => `${category.id}.json`)
    );
    allowedFiles.add(INDEX_FILENAME); // index.jsonは除外対象

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
    if (error.code === 'ENOENT') {
      // ディレクトリが存在しない場合はスキップ
      console.log('データディレクトリが存在しないため、クリーンアップをスキップします');
      return;
    }
    console.error('データファイルのクリーンアップに失敗しました:', error);
    // エラーが発生しても処理は継続
  }
}
