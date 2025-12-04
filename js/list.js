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

    // 隐藏加载状态
    loadingEl.style.display = 'none';

    renderArticles(articlesCache);

  } catch (error) {
    console.error('Error loading articles:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = 'Failed to load articles: ' + (error.message || 'Unknown error');
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
    item.addEventListener('click', () => openArticle(article.id));

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

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteConfirm(article.id, article.title);
    });

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

// 登出处理
document.getElementById('logout-btn').addEventListener('click', async () => {
  const confirmed = confirm('Are you sure you want to logout?');

  if (confirmed) {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
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

// 页面加载时初始化
(async function init() {
  const user = await checkAuth();

  if (user) {
    await loadArticles();
  }
})();
