/**
 * Article Feed Hub - Frontend Application
 * @description RSS フィードから収集した記事を表示するフロントエンドアプリケーション
 */

// ==================== 定数定義 ====================

/**
 * アプリケーション定数
 * @const {Object}
 */
const CONSTANTS = {
  /** スニペットの最大長 */
  SNIPPET_MAX_LENGTH: 150,
  /** スクロールトップボタン表示の閾値 (px) */
  SCROLL_THRESHOLD: 300,
  /** コピーボタンのフィードバック表示時間 (ms) */
  COPY_FEEDBACK_DURATION: 2000,
  /** 単語境界調整の最大距離 (文字数) */
  WORD_BOUNDARY_MAX_DISTANCE: 20,
  /** データフォルダのパス */
  DATA_PATH: './data/',
};

// ==================== 状態管理 ====================

/**
 * アプリケーション状態管理オブジェクト
 * @const {Object}
 */
const State = {
  /** 現在選択中のカテゴリID配列 */
  currentCategory: null,
  /** カテゴリデータ配列 */
  categoriesData: [],
  /** 記事データのキャッシュ (categoryId -> articles[]) */
  articlesData: {},
  /** 検索モードフラグ */
  isSearchMode: false,
  /** 検索キーワード */
  searchKeyword: '',
  /** 期間フィルタの設定 */
  dateFilter: {
    mode: 'all', // 'all' | 'today' | 'week' | 'specific-month'
    startDate: null,
    endDate: null,
    selectedMonth: null, // 'YYYY-MM' format
  },

  /**
   * 状態をリセット
   */
  reset() {
    this.currentCategory = null;
    this.isSearchMode = false;
    this.searchKeyword = '';
  },

  /**
   * 検索モードに切り替え
   * @param {string} keyword - 検索キーワード
   */
  enterSearchMode(keyword) {
    this.isSearchMode = true;
    this.searchKeyword = keyword;
  },

  /**
   * 通常モードに戻る
   */
  exitSearchMode() {
    this.isSearchMode = false;
    this.searchKeyword = '';
  },
};

// ==================== ユーティリティ関数 ====================

/**
 * ユーティリティ関数群
 * @namespace
 */
const Utils = {
  /**
   * HTMLエスケープ
   * @param {string} text - エスケープするテキスト
   * @returns {string} エスケープされたテキスト
   */
  escapeHtml(text) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => escapeMap[char]);
  },

  /**
   * 日付を YYYY-MM-DD HH:MM 形式でフォーマット
   * @param {Date} date - フォーマットする日付
   * @returns {string} フォーマットされた日付文字列
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  /**
   * 日付を YYYY-MM 形式でフォーマット
   * @param {Date} date - フォーマットする日付
   * @returns {string} フォーマットされた年月文字列
   */
  formatYearMonth(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  },

  /**
   * 配列が等しいかチェック（順序を考慮しない）
   * @param {Array} arr1 - 配列1
   * @param {Array} arr2 - 配列2
   * @returns {boolean} 等しければtrue
   */
  arrayEquals(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return JSON.stringify(sorted1) === JSON.stringify(sorted2);
  },

  /**
   * 単語境界を考慮してテキストの開始位置を調整
   * @param {string} text - 対象テキスト
   * @param {number} start - 開始位置
   * @returns {number} 調整後の開始位置
   */
  adjustStartPosition(text, start) {
    if (start <= 0) return 0;

    const spaceIndex = text.lastIndexOf(' ', start);
    if (spaceIndex !== -1 && spaceIndex >= start - CONSTANTS.WORD_BOUNDARY_MAX_DISTANCE) {
      return spaceIndex + 1;
    }
    return start;
  },

  /**
   * 単語境界を考慮してテキストの終了位置を調整
   * @param {string} text - 対象テキスト
   * @param {number} end - 終了位置
   * @returns {number} 調整後の終了位置
   */
  adjustEndPosition(text, end) {
    if (end >= text.length) return text.length;

    const spaceIndex = text.indexOf(' ', end);
    if (spaceIndex !== -1 && spaceIndex <= end + CONSTANTS.WORD_BOUNDARY_MAX_DISTANCE) {
      return spaceIndex;
    }
    return end;
  },
};

// ==================== テーマ管理 ====================

/**
 * テーマ管理クラス
 * @namespace
 */
const ThemeManager = {
  /** @type {HTMLElement|null} テーマトグルボタン */
  themeToggle: null,
  /** @type {HTMLElement|null} サンアイコン */
  sunIcon: null,
  /** @type {HTMLElement|null} ムーンアイコン */
  moonIcon: null,

  /**
   * テーマ管理の初期化
   */
  init() {
    this.themeToggle = document.getElementById('theme-toggle');
    this.sunIcon = document.querySelector('.sun-icon');
    this.moonIcon = document.querySelector('.moon-icon');

    if (!this.themeToggle || !this.sunIcon || !this.moonIcon) {
      console.warn('Theme toggle elements not found');
      return;
    }

    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const savedTheme = localStorage.getItem('theme');
    const initialTheme = savedTheme || (systemPrefersDark.matches ? 'dark' : 'light');

    this.setTheme(initialTheme);
    this.setupEventListeners(systemPrefersDark);
  },

  /**
   * イベントリスナーの設定
   * @param {MediaQueryList} systemPrefersDark - システムのダークモード設定
   */
  setupEventListeners(systemPrefersDark) {
    this.themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      this.setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
    });

    systemPrefersDark.addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  },

  /**
   * テーマを設定
   * @param {string} theme - 'light' | 'dark'
   */
  setTheme(theme) {
    if (!this.sunIcon || !this.moonIcon) return;

    document.documentElement.setAttribute('data-theme', theme);

    if (theme === 'dark') {
      this.sunIcon.style.display = 'block';
      this.moonIcon.style.display = 'none';
    } else {
      this.sunIcon.style.display = 'none';
      this.moonIcon.style.display = 'block';
    }
  },
};

// ==================== データ管理 ====================

/**
 * データ管理クラス
 * @namespace
 */
const DataManager = {
  /**
   * インデックスデータを読み込む
   * @returns {Promise<Object>} インデックスデータ
   * @throws {Error} 読み込みに失敗した場合
   */
  async loadIndex() {
    const response = await fetch(`${CONSTANTS.DATA_PATH}index.json`);
    if (!response.ok) {
      throw new Error('Failed to load index file');
    }
    return await response.json();
  },

  /**
   * カテゴリの記事データを読み込む
   * @param {string} categoryId - カテゴリID
   * @param {string} dataFile - データファイル名
   * @returns {Promise<Array>} 記事配列
   * @throws {Error} 読み込みに失敗した場合
   */
  async loadCategoryArticles(categoryId, dataFile) {
    if (State.articlesData[categoryId]) {
      return State.articlesData[categoryId];
    }

    const response = await fetch(`${CONSTANTS.DATA_PATH}${dataFile}`);
    if (!response.ok) {
      throw new Error(`Failed to load category ${categoryId}`);
    }

    const data = await response.json();
    const articles = data.articles || [];
    State.articlesData[categoryId] = articles;
    return articles;
  },

  /**
   * 全カテゴリの記事データを読み込む
   * @returns {Promise<void>}
   */
  async loadAllCategories() {
    const promises = State.categoriesData.map(async (category) => {
      if (!State.articlesData[category.id]) {
        try {
          await this.loadCategoryArticles(category.id, category.dataFile);
        } catch (error) {
          console.error(`Category ${category.id} loading error:`, error);
        }
      }
    });

    await Promise.all(promises);
  },

  /**
   * 複数カテゴリの記事を統合して取得
   * @param {Array<string>} categoryIds - カテゴリID配列
   * @returns {Promise<Array>} 統合された記事配列（日付降順）
   */
  async getMergedArticles(categoryIds) {
    const allArticles = [];

    for (const categoryId of categoryIds) {
      const category = State.categoriesData.find((cat) => cat.id === categoryId);
      if (!category) continue;

      try {
        const articles = await this.loadCategoryArticles(category.id, category.dataFile);
        allArticles.push(...articles);
      } catch (error) {
        console.error(`Failed to load category ${categoryId}:`, error);
      }
    }

    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    return allArticles;
  },

  /**
   * 全カテゴリの記事を取得（カテゴリ情報付き）
   * @returns {Array} カテゴリ情報付き記事配列
   */
  getAllArticlesWithCategory() {
    const allArticles = [];

    State.categoriesData.forEach((category) => {
      const articles = State.articlesData[category.id] || [];
      articles.forEach((article) => {
        allArticles.push({
          ...article,
          categoryId: category.id,
          categoryName: category.name,
        });
      });
    });

    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    return allArticles;
  },
};

// ==================== フィルタ管理 ====================

/**
 * フィルタ管理クラス
 * @namespace
 */
const FilterManager = {
  /**
   * 期間フィルタを適用
   * @param {Array} articles - 記事配列
   * @param {Object} filterConfig - フィルタ設定
   * @returns {Array} フィルタリングされた記事配列
   */
  filterByDate(articles, filterConfig) {
    if (filterConfig.mode === 'all') {
      return articles;
    }

    const { startDate, endDate } = this.calculateDateRange(filterConfig);

    return articles.filter((article) => {
      if (!article.pubDate) return false;
      const pubDate = new Date(article.pubDate);

      if (startDate && endDate) {
        return pubDate >= startDate && pubDate <= endDate;
      }
      if (startDate) {
        return pubDate >= startDate;
      }
      if (endDate) {
        return pubDate <= endDate;
      }
      return true;
    });
  },

  /**
   * フィルタ設定から日付範囲を計算
   * @param {Object} filterConfig - フィルタ設定
   * @returns {Object} { startDate, endDate }
   */
  calculateDateRange(filterConfig) {
    const now = new Date();
    let startDate = null;
    let endDate = null;

    switch (filterConfig.mode) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;

      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;

      case 'specific-month':
        if (filterConfig.selectedMonth) {
          const [year, month] = filterConfig.selectedMonth.split('-').map(Number);
          startDate = new Date(year, month - 1, 1, 0, 0, 0);
          endDate = new Date(year, month, 0, 23, 59, 59);
        }
        break;
    }

    return { startDate, endDate };
  },

  /**
   * 検索キーワードでフィルタリング
   * @param {Array} articles - 記事配列
   * @param {string} keyword - 検索キーワード
   * @returns {Array} フィルタリングされた記事配列
   */
  filterByKeyword(articles, keyword) {
    if (!keyword || keyword.trim() === '') {
      return articles;
    }

    const lowerKeyword = keyword.toLowerCase();
    return articles.filter((article) => {
      const titleMatch = article.title.toLowerCase().includes(lowerKeyword);
      const snippetMatch =
        article.contentSnippet && article.contentSnippet.toLowerCase().includes(lowerKeyword);
      return titleMatch || snippetMatch;
    });
  },

  /**
   * 全フィルタを適用
   * @param {Array} articles - 記事配列
   * @param {string} keyword - 検索キーワード
   * @param {Object} dateFilterConfig - 期間フィルタ設定
   * @returns {Array} フィルタリングされた記事配列
   */
  applyAll(articles, keyword, dateFilterConfig) {
    let filtered = this.filterByDate(articles, dateFilterConfig);
    filtered = this.filterByKeyword(filtered, keyword);
    return filtered;
  },
};

// ==================== DOM操作 ====================

/**
 * DOM操作ユーティリティ
 * @namespace
 */
const DOMHelper = {
  /**
   * 要素のテキストを設定
   * @param {string} elementId - 要素ID
   * @param {string} text - 設定するテキスト
   */
  setText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
    }
  },

  /**
   * 要素のHTMLを設定
   * @param {string} elementId - 要素ID
   * @param {string} html - 設定するHTML
   */
  setHtml(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = html;
    }
  },

  /**
   * ローディング表示
   * @param {string} message - 表示するメッセージ
   */
  showLoading(message = 'Loading articles...') {
    this.setHtml('articlesList', `<p class="loading">${message}</p>`);
  },

  /**
   * エラー表示
   * @param {string} message - エラーメッセージ
   */
  showError(message) {
    this.setHtml('articlesList', `<p class="error">${message}</p>`);
  },

  /**
   * 記事なし表示
   * @param {string} message - 表示するメッセージ
   */
  showNoArticles(message = 'No articles') {
    this.setHtml('articlesList', `<p class="no-articles">${message}</p>`);
  },

  /**
   * 全てのタブの選択状態をクリア
   */
  clearTabSelection() {
    document.querySelectorAll('.category-tab').forEach((tab) => {
      tab.classList.remove('active');
    });
  },

  /**
   * 全てのプリセットボタンの選択状態をクリア
   */
  clearPresetSelection() {
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
  },

  /**
   * プリセットボタンをアクティブにする
   * @param {string} preset - プリセット名
   */
  activatePreset(preset) {
    const button = document.querySelector(`[data-preset="${preset}"]`);
    if (button) {
      button.classList.add('active');
    }
  },
};

// ==================== テキスト処理 ====================

/**
 * テキスト処理ユーティリティ
 * @namespace
 */
const TextProcessor = {
  /**
   * 検索キーワードをハイライト
   * @param {string} text - 対象テキスト
   * @param {string} keyword - ハイライトするキーワード
   * @returns {string} ハイライト済みHTML
   */
  highlightKeyword(text, keyword) {
    if (!keyword || !text) return Utils.escapeHtml(text);

    const escapedText = Utils.escapeHtml(text);
    const escapedKeyword = Utils.escapeHtml(keyword);
    const safeKeyword = escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeKeyword})`, 'gi');

    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
  },

  /**
   * キーワード周辺のテキストを抽出
   * @param {string} text - 対象テキスト
   * @param {string} keyword - 検索キーワード
   * @param {number} maxLength - 最大長
   * @returns {string} 抽出されたスニペット
   */
  extractSnippetWithKeyword(text, keyword, maxLength = CONSTANTS.SNIPPET_MAX_LENGTH) {
    if (!text) return '';
    if (!keyword) {
      return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
    }

    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    const keywordIndex = lowerText.indexOf(lowerKeyword);

    if (keywordIndex === -1) {
      return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
    }

    const keywordLength = keyword.length;
    const halfLength = Math.floor((maxLength - keywordLength) / 2);

    let start = Math.max(0, keywordIndex - halfLength);
    let end = Math.min(text.length, keywordIndex + keywordLength + halfLength);

    start = Utils.adjustStartPosition(text, start);
    end = Utils.adjustEndPosition(text, end);

    let snippet = '';
    if (start > 0) snippet += '...';
    snippet += text.substring(start, end);
    if (end < text.length) snippet += '...';

    return snippet;
  },

  /**
   * スニペットを切り詰め
   * @param {string} text - 対象テキスト
   * @param {number} maxLength - 最大長
   * @returns {string} 切り詰められたテキスト
   */
  truncateSnippet(text, maxLength = CONSTANTS.SNIPPET_MAX_LENGTH) {
    if (!text) return '';
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  },
};

// ==================== UI コンポーネント ====================

/**
 * 記事カード作成クラス
 * @namespace
 */
const ArticleCard = {
  /**
   * 記事カードを作成
   * @param {Object} article - 記事データ
   * @param {boolean} showCategory - カテゴリバッジを表示するか
   * @returns {HTMLElement} 記事カードElement
   */
  create(article, showCategory = false) {
    const card = document.createElement('article');
    card.className = 'article-card';

    const cardHeader = this.createHeader(article, showCategory);
    const meta = this.createMeta(article, showCategory);
    const snippet = this.createSnippet(article, showCategory);

    card.appendChild(cardHeader);
    card.appendChild(meta);
    if (snippet) {
      card.appendChild(snippet);
    }

    return card;
  },

  /**
   * カードヘッダーを作成
   * @param {Object} article - 記事データ
   * @param {boolean} showCategory - カテゴリ情報を表示するか
   * @returns {HTMLElement} ヘッダーElement
   */
  createHeader(article, showCategory) {
    const header = document.createElement('div');
    header.className = 'article-card-header';

    const title = this.createTitle(article, showCategory);
    const copyButton = this.createCopyButton(article);

    header.appendChild(title);
    header.appendChild(copyButton);

    return header;
  },

  /**
   * タイトル要素を作成
   * @param {Object} article - 記事データ
   * @param {boolean} showCategory - カテゴリ情報を表示するか
   * @returns {HTMLElement} タイトルElement
   */
  createTitle(article, showCategory) {
    const title = document.createElement('h3');
    title.className = 'article-title';

    const link = document.createElement('a');
    link.href = article.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    if (showCategory && State.searchKeyword) {
      link.innerHTML = TextProcessor.highlightKeyword(article.title, State.searchKeyword);
    } else {
      link.textContent = article.title;
    }

    title.appendChild(link);
    return title;
  },

  /**
   * コピーボタンを作成
   * @param {Object} article - 記事データ
   * @returns {HTMLElement} コピーボタンElement
   */
  createCopyButton(article) {
    const button = document.createElement('button');
    button.className = 'copy-link-btn';
    button.setAttribute('aria-label', 'リンクをコピー');
    button.setAttribute('title', 'リンクをコピー');

    button.innerHTML = `
      <svg class="copy-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <svg class="check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.handleCopyClick(button, article.link);
    });

    return button;
  },

  /**
   * コピーボタンクリック処理
   * @param {HTMLElement} button - ボタンElement
   * @param {string} link - コピーするリンク
   */
  async handleCopyClick(button, link) {
    try {
      await navigator.clipboard.writeText(link);

      const copyIcon = button.querySelector('.copy-icon');
      const checkIcon = button.querySelector('.check-icon');

      copyIcon.style.display = 'none';
      checkIcon.style.display = 'block';
      button.classList.add('copied');

      setTimeout(() => {
        copyIcon.style.display = 'block';
        checkIcon.style.display = 'none';
        button.classList.remove('copied');
      }, CONSTANTS.COPY_FEEDBACK_DURATION);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  },

  /**
   * メタ情報を作成
   * @param {Object} article - 記事データ
   * @param {boolean} showCategory - カテゴリバッジを表示するか
   * @returns {HTMLElement} メタ情報Element
   */
  createMeta(article, showCategory) {
    const meta = document.createElement('div');
    meta.className = 'article-meta';

    const dateStr = Utils.formatDate(new Date(article.pubDate));
    let metaHtml = '';

    const dateTimeText = article.siteName
      ? `【${Utils.escapeHtml(article.siteName)}】${dateStr}`
      : dateStr;
    metaHtml += `<span>${dateTimeText}</span>`;

    if (showCategory && article.categoryName) {
      metaHtml += `<span class="category-badge">${Utils.escapeHtml(article.categoryName)}</span>`;
    }

    meta.innerHTML = metaHtml;
    return meta;
  },

  /**
   * スニペットを作成
   * @param {Object} article - 記事データ
   * @param {boolean} showCategory - カテゴリ情報を表示するか
   * @returns {HTMLElement|null} スニペットElement
   */
  createSnippet(article, showCategory) {
    if (!article.contentSnippet) return null;

    const snippet = document.createElement('p');
    snippet.className = 'article-snippet';

    if (showCategory && State.searchKeyword) {
      const snippetText = TextProcessor.extractSnippetWithKeyword(
        article.contentSnippet,
        State.searchKeyword
      );
      snippet.innerHTML = TextProcessor.highlightKeyword(snippetText, State.searchKeyword);
    } else {
      snippet.textContent = TextProcessor.truncateSnippet(article.contentSnippet);
    }

    return snippet;
  },
};

/**
 * カテゴリタブ管理
 * @namespace
 */
const CategoryTabs = {
  /**
   * カテゴリをグループ化
   * @returns {Object} グループ化されたカテゴリ
   */
  groupCategories() {
    const grouped = {};

    State.categoriesData.forEach((category) => {
      if (!grouped[category.name]) {
        grouped[category.name] = {
          name: category.name,
          ids: [],
          totalArticleCount: 0,
        };
      }
      grouped[category.name].ids.push(category.id);
      grouped[category.name].totalArticleCount += category.articleCount;
    });

    return grouped;
  },

  /**
   * タブを描画
   */
  render() {
    const tabsContainer = document.getElementById('categoryTabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';
    const groupedCategories = this.groupCategories();

    Object.values(groupedCategories).forEach((group) => {
      const tab = this.createTab(group);
      tabsContainer.appendChild(tab);
    });
  },

  /**
   * タブ要素を作成
   * @param {Object} group - カテゴリグループ
   * @returns {HTMLElement} タブElement
   */
  createTab(group) {
    const tab = document.createElement('button');
    tab.className = 'category-tab';
    tab.textContent = `${group.name} (${group.totalArticleCount})`;
    tab.dataset.categoryIds = JSON.stringify(group.ids);
    tab.onclick = () => CategoryManager.select(group.ids);
    return tab;
  },

  /**
   * 指定されたカテゴリIDのタブをアクティブにする
   * @param {Array<string>} categoryIds - カテゴリID配列
   */
  setActive(categoryIds) {
    document.querySelectorAll('.category-tab').forEach((tab) => {
      const tabIds = JSON.parse(tab.dataset.categoryIds);
      const isActive = Utils.arrayEquals(tabIds, categoryIds);
      tab.classList.toggle('active', isActive);
    });
  },
};

/**
 * 月選択ドロップダウン管理
 * @namespace
 */
const MonthSelector = {
  /**
   * 記事から利用可能な月のリストを生成
   * @param {Array} articles - 記事配列
   */
  generate(articles) {
    const monthsSet = new Set();

    if (articles && Array.isArray(articles)) {
      articles.forEach((article) => {
        if (article.pubDate) {
          const yearMonth = Utils.formatYearMonth(new Date(article.pubDate));
          monthsSet.add(yearMonth);
        }
      });
    }

    const months = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    this.render(months);
  },

  /**
   * ドロップダウンを描画
   * @param {Array<string>} months - 月の配列 (YYYY-MM形式)
   */
  render(months) {
    const selector = document.getElementById('monthSelector');
    if (!selector) return;

    selector.innerHTML = '<option value="">All Months</option>';

    months.forEach((month) => {
      const option = document.createElement('option');
      option.value = month;
      option.textContent = month;
      selector.appendChild(option);
    });

    if (State.dateFilter.mode === 'specific-month' && State.dateFilter.selectedMonth) {
      selector.value = State.dateFilter.selectedMonth;
    } else {
      selector.value = '';
    }
  },
};

// ==================== カテゴリ管理 ====================

/**
 * カテゴリ管理クラス
 * @namespace
 */
const CategoryManager = {
  /**
   * カテゴリを選択
   * @param {Array<string>|string} categoryIds - カテゴリID（配列または単一ID）
   */
  async select(categoryIds) {
    const idsArray = Array.isArray(categoryIds) ? categoryIds : [categoryIds];

    const categoryChanged = !Utils.arrayEquals(State.currentCategory, idsArray);
    if (categoryChanged && State.dateFilter.mode === 'specific-month') {
      this.resetMonthFilter();
    }

    State.currentCategory = idsArray;
    CategoryTabs.setActive(idsArray);
    DOMHelper.setText('categoryTitle', 'Article List');

    await this.loadAndRender(idsArray);
  },

  /**
   * 月フィルタをリセット
   */
  resetMonthFilter() {
    State.dateFilter.mode = 'all';
    State.dateFilter.selectedMonth = null;
    DOMHelper.clearPresetSelection();
    DOMHelper.activatePreset('all');
  },

  /**
   * カテゴリの記事を読み込んで表示
   * @param {Array<string>} categoryIds - カテゴリID配列
   */
  async loadAndRender(categoryIds) {
    DOMHelper.showLoading();

    try {
      const allArticles = await DataManager.getMergedArticles(categoryIds);
      MonthSelector.generate(allArticles);

      const filteredArticles = FilterManager.applyAll(
        allArticles,
        State.searchKeyword,
        State.dateFilter
      );

      DOMHelper.setText('articlesCount', `${filteredArticles.length} Articles`);
      ArticleList.render(filteredArticles);
    } catch (error) {
      console.error('Article failed to load:', error);
      DOMHelper.showError('Article failed to load');
    }
  },
};

// ==================== 検索管理 ====================

/**
 * 検索管理クラス
 * @namespace
 */
const SearchManager = {
  /**
   * 検索処理
   * @param {Event} event - inputイベント
   */
  async handleInput(event) {
    const keyword = event.target.value.trim();
    State.searchKeyword = keyword;

    const clearBtn = document.getElementById('clearSearch');

    if (keyword === '') {
      State.exitSearchMode();
      if (clearBtn) clearBtn.style.display = 'none';

      if (State.currentCategory) {
        await CategoryManager.select(State.currentCategory);
      }
      return;
    }

    if (clearBtn) clearBtn.style.display = 'block';

    State.enterSearchMode(keyword);
    DOMHelper.clearTabSelection();
    DOMHelper.setText('categoryTitle', `Search Results: "${keyword}"`);

    await this.performSearch(keyword);
  },

  /**
   * 検索をクリア
   */
  async clear() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');

    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';

    State.exitSearchMode();

    if (State.currentCategory) {
      await CategoryManager.select(State.currentCategory);
    }
  },

  /**
   * 検索を実行
   * @param {string} keyword - 検索キーワード
   */
  async performSearch(keyword) {
    DOMHelper.showLoading('Searching...');

    try {
      await DataManager.loadAllCategories();

      const allArticles = DataManager.getAllArticlesWithCategory();
      MonthSelector.generate(allArticles);

      const results = FilterManager.applyAll(allArticles, keyword, State.dateFilter);

      DOMHelper.setText('articlesCount', `${results.length} Articles`);
      ArticleList.render(results, true);
    } catch (error) {
      console.error('Search error:', error);
      DOMHelper.showError('Search failed');
    }
  },

  /**
   * イベントリスナーを設定
   */
  setupListeners() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleInput(e));
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clear());
    }
  },
};

// ==================== 記事リスト表示 ====================

/**
 * 記事リスト表示クラス
 * @namespace
 */
const ArticleList = {
  /**
   * 記事リストを描画
   * @param {Array} articles - 記事配列
   * @param {boolean} showCategory - カテゴリバッジを表示するか
   */
  render(articles, showCategory = false) {
    const articlesListEl = document.getElementById('articlesList');
    if (!articlesListEl) return;

    if (articles.length === 0) {
      DOMHelper.showNoArticles(
        showCategory ? 'No search results found' : 'No articles'
      );
      return;
    }

    articlesListEl.innerHTML = '';

    articles.forEach((article) => {
      const card = ArticleCard.create(article, showCategory);
      articlesListEl.appendChild(card);
    });
  },
};

// ==================== 期間フィルタ管理 ====================

/**
 * 期間フィルタ管理クラス
 * @namespace
 */
const DateFilterManager = {
  /**
   * プリセットボタンクリック処理
   * @param {string} preset - プリセット名
   */
  handlePresetClick(preset) {
    DOMHelper.clearPresetSelection();
    DOMHelper.activatePreset(preset);

    const monthSelector = document.getElementById('monthSelector');
    if (monthSelector) {
      monthSelector.value = '';
    }

    State.dateFilter.mode = preset;
    State.dateFilter.startDate = null;
    State.dateFilter.endDate = null;
    State.dateFilter.selectedMonth = null;

    this.apply();
  },

  /**
   * 月選択処理
   * @param {string} monthValue - 選択された月 (YYYY-MM形式)
   */
  handleMonthSelect(monthValue) {
    if (!monthValue) {
      this.handlePresetClick('all');
      return;
    }

    DOMHelper.clearPresetSelection();

    State.dateFilter.mode = 'specific-month';
    State.dateFilter.selectedMonth = monthValue;
    State.dateFilter.startDate = null;
    State.dateFilter.endDate = null;

    this.apply();
  },

  /**
   * フィルタを適用
   */
  async apply() {
    if (State.isSearchMode) {
      await SearchManager.performSearch(State.searchKeyword);
    } else if (State.currentCategory) {
      await CategoryManager.select(State.currentCategory);
    }
  },

  /**
   * イベントリスナーを設定
   */
  setupListeners() {
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const preset = button.dataset.preset;
        this.handlePresetClick(preset);
      });
    });

    const monthSelector = document.getElementById('monthSelector');
    if (monthSelector) {
      monthSelector.addEventListener('change', (e) => {
        this.handleMonthSelect(e.target.value);
      });
    }
  },
};

// ==================== スクロール管理 ====================

/**
 * スクロールトップボタン管理
 * @namespace
 */
const ScrollToTopButton = {
  /** @type {HTMLElement|null} スクロールトップボタン */
  button: null,
  /** @type {boolean} requestAnimationFrameのスケジュール状態 */
  ticking: false,

  /**
   * 初期化
   */
  init() {
    this.button = document.getElementById('scrollToTop');
    if (!this.button) {
      console.warn('Scroll to top button not found');
      return;
    }

    this.setupScrollListener();
    this.setupClickListener();
  },

  /**
   * スクロールイベントリスナーを設定
   */
  setupScrollListener() {
    window.addEventListener('scroll', () => {
      if (!this.ticking) {
        window.requestAnimationFrame(() => {
          this.updateVisibility();
          this.ticking = false;
        });
        this.ticking = true;
      }
    });
  },

  /**
   * クリックイベントリスナーを設定
   */
  setupClickListener() {
    this.button.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    });
  },

  /**
   * ボタンの表示/非表示を更新
   */
  updateVisibility() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    this.button.classList.toggle('visible', scrollTop > CONSTANTS.SCROLL_THRESHOLD);
  },
};

// ==================== アプリケーション初期化 ====================

/**
 * アプリケーション初期化
 */
async function init() {
  ThemeManager.init();

  try {
    const indexData = await DataManager.loadIndex();
    State.categoriesData = indexData.categories;

    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) {
      const date = new Date(indexData.generatedAt);
      lastUpdatedEl.textContent = date.toLocaleString('ja-JP');
    }

    CategoryTabs.render();

    if (State.categoriesData.length > 0) {
      const firstGroup = Object.values(CategoryTabs.groupCategories())[0];
      await CategoryManager.select(firstGroup.ids);
    }

    SearchManager.setupListeners();
    DateFilterManager.setupListeners();
    ScrollToTopButton.init();
  } catch (error) {
    console.error('Initialization error:', error);
    DOMHelper.showError('Loading failed');
  }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', init);
