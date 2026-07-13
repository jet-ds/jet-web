import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, Plus } from 'lucide-react';
import GlassSurface from './GlassSurface';
import { useTheme } from '../../hooks/useTheme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isActiveNavItem, NAV_ITEMS } from '../../config/site';

const DOCK_SCROLLED_KEY = 'dockScrolled';

interface LiquidGlassDockProps {
  currentPath: string;
}

export default function LiquidGlassDock({ currentPath }: LiquidGlassDockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const themeIconRef = useRef<HTMLButtonElement>(null);
  const disclosureButtonRef = useRef<HTMLButtonElement>(null);

  // Tracks initial mount to prevent race condition with sessionStorage read
  const isInitialMount = useRef(true);

  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [dockVisible, setDockVisible] = useState(true);

  // Page-level: Has user scrolled on THIS page? (resets per navigation)
  const [hasScrolledOnPage, setHasScrolledOnPage] = useState(false);

  // Session-level: Has user discovered button in this browsing session?
  const [buttonDiscoveredInSession, setButtonDiscoveredInSession] = useState(false);

  const [buttonLeftPosition, setButtonLeftPosition] = useState<number | null>(null);

  const { theme, toggleTheme } = useTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Restore session state: Check if button was already discovered in this session
  useEffect(() => {
    const stored = sessionStorage.getItem(DOCK_SCROLLED_KEY);
    if (stored === 'true') {
      setButtonDiscoveredInSession(true);
    }
  }, []);

  // Handle breakpoint changes: Reset state when switching to desktop
  useEffect(() => {
    // Skip cleanup on initial mount (prevent race condition with sessionStorage read)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only cleanup when switching from mobile to desktop mid-session
    if (!isMobile) {
      setDockVisible(true);
      setHasScrolledOnPage(false);
      sessionStorage.removeItem(DOCK_SCROLLED_KEY);
      setButtonDiscoveredInSession(false);
    }
  }, [isMobile]);

  // One-time scroll detection: Tutorial animation only in State 0 (undiscovered)
  useEffect(() => {
    // Only attach scroll handler in State 0 (before discovery)
    if (!isMobile || hasScrolledOnPage || buttonDiscoveredInSession) return;

    const handleFirstScroll = () => {
      if (window.scrollY > 100) {
        setHasScrolledOnPage(true);

        // Transition to State 1: persist discovery, hide dock, reveal button
        sessionStorage.setItem(DOCK_SCROLLED_KEY, 'true');
        setButtonDiscoveredInSession(true);
        setDockVisible(false);

        window.removeEventListener('scroll', handleFirstScroll);
      }
    };

    window.addEventListener('scroll', handleFirstScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleFirstScroll);
  }, [isMobile, hasScrolledOnPage, buttonDiscoveredInSession]);

  // Calculate Plus/X button horizontal position (aligned with theme icon)
  useEffect(() => {
    const shouldShowButton = hasScrolledOnPage || buttonDiscoveredInSession;
    if (!isMobile || !themeIconRef.current || !shouldShowButton) return;

    const calculatePosition = () => {
      if (!themeIconRef.current) return;
      const rect = themeIconRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      setButtonLeftPosition(centerX);
    };

    calculatePosition();

    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  }, [isMobile, hasScrolledOnPage, buttonDiscoveredInSession]);

  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      const icons = dockRef.current?.querySelectorAll('.dock-icon-container');
      if (!icons) return;

      icons.forEach((icon) => {
        const rect = icon.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const distance = Math.abs(e.clientX - centerX);

        const effectWidth = 280;
        const theta = Math.min((Math.PI * distance) / effectWidth, Math.PI);
        const magnitude = (Math.cos(theta) + 1) / 2;

        const minScale = 1.0;
        const maxScale = 1.3;
        const scale = minScale + (maxScale - minScale) * magnitude;

        (icon as HTMLElement).style.transform =
          `translateY(${(scale - 1) * -10}px) scale(${scale})`;
      });
    };

    const resetScales = () => {
      const icons = dockRef.current?.querySelectorAll('.dock-icon-container');
      icons?.forEach((icon) => {
        (icon as HTMLElement).style.transform = 'translateY(0) scale(1)';
      });
    };

    const dock = dockRef.current;
    if (dock) {
      dock.addEventListener('mousemove', handleMouseMove);
      dock.addEventListener('mouseleave', resetScales);
    }

    return () => {
      if (dock) {
        dock.removeEventListener('mousemove', handleMouseMove);
        dock.removeEventListener('mouseleave', resetScales);
      }
    };
  }, [isMobile]);

  const Tooltip = ({ text }: { text: string }) => (
    <div className={`absolute ${isMobile ? 'bottom-20' : 'top-20'} left-1/2 -translate-x-1/2`}>
      <div className='relative px-2.5 py-0.5 bg-white/90 dark:bg-[#1d1d1f]/80 backdrop-blur-sm text-gray-800 dark:text-white text-xs rounded-md whitespace-nowrap border border-gray-300 dark:border-gray-600'>
        {text}
        <div className={`absolute left-1/2 -translate-x-1/2 ${isMobile ? '-bottom-[5px] rotate-[225deg]' : '-top-[5px] rotate-45'} w-2.5 h-2.5 bg-white/90 dark:bg-[#1d1d1f]/80 backdrop-blur-sm border-t border-l border-gray-300 dark:border-gray-600`} />
      </div>
    </div>
  );

  // Determine if Plus/X button should show (pure derivation)
  const shouldShowButton = hasScrolledOnPage || buttonDiscoveredInSession;
  const isDockClosedOnMobile = isMobile && !dockVisible;

  const handleDisclosureClick = () => {
    if (dockVisible) {
      setDockVisible(false);
      disclosureButtonRef.current?.focus();
      return;
    }

    setDockVisible(true);
  };

  return (
    <>
      <motion.div
        id="site-navigation-dock"
        inert={isDockClosedOnMobile ? true : undefined}
        aria-hidden={isDockClosedOnMobile ? true : undefined}
        className='fixed bottom-4 md:top-4 left-1/2 z-50'
        initial={{ x: '-50%' }}
        animate={isMobile ? {
          opacity: dockVisible ? 1 : 0,
          y: dockVisible ? 0 : 100,
        } : {}}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{
          pointerEvents: 'none',
          x: '-50%',
          willChange: isMobile ? 'transform' : 'auto',
        }}
      >
        <GlassSurface
          width="auto"
          borderRadius={16}
          displace={1}
          distortionScale={-180}
          backgroundOpacity={0.33}
          brightness={50}
          opacity={0.9}
          className={`px-2 py-3 md:px-3 md:py-6 !overflow-visible ${isDockClosedOnMobile ? 'pointer-events-none' : 'pointer-events-auto'}`}
        >
          <div ref={dockRef} className='flex items-end space-x-2 md:space-x-6 overflow-visible'>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveNavItem(currentPath, item.href);

              return (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  tabIndex={isDockClosedOnMobile ? -1 : undefined}
                  onMouseEnter={() => !isMobile && setHoveredIcon(item.id)}
                  onMouseLeave={() => !isMobile && setHoveredIcon(null)}
                  className='relative dock-icon-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-base focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base rounded-xl'
                  style={{ transformOrigin: 'bottom center' }}
                >
                  <div className={`w-10 h-10 md:w-14 md:h-14 bg-gradient-to-t ${item.gradient} rounded-lg md:rounded-xl flex items-center justify-center shadow-lg transition-transform ${isActive ? 'ring-2 ring-white/50' : ''}`}>
                    <Icon size={isMobile ? 24 : 32} className='text-white' strokeWidth={2} />
                  </div>
                  {hoveredIcon === item.id && !isMobile && <Tooltip text={item.label} />}
                </a>
              );
            })}

            <div className='flex items-center'>
              <div className='w-px h-10 md:h-14 bg-black/50 dark:bg-white/50' />
            </div>

            <button
              ref={themeIconRef}
              onClick={toggleTheme}
              onMouseEnter={() => !isMobile && setHoveredIcon('theme')}
              onMouseLeave={() => !isMobile && setHoveredIcon(null)}
              tabIndex={isDockClosedOnMobile ? -1 : undefined}
              className='relative dock-icon-container'
              style={{ transformOrigin: 'bottom center' }}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <div className='w-10 h-10 md:w-14 md:h-14 bg-gradient-to-t from-gray-700 to-gray-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg transition-transform'>
                {theme === 'dark' ? (
                  <Sun size={isMobile ? 24 : 32} className='text-yellow-300' strokeWidth={2} />
                ) : (
                  <Moon size={isMobile ? 24 : 32} className='text-blue-200' strokeWidth={2} />
                )}
              </div>
              {hoveredIcon === 'theme' && <Tooltip text={theme === 'dark' ? 'Light Mode' : 'Dark Mode'} />}
            </button>
          </div>
        </GlassSurface>
      </motion.div>

      {isMobile && shouldShowButton && buttonLeftPosition !== null && (
        <motion.button
          ref={disclosureButtonRef}
          className='fixed z-50'
          style={{
            left: buttonLeftPosition,
            bottom: '1rem',
            willChange: 'transform',
          }}
          initial={false}
          animate={{
            y: dockVisible ? -88 : 0,
            rotate: dockVisible ? 45 : 0,
            x: '-50%',
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          onClick={handleDisclosureClick}
          aria-expanded={dockVisible}
          aria-controls="site-navigation-dock"
          aria-label={dockVisible ? 'Close navigation' : 'Open navigation'}
        >
          <GlassSurface
            width={48}
            height={48}
            borderRadius={24}
            displace={1}
            distortionScale={-180}
            backgroundOpacity={0.33}
            brightness={50}
            opacity={0.9}
          >
            <Plus className="w-6 h-6 text-foreground dark:text-foreground-dark" />
          </GlassSurface>
        </motion.button>
      )}
    </>
  );
}
