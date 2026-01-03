import Parser from 'rss-parser';

/**
 * RSSフィードのアイテムを正規化された記事オブジェクトに変換する
 * @param {Object} item - RSS フィードのアイテム
 * @param {string} [item.guid] - 記事の一意識別子
 * @param {string} item.link - 記事のURL
 * @param {string} item.title - 記事タイトル
 * @param {string} [item.pubDate] - 公開日時
 * @param {string} [item.contentSnippet] - 記事の概要（プレーンテキスト）
 * @param {string} [item.content] - 記事の内容（HTML）
 * @returns {Object} 正規化された記事オブジェクト
 */
function normalizeArticle(item) {
  return {
    id: item.guid || item.link,
    title: item.title || '（タイトルなし）',
    link: item.link,
    pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    contentSnippet: item.contentSnippet || item.content || '',
  };
}

/**
 * RSSフィードから記事を収集する
 * @param {string} feedUrl - RSSフィードのURL
 * @returns {Promise<Array<Object>>} 記事の配列
 * @throws {Error} RSSフィードの取得に失敗した場合
 */
export async function collectFeed(feedUrl) {
  if (!feedUrl || typeof feedUrl !== 'string') {
    throw new Error('有効なRSSフィードURLが指定されていません');
  }

  const parser = new Parser();

  try {
    const feed = await parser.parseURL(feedUrl);

    if (!feed || !Array.isArray(feed.items)) {
      throw new Error('RSSフィードの形式が不正です');
    }

    return feed.items.map(normalizeArticle);
  } catch (error) {
    const errorMessage = `RSSフィードの取得に失敗しました: ${feedUrl}`;
    console.error(errorMessage, error);
    throw new Error(`${errorMessage} - ${error.message}`);
  }
}
