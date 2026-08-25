const ARTICLE_SELECTOR = '[data-article-toc-content]';
const NAVIGATION_SELECTOR = '[data-article-toc]';
const LINK_SELECTOR = 'a[href^="#"]';
const TOGGLE_SELECTOR = '[data-article-toc-toggle]';
const PANEL_SELECTOR = '[data-article-toc-panel]';
const CURRENT_SELECTOR = '[data-article-toc-current]';
const NAVIGATION_DISCLOSURE_SELECTOR = '[aria-controls="site-navigation-dock"]';

interface ControllerState {
  cleanup: () => void;
}

const installedControllers = new WeakMap<Document, ControllerState>();

function fragmentId(link: HTMLAnchorElement): string | null {
  const hash = link.getAttribute('href');
  if (hash === null || !hash.startsWith('#') || hash.length === 1) return null;

  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}

function setDisclosure(
  toggle: HTMLButtonElement,
  panel: HTMLElement,
  expanded: boolean,
) {
  toggle.setAttribute('aria-expanded', String(expanded));
  panel.hidden = !expanded;
  panel.style.removeProperty('max-height');

  if (!expanded) return;
  const dockDisclosure = panel.ownerDocument.querySelector<HTMLElement>(
    NAVIGATION_DISCLOSURE_SELECTOR,
  );
  if (dockDisclosure === null) return;

  const availableHeight =
    dockDisclosure.getBoundingClientRect().top -
    panel.getBoundingClientRect().top;
  if (availableHeight > 0)
    panel.style.maxHeight = `${Math.floor(availableHeight)}px`;
}

function focusHeading(heading: HTMLElement): () => void {
  const hadTabIndex = heading.hasAttribute('tabindex');
  const tabIndex = heading.getAttribute('tabindex');
  if (!hadTabIndex) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });

  const restore = () => {
    heading.removeEventListener('blur', restore);
    if (hadTabIndex) {
      if (tabIndex !== null) heading.setAttribute('tabindex', tabIndex);
    } else {
      heading.removeAttribute('tabindex');
    }
  };
  heading.addEventListener('blur', restore, { once: true });
  return restore;
}

function initializeArticleToc(document: Document): () => void {
  const article = document.querySelector<HTMLElement>(ARTICLE_SELECTOR);
  if (article === null) return () => undefined;

  const navigations = [
    ...document.querySelectorAll<HTMLElement>(NAVIGATION_SELECTOR),
  ];
  const links = navigations.flatMap((navigation) => [
    ...navigation.querySelectorAll<HTMLAnchorElement>(LINK_SELECTOR),
  ]);
  const representedIds = new Set(
    links.map(fragmentId).filter((id): id is string => id !== null),
  );
  const headings = [
    ...article.querySelectorAll<HTMLElement>('h2[id], h3[id]'),
  ].filter((heading) => representedIds.has(heading.id));

  if (headings.length === 0) return () => undefined;

  const linksById = new Map<string, HTMLAnchorElement[]>();
  for (const link of links) {
    const id = fragmentId(link);
    if (id === null || !representedIds.has(id)) continue;
    const sameHeadingLinks = linksById.get(id) ?? [];
    sameHeadingLinks.push(link);
    linksById.set(id, sameHeadingLinks);
  }

  const currentLabels = navigations.flatMap((navigation) => [
    ...navigation.querySelectorAll<HTMLElement>(CURRENT_SELECTOR),
  ]);
  const setActiveHeading = (id: string) => {
    for (const [candidateId, headingLinks] of linksById) {
      const active = candidateId === id;
      for (const link of headingLinks) {
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }

    const label = linksById.get(id)?.[0]?.textContent?.trim();
    if (label !== undefined && label.length > 0) {
      for (const currentLabel of currentLabels)
        currentLabel.textContent = label;
    }
  };

  const activeHeadingAtReadingPosition = () => {
    const readingLine = window.innerHeight * 0.3;
    return (
      [...headings]
        .reverse()
        .find(
          (heading) => heading.getBoundingClientRect().top <= readingLine,
        ) ?? headings[0]
    );
  };

  const updateActiveHeading = () =>
    setActiveHeading(activeHeadingAtReadingPosition().id);

  const observer = new IntersectionObserver(updateActiveHeading, {
    threshold: 0,
  });
  for (const heading of headings) observer.observe(heading);
  updateActiveHeading();

  window.addEventListener('scroll', updateActiveHeading, { passive: true });
  window.addEventListener('resize', updateActiveHeading);
  const cleanups: Array<() => void> = [
    () => observer.disconnect(),
    () => window.removeEventListener('scroll', updateActiveHeading),
    () => window.removeEventListener('resize', updateActiveHeading),
  ];
  for (const navigation of navigations) {
    const toggle = navigation.querySelector<HTMLButtonElement>(TOGGLE_SELECTOR);
    const controls = toggle?.getAttribute('aria-controls');
    const panel = controls
      ? document.getElementById(controls)
      : navigation.querySelector<HTMLElement>(PANEL_SELECTOR);
    if (toggle !== null && toggle !== undefined && panel !== null) {
      const onToggle = () =>
        setDisclosure(
          toggle,
          panel,
          toggle.getAttribute('aria-expanded') !== 'true',
        );
      toggle.addEventListener('click', onToggle);
      cleanups.push(() => toggle.removeEventListener('click', onToggle));

      for (const link of navigation.querySelectorAll<HTMLAnchorElement>(
        LINK_SELECTOR,
      )) {
        const onSelection = () => {
          setDisclosure(toggle, panel, false);
          const id = fragmentId(link);
          const heading = id === null ? null : document.getElementById(id);
          if (heading instanceof HTMLElement)
            cleanups.push(focusHeading(heading));
        };
        link.addEventListener('click', onSelection);
        cleanups.push(() => link.removeEventListener('click', onSelection));
      }
    }
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

/**
 * Installs the article navigation lifecycle once for the current document.
 * Astro view transitions re-run it on `astro:page-load`; each re-run clears
 * the previous observer and interaction handlers before observing new content.
 */
export function installArticleTocController(document: Document): () => void {
  installedControllers.get(document)?.cleanup();

  let cleanupCurrent = initializeArticleToc(document);
  const onPageLoad = () => {
    cleanupCurrent();
    cleanupCurrent = initializeArticleToc(document);
  };
  document.addEventListener('astro:page-load', onPageLoad);

  const cleanup = () => {
    if (installedControllers.get(document)?.cleanup !== cleanup) return;
    document.removeEventListener('astro:page-load', onPageLoad);
    cleanupCurrent();
    installedControllers.delete(document);
  };
  installedControllers.set(document, { cleanup });
  return cleanup;
}
