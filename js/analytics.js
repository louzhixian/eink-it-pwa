/**
 * Google Analytics 4 Event Tracking Helper
 *
 * Usage:
 *   trackEvent('signup', { method: 'email', has_invitation: true });
 *   trackEvent('article_view', { article_id: '123' });
 */

// Check if gtag is available
function isGtagAvailable() {
  return typeof gtag !== 'undefined';
}

/**
 * Track custom events to Google Analytics
 * @param {string} eventName - Event name (e.g., 'login', 'signup', 'article_view')
 * @param {object} eventParams - Event parameters (optional)
 */
function trackEvent(eventName, eventParams = {}) {
  if (!isGtagAvailable()) {
    console.warn('[Analytics] gtag not available, skipping event:', eventName);
    return;
  }

  try {
    // Remove any sensitive data (email, passwords, tokens, etc.)
    const sanitizedParams = sanitizeEventParams(eventParams);
    gtag('event', eventName, sanitizedParams);
    console.log('[Analytics] Event tracked:', eventName, sanitizedParams);
  } catch (error) {
    console.error('[Analytics] Error tracking event:', error);
  }
}

/**
 * Remove sensitive data from event parameters
 * @param {object} params - Event parameters
 * @returns {object} Sanitized parameters
 */
function sanitizeEventParams(params) {
  const sanitized = { ...params };

  // Remove sensitive fields
  const sensitiveFields = ['email', 'password', 'token', 'access_token', 'refresh_token', 'user_id'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      delete sanitized[field];
    }
  });

  return sanitized;
}

/**
 * Track page views (automatically done by GA, but can be called manually)
 * @param {string} pageTitle - Page title
 * @param {string} pagePath - Page path
 */
function trackPageView(pageTitle, pagePath) {
  if (!isGtagAvailable()) return;

  try {
    gtag('event', 'page_view', {
      page_title: pageTitle,
      page_path: pagePath
    });
    console.log('[Analytics] Page view tracked:', pageTitle);
  } catch (error) {
    console.error('[Analytics] Error tracking page view:', error);
  }
}

/**
 * Set user properties (non-PII only)
 * @param {object} properties - User properties
 */
function setUserProperties(properties) {
  if (!isGtagAvailable()) return;

  try {
    const sanitized = sanitizeEventParams(properties);
    gtag('set', 'user_properties', sanitized);
    console.log('[Analytics] User properties set:', sanitized);
  } catch (error) {
    console.error('[Analytics] Error setting user properties:', error);
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.trackEvent = trackEvent;
  window.trackPageView = trackPageView;
  window.setUserProperties = setUserProperties;
}
