import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Home, User, FileText, Briefcase, Mail, Moon, Sun, type LucideIcon } from 'lucide-react';
import GlassSurface from './GlassSurface';

interface LiquidGlassMobileMenuProps {
  currentPath: string;
}

type MenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  gradient: string;
  href?: string;
  onClick?: () => void;
};

export default function LiquidGlassMobileMenu({ currentPath }: LiquidGlassMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Check current theme
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    setTheme(newTheme);
    setIsOpen(false);
  };

  const navItems: MenuItem[] = [
    { id: 'home', label: 'Home', href: '/', icon: Home, gradient: 'from-blue-600 to-blue-400' },
    { id: 'about', label: 'About', href: '/about', icon: User, gradient: 'from-purple-600 to-purple-400' },
    { id: 'blog', label: 'Blog', href: '/blog', icon: FileText, gradient: 'from-green-600 to-green-400' },
    { id: 'works', label: 'Works', href: '/works', icon: Briefcase, gradient: 'from-orange-600 to-orange-400' },
    { id: 'contact', label: 'Contact', href: '/contact', icon: Mail, gradient: 'from-red-600 to-red-400' },
  ];

  const allItems: MenuItem[] = [
    ...navItems,
    {
      id: 'theme',
      label: theme === 'dark' ? 'Light Mode' : 'Dark Mode',
      icon: theme === 'dark' ? Sun : Moon,
      gradient: 'from-gray-700 to-gray-500',
      onClick: toggleTheme,
    }
  ];

  return (
    <>
      {/* Plus/X Button */}
      <motion.div
        className="fixed top-4 right-4 z-50 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <GlassSurface
          width={56}
          height={56}
          borderRadius={28}
          displace={0.5}
          distortionScale={-180}
          backgroundOpacity={0.25}
          brightness={50}
          opacity={0.5}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <Plus className="w-6 h-6 text-foreground dark:text-foreground-dark" />
          </motion.div>
        </GlassSurface>
      </motion.div>

      {/* Menu Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
              animate={{ opacity: 1, scale: 1, x: 20, y: 80 }}
              exit={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed top-4 left-4 z-50"
            >
              <GlassSurface
                width="auto"
                borderRadius={16}
                displace={0.5}
                distortionScale={-180}
                backgroundOpacity={0.25}
                brightness={50}
                opacity={0.5}
                className="p-4"
              >
                <div className="flex flex-col gap-3">
                  {allItems.map((item, i) => {
                    const Icon = item.icon;
                    const isActive = item.href ? (currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))) : false;
                    const isButton = item.id === 'theme';

                    const content = (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: i * 0.08,
                          type: 'spring',
                          stiffness: 300,
                          damping: 25
                        }}
                        className="flex items-center gap-3"
                      >
                        <div className={`w-12 h-12 bg-gradient-to-t ${item.gradient} rounded-xl flex items-center justify-center shadow-lg ${isActive ? 'ring-2 ring-white/50' : ''}`}>
                          <Icon size={24} className='text-white' strokeWidth={2} />
                        </div>
                        <span className="text-sm font-medium text-foreground dark:text-foreground-dark whitespace-nowrap">
                          {item.label}
                        </span>
                      </motion.div>
                    );

                    return isButton ? (
                      <button
                        key={item.id}
                        onClick={item.onClick}
                        className="text-left"
                      >
                        {content}
                      </button>
                    ) : (
                      <a
                        key={item.id}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                      >
                        {content}
                      </a>
                    );
                  })}
                </div>
              </GlassSurface>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
