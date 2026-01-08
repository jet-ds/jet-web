import { Home, User, FileText, Briefcase, Mail, type LucideIcon } from 'lucide-react';

export const SITE = {
  title: 'Jet - Personal Website',
  description: 'Personal website and blog featuring research, projects, and writings.',
  author: 'Jet Sanchez',
  givenName: 'Jet',
  familyName: 'Sanchez',
  alternateNames: [
    'Josh Ethan Maupin Sanchez',
    'Josh Ethan Sanchez',
    'Jet (Josh Ethan) Sanchez',
  ],
  jobTitle: 'AI Researcher & Content Strategist',
  email: 'jetsanchezzz@gmail.com',
  siteUrl: 'https://jetsanchez.com',
} as const;

export const SOCIAL_LINKS = {
  github: 'https://github.com/jet-ds',
  linkedin: 'https://www.linkedin.com/in/jetsanchez/',
  ssrn: 'https://ssrn.com/author=7608771',
  scholar: 'https://scholar.google.com/citations?user=npRT5wwAAAAJ',
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
