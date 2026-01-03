import fs from 'fs/promises';

const HISTORY_FILE = 'post-history.json';

/**
 * 投稿履歴を読み込む
 * @returns {Promise<Set<string>>} 投稿済みの記事IDのセット
 */
export async function loadHistory() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    const history = JSON.parse(data);

    if (!history || !Array.isArray(history.postedIds)) {
      console.warn('投稿履歴ファイルの形式が不正です。空の履歴として初期化します。');
      return new Set();
    }

    return new Set(history.postedIds);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // ファイルが存在しない場合は空のセットを返す（初回実行時）
      console.log('投稿履歴ファイルが存在しません。新規作成します。');
      return new Set();
    }
    // その他のエラーの場合は警告を出して空のセットを返す
    console.warn('投稿履歴の読み込みに失敗しました:', error);
    return new Set();
  }
}

/**
 * 投稿履歴を保存する（90日以内の記事のみ保持）
 * @param {Set<string>} postedIds - 投稿済みの記事IDのセット
 * @param {Set<string>} validIds - 有効な記事IDのセット（90日以内の記事）
 * @returns {Promise<void>}
 * @throws {Error} 投稿履歴の保存に失敗した場合
 */
export async function saveHistory(postedIds, validIds) {
  if (!(postedIds instanceof Set) || !(validIds instanceof Set)) {
    throw new Error('postedIds と validIds は Set である必要があります');
  }

  try {
    // validIds に存在する ID のみを保持（90日以内の記事のみ）
    const filteredIds = Array.from(postedIds).filter(id => validIds.has(id));

    const history = {
      postedIds: filteredIds,
      lastUpdated: new Date().toISOString(),
    };

    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
    console.log(`投稿履歴を保存しました（${filteredIds.length}件）`);
  } catch (error) {
    console.error('投稿履歴の保存に失敗しました:', error);
    throw error;
  }
}

/**
 * 未投稿の記事をフィルタリングする
 * @param {Array<Object>} articles - 記事の配列
 * @param {Set<string>} postedIds - 投稿済みの記事IDのセット
 * @returns {Array<Object>} 未投稿の記事の配列
 */
export function filterNewArticles(articles, postedIds) {
  if (!Array.isArray(articles)) {
    throw new Error('articles は配列である必要があります');
  }

  if (!(postedIds instanceof Set)) {
    throw new Error('postedIds は Set である必要があります');
  }

  return articles.filter(article => article && article.id && !postedIds.has(article.id));
}

/**
 * 記事IDを投稿履歴に追加する
 * @param {Set<string>} postedIds - 投稿済みの記事IDのセット
 * @param {Array<Object>} articles - 投稿した記事の配列
 * @returns {void}
 */
export function addToHistory(postedIds, articles) {
  if (!(postedIds instanceof Set)) {
    throw new Error('postedIds は Set である必要があります');
  }

  if (!Array.isArray(articles)) {
    throw new Error('articles は配列である必要があります');
  }

  articles.forEach(article => {
    if (article && article.id) {
      postedIds.add(article.id);
    }
  });
}
