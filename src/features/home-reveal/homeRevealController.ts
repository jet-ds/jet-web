const SCOPE_SELECTOR = '[data-home-reveal-scope]';
const TARGET_SELECTOR = '[data-home-reveal]';
const STATE_ATTRIBUTE = 'data-home-reveal-state';

interface ControllerState {
  cleanup: () => void;
}

const installedControllers = new WeakMap<Document, ControllerState>();

function setRevealed(target: HTMLElement) {
  target.setAttribute(STATE_ATTRIBUTE, 'revealed');
}

function initializeHomeReveal(document: Document): () => void {
  const scope = document.querySelector<HTMLElement>(SCOPE_SELECTOR);
  if (scope === null) return () => undefined;

  const targets = [...scope.querySelectorAll<HTMLElement>(TARGET_SELECTOR)];
  if (targets.length === 0) return () => undefined;

  const view = document.defaultView;
  const reducedMotion =
    view?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? true;
  if (reducedMotion || view === null || !('IntersectionObserver' in view)) {
    for (const target of targets) setRevealed(target);
    return () => undefined;
  }

  const observer = new view.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement))
          continue;
        setRevealed(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -10%', threshold: 0.12 },
  );

  for (const target of targets) {
    if (target.getAttribute(STATE_ATTRIBUTE) === 'revealed') continue;
    if (target.getBoundingClientRect().top < view.innerHeight) {
      setRevealed(target);
      continue;
    }
    target.setAttribute(STATE_ATTRIBUTE, 'pending');
    observer.observe(target);
  }

  return () => observer.disconnect();
}

/**
 * Installs the Homepage reveal lifecycle once per document. Astro ClientRouter
 * page loads replace the observer before initializing targets on the new page.
 */
export function installHomeRevealController(document: Document): () => void {
  installedControllers.get(document)?.cleanup();

  let cleanupCurrent = initializeHomeReveal(document);
  const onPageLoad = () => {
    cleanupCurrent();
    cleanupCurrent = initializeHomeReveal(document);
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
