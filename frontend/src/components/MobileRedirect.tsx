import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isMobileDevice, isDesktopModeForced } from '../utils/isMobile';

/**
 * Component that redirects mobile users from desktop routes to mobile routes
 */
export const MobileRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if user is on mobile and not forcing desktop mode
    if (isMobileDevice() && !isDesktopModeForced()) {
      // Check if currently on a desktop route (not /mobile/*)
      if (!location.pathname.startsWith('/mobile')) {
        // Redirect to mobile dashboard
        navigate('/mobile', { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return <>{children}</>;
};
