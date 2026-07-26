import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, Plus } from 'lucide-react';
import GlassSurface from './GlassSurface';
import { useTheme } from '../../hooks/useTheme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isActiveNavItem, NAV_ITEMS } from '../../config/site';

const MOBILE_DOCK_STATE_KEY = 'mobileDockState';

type MobileDockVisibility = 'open' | 'closed';

interface MobileDockState {
  discovered: boolean;
  visibility: MobileDockVisibility;
}

interface LiquidGlassDockProps {
  currentPath: string;
  immersive: boolean;
}

function freshMobileDockState(immersive: boolean): MobileDockState {
  return { discovered: immersive, visibility: 'open' };
}

function normalizeMobileDockState(value: MobileDockState): MobileDockState {
  return value.visibility === 'closed'
    ? { discovered: true, visibility: 'closed' }
    : { discovered: value.discovered, visibility: 'open' };
}

function readMobileDockState(immersive: boolean): MobileDockState {
  const fallback = freshMobileDockState(immersive);

  try {
    const raw = window.sessionStorage.getItem(MOBILE_DOCK_STATE_KEY);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'discovered' in value &&
      'visibility' in value &&
      typeof value.discovered === 'boolean' &&
      (value.visibility === 'open' || value.visibility === 'closed')
    ) {
      return normalizeMobileDockState(value as MobileDockState);
    }
  } catch {
    // Private browsing and restricted embeds retain an operable page-lifetime state.
  }

  return fallback;
}

function saveMobileDockState(state: MobileDockState): void {
  try {
    window.sessionStorage.setItem(MOBILE_DOCK_STATE_KEY, JSON.stringify(state));
  } catch {
    // State remains available for the current mounted page when storage is unavailable.
  }
}

export default function LiquidGlassDock({
  currentPath,
  immersive,
}: LiquidGlassDockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const themeIconRef = useRef<HTMLButtonElement>(null);
  const disclosureButtonRef = useRef<HTMLButtonElement>(null);

  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [mobileDockState, setMobileDockState] = useState<MobileDockState>(() =>
    readMobileDockState(immersive),
  );

  const [buttonLeftPosition, setButtonLeftPosition] = useState<number | null>(
    null,
  );

  const { theme, toggleTheme } = useTheme();
  const isCompact = useMediaQuery('(max-width: 47.999rem)');

  const updateMobileDockState = (next: MobileDockState) => {
    const normalized = normalizeMobileDockState(next);
    saveMobileDockState(normalized);
    setMobileDockState(normalized);
  };

  // Immersive entry intentionally makes the disclosure available before any scroll.
  useEffect(() => {
    if (immersive && !mobileDockState.discovered) {
      updateMobileDockState({ discovered: true, visibility: 'open' });
    }
  }, [immersive, mobileDockState.discovered]);

  useEffect(() => {
    if (immersive && mobileDockState.discovered)
      saveMobileDockState(mobileDockState);
  }, [immersive, mobileDockState]);

  // One-time scroll discovery only applies to a fresh ordinary compact route.
  useEffect(() => {
    if (!isCompact || mobileDockState.discovered) return;

    const handleFirstScroll = () => {
      if (window.scrollY > 100) {
        updateMobileDockState({ discovered: true, visibility: 'closed' });

        window.removeEventListener('scroll', handleFirstScroll);
      }
    };

    window.addEventListener('scroll', handleFirstScroll, { passive: true });
    handleFirstScroll();
    return () => window.removeEventListener('scroll', handleFirstScroll);
  }, [isCompact, mobileDockState.discovered]);

  // Calculate Plus/X button horizontal position (aligned with theme icon)
  useEffect(() => {
    if (!isCompact || !themeIconRef.current || !mobileDockState.discovered)
      return;

    const calculatePosition = () => {
      if (!themeIconRef.current) return;
      const rect = themeIconRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      setButtonLeftPosition(centerX);
    };

    calculatePosition();

    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  }, [isCompact, mobileDockState.discovered]);

  useEffect(() => {
    if (isCompact) return;

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
  }, [isCompact]);

  const Tooltip = ({ text }: { text: string }) => (
    <div
      className={`absolute ${isCompact ? 'bottom-20' : 'top-20'} left-1/2 -translate-x-1/2`}
    >
      <div className="relative px-2.5 py-0.5 bg-white/90 dark:bg-[#1d1d1f]/80 backdrop-blur-xs text-gray-800 dark:text-white text-xs rounded-md whitespace-nowrap border border-gray-300 dark:border-gray-600">
        {text}
        <div
          className={`absolute left-1/2 -translate-x-1/2 ${isCompact ? '-bottom-[5px] rotate-[225deg]' : '-top-[5px] rotate-45'} w-2.5 h-2.5 bg-white/90 dark:bg-[#1d1d1f]/80 backdrop-blur-xs border-t border-l border-gray-300 dark:border-gray-600`}
        />
      </div>
    </div>
  );

  // Determine if Plus/X button should show (pure derivation)
  const dockVisible = !isCompact || mobileDockState.visibility === 'open';
  const shouldShowButton = isCompact && mobileDockState.discovered;
  const isDockClosedOnMobile = isCompact && !dockVisible;

  const handleDisclosureClick = () => {
    if (dockVisible) {
      updateMobileDockState({ discovered: true, visibility: 'closed' });
      disclosureButtonRef.current?.focus();
      return;
    }

    updateMobileDockState({ discovered: true, visibility: 'open' });
  };

  return (
    <>
      <motion.div
        id="site-navigation-dock"
        inert={isDockClosedOnMobile ? true : undefined}
        aria-hidden={isDockClosedOnMobile ? true : undefined}
        className="site-navigation-dock fixed bottom-[var(--navigation-dock-offset)] left-1/2 z-50 lg:bottom-auto lg:top-[var(--navigation-dock-offset)]"
        initial={{ x: '-50%' }}
        animate={
          isCompact
            ? {
                opacity: dockVisible ? 1 : 0,
                y: dockVisible ? 0 : 100,
              }
            : {}
        }
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{
          pointerEvents: 'none',
          x: '-50%',
          willChange: isCompact ? 'transform' : 'auto',
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
          className={`px-2 max-[359px]:px-0 py-3 md:px-3 md:py-6 !overflow-visible ${isDockClosedOnMobile ? 'pointer-events-none' : 'pointer-events-auto'}`}
        >
          <div
            ref={dockRef}
            className="flex items-end space-x-2 max-[359px]:space-x-1 md:space-x-6 overflow-visible"
          >
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
                  onMouseEnter={() => !isCompact && setHoveredIcon(item.id)}
                  onMouseLeave={() => !isCompact && setHoveredIcon(null)}
                  className="relative dock-icon-container focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-base focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base rounded-xl"
                  style={{ transformOrigin: 'bottom center' }}
                >
                  <div
                    className={`w-10 h-10 max-[359px]:w-9 max-[359px]:h-9 md:w-14 md:h-14 bg-gradient-to-t ${item.gradient} rounded-lg md:rounded-xl flex items-center justify-center shadow-lg transition-transform ${isActive ? 'ring-2 ring-white/50' : ''}`}
                  >
                    <Icon
                      size={isCompact ? 24 : 32}
                      className="text-white"
                      strokeWidth={2}
                    />
                  </div>
                  {hoveredIcon === item.id && !isCompact && (
                    <Tooltip text={item.label} />
                  )}
                </a>
              );
            })}

            <div className="flex items-center">
              <div className="w-px h-10 md:h-14 bg-black/50 dark:bg-white/50" />
            </div>

            <button
              ref={themeIconRef}
              onClick={toggleTheme}
              onMouseEnter={() => !isCompact && setHoveredIcon('theme')}
              onMouseLeave={() => !isCompact && setHoveredIcon(null)}
              tabIndex={isDockClosedOnMobile ? -1 : undefined}
              className="relative dock-icon-container"
              style={{ transformOrigin: 'bottom center' }}
              aria-label={
                theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
            >
              <div className="w-10 h-10 max-[359px]:w-9 max-[359px]:h-9 md:w-14 md:h-14 bg-gradient-to-t from-gray-700 to-gray-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg transition-transform">
                {theme === 'dark' ? (
                  <Sun
                    size={isCompact ? 24 : 32}
                    className="text-yellow-300"
                    strokeWidth={2}
                  />
                ) : (
                  <Moon
                    size={isCompact ? 24 : 32}
                    className="text-blue-200"
                    strokeWidth={2}
                  />
                )}
              </div>
              {hoveredIcon === 'theme' && (
                <Tooltip text={theme === 'dark' ? 'Light Mode' : 'Dark Mode'} />
              )}
            </button>
          </div>
        </GlassSurface>
      </motion.div>

      {shouldShowButton && (
        <motion.button
          ref={disclosureButtonRef}
          className="site-navigation-disclosure fixed z-50"
          style={{
            left: buttonLeftPosition ?? '50%',
            willChange: 'transform',
          }}
          initial={false}
          animate={{
            y: dockVisible
              ? 'calc(-1 * var(--navigation-disclosure-raise))'
              : 0,
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
