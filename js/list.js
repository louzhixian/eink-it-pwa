// 初始化 Supabase（使用 config.js 中声明的全局变量）
initSupabase();

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
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const articlesListEl = document.getElementById('articles-list');
  const emptyStateEl = document.getElementById('empty-state');

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

    // 隐藏加载状态
    loadingEl.style.display = 'none';

    // 如果没有文章，显示空状态
    if (!articles || articles.length === 0) {
      emptyStateEl.style.display = 'block';
      return;
    }

    // 渲染文章列表
    articlesListEl.innerHTML = articles.map(article => {
      const date = new Date(article.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const meta = [article.byline, article.site_name]
        .filter(Boolean)
        .join(' · ');

      return `
        <div class="article-item" onclick="openArticle('${article.id}')">
          <h3>${escapeHtml(article.title)}</h3>
          ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
          <div class="date">${date}</div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading articles:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = 'Failed to load articles: ' + (error.message || 'Unknown error');
  }
}

// 打开文章阅读器
function openArticle(id) {
  window.location.href = `reader.html?id=${id}`;
}

// HTML 转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 登出处理
document.getElementById('logout-btn').addEventListener('click', async () => {
  const confirmed = confirm('Are you sure you want to logout?');

  if (confirmed) {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  }
});

// 页面加载时初始化
(async function init() {
  const user = await checkAuth();

  if (user) {
    await loadArticles();
  }
})();
