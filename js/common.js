// Common connectivity utilities used across pages
let cachedConnectivity = navigator.onLine !== false;
let connectivityPollTimer = null;

async function probeConnectivity() {
  // Use fetch if available, otherwise fall back to Image ping for older engines
  if (typeof fetch === 'function') {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = setTimeout(() => controller && controller.abort(), 2500);
    try {
      await fetch('https://www.gstatic.com/generate_204', {
        method: 'GET',
        cache: 'no-store',
        mode: 'no-cors',
        signal: controller ? controller.signal : undefined
      });
      clearTimeout(timeout);
      return true;
    } catch (err) {
      clearTimeout(timeout);
      console.warn('Fetch probe failed:', err);
      return false;
    }
  }

  // Legacy fallback: image ping
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      cleanup(false);
    }, 3000);

    const cleanup = (result) => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    };

    img.onload = () => cleanup(true);
    img.onerror = () => cleanup(false);
    img.src = `https://www.google.com/favicon.ico?_=${Date.now()}`;
  });
}

async function determineOfflineStatus() {
  // navigator.onLine may be unreliable on some browsers; use a probe
  if (navigator.onLine === false) {
    cachedConnectivity = false;
    return true;
  }

  const online = await probeConnectivity();
  cachedConnectivity = online;
  return !online;
}

async function updateOnlineStatus() {
  const offline = await determineOfflineStatus();
  if (offline) {
    showOfflineBadge();
  } else {
    hideOfflineBadge();
  }
  return offline;
}

// Show offline badge programmatically (for explicit offline states)
function showOfflineBadge() {
  const badge = document.getElementById('offlineBadge');
  if (badge) {
    badge.style.display = 'inline-block';
  }
}

// Hide offline badge programmatically
function hideOfflineBadge() {
  const badge = document.getElementById('offlineBadge');
  if (badge) {
    badge.style.display = 'none';
  }
}

// Listen for online/offline events and recheck with probe
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
window.addEventListener('load', updateOnlineStatus);

// Periodic live check for older browsers / flaky networks
function startConnectivityMonitor(intervalMs = 15000) {
  if (connectivityPollTimer) clearInterval(connectivityPollTimer);
  connectivityPollTimer = setInterval(() => {
    updateOnlineStatus();
  }, intervalMs);
}

startConnectivityMonitor();
