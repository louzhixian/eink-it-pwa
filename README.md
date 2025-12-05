# Eink-It PWA - E-ink 优化阅读器

一个专为 E-ink 电子墨水屏设备优化的渐进式 Web 应用（PWA），配合 Eink-It 浏览器扩展使用，提供极致的电子书阅读体验。

## 📋 项目概述

**核心目标**: 让用户在 Kindle 等 E-ink 设备上无缝阅读从浏览器扩展转换的文章

**技术栈**:
- 纯 Vanilla JavaScript（无框架依赖）
- Supabase（认证 + 数据库）
- PWA（离线支持）
- CSS3（Flexbox + Grid）

**部署**: Vercel / Netlify

---

## 🏗️ 项目结构

```
eink-it-pwa/
├── index.html              # 登录/注册页面
├── list.html               # 文章列表页面
├── reader.html             # 阅读器页面
├── manifest.json           # PWA 清单
├── service-worker.js       # Service Worker（离线支持）
├── vercel.json             # 部署配置
├── package.json            # 项目配置
├── icons/                  # PWA 图标集
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── favicon-96x96.png
│   ├── icon-180.png        # Apple Touch Icon
│   ├── icon-192.png        # Android Chrome
│   └── icon-512.png        # 高清图标
├── css/
│   ├── common.css          # 通用样式 + 离线徽章
│   ├── login.css           # 登录页样式
│   ├── list.css            # 列表页样式 + 下载按钮
│   └── reader.css          # 阅读器核心样式 + 图片降级
├── js/
│   ├── config.js           # Supabase 配置
│   ├── auth.js             # 认证逻辑
│   ├── common.js           # 离线状态检测（增强版）
│   ├── offline-cache.js    # IndexedDB 离线缓存
│   ├── list.js             # 列表管理 + 离线下载
│   └── reader.js           # 阅读器核心 + 离线加载
└── lib/
    └── supabase.js         # Supabase SDK（本地化）
```

---

## ✨ 核心功能

### 1. 多用户认证系统
- ✅ 邮箱密码注册/登录
- ✅ Supabase 后端认证
- ✅ 用户数据隔离（RLS 行级安全）
- ✅ 自动登录状态检查
- ✅ 安全的登出功能

### 2. 文章列表管理
- ✅ 从 Supabase 实时加载文章
- ✅ 按创建时间倒序排列
- ✅ 显示元数据：标题、作者、网站、日期
- ✅ 显示阅读进度百分比（已读/总页数）
- ✅ 点击跳转到阅读器
- ✅ 支持加载最多 50 篇文章
- ✅ 空状态提示
- ✅ **离线模式支持**：
  - 自动切换到本地缓存
  - 未缓存文章灰显禁用
  - 点击提示需要下载或联网

### 2.1 离线下载功能（⭐ 新增）
- ✅ **手动下载按钮**（图标按钮）：
  - 未下载：下载图标（黑色）
  - 下载中：旋转加载图标
  - 已下载：勾选图标（绿色）
- ✅ **首次下载提示**：弹窗说明图片不会缓存（仅提示一次）
- ✅ **删除按钮**：Icon 样式统一，支持删除缓存
- ✅ **状态持久化**：IndexedDB 存储完整文章内容
- ✅ **智能存储**：只缓存 HTML 文本，不缓存外部图片（节省空间）

### 3. E-ink 优化阅读器

#### 核心阅读体验
- ✅ **智能分页系统**: 根据视口高度和内容自动计算总页数
- ✅ **动态行高重叠**: 保持约 1 行内容连贯性，避免断句
- ✅ **多种导航方式**:
  - 键盘：← / → / PageUp / PageDown / Home / End
  - 鼠标：左右两侧 32% 点击区域
  - 触摸：左右点击翻页
- ✅ **响应式布局**: 窗口尺寸变化自动重新计算分页
- ✅ **图片加载等待**: 确保分页准确性

#### 个性化设置
- ✅ **字体大小**: 14px - 48px（11 档可选）
- ✅ **字体选择**:
  - 西文：Georgia、Times New Roman、Palatino、Arial、Helvetica
  - 中文：霞鹜文楷、思源宋体、仿宋、苹方/微软雅黑
  - 自动检测浏览器语言（中文默认霞鹜文楷）
- ✅ **行高调整**: 1.4 - 2.0（6 档可选）
- ✅ **深色模式**: 独立切换，完整主题支持
- ✅ **设置持久化**: localStorage 本地存储

#### E-ink 专属优化
- ✅ **禁用所有动画和过渡**: 避免 E-ink 屏幕闪烁
  ```css
  transition: none !important;
  animation: none !important;
  ```
- ✅ **隐藏滚动条**: 移除视觉杂乱
- ✅ **离散分页**: 即时滚动（非平滑），减少重绘
- ✅ **大点击区域**: 左右各 32% 宽度，适合触屏点击
- ✅ **高对比度**: 纯黑纯白（#000 / #fff）
- ✅ **智能 UI 自隐藏**:
  - 头部/底部 3 秒后自动隐藏
  - 顶部 40% 热区点击恢复
  - 最大化内容显示区域
- ✅ **图片优雅降级**（⭐ 新增）:
  - 加载失败时显示虚线占位框
  - 显示 alt 文本或默认提示
  - 离线模式友好提示

#### 离线阅读支持（⭐ 新增）
- ✅ **网络优先策略**: 在线时优先加载最新内容
- ✅ **离线回退**: 网络失败时自动从 IndexedDB 加载
- ✅ **离线徽章**: Header 显示 "Offline" 橙色徽章
- ✅ **增强网络检测**:
  - 主动探测连接（不依赖 `navigator.onLine`）
  - 定期检查网络状态（15秒）
  - 自动更新离线徽章

---

## 🔧 技术实现

### PWA 离线架构（⭐ 核心）

#### Service Worker 缓存策略

```javascript
// 三种缓存策略
const STATIC_CACHE = 'eink-it-static-v1';    // 静态资源
const ARTICLE_CACHE = 'eink-it-articles-v1'; // API 响应
const FONT_CACHE = 'eink-it-fonts-v1';       // CDN 字体

// 策略 1: Cache First（静态资源）
// HTML, CSS, JS → 优先从缓存读取，失败则网络请求

// 策略 2: Network First（Supabase API）
// 文章数据 → 优先网络请求，失败则从缓存读取

// 策略 3: Stale While Revalidate（CDN 字体）
// 立即返回缓存，后台更新
```

#### IndexedDB 离线存储

```javascript
// 数据库结构
const DB_NAME = 'eink-it-offline';
const STORE_NAME = 'articles';

// 存储内容
{
  id: 'uuid',
  user_id: 'uuid',
  title: 'Article Title',
  content: '<html>...</html>',  // 完整 HTML
  byline: 'Author Name',
  site_name: 'Website',
  created_at: '2024-12-05'
}

// 存储限制
- IndexedDB: 磁盘可用空间的 60%（Chrome/Edge）
- 实际可存储：数百至数千篇文章
- 平均单篇：50-200 KB
```

#### 增强网络检测

```javascript
async function probeConnectivity() {
  // 不依赖 navigator.onLine（不可靠）
  // 主动 fetch Google 204 端点测试真实连接
  const response = await fetch('https://www.gstatic.com/generate_204', {
    method: 'GET',
    cache: 'no-store',
    mode: 'no-cors'
  });

  return response.ok;
}

// 定期检查（15秒）+ 事件监听
startConnectivityMonitor(15000);
```

### 分页算法核心逻辑

```javascript
// 1. 计算视口和内容高度
const pageHeight = content.clientHeight;
const totalHeight = content.scrollHeight;

// 2. 计算行高重叠（保持连贯性）
const pageOverlap = computeLineOverlapPx(); // ~1 行高

// 3. 计算有效步幅
const pageStride = Math.max(pageHeight - pageOverlap, 50);

// 4. 计算总页数
const totalPages = Math.ceil(Math.max(totalHeight - pageOverlap, 1) / pageStride);

// 5. 翻页定位
const scrollPosition = (page - 1) * pageStride;
content.scrollTo({ top: scrollPosition, behavior: 'auto' });
```

### 数据库架构

**articles 表**:
```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  byline TEXT,
  site_name TEXT,
  source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 用户数据隔离策略
CREATE POLICY "Users can view their own articles"
ON articles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own articles"
ON articles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

### 性能优化

- **无框架开销**: 纯 Vanilla JS，轻量级
- **延迟分页计算**: setTimeout(100ms) 避免阻塞渲染
- **防抖 resize 事件**: 300ms 防抖，减少重计算
- **图片异步加载**: Promise.all 等待所有图片
- **最小化重排**: 隐藏滚动条、固定布局

---

## 🚀 部署指南

### 本地开发

```bash
# 启动本地服务器
cd eink-it-pwa
python3 -m http.server 8000

# 访问
open http://localhost:8000
```

### Vercel 部署

1. 安装 Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. 部署:
   ```bash
   cd eink-it-pwa
   vercel
   ```

3. 自动生成部署 URL（如 `https://eink-it-pwa.vercel.app`）

### Netlify 部署

1. 拖放部署:
   - 访问 https://app.netlify.com/drop
   - 拖动 `eink-it-pwa` 文件夹到页面

2. 或使用 CLI:
   ```bash
   npm i -g netlify-cli
   cd eink-it-pwa
   netlify deploy --prod
   ```

---

## 🔗 配套浏览器扩展

此 PWA 需配合 **Eink-It 浏览器扩展** 使用：

1. 用户在浏览器中安装扩展
2. 访问任意网页文章，点击扩展按钮
3. 扩展提取文章内容并上传到 Supabase
4. 用户在 E-ink 设备上访问 PWA
5. 登录后查看文章列表，点击阅读

**数据流**:
```
浏览器扩展 → Supabase 云端 → PWA 阅读器 → E-ink 设备
```

---

## 📱 使用场景

### 典型工作流

1. **在电脑上**:
   - 浏览网页发现好文章
   - 点击浏览器扩展转换
   - 文章自动上传到云端

2. **在 Kindle/E-ink 设备上**:
   - 打开 PWA 网址（如 `https://eink-it-pwa.vercel.app`）
   - 登录账户（仅需一次）
   - 浏览文章列表
   - 点击阅读，享受优化的阅读体验

### 支持设备

- ✅ Kindle Paperwhite / Oasis / Scribe
- ✅ Kobo 阅读器
- ✅ BOOX 电纸书
- ✅ 其他支持浏览器的 E-ink 设备
- ✅ 桌面浏览器（测试用）

---

## 🔐 安全性

- ✅ Supabase JWT 认证
- ✅ 行级安全策略（RLS）用户数据隔离
- ✅ HTML 内容转义（防 XSS）
- ✅ HTTPS 加密传输
- ✅ 无敏感数据存储在前端

---

## 🎨 设计哲学

### E-ink 优先
整个设计围绕 E-ink 屏幕特性：
- **慢刷新率**: 禁用所有动画
- **黑白显示**: 高对比度设计
- **低电量**: 减少重绘和计算
- **阳光可读**: 纯黑纯白无灰阶

### 极简主义
- 去除所有非必要元素
- 大字体、大行距
- 自动隐藏 UI
- 专注内容本身

### 响应式设计
- 自动适配不同尺寸设备
- 支持横竖屏切换
- 保持阅读位置

---

## 📊 项目状态

**当前版本**: v2.0.0
**状态**: ✅ 生产就绪（完整 PWA 支持）

### 已完成功能
- [x] 用户认证系统
- [x] 文章列表展示
- [x] E-ink 优化阅读器
- [x] 智能分页系统
- [x] 个性化设置
- [x] 深色模式
- [x] 多用户数据隔离
- [x] **完整 PWA 离线支持**（⭐ v2.0）
  - [x] Service Worker 三种缓存策略
  - [x] IndexedDB 离线文章存储
  - [x] 手动下载/删除按钮
  - [x] 离线徽章指示
  - [x] 增强网络检测
  - [x] 图片优雅降级
- [x] 阅读进度显示
- [x] 响应式布局
- [x] 本地 CDN 依赖

### 待优化功能
- [ ] 文章搜索功能
- [ ] 标签/分类管理
- [ ] 阅读进度云端同步
- [ ] 批量操作（下载/删除）
- [ ] 导出为 EPUB/PDF
- [ ] 阅读统计和热力图
- [ ] 强制更新机制（E-ink 设备）

---

## 🤝 配合扩展使用

**扩展位置**: `/Users/zhixian/Codes/AI Playground/eink-it/eink-it-plugin/`

**扩展功能**:
- 一键提取网页文章
- 使用 Mozilla Readability 清理内容
- 自动上传到 Supabase
- 支持同一 URL 更新（不重复插入）
- 手动上传按钮（带状态反馈）

---

## 📝 开发日志

### 2024-12-05 - v2.0.0 ⭐ PWA 完整支持
- ✅ **Service Worker 实现**：
  - Cache First 策略（静态资源）
  - Network First 策略（API 请求）
  - Stale While Revalidate（CDN 字体）
- ✅ **IndexedDB 离线缓存**：
  - 完整文章内容存储
  - 手动下载/删除功能
  - 三态按钮（未下载/下载中/已下载）
- ✅ **增强网络检测**：
  - 主动探测真实连接
  - 定期检查（15秒）
  - 自动更新离线徽章
- ✅ **离线 UX 优化**：
  - 未缓存文章灰显禁用
  - 离线徽章提示（橙色）
  - 首次下载弹窗说明
- ✅ **图片优雅降级**：
  - 虚线占位框
  - 显示 alt 文本或默认提示
  - E-ink 友好设计
- ✅ **阅读进度显示**：
  - 列表页显示百分比
  - 基于页数计算

### 2024-12-04 - v1.0.0
- ✅ 完成基础 PWA 框架
- ✅ 实现 E-ink 优化阅读器
- ✅ 集成 Supabase 认证和数据库
- ✅ 添加智能分页算法
- ✅ 实现多用户数据隔离
- ✅ 本地化所有 CDN 依赖
- ✅ 添加手动上传按钮到扩展
- ✅ 优化按钮状态反馈

---

## 🛠️ 故障排查

### 文章列表为空
1. 检查是否已登录（查看右上角邮箱）
2. 确认浏览器扩展是否成功上传文章
3. 打开 Supabase Dashboard 检查数据库
4. 检查控制台是否有错误信息

### RLS 权限错误 (403)
```sql
-- 在 Supabase SQL Editor 执行
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own articles"
ON articles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own articles"
ON articles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
```

### 分页计算不准确
- 清除浏览器缓存
- 确保所有图片加载完成
- 检查字体是否正确加载
- 尝试调整窗口大小触发重新计算

---

## 📧 联系与支持

- **项目**: Eink-It PWA
- **开发时间**: 2024-12
- **技术栈**: Vanilla JS + Supabase + PWA
- **目标用户**: E-ink 设备用户

---

## 📄 许可证

MIT License - 自由使用和修改

---

## 🙏 致谢

- **Mozilla Readability**: 文章提取引擎
- **Supabase**: 后端服务
- **LXGW WenKai**: 开源中文字体
- **Vercel**: 托管服务

---

*最后更新: 2024-12-05 - v2.0.0 PWA 完整离线支持*
