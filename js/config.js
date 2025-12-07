// Supabase 配置
const SUPABASE_URL = 'https://rkmzjywlxatgefvjacdu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbXpqeXdseGF0Z2VmdmphY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTYxMTYsImV4cCI6MjA4MDM5MjExNn0.txMEAKjNZW3jOuCZNf9VODy5YhOeXlJDyeRnLzJonts';

// 初始化 Supabase 客户端（需要先加载 Supabase JS 库）
let supabase = null;

function initSupabase() {
  if (!supabase && typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // 自动刷新 token
        autoRefreshToken: true,
        // 在浏览器 tab 获得焦点时检测 session
        detectSessionInUrl: false,
        // 持久化 session 到 localStorage
        persistSession: true
      }
    });

    // 监听认证状态变化，处理自动 token 刷新
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] State changed:', event);

      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed automatically');
      } else if (event === 'SIGNED_OUT') {
        console.log('[Auth] User signed out');
      } else if (event === 'SIGNED_IN') {
        console.log('[Auth] User signed in');
      }
    });
  }
  return supabase;
}
