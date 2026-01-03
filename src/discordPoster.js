// Discord Embedの設定
const EMBED_COLOR = 0x0099ff; // 青色
const SNIPPET_MAX_LENGTH = 200; // 記事概要の最大文字数
const DELAY_MS = 1000; // Discord Rate Limit対策の投稿間隔（ミリ秒）

/**
 * Discord Embedを作成する
 * @param {Object} article - 記事情報
 * @param {string} article.title - 記事タイトル
 * @param {string} article.link - 記事URL
 * @param {string} article.pubDate - 公開日時（ISO 8601形式）
 * @param {string} [article.contentSnippet] - 記事の概要
 * @param {string} categoryName - カテゴリ名
 * @returns {Object} Discord Embed オブジェクト
 */
function createDiscordEmbed(article, categoryName) {
  const embed = {
    title: article.title,
    url: article.link,
    color: EMBED_COLOR,
    fields: [
      {
        name: 'カテゴリ',
        value: categoryName,
        inline: true,
      },
      {
        name: '公開日時',
        value: new Date(article.pubDate).toLocaleString('ja-JP'),
        inline: true,
      },
    ],
    timestamp: new Date(article.pubDate).toISOString(),
  };

  // 記事の概要があれば追加
  if (article.contentSnippet) {
    const snippet = article.contentSnippet.substring(0, SNIPPET_MAX_LENGTH);
    embed.description = snippet + (article.contentSnippet.length > SNIPPET_MAX_LENGTH ? '...' : '');
  }

  return embed;
}

/**
 * Discordに記事を投稿する
 * @param {string} webhookUrl - Discord WebhookのURL
 * @param {Object} article - 投稿する記事情報
 * @param {string} article.title - 記事タイトル
 * @param {string} article.link - 記事URL
 * @param {string} article.pubDate - 公開日時（ISO 8601形式）
 * @param {string} [article.contentSnippet] - 記事の概要
 * @param {string} categoryName - カテゴリ名
 * @returns {Promise<void>}
 * @throws {Error} Discord投稿に失敗した場合
 */
export async function postToDiscord(webhookUrl, article, categoryName) {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    throw new Error('有効なWebhook URLが指定されていません');
  }

  if (!article || !article.title || !article.link) {
    throw new Error('記事データが不正です');
  }

  const embed = createDiscordEmbed(article, categoryName);
  const payload = {
    embeds: [embed],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorMessage = `Discord投稿に失敗しました: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    console.log(`Discordに投稿しました: ${article.title}`);
  } catch (error) {
    console.error('Discord投稿エラー:', error);
    throw error;
  }
}

/**
 * 指定時間待機する
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 複数の記事を順次投稿する（Rate Limit対策で間隔を空ける）
 * @param {string} webhookUrl - Discord WebhookのURL
 * @param {Array<Object>} articles - 投稿する記事の配列
 * @param {string} categoryName - カテゴリ名
 * @returns {Promise<void>}
 * @throws {Error} Discord投稿に失敗した場合
 */
export async function postMultipleArticles(webhookUrl, articles, categoryName) {
  if (!Array.isArray(articles) || articles.length === 0) {
    console.warn('投稿する記事が指定されていません');
    return;
  }

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    await postToDiscord(webhookUrl, article, categoryName);

    // 最後の記事の後は待機不要
    if (i < articles.length - 1) {
      await delay(DELAY_MS);
    }
  }
}
