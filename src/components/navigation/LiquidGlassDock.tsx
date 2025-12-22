import { useEffect, useRef, useState } from 'react';
import { Home, User, FileText, Briefcase, Mail, Moon, Sun } from 'lucide-react';
import GlassSurface from './GlassSurface';
import { useTheme } from '../../hooks/useTheme';

interface LiquidGlassDockProps {
  currentPath: string;
}

export default function LiquidGlassDock({ currentPath }: LiquidGlassDockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
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
  }, []);

  const Tooltip = ({ text }: { text: string }) => (
    <div className='absolute top-20 left-1/2 -translate-x-1/2'>
      <div className='relative px-2.5 py-0.5 bg-white/90 dark:bg-[#1d1d1f]/80 backdrop-blur-sm text-gray-800 dark:text-white text-xs rounded-md whitespace-nowrap border border-gray-300 dark:border-gray-600'>
        {text}
        <div className='absolute left-1/2 -translate-x-1/2 -top-[5px] w-2.5 h-2.5 bg-white/90 dark:bg-[#1d1d1f]/80 backdrop-blur-sm rotate-45 border-t border-l border-gray-300 dark:border-gray-600' />
      </div>
    </div>
  );

  const navItems = [
    { id: 'home', label: 'Home', href: '/', icon: Home, gradient: 'from-blue-600 to-blue-400' },
    { id: 'about', label: 'About', href: '/about', icon: User, gradient: 'from-purple-600 to-purple-400' },
    { id: 'blog', label: 'Blog', href: '/blog', icon: FileText, gradient: 'from-green-600 to-green-400' },
    { id: 'works', label: 'Works', href: '/works', icon: Briefcase, gradient: 'from-orange-600 to-orange-400' },
    { id: 'contact', label: 'Contact', href: '/contact', icon: Mail, gradient: 'from-red-600 to-red-400' },
  ];

  return (
    <div className='fixed top-4 left-1/2 -translate-x-1/2 z-50'>
      <div className='overflow-visible'>
        <GlassSurface
          width="auto"
          borderRadius={16}
          displace={1}
          distortionScale={-180}
          backgroundOpacity={0.33}
          brightness={50}
          opacity={0.9}
          className="px-3 py-6 !overflow-visible"
        >
          <div ref={dockRef} className='flex items-end space-x-6 overflow-visible'>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href));

              return (
                <a
                  key={item.id}
                  href={item.href}
                  onMouseEnter={() => setHoveredIcon(item.id)}
                  onMouseLeave={() => setHoveredIcon(null)}
                  className='relative dock-icon-container'
                  style={{ transformOrigin: 'bottom center' }}
                >
                  <div className={`w-14 h-14 bg-gradient-to-t ${item.gradient} rounded-xl flex items-center justify-center shadow-lg transition-transform ${isActive ? 'ring-2 ring-white/50' : ''}`}>
                    <Icon size={32} className='text-white' strokeWidth={2} />
                  </div>
                  {hoveredIcon === item.id && <Tooltip text={item.label} />}
                </a>
              );
            })}

            <div className='flex items-center'>
              <div className='w-px h-14 bg-white/50 dark:bg-white/40' />
            </div>

            <button
              onClick={toggleTheme}
              onMouseEnter={() => setHoveredIcon('theme')}
              onMouseLeave={() => setHoveredIcon(null)}
              className='relative dock-icon-container'
              style={{ transformOrigin: 'bottom center' }}
            >
              <div className='w-14 h-14 bg-gradient-to-t from-gray-700 to-gray-500 rounded-xl flex items-center justify-center shadow-lg transition-transform'>
                {theme === 'dark' ? (
                  <Sun size={32} className='text-yellow-300' strokeWidth={2} />
                ) : (
                  <Moon size={32} className='text-blue-200' strokeWidth={2} />
                )}
              </div>
              {hoveredIcon === 'theme' && <Tooltip text={theme === 'dark' ? 'Light Mode' : 'Dark Mode'} />}
            </button>
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}
