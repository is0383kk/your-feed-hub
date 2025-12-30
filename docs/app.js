// 状態管理
let currentCategory = null;
let categoriesData = [];
let articlesData = {};
let isSearchMode = false;
let searchKeyword = '';

// 初期化
async function init() {
  try {
    // インデックスファイルを読み込む
    const indexResponse = await fetch('./data/index.json');
    if (!indexResponse.ok) {
      throw new Error('インデックスファイルの読み込みに失敗しました');
    }

    const indexData = await indexResponse.json();
    categoriesData = indexData.categories;

    // 最終更新日時を表示
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) {
      const date = new Date(indexData.generatedAt);
      lastUpdatedEl.textContent = date.toLocaleString('ja-JP');
    }

    // カテゴリタブを生成
    renderCategoryTabs();

    // 最初のカテゴリを選択
    if (categoriesData.length > 0) {
      selectCategory(categoriesData[0].id);
    }

    // 検索機能のイベントリスナーを設定
    setupSearchListeners();
  } catch (error) {
    console.error('初期化エラー:', error);
    showError('データの読み込みに失敗しました');
  }
}

// カテゴリタブを生成
function renderCategoryTabs() {
  const tabsContainer = document.getElementById('categoryTabs');
  tabsContainer.innerHTML = '';

  categoriesData.forEach(category => {
    const tab = document.createElement('button');
    tab.className = 'category-tab';
    tab.textContent = `${category.name} (${category.articleCount})`;
    tab.onclick = () => selectCategory(category.id);
    tab.dataset.categoryId = category.id;
    tabsContainer.appendChild(tab);
  });
}

// カテゴリを選択
async function selectCategory(categoryId) {
  currentCategory = categoryId;

  // タブのアクティブ状態を更新
  document.querySelectorAll('.category-tab').forEach(tab => {
    if (tab.dataset.categoryId === categoryId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // カテゴリ情報を取得
  const category = categoriesData.find(cat => cat.id === categoryId);
  if (!category) return;

  // タイトルを更新
  const titleEl = document.getElementById('categoryTitle');
  if (titleEl) {
    titleEl.textContent = `${category.name}の記事`;
  }

  // 記事を読み込んで表示
  await loadAndRenderArticles(categoryId, category.dataFile);
}

// 記事を読み込んで表示
async function loadAndRenderArticles(categoryId, dataFile) {
  const articlesListEl = document.getElementById('articlesList');
  articlesListEl.innerHTML = '<p class="loading">記事を読み込んでいます...</p>';

  try {
    // キャッシュをチェック
    if (!articlesData[categoryId]) {
      const response = await fetch(`./data/${dataFile}`);
      if (!response.ok) {
        throw new Error('記事データの読み込みに失敗しました');
      }

      const data = await response.json();
      articlesData[categoryId] = data.articles || [];
    }

    const articles = articlesData[categoryId];

    // 記事数を更新
    const countEl = document.getElementById('articlesCount');
    if (countEl) {
      countEl.textContent = `${articles.length}件の記事`;
    }

    // 記事を表示
    renderArticles(articles);
  } catch (error) {
    console.error('記事の読み込みエラー:', error);
    showError('記事の読み込みに失敗しました');
  }
}

// 記事を表示
function renderArticles(articles) {
  const articlesListEl = document.getElementById('articlesList');

  if (articles.length === 0) {
    articlesListEl.innerHTML = '<p class="no-articles">記事がありません</p>';
    return;
  }

  articlesListEl.innerHTML = '';

  articles.forEach(article => {
    const card = createArticleCard(article);
    articlesListEl.appendChild(card);
  });
}

// 記事カードを作成
function createArticleCard(article, showCategory = false) {
  const card = document.createElement('article');
  card.className = 'article-card';

  const title = document.createElement('h3');
  title.className = 'article-title';

  const link = document.createElement('a');
  link.href = article.link;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  // 検索モードの場合はタイトルをハイライト
  if (showCategory && searchKeyword) {
    link.innerHTML = highlightKeyword(article.title, searchKeyword);
  } else {
    link.textContent = article.title;
  }

  title.appendChild(link);
  card.appendChild(title);

  // メタ情報
  const meta = document.createElement('div');
  meta.className = 'article-meta';

  const date = new Date(article.pubDate);
  const dateStr = date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let metaHtml = `<span>公開日: ${dateStr}</span>`;

  // 検索結果の場合はカテゴリバッジを表示
  if (showCategory && article.categoryName) {
    metaHtml += ` <span class="category-badge">${escapeHtml(article.categoryName)}</span>`;
  }

  meta.innerHTML = metaHtml;
  card.appendChild(meta);

  // 概要
  if (article.contentSnippet) {
    const snippet = document.createElement('p');
    snippet.className = 'article-snippet';

    let snippetText;
    // 検索モードの場合はキーワード周辺を抽出
    if (showCategory && searchKeyword) {
      snippetText = extractSnippetWithKeyword(article.contentSnippet, searchKeyword);
      snippet.innerHTML = highlightKeyword(snippetText, searchKeyword);
    } else {
      // 通常モードは先頭150文字を表示
      snippetText = article.contentSnippet.substring(0, 150) + (article.contentSnippet.length > 150 ? '...' : '');
      snippet.textContent = snippetText;
    }

    card.appendChild(snippet);
  }

  return card;
}

// エラー表示
function showError(message) {
  const articlesListEl = document.getElementById('articlesList');
  articlesListEl.innerHTML = `<p class="error">${message}</p>`;
}

// テキストをHTMLエスケープ
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// 検索キーワードをハイライト
function highlightKeyword(text, keyword) {
  if (!keyword || !text) return escapeHtml(text);

  // テキストをエスケープ
  const escapedText = escapeHtml(text);

  // キーワードもエスケープ
  const escapedKeyword = escapeHtml(keyword);

  // 大文字小文字を区別せずにマッチ
  const regex = new RegExp(`(${escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

  // マッチした部分を<mark>タグで囲む
  return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// キーワード周辺のテキストを抽出（スマート切り詰め）
function extractSnippetWithKeyword(text, keyword, maxLength = 150) {
  if (!text) return '';
  if (!keyword) return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');

  // 大文字小文字を区別せずにキーワードの位置を探す
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const keywordIndex = lowerText.indexOf(lowerKeyword);

  // キーワードが見つからない場合は通常の切り詰め
  if (keywordIndex === -1) {
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  // キーワードを中心に前後の文字を取得
  const keywordLength = keyword.length;
  const halfLength = Math.floor((maxLength - keywordLength) / 2);

  let start = Math.max(0, keywordIndex - halfLength);
  let end = Math.min(text.length, keywordIndex + keywordLength + halfLength);

  // 開始位置を調整（単語の途中で切れないように）
  if (start > 0) {
    // 前方の空白を探す
    const spaceBeforeStart = text.lastIndexOf(' ', start);
    if (spaceBeforeStart !== -1 && spaceBeforeStart >= start - 20) {
      start = spaceBeforeStart + 1;
    }
  }

  // 終了位置を調整（単語の途中で切れないように）
  if (end < text.length) {
    // 後方の空白を探す
    const spaceAfterEnd = text.indexOf(' ', end);
    if (spaceAfterEnd !== -1 && spaceAfterEnd <= end + 20) {
      end = spaceAfterEnd;
    }
  }

  // 抽出したテキストを組み立て
  let snippet = '';
  if (start > 0) snippet += '...';
  snippet += text.substring(start, end);
  if (end < text.length) snippet += '...';

  return snippet;
}

// 検索機能のイベントリスナーを設定
function setupSearchListeners() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearch');

  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearSearch);
  }
}

// 検索処理
async function handleSearch(event) {
  const keyword = event.target.value.trim();
  searchKeyword = keyword;

  const clearBtn = document.getElementById('clearSearch');

  if (keyword === '') {
    // 検索キーワードが空の場合は通常モードに戻る
    isSearchMode = false;
    if (clearBtn) clearBtn.style.display = 'none';

    // 現在のカテゴリを再表示
    if (currentCategory) {
      selectCategory(currentCategory);
    }
    return;
  }

  // クリアボタンを表示
  if (clearBtn) clearBtn.style.display = 'block';

  // 検索モードに切り替え
  isSearchMode = true;

  // カテゴリタブの選択状態を解除
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.remove('active');
  });

  // タイトルを更新
  const titleEl = document.getElementById('categoryTitle');
  if (titleEl) {
    titleEl.textContent = `検索結果: "${keyword}"`;
  }

  // 全カテゴリのデータを読み込んで検索
  await performSearch(keyword);
}

// 検索をクリア
function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearch');

  if (searchInput) {
    searchInput.value = '';
  }
  if (clearBtn) {
    clearBtn.style.display = 'none';
  }

  searchKeyword = '';
  isSearchMode = false;

  // 現在のカテゴリを再表示
  if (currentCategory) {
    selectCategory(currentCategory);
  }
}

// 全カテゴリのデータを読み込む
async function loadAllCategories() {
  const promises = categoriesData.map(async (category) => {
    if (!articlesData[category.id]) {
      try {
        const response = await fetch(`./data/${category.dataFile}`);
        if (response.ok) {
          const data = await response.json();
          articlesData[category.id] = data.articles || [];
        }
      } catch (error) {
        console.error(`カテゴリ ${category.id} の読み込みエラー:`, error);
      }
    }
  });

  await Promise.all(promises);
}

// 検索を実行
async function performSearch(keyword) {
  const articlesListEl = document.getElementById('articlesList');
  articlesListEl.innerHTML = '<p class="loading">検索しています...</p>';

  try {
    // 全カテゴリのデータを読み込む
    await loadAllCategories();

    // 検索を実行
    const results = searchArticles(keyword);

    // 記事数を更新
    const countEl = document.getElementById('articlesCount');
    if (countEl) {
      countEl.textContent = `${results.length}件の記事`;
    }

    // 検索結果を表示
    renderSearchResults(results);
  } catch (error) {
    console.error('検索エラー:', error);
    showError('検索に失敗しました');
  }
}

// 記事を検索してフィルタリング
function searchArticles(keyword) {
  const results = [];
  const lowerKeyword = keyword.toLowerCase();

  categoriesData.forEach(category => {
    const articles = articlesData[category.id] || [];

    articles.forEach(article => {
      // タイトルと概要を対象に検索
      const titleMatch = article.title.toLowerCase().includes(lowerKeyword);
      const snippetMatch = article.contentSnippet &&
        article.contentSnippet.toLowerCase().includes(lowerKeyword);

      if (titleMatch || snippetMatch) {
        results.push({
          ...article,
          categoryId: category.id,
          categoryName: category.name
        });
      }
    });
  });

  // 日付の降順でソート
  results.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  return results;
}

// 検索結果を表示
function renderSearchResults(results) {
  const articlesListEl = document.getElementById('articlesList');

  if (results.length === 0) {
    articlesListEl.innerHTML = '<p class="no-articles">検索結果が見つかりませんでした</p>';
    return;
  }

  articlesListEl.innerHTML = '';

  results.forEach(article => {
    const card = createArticleCard(article, true);
    articlesListEl.appendChild(card);
  });
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', init);
