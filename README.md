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
├── vercel.json             # 部署配置
├── package.json            # 项目配置
├── css/
│   ├── common.css          # 通用样式
│   ├── login.css           # 登录页样式
│   ├── list.css            # 列表页样式
│   └── reader.css          # 阅读器核心样式 (11KB)
├── js/
│   ├── config.js           # Supabase 配置
│   ├── auth.js             # 认证逻辑 (4KB)
│   ├── list.js             # 列表管理 (3KB)
│   └── reader.js           # 阅读器核心 (17KB)
└── lib/
    └── supabase.js         # Supabase SDK (本地化)
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
- ✅ 点击跳转到阅读器
- ✅ 支持加载最多 50 篇文章
- ✅ 空状态提示

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
- ✅ **大点击区域**: 左右各 32% 宽度，适合电子设备点击
- ✅ **高对比度**: 纯黑纯白（#000 / #fff）
- ✅ **智能 UI 自隐藏**:
  - 头部/底部 3 秒后自动隐藏
  - 顶部 40% 热区点击恢复
  - 最大化内容显示区域

---

## 🔧 技术实现

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

**当前版本**: v1.0.0
**状态**: ✅ 生产就绪

### 已完成功能
- [x] 用户认证系统
- [x] 文章列表展示
- [x] E-ink 优化阅读器
- [x] 智能分页系统
- [x] 个性化设置
- [x] 深色模式
- [x] 多用户数据隔离
- [x] PWA 离线支持
- [x] 响应式布局
- [x] 本地 CDN 依赖

### 待优化功能
- [ ] 文章搜索功能
- [ ] 标签/分类管理
- [ ] 阅读进度同步
- [ ] 批量删除文章
- [ ] 导出为 EPUB/PDF
- [ ] 离线缓存文章内容
- [ ] 阅读统计和热力图

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

*最后更新: 2024-12-04*
