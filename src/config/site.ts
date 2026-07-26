import {
  Home,
  User,
  FileText,
  Briefcase,
  Ghost,
  Mail,
  type LucideIcon,
} from 'lucide-react';
import { EGREGORE_IDENTITY } from './egregore';

export const SITE = {
  title: 'Jet Sanchez',
  description:
    'Research, systems & tools for thinking clearly in an AI-driven world',
  author: 'Jet Sanchez',
  givenName: 'Jet',
  familyName: 'Sanchez',
  alternateNames: [
    'Josh Ethan Maupin Sanchez',
    'Josh Ethan Sanchez',
    'Jet (Josh Ethan) Sanchez',
  ],
  email: 'jetsanchezzz@gmail.com',
  siteUrl: 'https://jetsanchez.com',
  ga4MeasurementId: 'G-71J4JTMLJE',
  defaultOpenGraphImage: {
    path: '/images/og-default.jpg',
    url: 'https://jetsanchez.com/images/og-default.jpg',
    width: 1920,
    height: 1080,
    alt: "Jet Sanchez's homepage hero with a blue and mustard Grainient background",
    maxBytes: 2_000_000,
  },
} as const;

export const SOCIAL_LINKS = {
  github: 'https://github.com/jet-ds',
  linkedin: 'https://www.linkedin.com/in/jetsanchez/',
  ssrn: 'https://ssrn.com/author=7608771',
  scholar: 'https://scholar.google.com/citations?user=npRT5wwAAAAJ',
} as const;

export const NAV_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    icon: Home,
    gradient: 'from-blue-600 to-blue-400',
  },
  {
    id: 'about',
    label: 'About',
    href: '/about/',
    icon: User,
    gradient: 'from-purple-600 to-purple-400',
  },
  {
    id: 'blog',
    label: 'Blog',
    href: '/blog/',
    icon: FileText,
    gradient: 'from-green-600 to-green-400',
  },
  {
    id: 'works',
    label: 'Works',
    href: '/works/',
    icon: Briefcase,
    gradient: 'from-orange-600 to-orange-400',
  },
  {
    id: 'egregore',
    label: EGREGORE_IDENTITY.name,
    href: EGREGORE_IDENTITY.canonicalPath,
    icon: Ghost,
    gradient: 'from-indigo-600 to-indigo-400',
  },
  {
    id: 'contact',
    label: 'Contact',
    href: '/contact/',
    icon: Mail,
    gradient: 'from-red-600 to-red-400',
  },
] as const;

export function isActiveNavItem(currentPath: string, href: string): boolean {
  const normalizePath = (path: string): string => {
    const withoutTrailingSlashes = path.replace(/\/+$/u, '');
    return withoutTrailingSlashes === '' ? '/' : `${withoutTrailingSlashes}/`;
  };
  const normalizedCurrentPath = normalizePath(currentPath);
  const normalizedHref = normalizePath(href);

  return (
    normalizedCurrentPath === normalizedHref ||
    (normalizedHref !== '/' && normalizedCurrentPath.startsWith(normalizedHref))
  );
}

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  gradient: string;
};
