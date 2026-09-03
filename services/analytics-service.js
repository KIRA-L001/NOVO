const Analytics = {
  track(event, data = {}) {
    window.dispatchEvent(new CustomEvent('ray:' + event, { detail: data }));
    if (window.RAY && typeof window.RAY.trackEvent === 'function') {
      window.RAY.trackEvent(event, data);
    }
  }
};
