// 初始化 Supabase（使用 config.js 中声明的全局变量）
initSupabase();

// 检查是否已登录

async function checkAuthStatus() {
  if (!supabase) {
    console.error('Supabase client not initialized');
    showMessage('Error: Could not initialize login service. Please refresh the page.', 'error');
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Determines correct path based on environment
      window.navigateTo('list');
    }
  } catch (err) {
    console.error('Error checking auth status:', err);
  }
}

// 显示消息
function showMessage(text, type = 'info') {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  // 3秒后自动隐藏
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

// 切换到注册表单
document.getElementById('show-signup').addEventListener('click', () => {
  document.getElementById('login-form').style.display = 'none';
  document.querySelector('p:has(#show-signup)').style.display = 'none';
  document.getElementById('signup-form').style.display = 'block';
  document.getElementById('back-to-login').style.display = 'block';
  document.getElementById('signup-email').focus();
});

// 切换回登录表单
document.getElementById('show-login').addEventListener('click', () => {
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('back-to-login').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.querySelector('p:has(#show-signup)').style.display = 'block';
  document.getElementById('login-email').focus();
});

// 登录处理
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  // 禁用按钮，显示加载状态
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  try {
    if (!supabase) throw new Error('Service not initialized');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    // 登录成功，跳转到文章列表
    trackEvent('login', { method: 'email' });
    showMessage('Login successful! Redirecting...', 'success');
    setTimeout(() => {
      window.navigateTo('list');
    }, 500);

  } catch (error) {
    console.error('Login error:', error);
    trackEvent('login_failed', { error_message: error.message });
    showMessage(error.message || 'Login failed. Please try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
});

// 注册处理
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const invitationCode = document.getElementById('invitation-code').value.trim().toLowerCase();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const passwordConfirm = document.getElementById('signup-password-confirm').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  // 验证密码匹配
  if (password !== passwordConfirm) {
    showMessage('Passwords do not match', 'error');
    return;
  }

  // 验证密码长度
  if (password.length < 6) {
    showMessage('Password must be at least 6 characters', 'error');
    return;
  }

  // 禁用按钮，显示加载状态
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing up...';

  try {
    // 1. 先验证邀请码是否存在且未使用
    const { data: codeData, error: codeError } = await supabase
      .from('invitation_codes')
      .select('code')
      .eq('code', invitationCode)
      .is('used_by', null)
      .single();

    if (codeError || !codeData) {
      throw new Error('Invalid or already used invitation code');
    }

    // 2. 注册用户
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Registration failed');
    }

    // 3. 标记邀请码为已使用
    const { error: useError } = await supabase.rpc('use_invitation_code', {
      p_code: invitationCode,
      p_user_id: data.user.id
    });

    if (useError) {
      console.error('Failed to mark invitation code as used:', useError);
      // 用户已注册成功，但邀请码标记失败，继续流程
    }

    // 注册成功
    trackEvent('signup', { method: 'email', has_invitation: true });

    // 注意：Supabase 可能需要邮箱验证，取决于配置
    if (data.user && !data.session) {
      showMessage('Please check your email to confirm your account', 'success');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign Up';
    } else {
      showMessage('Sign up successful! Redirecting...', 'success');
      setTimeout(() => {
        window.navigateTo('list');
      }, 500);
    }

  } catch (error) {
    console.error('Signup error:', error);
    trackEvent('signup_failed', { error_message: error.message });
    showMessage(error.message || 'Sign up failed. Please try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign Up';
  }
});

// 页面加载时检查登录状态
checkAuthStatus();

// ==========================================
// Update & Cache Management (Copied from list.js to ensure availability on login)
// ==========================================

// Version check for update notification
async function checkForUpdates() {
  try {
    const response = await fetch('/version.json?' + Date.now()); // Cache bust
    if (!response.ok) return;

    const data = await response.json();
    const serverVersion = data.version;
    const localVersion = localStorage.getItem('app_version');

    // Update version display if element exists
    const versionEl = document.getElementById('app-version');
    if (versionEl) {
      versionEl.textContent = 'v' + (localVersion || serverVersion);
    }

    // First time or version changed
    if (!localVersion) {
      localStorage.setItem('app_version', serverVersion);
    } else if (localVersion !== serverVersion) {
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

async function clearCacheAndReload() {
  try {
    console.log('Clearing all caches...');

    // Delete all caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));

    // Clear localStorage (except auth session and offline notices)
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Keep Supabase auth
      if (!key.startsWith('sb-') && key !== 'offline_image_notice_shown') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Unregister service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // Force reload
    window.location.reload(true);
  } catch (error) {
    console.error('Failed to clear cache:', error);
    window.location.reload(true);
  }
}

// Bind Update Banner Buttons
const refreshBtn = document.getElementById('refresh-btn');
const dismissUpdateBtn = document.getElementById('dismiss-update');

if (refreshBtn) {
  refreshBtn.addEventListener('click', clearCacheAndReload);
}

if (dismissUpdateBtn) {
  dismissUpdateBtn.addEventListener('click', () => {
    hideUpdateBanner();
    fetch('/version.json?' + Date.now())
      .then(res => res.json())
      .then(data => localStorage.setItem('app_version', data.version))
      .catch(console.error);
  });
}

// Bind Repair/Reset Button
const resetAppBtn = document.getElementById('reset-app-btn');
if (resetAppBtn) {
  resetAppBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('This will clear all data (except your login) and reload the app. Use this if the app is stuck or not updating properly.')) {
      clearCacheAndReload();
    }
  });
}

// Check for updates immediately
checkForUpdates();
