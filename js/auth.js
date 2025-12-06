// 初始化 Supabase（使用 config.js 中声明的全局变量）
initSupabase();

// 检查是否已登录
async function checkAuthStatus() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // 已登录，跳转到文章列表页
    window.location.href = 'list.html';
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
      window.location.href = 'list.html';
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
        window.location.href = 'list.html';
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
