// 初始化 Supabase（使用 config.js 中声明的全局变量）
initSupabase();

// State management
let currentPage = 1;
let totalPages = 1;
let pageHeight = 0;
let contentElement = null;

// Default settings - auto-detect Chinese language
const defaultSettings = {
  fontSize: '18',
  fontFamily: navigator.language.startsWith('zh')
    ? "'LXGW WenKai', serif"  // Chinese default
    : 'Georgia, serif',        // Western default
  lineHeight: '1.7',
  darkMode: false
};

// Initialize reader on page load
document.addEventListener('DOMContentLoaded', initReader);

async function initReader() {
  try {
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return;
    }

    // Get article ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');

    if (!articleId) {
      showError('No article ID provided.');
      return;
    }

    // Show loading initially
    document.getElementById('loading').style.display = 'block';
    document.getElementById('reader-container').style.display = 'none';

    // Load article from Supabase
    const { data: article, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (error) {
      throw error;
    }

    if (!article) {
      showError('Article not found.');
      return;
    }

    console.log('Loading article:', article.title);

    // Populate page content
    const titleElement = document.getElementById('article-title');
    titleElement.textContent = article.title || 'Untitled';

    // Apply title truncation with ellipsis in middle
    truncateTitle(titleElement);

    document.getElementById('article-byline').textContent = article.byline || '';
    document.getElementById('article-site').textContent = article.site_name || '';

    contentElement = document.getElementById('reader-content');
    contentElement.innerHTML = article.content;

    // Hide loading
    document.getElementById('loading').style.display = 'none';
    document.getElementById('reader-container').style.display = 'flex';

    // Load and apply saved settings
    loadSettings();

    // Wait for images to load before calculating pagination
    await waitForImages();

    // Calculate pagination after content is rendered
    setTimeout(() => {
      calculatePagination();
      setupNavigation();
      setupSettingsPanel();
      setupDarkMode();
      setupBackButton();
    }, 100);

  } catch (error) {
    console.error('Error loading article:', error);
    showError('Failed to load article: ' + error.message);
  }
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

  // Calculate number of pages
  totalPages = Math.ceil(totalHeight / pageHeight);

  // Ensure at least 1 page
  if (totalPages < 1) totalPages = 1;

  // Update UI
  document.getElementById('total-pages').textContent = totalPages;
  document.getElementById('current-page').textContent = currentPage;

  console.log(`Pagination calculated: ${totalPages} pages, ${pageHeight}px per page, ${totalHeight}px total`);
}

// Navigate to specific page
function goToPage(pageNumber) {
  if (pageNumber < 1 || pageNumber > totalPages) {
    console.log(`Page ${pageNumber} out of bounds (1-${totalPages})`);
    return;
  }

  currentPage = pageNumber;

  // Calculate scroll position for this page
  const scrollPosition = (currentPage - 1) * pageHeight;

  // Instantly scroll to position (no smooth behavior for E-ink)
  contentElement.scrollTo({
    top: scrollPosition,
    behavior: 'auto' // CRITICAL: instant, not smooth
  });

  // Update page indicator
  document.getElementById('current-page').textContent = currentPage;

  console.log(`Navigated to page ${currentPage} (scroll: ${scrollPosition}px)`);
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
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
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
  });

  // Mouse click navigation zones
  const prevZone = document.getElementById('prev-zone');
  const nextZone = document.getElementById('next-zone');

  prevZone.addEventListener('click', (e) => {
    // Check for buttons or modal
    if (e.target.closest('button') || e.target.closest('.modal')) {
      return;
    }
    e.preventDefault();
    previousPage();
  });

  nextZone.addEventListener('click', (e) => {
    // Check for buttons or modal
    if (e.target.closest('button') || e.target.closest('.modal')) {
      return;
    }
    e.preventDefault();
    nextPage();
  });

  // Recalculate pagination on window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const oldPage = currentPage;
      calculatePagination();

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
      window.location.href = 'list.html';
    });
  }
}

// Utility function to show error
function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('reader-container').style.display = 'none';
  document.getElementById('error').textContent = message;
  document.getElementById('error').style.display = 'block';
}

// Truncate title with ellipsis in the middle
function truncateTitle(element) {
  const fullText = element.textContent;
  const maxWidth = element.offsetWidth;

  // Create a temporary span to measure text width
  const measureSpan = document.createElement('span');
  measureSpan.style.visibility = 'hidden';
  measureSpan.style.position = 'absolute';
  measureSpan.style.whiteSpace = 'nowrap';
  measureSpan.style.fontSize = window.getComputedStyle(element).fontSize;
  measureSpan.style.fontWeight = window.getComputedStyle(element).fontWeight;
  measureSpan.style.fontFamily = window.getComputedStyle(element).fontFamily;
  document.body.appendChild(measureSpan);

  measureSpan.textContent = fullText;

  // Check if truncation is needed
  if (measureSpan.offsetWidth <= maxWidth) {
    document.body.removeChild(measureSpan);
    return;
  }

  // Binary search for the right amount to keep on each side
  const ellipsis = '...';
  let left = 0;
  let right = Math.floor(fullText.length / 2);
  let bestFit = '';

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const truncated = fullText.substring(0, mid) + ellipsis + fullText.substring(fullText.length - mid);
    measureSpan.textContent = truncated;

    if (measureSpan.offsetWidth <= maxWidth) {
      bestFit = truncated;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  element.textContent = bestFit || (fullText.substring(0, 10) + ellipsis + fullText.substring(fullText.length - 10));
  element.title = fullText; // Show full text on hover

  document.body.removeChild(measureSpan);
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

    console.log('Dark mode toggled:', settings.darkMode);
  });
}
