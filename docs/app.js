// 状態管理
let currentCategory = null;
let categoriesData = [];
let articlesData = {};
let isSearchMode = false;
let searchKeyword = '';

// 期間フィルタの状態管理
let dateFilter = {
  mode: 'all', // 'all' | 'today' | 'week' | 'month'
  startDate: null, // Date object or null
  endDate: null    // Date object or null
};

// ダークモード管理
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');

  if (!themeToggle || !sunIcon || !moonIcon) {
    console.warn('Theme toggle elements not found');
    return;
  }

  // システムのカラースキーム設定を取得
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  // 保存されたテーマまたはシステム設定から初期テーマを決定
  const savedTheme = localStorage.getItem('theme');
  const initialTheme = savedTheme || (systemPrefersDark.matches ? 'dark' : 'light');

  // 初期テーマを適用
  setTheme(initialTheme);

  // トグルボタンのクリックイベント
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  });

  // システムのカラースキーム変更を監視(ユーザーが明示的に設定していない場合のみ)
  systemPrefersDark.addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
}

// テーマを設定
function setTheme(theme) {
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');

  if (!sunIcon || !moonIcon) return;

  document.documentElement.setAttribute('data-theme', theme);

  // アイコンの表示/非表示を切り替え
  if (theme === 'dark') {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  } else {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  }
}

// 初期化
async function init() {
  // テーマ初期化を最初に実行
  initTheme();

  try {
    // インデックスファイルを読み込む
    const indexResponse = await fetch('./data/index.json');
    if (!indexResponse.ok) {
      throw new Error('Failed to load index file');
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

    // 最初のカテゴリグループを選択
    if (categoriesData.length > 0) {
      // カテゴリ名でグループ化して最初のグループのIDsを取得
      const groupedCategories = {};
      categoriesData.forEach(category => {
        if (!groupedCategories[category.name]) {
          groupedCategories[category.name] = {
            ids: []
          };
        }
        groupedCategories[category.name].ids.push(category.id);
      });
      const firstGroupIds = Object.values(groupedCategories)[0].ids;
      selectCategory(firstGroupIds);
    }

    // 検索機能のイベントリスナーを設定
    setupSearchListeners();

    // 期間フィルタのイベントリスナーを設定
    setupDateFilterListeners();

    // トップに戻るボタンを初期化
    initScrollToTop();
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Loading failed');
  }
}

// カテゴリタブを生成（同じカテゴリ名をグループ化）
function renderCategoryTabs() {
  const tabsContainer = document.getElementById('categoryTabs');
  tabsContainer.innerHTML = '';

  // カテゴリ名でグループ化
  const groupedCategories = {};
  categoriesData.forEach(category => {
    if (!groupedCategories[category.name]) {
      groupedCategories[category.name] = {
        name: category.name,
        ids: [],
        totalArticleCount: 0
      };
    }
    groupedCategories[category.name].ids.push(category.id);
    groupedCategories[category.name].totalArticleCount += category.articleCount;
  });

  // グループ化されたカテゴリでタブを生成
  Object.values(groupedCategories).forEach(group => {
    const tab = document.createElement('button');
    tab.className = 'category-tab';
    tab.textContent = `${group.name} (${group.totalArticleCount})`;
    tab.onclick = () => selectCategory(group.ids);
    tab.dataset.categoryIds = JSON.stringify(group.ids);
    tabsContainer.appendChild(tab);
  });
}

// カテゴリを選択（複数IDに対応）
async function selectCategory(categoryIds) {
  // 配列でない場合は配列化（後方互換性のため）
  if (!Array.isArray(categoryIds)) {
    categoryIds = [categoryIds];
  }

  currentCategory = categoryIds;

  // タブのアクティブ状態を更新
  document.querySelectorAll('.category-tab').forEach(tab => {
    const tabIds = JSON.parse(tab.dataset.categoryIds);
    // 配列の内容が同じかチェック
    const isActive = JSON.stringify(tabIds.sort()) === JSON.stringify([...categoryIds].sort());
    if (isActive) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // タイトルを「Article List」に戻す
  const titleEl = document.getElementById('categoryTitle');
  if (titleEl) {
    titleEl.textContent = 'Article List';
  }

  // カテゴリ情報を取得
  const categories = categoriesData.filter(cat => categoryIds.includes(cat.id));
  if (categories.length === 0) return;

  // 複数カテゴリの記事を読み込んで表示
  await loadAndRenderMultipleCategories(categoryIds, categories);
}

// 記事を読み込んで表示（単一カテゴリ用）
async function loadAndRenderArticles(categoryId, dataFile) {
  const articlesListEl = document.getElementById('articlesList');
  articlesListEl.innerHTML = '<p class="loading">Loading articles...</p>';

  try {
    // キャッシュをチェック
    if (!articlesData[categoryId]) {
      const response = await fetch(`./data/${dataFile}`);
      if (!response.ok) {
        throw new Error('Loading failed');
      }

      const data = await response.json();
      articlesData[categoryId] = data.articles || [];
    }

    const articles = articlesData[categoryId];

    // 記事数を更新
    const countEl = document.getElementById('articlesCount');
    if (countEl) {
      countEl.textContent = `${articles.length} Articles`;
    }

    // 記事を表示
    renderArticles(articles);
  } catch (error) {
    console.error('Article loading error:', error);
    showError('Failed to load articles');
  }
}

// 複数カテゴリの記事を読み込んで表示
async function loadAndRenderMultipleCategories(categoryIds, categories) {
  const articlesListEl = document.getElementById('articlesList');
  articlesListEl.innerHTML = '<p class="loading">Loading articles...</p>';

  try {
    // 各カテゴリのデータを読み込み
    const allArticles = [];

    for (const categoryId of categoryIds) {
      const category = categories.find(cat => cat.id === categoryId);
      if (!category) continue;

      // キャッシュをチェック
      if (!articlesData[categoryId]) {
        const response = await fetch(`./data/${category.dataFile}`);
        if (!response.ok) {
          console.error(`Failed to load category ${categoryId}`);
          continue;
        }

        const data = await response.json();
        articlesData[categoryId] = data.articles || [];
      }

      // 記事を追加
      allArticles.push(...articlesData[categoryId]);
    }

    // 日付の降順でソート
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // フィルタを適用
    const filteredArticles = applyAllFilters(allArticles, searchKeyword, dateFilter);

    // 記事数を更新
    const countEl = document.getElementById('articlesCount');
    if (countEl) {
      countEl.textContent = `${filteredArticles.length} Articles`;
    }

    // 記事を表示
    renderArticles(filteredArticles);
  } catch (error) {
    console.error('Article failed to load:', error);
    showError('Article failed to load');
  }
}

// 記事を表示
function renderArticles(articles) {
  const articlesListEl = document.getElementById('articlesList');

  if (articles.length === 0) {
    articlesListEl.innerHTML = '<p class="no-articles">No articles</p>';
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day} ${hours}:${minutes}`;

  let metaHtml = '';

  // サイト名と日付を1つのspanにまとめて表示
  let dateTimeText = '';
  if (article.siteName) {
    dateTimeText = `【${escapeHtml(article.siteName)}】${dateStr}`;
  } else {
    dateTimeText = dateStr;
  }
  metaHtml += `<span>${dateTimeText}</span>`;

  // 検索結果の場合はカテゴリバッジも表示
  if (showCategory && article.categoryName) {
    metaHtml += `<span class="category-badge">${escapeHtml(article.categoryName)}</span>`;
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

// 期間フィルタリング関数
function filterByDate(articles, filterConfig) {
  // フィルタなしの場合はそのまま返す
  if (filterConfig.mode === 'all') {
    return articles;
  }

  const now = new Date();
  let startDate, endDate;

  // プリセット期間の場合
  if (filterConfig.mode === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (filterConfig.mode === 'week') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (filterConfig.mode === 'month') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  }

  // 記事をフィルタリング
  return articles.filter(article => {
    if (!article.pubDate) return false;

    const pubDate = new Date(article.pubDate);

    // 開始日のみ指定されている場合
    if (startDate && !endDate) {
      return pubDate >= startDate;
    }

    // 終了日のみ指定されている場合
    if (!startDate && endDate) {
      return pubDate <= endDate;
    }

    // 両方指定されている場合
    if (startDate && endDate) {
      return pubDate >= startDate && pubDate <= endDate;
    }

    return true;
  });
}

// 全フィルタを適用（期間フィルタ + 検索フィルタ）
function applyAllFilters(articles, keyword, dateFilterConfig) {
  let filteredArticles = articles;

  // 期間フィルタを適用
  filteredArticles = filterByDate(filteredArticles, dateFilterConfig);

  // 検索キーワードがある場合は検索フィルタを適用
  if (keyword && keyword.trim() !== '') {
    const lowerKeyword = keyword.toLowerCase();
    filteredArticles = filteredArticles.filter(article => {
      const titleMatch = article.title.toLowerCase().includes(lowerKeyword);
      const snippetMatch = article.contentSnippet &&
        article.contentSnippet.toLowerCase().includes(lowerKeyword);
      return titleMatch || snippetMatch;
    });
  }

  return filteredArticles;
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

// 期間フィルタのイベントリスナーを設定
function setupDateFilterListeners() {
  // プリセットボタンのイベントリスナー
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(button => {
    button.addEventListener('click', () => {
      const preset = button.dataset.preset;
      handlePresetClick(preset);
    });
  });
}

// プリセットボタンクリック時の処理
function handlePresetClick(preset) {
  // すべてのプリセットボタンから active クラスを削除
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // クリックされたボタンに active クラスを追加
  const clickedBtn = document.querySelector(`[data-preset="${preset}"]`);
  if (clickedBtn) {
    clickedBtn.classList.add('active');
  }

  // dateFilter状態を更新
  dateFilter.mode = preset;
  dateFilter.startDate = null;
  dateFilter.endDate = null;

  // フィルタを適用
  applyDateFilter();
}

// 期間フィルタを適用
function applyDateFilter() {
  if (isSearchMode) {
    // 検索モードの場合は検索を再実行
    performSearch(searchKeyword);
  } else {
    // カテゴリモードの場合は現在のカテゴリを再表示
    if (currentCategory) {
      selectCategory(currentCategory);
    }
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
    titleEl.textContent = `Search Results: "${keyword}"`;
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
        console.error(`Category ${category.id} loading error:`, error);
      }
    }
  });

  await Promise.all(promises);
}

// 検索を実行
async function performSearch(keyword) {
  const articlesListEl = document.getElementById('articlesList');
  articlesListEl.innerHTML = '<p class="loading">Searching...</p>';

  try {
    // 全カテゴリのデータを読み込む
    await loadAllCategories();

    // 検索を実行
    const results = searchArticles(keyword);

    // 記事数を更新
    const countEl = document.getElementById('articlesCount');
    if (countEl) {
      countEl.textContent = `${results.length} Articles`;
    }

    // 検索結果を表示
    renderSearchResults(results);
  } catch (error) {
    console.error('Search error:', error);
    showError('Search failed');
  }
}

// 記事を検索してフィルタリング
function searchArticles(keyword) {
  const allArticles = [];

  // 全カテゴリの記事を取得
  categoriesData.forEach(category => {
    const articles = articlesData[category.id] || [];

    articles.forEach(article => {
      allArticles.push({
        ...article,
        categoryId: category.id,
        categoryName: category.name
      });
    });
  });

  // 日付の降順でソート
  allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // フィルタを適用（期間フィルタ + 検索フィルタ）
  const filteredArticles = applyAllFilters(allArticles, keyword, dateFilter);

  return filteredArticles;
}

// 検索結果を表示
function renderSearchResults(results) {
  const articlesListEl = document.getElementById('articlesList');

  if (results.length === 0) {
    articlesListEl.innerHTML = '<p class="no-articles">No search results found</p>';
    return;
  }

  articlesListEl.innerHTML = '';

  results.forEach(article => {
    const card = createArticleCard(article, true);
    articlesListEl.appendChild(card);
  });
}

// トップに戻るボタンの初期化
function initScrollToTop() {
  const scrollToTopBtn = document.getElementById('scrollToTop');

  if (!scrollToTopBtn) {
    console.warn('Scroll to top button not found');
    return;
  }

  // スクロールイベントを監視
  let lastScrollTop = 0;
  let ticking = false;

  window.addEventListener('scroll', () => {
    lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (!ticking) {
      window.requestAnimationFrame(() => {
        toggleScrollToTopButton(scrollToTopBtn, lastScrollTop);
        ticking = false;
      });

      ticking = true;
    }
  });

  // ボタンクリック時にトップまでスムーズスクロール
  scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// ボタンの表示/非表示を切り替え
function toggleScrollToTopButton(button, scrollTop) {
  // 300px以上スクロールしたらボタンを表示
  if (scrollTop > 300) {
    button.classList.add('visible');
  } else {
    button.classList.remove('visible');
  }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', init);
