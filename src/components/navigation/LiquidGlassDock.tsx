import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Home, User, FileText, Briefcase, Mail, Moon, Sun, Ghost, Plus } from 'lucide-react';
import GlassSurface from './GlassSurface';
import { useTheme } from '../../hooks/useTheme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useScrollDirection } from '../../hooks/useScrollDirection';

interface LiquidGlassDockProps {
  currentPath: string;
}

export default function LiquidGlassDock({ currentPath }: LiquidGlassDockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [dockVisible, setDockVisible] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const scrollVisible = useScrollDirection();

  useEffect(() => {
    if (isMobile) {
      setDockVisible(scrollVisible);
    }
  }, [scrollVisible, isMobile]);

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

  const navItems = [
    { id: 'home', label: 'Home', href: '/', icon: Home, gradient: 'from-blue-600 to-blue-400' },
    { id: 'about', label: 'About', href: '/about', icon: User, gradient: 'from-purple-600 to-purple-400' },
    { id: 'blog', label: 'Blog', href: '/blog', icon: FileText, gradient: 'from-green-600 to-green-400' },
    { id: 'works', label: 'Works', href: '/works', icon: Briefcase, gradient: 'from-orange-600 to-orange-400' },
    { id: 'chatbot', label: "Jet's Ghost", href: '/chatbot', icon: Ghost, gradient: 'from-indigo-600 to-indigo-400' },
    { id: 'contact', label: 'Contact', href: '/contact', icon: Mail, gradient: 'from-red-600 to-red-400' },
  ];

  return (
    <>
      <motion.div
        className='fixed bottom-4 md:top-4 left-1/2 z-50'
        initial={{ x: '-50%' }}
        animate={isMobile ? {
          opacity: dockVisible ? 1 : 0,
          y: dockVisible ? 0 : 100,
        } : {}}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{
          pointerEvents: dockVisible ? 'auto' : 'none',
          x: '-50%'
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
          className="px-2 py-3 md:px-3 md:py-6 !overflow-visible"
        >
          <div ref={dockRef} className='flex items-end space-x-2 md:space-x-6 overflow-visible'>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href));

              return (
                <a
                  key={item.id}
                  href={item.href}
                  onMouseEnter={() => !isMobile && setHoveredIcon(item.id)}
                  onMouseLeave={() => !isMobile && setHoveredIcon(null)}
                  className='relative dock-icon-container'
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
              onClick={toggleTheme}
              onMouseEnter={() => !isMobile && setHoveredIcon('theme')}
              onMouseLeave={() => !isMobile && setHoveredIcon(null)}
              className='relative dock-icon-container'
              style={{ transformOrigin: 'bottom center' }}
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

      {isMobile && (
        <motion.button
          className='fixed bottom-4 right-4 z-50'
          animate={{
            opacity: dockVisible ? 0 : 1,
            scale: dockVisible ? 0.8 : 1,
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{ pointerEvents: dockVisible ? 'none' : 'auto' }}
          onClick={() => setDockVisible(true)}
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
