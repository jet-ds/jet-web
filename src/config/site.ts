import { Home, User, FileText, Briefcase, Mail, type LucideIcon } from 'lucide-react';

export const SITE = {
  title: 'Jet - Personal Website',
  description: 'Personal website and blog featuring research, projects, and writings.',
  author: 'Jet',
  email: 'your.email@example.com', // TODO: Update with your actual email
  siteUrl: 'https://example.com', // TODO: Update with your actual domain
} as const;

export const SOCIAL_LINKS = {
  github: 'https://github.com/yourusername', // TODO: Update
  linkedin: 'https://linkedin.com/in/yourusername', // TODO: Update
  twitter: 'https://twitter.com/yourusername', // TODO: Update (optional)
  ssrn: 'https://ssrn.com/author=your-id', // TODO: Update with your SSRN author page
} as const;

export const NAV_ITEMS = [
  { id: 'home', label: 'Home', href: '/', icon: Home },
  { id: 'about', label: 'About', href: '/about', icon: User },
  { id: 'blog', label: 'Blog', href: '/blog', icon: FileText },
  { id: 'works', label: 'Works', href: '/works', icon: Briefcase },
  { id: 'contact', label: 'Contact', href: '/contact', icon: Mail },
] as const;

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};
