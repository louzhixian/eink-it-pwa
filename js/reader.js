// 初始化 Supabase（使用 config.js 中声明的全局变量）
initSupabase();

// State management
let currentPage = 1;
let totalPages = 1;
let pageHeight = 0;
let contentElement = null;
let pageOverlap = 40; // px of overlap, dynamic per computed line height
let pageStride = 0;
let chromeHideTimer = null;
const CHROME_VISIBLE_MS = 4000;
let currentArticleId = null; // Store current article ID for progress tracking

// Default settings - auto-detect Chinese language
const defaultSettings = {
  fontSize: '20',
  fontFamily: navigator.language.startsWith('zh')
    ? "'LXGW WenKai', serif"  // Chinese default
    : 'Georgia, serif',        // Western default
  lineHeight: '1.5',
  darkMode: false
};

// Initialize reader on page load
document.addEventListener('DOMContentLoaded', initReader);

async function initReader() {
  try {
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.navigateTo('index');
      return;
    }

    // Get article ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');
    currentArticleId = articleId; // Store for progress tracking

    if (!articleId) {
      showError('No article ID provided.');
      return;
    }

    // Show loading initially
    document.getElementById('loading').style.display = 'block';
    document.getElementById('reader-container').style.display = 'none';

    // Try to load article from Supabase first (network first strategy)
    let article = null;
    let loadedFromCache = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .single();
      clearTimeout(timeout);

      if (error) throw error;

      article = data;

      // If article was previously downloaded and we got fresh data, update cache
      if (article) {
        const isDownloaded = await checkArticleDownloaded(articleId);
        if (isDownloaded) {
          await saveArticleOffline(article);
          localStorage.setItem('offline_cache_dirty', 'true');
          console.log('Updated cached article with fresh data');
        } else {
          // Auto-cache after first successful view
          await saveArticleOffline(article);
          localStorage.setItem('offline_cache_dirty', 'true');
          console.log('Article auto-cached for offline use');
        }
      }
    } catch (error) {
      // Network failed, try to load from IndexedDB
      console.warn('Network failed, attempting to load from offline cache:', error);
      article = await getArticleOffline(articleId);

      if (article) {
        loadedFromCache = true;
        console.log('Loaded article from offline cache');
        showOfflineBadge(); // Show offline indicator
      } else {
        showError('Article not found and not available offline. Please check your connection.');
        return;
      }
    }

    if (!article) {
      showError('Article not found.');
      return;
    }

    console.log('Loading article:', article.title);

    // Populate page content
    const titleElement = document.getElementById('article-title');
    titleElement.textContent = article.title || 'Untitled';

    // Fit title font-size to single-line width
    fitTitleToWidth(titleElement);

    document.getElementById('article-byline').textContent = article.byline || '';
    document.getElementById('article-site').textContent = article.site_name || '';
    updateMetaSeparators();

    contentElement = document.getElementById('reader-content');
    contentElement.innerHTML = article.content;

    // Setup graceful degradation for images (handle loading failures)
    setupImageErrorHandling();

    // Hide loading
    document.getElementById('loading').style.display = 'none';
    document.getElementById('reader-container').style.display = 'flex';

    // Load and apply saved settings
    loadSettings();

    // Wait for images to load before calculating pagination
    await waitForImages();

    // Calculate pagination after content is rendered
    setTimeout(() => {
      refitTitle();
      calculatePagination();
      restoreReadingProgress(); // Restore saved reading position
      setupNavigation();
      setupSettingsPanel();
      setupDarkMode();
      setupBackButton();
      setupPageNavigation(); // Setup page navigation modal
      setupChromeVisibility();
      updateClickZones();
    }, 100);

  } catch (error) {
    console.error('Error loading article:', error);
    showError('Failed to load article: ' + error.message);
  }
}

// Setup error handling for images (graceful degradation for offline mode)
function setupImageErrorHandling() {
  const images = document.querySelectorAll('#reader-content img');

  const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

  const markBroken = (img) => {
    if (img.dataset.brokenHandled === 'true') return;
    const altText = (img.getAttribute('alt') || '').trim();
    const placeholder = document.createElement('div');
    placeholder.className = 'broken-placeholder';
    const titleEl = document.createElement('div');
    titleEl.className = 'broken-placeholder-text';
    titleEl.textContent = altText || 'Image';
    const noteEl = document.createElement('div');
    noteEl.className = 'broken-placeholder-note';
    noteEl.textContent = '(Image not available offline)';
    placeholder.appendChild(titleEl);
    placeholder.appendChild(noteEl);

    // Maintain sizing similar to images
    placeholder.style.maxWidth = img.style.maxWidth || '100%';
    placeholder.style.maxHeight = img.style.maxHeight || '400px';
    placeholder.style.margin = img.style.margin || '30px auto';

    img.dataset.brokenHandled = 'true';
    img.replaceWith(placeholder);
  };

  images.forEach(img => {
    // Add error handler to mark broken images
    img.addEventListener('error', function () {
      console.log('Image failed to load:', this.src);
      markBroken(this);
    }, { passive: true });

    // If image is already in error state (e.g., offline), mark it immediately
    if (!img.complete || img.naturalHeight === 0) {
      // Check after a short delay to see if image loaded
      setTimeout(() => {
        if (!img.complete || img.naturalHeight === 0) {
          markBroken(img);
        }
      }, 1000);
    }
  });
}

// Wait for all images to load
function waitForImages() {
  const images = document.querySelectorAll('#reader-content img');
  const promises = Array.from(images).map(img => {
    if (img.complete) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // Still resolve on error to not block pagination
    });
  });

  return Promise.all(promises);
}

// Calculate pagination based on viewport
function calculatePagination() {
  const content = document.getElementById('reader-content');

  // Get the visible height for content area
  pageHeight = content.clientHeight;

  // Get total scrollable height
  const totalHeight = content.scrollHeight;

  // Calculate dynamic overlap based on computed line-height to keep exactly ~1 line repeated
  pageOverlap = computeLineOverlapPx();

  // Calculate effective stride with overlap
  pageStride = Math.max(pageHeight - pageOverlap, Math.max(pageOverlap + 10, 50));

  // Calculate number of pages
  totalPages = Math.ceil(Math.max(totalHeight - pageOverlap, 1) / pageStride);

  // Ensure at least 1 page
  if (totalPages < 1) totalPages = 1;

  // Update UI
  document.getElementById('total-pages').textContent = totalPages;
  document.getElementById('current-page').textContent = currentPage;

  console.log(`Pagination calculated: ${totalPages} pages, ${pageHeight}px per page, ${totalHeight}px total`);
}

// Compute overlap (px) equal to ~0.5 line height of content for minimal but visible overlap
function computeLineOverlapPx() {
  const target = contentElement || document.getElementById('reader-content') || document.body;
  const styles = window.getComputedStyle(target);

  let lineHeight = parseFloat(styles.lineHeight);

  if (Number.isNaN(lineHeight)) {
    const fontSize = parseFloat(styles.fontSize) || 18;
    const lineHeightRaw = styles.lineHeight;

    if (lineHeightRaw && lineHeightRaw.endsWith('px')) {
      lineHeight = parseFloat(lineHeightRaw);
    } else {
      const ratio = parseFloat(lineHeightRaw) || 1.4;
      lineHeight = fontSize * ratio;
    }
  }

  if (!lineHeight || Number.isNaN(lineHeight)) {
    const fallbackFont = parseFloat(styles.fontSize) || 18;
    lineHeight = fallbackFont * 1.4;
  }

  // Return 1 line height for minimal overlap
  return Math.max(Math.round(lineHeight * 1.1), 8);
}

// Navigate to specific page
function goToPage(pageNumber) {
  if (pageNumber < 1 || pageNumber > totalPages) {
    console.log(`Page ${pageNumber} out of bounds (1-${totalPages})`);
    return;
  }

  currentPage = pageNumber;

  // Calculate scroll position for this page
  const baseHeight = pageHeight || contentElement?.clientHeight || 0;
  const stride = pageStride || Math.max(baseHeight - pageOverlap, Math.max(pageOverlap + 10, 50));
  const scrollPosition = (currentPage - 1) * stride;

  // Instantly scroll to position (no smooth behavior for E-ink)
  contentElement.scrollTo({
    top: scrollPosition,
    behavior: 'auto' // CRITICAL: instant, not smooth
  });

  // Update page indicator
  document.getElementById('current-page').textContent = currentPage;

  // Save reading progress
  saveReadingProgress();

  console.log(`Navigated to page ${currentPage} (scroll: ${scrollPosition}px)`);
}

// Save reading progress to localStorage
function saveReadingProgress() {
  if (!currentArticleId) return;

  try {
    const progressKey = `reading_progress_${currentArticleId}`;
    const payload = { page: currentPage, total: totalPages };
    localStorage.setItem(progressKey, JSON.stringify(payload));
    console.log(`Saved reading progress: article ${currentArticleId}, page ${currentPage}, total ${totalPages}`);
  } catch (error) {
    console.error('Error saving reading progress:', error);
  }
}

// Restore reading progress from localStorage
function restoreReadingProgress() {
  if (!currentArticleId) return;

  try {
    const progressKey = `reading_progress_${currentArticleId}`;
    const saved = localStorage.getItem(progressKey);

    if (saved) {
      let pageNumber = null;
      try {
        const parsed = JSON.parse(saved);
        pageNumber = parsed && parsed.page ? parseInt(parsed.page, 10) : null;
      } catch {
        pageNumber = parseInt(saved, 10); // backward compatibility
      }

      if (pageNumber && pageNumber > 1 && pageNumber <= totalPages) {
        console.log(`Restoring reading progress: jumping to page ${pageNumber}`);
        goToPage(pageNumber);
      }
    }
  } catch (error) {
    console.error('Error restoring reading progress:', error);
  }
}

// Navigation functions
function nextPage() {
  if (currentPage < totalPages) {
    goToPage(currentPage + 1);
  } else {
    console.log('Already at last page');
  }
}

function previousPage() {
  if (currentPage > 1) {
    goToPage(currentPage - 1);
  } else {
    console.log('Already at first page');
  }
}

// Setup navigation listeners
function setupNavigation() {
  // Keyboard navigation (including volume keys for mobile e-ink devices)
  document.addEventListener('keydown', (e) => {
    // Standard keyboard navigation
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      nextPage();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      previousPage();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goToPage(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      goToPage(totalPages);
    }
    // Volume keys for e-ink devices (Kindle, Kobo, etc.)
    // Note: Not all browsers/devices allow capturing volume keys
    else if (e.key === 'AudioVolumeDown' || e.key === 'VolumeDown') {
      e.preventDefault();
      nextPage();
      console.log('[Volume Key] Next page triggered');
    } else if (e.key === 'AudioVolumeUp' || e.key === 'VolumeUp') {
      e.preventDefault();
      previousPage();
      console.log('[Volume Key] Previous page triggered');
    }
  });

  // Mouse/touch navigation zones
  const prevZone = document.getElementById('prev-zone');
  const nextZone = document.getElementById('next-zone');

  const handleZoneTap = (dir) => {
    if (dir === 'prev') previousPage();
    else nextPage();
  };

  const attachZone = (zoneEl, dir) => {
    let startX = 0;
    let startY = 0;
    let moved = false;

    zoneEl.addEventListener('pointerdown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
    }, { passive: true });

    zoneEl.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) {
        moved = true;
      }
    }, { passive: true });

    zoneEl.addEventListener('pointerup', (e) => {
      if (moved) return; // treat as scroll/swipe, let it pass
      // Check for buttons or modal
      if (e.target.closest('button') || e.target.closest('.modal')) {
        return;
      }
      e.preventDefault();
      handleZoneTap(dir);
    });
  };

  attachZone(prevZone, 'prev');
  attachZone(nextZone, 'next');


  // Recalculate pagination on window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const oldPage = currentPage;
      const titleEl = document.getElementById('article-title');
      if (titleEl) {
        fitTitleToWidth(titleEl);
      }
      calculatePagination();
      updateClickZones();

      // Adjust current page if it's now out of bounds
      if (currentPage > totalPages) {
        goToPage(totalPages);
      } else {
        // Try to maintain approximate reading position
        goToPage(oldPage);
      }
    }, 300);
  });

  console.log('Navigation setup complete');
}

// Setup back button
function setupBackButton() {
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.navigateTo('list');
    });
  }
}

// Setup page navigation modal
function setupPageNavigation() {
  const pageInfoBtn = document.getElementById('page-info-btn');
  const modal = document.getElementById('page-nav-modal');
  const closeBtn = document.getElementById('close-page-nav-modal');
  const jumpFirstBtn = document.getElementById('jump-first-page');
  const jumpLastBtn = document.getElementById('jump-last-page');
  const jumpInput = document.getElementById('page-jump-number');
  const jumpBtn = document.getElementById('page-jump-btn');

  if (!pageInfoBtn || !modal) return;

  // Open modal
  pageInfoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    jumpInput.value = currentPage;
    jumpInput.max = totalPages;
    modal.style.display = 'flex';
  });

  // Close modal
  const closeModal = () => {
    modal.style.display = 'none';
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Jump to first page
  if (jumpFirstBtn) {
    jumpFirstBtn.addEventListener('click', () => {
      goToPage(1);
      closeModal();
    });
  }

  // Jump to last page
  if (jumpLastBtn) {
    jumpLastBtn.addEventListener('click', () => {
      goToPage(totalPages);
      closeModal();
    });
  }

  // Jump to specific page
  if (jumpBtn && jumpInput) {
    const performJump = () => {
      const pageNum = parseInt(jumpInput.value, 10);
      if (pageNum >= 1 && pageNum <= totalPages) {
        goToPage(pageNum);
        closeModal();
      } else {
        alert(`Please enter a page number between 1 and ${totalPages}`);
      }
    };

    jumpBtn.addEventListener('click', performJump);

    jumpInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performJump();
      }
    });
  }
}

// Manage header/footer auto-hide and reveal
function setupChromeVisibility() {
  const header = document.getElementById('reader-header');
  const footer = document.getElementById('reader-footer');
  const revealZone = document.getElementById('chrome-reveal-zone');
  if (!header || !footer || !revealZone) return;

  const hideChrome = () => {
    header.classList.add('hidden');
    footer.classList.add('hidden');
  };

  const showChrome = () => {
    header.classList.remove('hidden');
    footer.classList.remove('hidden');
    if (chromeHideTimer) clearTimeout(chromeHideTimer);
    chromeHideTimer = setTimeout(hideChrome, CHROME_VISIBLE_MS);
  };

  const isChromeVisible = () => {
    return !header.classList.contains('hidden');
  };

  // Reveal zone click - toggle chrome (show when hidden, hide when visible)
  revealZone.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isChromeVisible()) {
      // Chrome is visible - hide it immediately
      if (chromeHideTimer) clearTimeout(chromeHideTimer);
      hideChrome();
    } else {
      // Chrome is hidden - show it
      showChrome();
    }
  });

  // Initial visibility then auto-hide
  showChrome();
}

// Update footer height for reveal zone
function updateClickZones() {
  const footer = document.getElementById('reader-footer');
  const root = document.documentElement;

  const footerH = footer ? footer.offsetHeight : 0;

  // Set footer height for reveal zone
  root.style.setProperty('--footer-height', `${footerH}px`);
}

// Utility function to show error
function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('reader-container').style.display = 'none';
  document.getElementById('error').textContent = message;
  document.getElementById('error').style.display = 'block';
}

// Fit title to a single line by shrinking font size if needed
function fitTitleToWidth(element) {
  const maxSize = 32;
  const minSize = 16;

  element.style.fontSize = `${maxSize}px`;
  const parent = element.parentElement;
  let maxWidth = element.clientWidth;

  if (parent) {
    const ps = window.getComputedStyle(parent);
    const padL = parseFloat(ps.paddingLeft) || 0;
    const padR = parseFloat(ps.paddingRight) || 0;
    maxWidth = Math.max((parent.clientWidth || 0) - padL - padR, element.clientWidth);
  }

  if (!maxWidth || maxWidth <= 0) return;

  let currentSize = maxSize;
  while (currentSize > minSize && element.scrollWidth > maxWidth) {
    currentSize -= 1;
    element.style.fontSize = `${currentSize}px`;
  }
}

// Safely re-run title fitting after layout settles
function refitTitle() {
  const el = document.getElementById('article-title');
  if (!el) return;

  // Immediate fit
  fitTitleToWidth(el);

  // Fit again on next frame to catch late layout changes (fonts/padding)
  requestAnimationFrame(() => fitTitleToWidth(el));
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function updateMetaSeparators() {
  const bylineText = (document.getElementById('article-byline')?.textContent || '').trim();
  const siteText = (document.getElementById('article-site')?.textContent || '').trim();

  const bsDivider = document.getElementById('meta-divider-byline-site');

  if (bsDivider) {
    bsDivider.style.display = bylineText && siteText ? 'inline-flex' : 'none';
  }
}

// Load settings from localStorage
function loadSettings() {
  try {
    const savedSettings = localStorage.getItem('readerSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;
    applySettings(settings);
  } catch (error) {
    console.error('Error loading settings:', error);
    applySettings(defaultSettings);
  }
}

// Apply settings to the page
function applySettings(settings) {
  const body = document.body;
  body.style.fontSize = settings.fontSize + 'px';
  body.style.fontFamily = settings.fontFamily;
  body.style.lineHeight = settings.lineHeight;

  // Apply dark mode
  if (settings.darkMode) {
    body.classList.add('dark-mode');
  } else {
    body.classList.remove('dark-mode');
  }

  // Update dark mode button icon
  updateDarkModeIcon(settings.darkMode);

  console.log('Applied settings:', settings);
}

// Update dark mode button icon based on current mode
function updateDarkModeIcon(isDarkMode) {
  const darkModeBtn = document.getElementById('dark-mode-btn');
  if (darkModeBtn) {
    // Show sun in dark mode (switch to light), moon in light mode (switch to dark)
    darkModeBtn.textContent = isDarkMode ? '☀' : '☾';
    darkModeBtn.title = isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }
}

// Save settings to localStorage
function saveSettings(settings) {
  try {
    localStorage.setItem('readerSettings', JSON.stringify(settings));
    console.log('Settings saved:', settings);
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Setup settings panel event listeners
function setupSettingsPanel() {
  const modal = document.getElementById('settings-modal');
  const settingsBtn = document.getElementById('settings-btn');
  const closeBtn = document.getElementById('close-modal');
  const saveBtn = document.getElementById('save-settings');
  const cancelBtn = document.getElementById('cancel-settings');

  // Open modal
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering page navigation

    // Load current settings
    const savedSettings = localStorage.getItem('readerSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;

    // Populate form
    document.getElementById('font-size').value = settings.fontSize;
    document.getElementById('font-family').value = settings.fontFamily;
    document.getElementById('line-height').value = settings.lineHeight;

    modal.style.display = 'flex';
  });

  // Close modal
  const closeModal = () => {
    modal.style.display = 'none';
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const savedSettings = localStorage.getItem('readerSettings');
    const currentSettings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;

    const newSettings = {
      fontSize: document.getElementById('font-size').value,
      fontFamily: document.getElementById('font-family').value,
      lineHeight: document.getElementById('line-height').value,
      darkMode: currentSettings.darkMode // Preserve dark mode state
    };

    // Save and apply settings
    saveSettings(newSettings);
    applySettings(newSettings);

    // Track settings change
    trackEvent('reader_settings_change', {
      font_size: newSettings.fontSize,
      font_family: newSettings.fontFamily,
      line_height: newSettings.lineHeight
    });

    // Recalculate pagination with new settings
    setTimeout(() => {
      calculatePagination();
      goToPage(1); // Reset to first page
    }, 100);

    closeModal();
  });
}

// Setup dark mode toggle
function setupDarkMode() {
  const darkModeBtn = document.getElementById('dark-mode-btn');

  darkModeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering page navigation

    // Get current settings
    const savedSettings = localStorage.getItem('readerSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;

    // Toggle dark mode
    settings.darkMode = !settings.darkMode;

    // Save and apply
    saveSettings(settings);
    applySettings(settings);

    // Track dark mode toggle
    trackEvent('dark_mode_toggle', { enabled: settings.darkMode });

    console.log('Dark mode toggled:', settings.darkMode);
  });
}
