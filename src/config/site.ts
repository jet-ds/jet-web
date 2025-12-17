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
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Works', href: '/works' },
  { label: 'Contact', href: '/contact' },
] as const;
