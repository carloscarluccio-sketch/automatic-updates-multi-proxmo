/**
 * Detect if the user is on a mobile device
 */
export const isMobileDevice = (): boolean => {
  // Check if window is available (SSR safety)
  if (typeof window === 'undefined') {
    return false;
  }

  // Check user agent for mobile devices
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // Mobile device patterns
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

  // Check if it's a mobile user agent
  const isMobileUA = mobileRegex.test(userAgent);

  // Check screen width (mobile devices typically < 768px)
  const isMobileScreen = window.innerWidth < 768;

  // Check touch capability
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Return true if any mobile indicator is present
  return isMobileUA || (isMobileScreen && isTouchDevice);
};

/**
 * Get the appropriate initial route based on device type
 */
export const getInitialRoute = (): string => {
  return isMobileDevice() ? '/mobile' : '/dashboard';
};

/**
 * Check if user manually wants desktop mode
 */
export const isDesktopModeForced = (): boolean => {
  return localStorage.getItem('forceDesktopMode') === 'true';
};

/**
 * Set desktop mode preference
 */
export const setDesktopMode = (enabled: boolean): void => {
  if (enabled) {
    localStorage.setItem('forceDesktopMode', 'true');
  } else {
    localStorage.removeItem('forceDesktopMode');
  }
};
