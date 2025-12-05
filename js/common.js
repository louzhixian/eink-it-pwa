// Common connectivity utilities used across pages
let cachedConnectivity = navigator.onLine !== false;

async function determineOfflineStatus() {
  // navigator.onLine may be unreliable on some browsers; use a tiny probe
  if (navigator.onLine === false) {
    cachedConnectivity = false;
    return true;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    await fetch('https://www.gstatic.com/generate_204', {
      method: 'GET',
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal
    });
    clearTimeout(timeout);
    cachedConnectivity = true;
    return false;
  } catch (error) {
    console.warn('Connectivity probe failed, assuming offline:', error);
    cachedConnectivity = false;
    return true;
  }
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
