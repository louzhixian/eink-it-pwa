// 初始化 Supabase（使用 config.js 中声明的全局变量）
initSupabase();

const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const articlesListEl = document.getElementById('articles-list');
const emptyStateEl = document.getElementById('empty-state');

const deleteModal = document.getElementById('delete-confirm-modal');
const deleteText = document.getElementById('delete-confirm-text');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');

let articlesCache = [];
let pendingDeleteId = null;
let offlineMode = false;
let cachedArticleIds = new Set();
let cachedArticles = [];

// 检查登录状态并获取用户信息
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // 未登录，跳转到登录页
    window.location.href = 'index.html';
    return null;
  }

  // 显示用户邮箱
  const userEmailEl = document.getElementById('user-email');
  if (userEmailEl) {
    userEmailEl.textContent = session.user.email;
  }

  return session.user;
}

// 加载文章列表
async function loadArticles() {
  try {
    // 显示加载状态
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    articlesListEl.innerHTML = '';
    emptyStateEl.style.display = 'none';

    // 更新离线状态与本地缓存索引
    await refreshOfflineState();
    await refreshCachedArticles();

    // 离线模式下使用本地缓存
    if (offlineMode) {
      articlesCache = cachedArticles;
      loadingEl.style.display = 'none';
      renderArticles(articlesCache);
      return;
    }

    // 从 Supabase 获取文章列表
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, byline, site_name, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    articlesCache = articles || [];

    // Track article list loaded
    trackEvent('article_list_loaded', { count: articlesCache.length });

    // 隐藏加载状态
    loadingEl.style.display = 'none';

    renderArticles(articlesCache);

  } catch (error) {
    console.error('Error loading articles:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = 'Failed to load articles: ' + (error.message || 'Unknown error');

    // 回退到本地缓存
    if (cachedArticles.length) {
      renderArticles(cachedArticles);
    }
  }
}

function renderArticles(articles) {
  articlesListEl.innerHTML = '';

  if (!articles || articles.length === 0) {
    emptyStateEl.style.display = 'block';
    return;
  }

  emptyStateEl.style.display = 'none';

  articles.forEach((article) => {
    const item = document.createElement('div');
    item.className = 'article-item';

    const isCached = cachedArticleIds.has(article.id);

    // If offline and not cached, disable the article item
    if (offlineMode && !isCached) {
      item.classList.add('offline-disabled');
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        alert('This article is not available offline. Please download it first or connect to the internet.');
      });
    } else {
      item.addEventListener('click', () => openArticle(article.id));
    }

    const titleEl = document.createElement('h3');
    titleEl.textContent = article.title || 'Untitled';

    const metaText = [article.byline, article.site_name].filter(Boolean).join(' · ');
    const metaCol = document.createElement('div');
    metaCol.className = 'article-meta-col';
    const metaEl = document.createElement('div');
    metaEl.className = 'meta';
    metaEl.textContent = metaText;

    const dateProgress = document.createElement('div');
    dateProgress.className = 'date-progress';
    const dateEl = document.createElement('span');
    dateEl.className = 'date';
    dateEl.textContent = formatDate(article.created_at);

    const progressPercent = getReadingProgressPercent(article.id);
    if (progressPercent !== null) {
      const divider = document.createElement('span');
      divider.className = 'progress-divider';
      divider.textContent = '•';

      const progressEl = document.createElement('span');
      progressEl.className = 'progress';
      progressEl.textContent = `${progressPercent}%`;

      dateProgress.appendChild(dateEl);
      dateProgress.appendChild(divider);
      dateProgress.appendChild(progressEl);
    } else {
      dateProgress.appendChild(dateEl);
    }

    if (metaText) {
      metaCol.appendChild(metaEl);
    }
    metaCol.appendChild(dateProgress);

    const actions = document.createElement('div');
    actions.className = 'article-actions';

    // Download button (icon)
    const downloadBtn = createIconButton(
      'download-btn',
      'Download for offline reading (text only, images require internet)',
      'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
      async (e) => {
        e.stopPropagation();
        const isDownloaded = await checkArticleDownloaded(article.id);
        if (isDownloaded) {
          // Already downloaded, clicking removes from cache
          if (confirm('Remove this article from offline cache?')) {
            await removeArticleFromCache(article.id, downloadBtn);
            renderArticles(articlesCache);
          }
        } else {
          // Not downloaded, clicking downloads it
          await downloadArticleToCache(article.id, downloadBtn);
          renderArticles(articlesCache);
        }
      }
    );

    // Check if article is already downloaded and update button state
    if (isCached) {
      updateDownloadButton(downloadBtn, 'downloaded');
    }

    if (offlineMode && !isCached) {
      downloadBtn.disabled = true;
      downloadBtn.title = 'Offline - connect to download';
    }

    // Delete button (icon)
    const deleteBtn = createIconButton(
      'delete-btn-icon',
      'Delete article',
      'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
      (e) => {
        e.stopPropagation();
        openDeleteConfirm(article.id, article.title);
      }
    );

    actions.appendChild(downloadBtn);
    actions.appendChild(deleteBtn);

    const infoRow = document.createElement('div');
    infoRow.className = 'article-info-row';
    infoRow.appendChild(metaCol);
    infoRow.appendChild(actions);

    item.appendChild(titleEl);
    item.appendChild(infoRow);

    articlesListEl.appendChild(item);
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function getReadingProgressPercent(articleId) {
  if (!articleId) return null;
  const key = `reading_progress_${articleId}`;
  const saved = localStorage.getItem(key);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved);
    const page = parsed?.page ? parseInt(parsed.page, 10) : null;
    const total = parsed?.total ? parseInt(parsed.total, 10) : null;
    if (page && total && total > 0 && page <= total) {
      return Math.ceil((page / total) * 100);
    }
  } catch {
    const page = parseInt(saved, 10);
    if (page && page > 0) {
      return null; // Not enough data to compute percent
    }
  }
  return null;
}

// 打开文章阅读器
function openArticle(id) {
  trackEvent('article_view', { article_id: id });
  window.location.href = `reader.html?id=${id}`;
}

function openDeleteConfirm(id, title) {
  pendingDeleteId = id;
  deleteConfirmBtn.disabled = false;
  deleteConfirmBtn.textContent = 'Delete';
  deleteText.textContent = `Delete "${title || 'this article'}"?`;
  deleteModal.style.display = 'flex';
}

function closeDeleteConfirm() {
  pendingDeleteId = null;
  deleteModal.style.display = 'none';
}

async function handleDeleteConfirmed() {
  if (!pendingDeleteId) {
    closeDeleteConfirm();
    return;
  }

  deleteConfirmBtn.disabled = true;
  deleteConfirmBtn.textContent = 'Deleting...';

  try {
    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', pendingDeleteId);

    if (error) {
      throw error;
    }

    trackEvent('article_delete', { article_id: pendingDeleteId });
    articlesCache = articlesCache.filter(article => article.id !== pendingDeleteId);
    renderArticles(articlesCache);
    closeDeleteConfirm();
  } catch (error) {
    console.error('Error deleting article:', error);
    alert('Failed to delete: ' + (error.message || 'Unknown error'));
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Delete';
  }
}

// 设置模态框处理
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings');

settingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'flex';
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.style.display = 'none';
  }
});

// 登出处理
document.getElementById('logout-btn').addEventListener('click', async () => {
  const confirmed = confirm('Are you sure you want to logout?');

  if (confirmed) {
    trackEvent('logout');
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  }
});

// 清除缓存并重载
document.getElementById('clear-cache-btn').addEventListener('click', async () => {
  const confirmed = confirm(
    'This will clear all cached data including:\n\n' +
    '• Static files (HTML, CSS, JS)\n' +
    '• Service Worker cache\n' +
    '• App settings\n\n' +
    'Downloaded articles will be preserved.\n' +
    'The app will reload immediately. Continue?'
  );

  if (!confirmed) return;

  try {
    console.log('Clearing all caches...');

    // Delete all caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('Caches cleared:', cacheNames);

    // Clear localStorage (except auth session and offline notices)
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Keep Supabase auth and offline-related flags
      if (!key.startsWith('sb-') && key !== 'offline_image_notice_shown' && key !== 'offline_cache_dirty') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('LocalStorage cleared:', keysToRemove);

    // Unregister service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      console.log('Service worker unregistered');
    }

    // Force reload (hard refresh)
    alert('Cache cleared successfully. The app will reload now.');
    window.location.reload(true);
  } catch (error) {
    console.error('Failed to clear cache:', error);
    alert('Failed to clear cache: ' + error.message);
  }
});

// 绑定删除确认弹窗
deleteCancelBtn.addEventListener('click', closeDeleteConfirm);
deleteConfirmBtn.addEventListener('click', handleDeleteConfirmed);
deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    closeDeleteConfirm();
  }
});

// Download article to offline cache
async function downloadArticleToCache(articleId, button) {
  try {
    // Show first-time download notice about images not being cached
    const hasSeenImageNotice = localStorage.getItem('offline_image_notice_shown');
    if (!hasSeenImageNotice) {
      const proceed = confirm(
        'Note: Only article text will be cached for offline reading.\n\n' +
        'Images require an internet connection to display.\n\n' +
        'Continue downloading?'
      );

      if (!proceed) {
        return; // User cancelled download
      }

      // Mark notice as shown
      localStorage.setItem('offline_image_notice_shown', 'true');
    }

    // Update button to downloading state
    updateDownloadButton(button, 'downloading');

    // Fetch full article from Supabase
    const { data: article, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (error) throw error;

    // Save to IndexedDB
    await saveArticleOffline(article);
    cachedArticleIds.add(articleId);
    localStorage.setItem('offline_cache_dirty', 'true');

    // Update button to downloaded state
    updateDownloadButton(button, 'downloaded');

    trackEvent('article_download_offline', { article_id: articleId });
    console.log('Article downloaded successfully');
  } catch (error) {
    console.error('Download failed:', error);
    alert('Failed to download article: ' + (error.message || 'Unknown error'));
    // Restore button to not-downloaded state
    updateDownloadButton(button, 'not-downloaded');
  }
}

// Remove article from offline cache
async function removeArticleFromCache(articleId, button) {
  try {
    await deleteArticleOffline(articleId);
    cachedArticleIds.delete(articleId);
    localStorage.setItem('offline_cache_dirty', 'true');
    updateDownloadButton(button, 'not-downloaded');
    trackEvent('article_remove_offline', { article_id: articleId });
    console.log('Article removed from offline cache:', articleId);
  } catch (error) {
    console.error('Failed to remove article from cache:', error);
    alert('Failed to remove from cache: ' + (error.message || 'Unknown error'));
  }
}

// Update download button state
function updateDownloadButton(button, state) {
  const svg = button.querySelector('svg');

  if (state === 'not-downloaded') {
    button.disabled = false;
    button.className = 'icon-btn download-btn';
    button.title = 'Download for offline reading (text only, images require internet)';
    svg.innerHTML = '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>';
    svg.classList.remove('spinner');
  } else if (state === 'downloading') {
    button.disabled = true;
    button.className = 'icon-btn download-btn downloading';
    button.title = 'Downloading article... (images will not be cached)';
    svg.innerHTML = '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25"/><path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" stroke-width="3" fill="none"/>';
    svg.classList.add('spinner');
  } else if (state === 'downloaded') {
    button.disabled = false;
    button.className = 'icon-btn download-btn downloaded';
    button.title = 'Downloaded for offline (text only) - Click to remove';
    svg.classList.remove('spinner');
    svg.innerHTML = '<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>';
  }
}

// Create icon button with SVG
function createIconButton(className, title, svgPath, handler) {
  const button = document.createElement('button');
  button.className = `icon-btn ${className}`;
  button.type = 'button';
  button.title = title;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', svgPath);
  svg.appendChild(path);

  button.appendChild(svg);
  button.addEventListener('click', handler);

  return button;
}

async function refreshCachedArticles() {
  try {
    cachedArticles = await getAllArticlesOffline();
    cachedArticleIds = new Set((cachedArticles || []).map(article => article.id));
  } catch (error) {
    console.error('Failed to refresh cached articles:', error);
    cachedArticles = [];
    cachedArticleIds = new Set();
  }
}

async function refreshOfflineState() {
  offlineMode = await updateOnlineStatus();
}

async function handleConnectivityChange() {
  await loadArticles();
}

// 页面加载时初始化
(async function init() {
  const user = await checkAuth();

  if (user) {
    await loadArticles();
  }
})();

window.addEventListener('online', handleConnectivityChange);
window.addEventListener('offline', handleConnectivityChange);

// Refresh cache state when returning from reader or tab focus
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshCacheIfDirty();
  }
});

window.addEventListener('focus', () => {
  refreshCacheIfDirty();
});

async function refreshCacheIfDirty() {
  const dirty = localStorage.getItem('offline_cache_dirty');
  if (!dirty) return;
  localStorage.removeItem('offline_cache_dirty');

  await refreshCachedArticles();
  const source = articlesCache.length ? articlesCache : cachedArticles;
  renderArticles(source);
}

// Version check for update notification
async function checkForUpdates() {
  try {
    const response = await fetch('/version.json?' + Date.now()); // Cache bust
    if (!response.ok) return;

    const data = await response.json();
    const serverVersion = data.version;
    const localVersion = localStorage.getItem('app_version');

    // First time or version changed
    if (!localVersion) {
      // First visit, save current version
      localStorage.setItem('app_version', serverVersion);
    } else if (localVersion !== serverVersion) {
      // Version changed - show update banner
      showUpdateBanner();
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
}

function showUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (banner) {
    banner.style.display = 'block';
  }
}

function hideUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

// Update banner event handlers
const refreshBtn = document.getElementById('refresh-btn');
const dismissUpdateBtn = document.getElementById('dismiss-update');

if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    // Clear all caches and reload
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));

      // Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // Update version in localStorage
      const response = await fetch('/version.json?' + Date.now());
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('app_version', data.version);
      }

      // Force hard reload
      window.location.reload(true);
    } catch (error) {
      console.error('Failed to refresh:', error);
      window.location.reload(true);
    }
  });
}

if (dismissUpdateBtn) {
  dismissUpdateBtn.addEventListener('click', () => {
    hideUpdateBanner();
    // Update local version to dismiss until next version change
    fetch('/version.json?' + Date.now())
      .then(res => res.json())
      .then(data => localStorage.setItem('app_version', data.version))
      .catch(err => console.error('Failed to update version:', err));
  });
}

// Check for updates on page load
checkForUpdates();
