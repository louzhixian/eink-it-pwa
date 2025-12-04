// Supabase 配置
const SUPABASE_URL = 'https://rkmzjywlxatgefvjacdu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbXpqeXdseGF0Z2VmdmphY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTYxMTYsImV4cCI6MjA4MDM5MjExNn0.txMEAKjNZW3jOuCZNf9VODy5YhOeXlJDyeRnLzJonts';

// 初始化 Supabase 客户端（需要先加载 Supabase JS 库）
let supabase = null;

function initSupabase() {
  if (!supabase && typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}
