import {
  Component,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, type PanInfo } from 'framer-motion';
import {
  getRecededIndices,
  resolveDragDelta,
  resolveRecededSelection,
  wrapIndex,
} from './carouselState';
import type { DepthCarouselProps } from './types';

const ENHANCEMENT_ATTRIBUTE = 'data-carousel-enhancement-active';

function findFallback(element: Element | null): HTMLElement | null {
  const owner = element?.closest('[data-home-collection-carousel]');
  const fallback = owner?.querySelector('[data-carousel-fallback]');
  return fallback instanceof HTMLElement ? fallback : null;
}

function findFocusedFallbackIndex(
  fallback: HTMLElement | null,
  items: DepthCarouselProps['items'],
): number | null {
  const focused = document.activeElement;
  if (
    fallback === null ||
    !(focused instanceof HTMLElement) ||
    !fallback.contains(focused)
  ) {
    return null;
  }

  const destination = focused.closest('a[href]');
  if (!(destination instanceof HTMLAnchorElement)) return null;
  const href = destination.getAttribute('href');
  const index = items.findIndex((item) => item.href === href);
  return index >= 0 ? index : null;
}

function concealFallback(fallback: HTMLElement | null): void {
  if (fallback === null) return;
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && fallback.contains(focused)) {
    focused.blur();
  }
  fallback.setAttribute(ENHANCEMENT_ATTRIBUTE, '');
  fallback.hidden = true;
  fallback.setAttribute('inert', '');
  fallback.setAttribute('aria-hidden', 'true');
}

function restoreFallback(fallback: HTMLElement | null): void {
  if (fallback === null || !fallback.hasAttribute(ENHANCEMENT_ATTRIBUTE)) {
    return;
  }
  fallback.hidden = false;
  fallback.removeAttribute('inert');
  fallback.removeAttribute('aria-hidden');
  fallback.removeAttribute(ENHANCEMENT_ATTRIBUTE);
}

function restoreFallbackFrom(element: Element | null): void {
  restoreFallback(findFallback(element));
}

function useMediaQuery(queryText: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(queryText).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(queryText);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    setMatches(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [queryText]);

  return matches;
}

interface CarouselBoundaryProps {
  children: ReactNode;
}

interface CarouselBoundaryState {
  failed: boolean;
}

class CarouselBoundary extends Component<
  CarouselBoundaryProps,
  CarouselBoundaryState
> {
  state: CarouselBoundaryState = { failed: false };
  private root: HTMLDivElement | null = null;

  static getDerivedStateFromError(): CarouselBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    restoreFallbackFrom(this.root);
  }

  componentWillUnmount(): void {
    restoreFallbackFrom(this.root);
  }

  render() {
    return (
      <div
        ref={(element) => {
          this.root = element;
        }}
        data-depth-carousel-boundary
      >
        {this.state.failed ? null : this.props.children}
      </div>
    );
  }
}

function ThemeImage({
  alt,
  depth,
  item,
}: {
  alt: string;
  depth: number;
  item: DepthCarouselProps['items'][number];
}) {
  const imageClass = 'depth-carousel__image';
  const loading = depth === 0 ? 'eager' : 'lazy';
  return item.image.darkUrl ? (
    <>
      <img
        src={item.image.url}
        alt={alt}
        width={item.image.width}
        height={item.image.height}
        className={`${imageClass} dark:hidden`}
        loading={loading}
        decoding="async"
      />
      <img
        src={item.image.darkUrl}
        alt={alt}
        width={item.image.width}
        height={item.image.height}
        className={`hidden ${imageClass} dark:block`}
        loading={loading}
        decoding="async"
      />
    </>
  ) : (
    <img
      src={item.image.url}
      alt={alt}
      width={item.image.width}
      height={item.image.height}
      className={imageClass}
      loading={loading}
      decoding="async"
    />
  );
}

function DepthCarouselStage({ label, items }: DepthCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeLinkRef = useRef<HTMLAnchorElement>(null);
  const fallbackRef = useRef<HTMLElement | null>(null);
  const dragOccurred = useRef(false);
  const focusActiveAfterSelection = useRef(false);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const desktopLayout = useMediaQuery('(min-width: 48rem)');
  const itemCount = items.length;

  useLayoutEffect(() => {
    fallbackRef.current = findFallback(rootRef.current);
    const focusedFallbackIndex = findFocusedFallbackIndex(
      fallbackRef.current,
      items,
    );
    if (focusedFallbackIndex !== null) {
      focusActiveAfterSelection.current = true;
      setActiveIndex(focusedFallbackIndex);
    }
    concealFallback(fallbackRef.current);
    setReady(true);
    return () => restoreFallback(fallbackRef.current);
  }, [items]);

  useLayoutEffect(() => {
    if (!ready || !focusActiveAfterSelection.current) return;
    focusActiveAfterSelection.current = false;
    activeLinkRef.current?.focus();
  }, [activeIndex, ready]);

  const move = useCallback(
    (delta: number) => {
      setActiveIndex((current) => wrapIndex(current, delta, itemCount));
    },
    [itemCount],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const nextIndex = wrapIndex(activeIndex, -1, itemCount);
      focusActiveAfterSelection.current =
        event.currentTarget.getAttribute('data-carousel-layer-item') ===
        items[nextIndex]?.id;
      move(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextIndex = wrapIndex(activeIndex, 1, itemCount);
      focusActiveAfterSelection.current =
        event.currentTarget.getAttribute('data-carousel-layer-item') ===
        items[nextIndex]?.id;
      move(1);
    }
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const delta = resolveDragDelta(info.offset.x, info.offset.y);
    if (delta !== 0) move(delta);
    window.requestAnimationFrame(() => {
      dragOccurred.current = false;
    });
  };

  const recededIndices = getRecededIndices(activeIndex, itemCount, 3);
  const layerIndices = [activeIndex, ...recededIndices];
  const activeItem = items[activeIndex];

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={label}
      aria-hidden={ready ? undefined : 'true'}
      inert={ready ? undefined : true}
      hidden={!ready}
      className="depth-carousel"
      data-depth-carousel
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      <motion.div
        className="depth-carousel__stage"
        data-carousel-stage
        drag={itemCount > 1 ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.14}
        dragMomentum={false}
        onDragStart={() => {
          dragOccurred.current = true;
        }}
        onDragEnd={handleDragEnd}
      >
        {layerIndices.map((itemIndex, depth) => {
          const item = items[itemIndex];
          const x = desktopLayout
            ? [0, 46, 84, 116][depth]
            : [0, 8, 16, 24][depth];
          const y = desktopLayout
            ? [0, 12, 22, 32][depth]
            : [0, 54, 108, 162][depth];
          const scale = desktopLayout
            ? [1, 0.94, 0.88, 0.82][depth]
            : [1, 0.96, 0.92, 0.88][depth];
          const rotateY = desktopLayout
            ? [0, -6, -10, -13][depth]
            : [0, -3, -5, -7][depth];
          const motionState = {
            x,
            y,
            scale,
            rotateY,
            opacity: [1, 0.9, 0.76, 0.62][depth],
            filter: [
              'brightness(1) saturate(1) blur(0px)',
              'brightness(0.88) saturate(0.82) blur(0.4px)',
              'brightness(0.76) saturate(0.68) blur(0.8px)',
              'brightness(0.66) saturate(0.56) blur(1.2px)',
            ][depth],
          };
          const transition = reducedMotion
            ? { duration: 0 }
            : { type: 'spring' as const, stiffness: 240, damping: 28 };
          const shared = {
            animate: motionState,
            className: 'depth-carousel__layer',
            'data-carousel-depth': depth,
            'data-carousel-layer-item': item.id,
            initial: false as const,
            style: { zIndex: 10 - depth },
            transition,
          };

          if (depth === 0) {
            return (
              <motion.div key={item.id} {...shared}>
                <ThemeImage alt={item.image.alt} depth={depth} item={item} />
              </motion.div>
            );
          }

          return (
            <motion.button
              key={item.id}
              {...shared}
              type="button"
              aria-label={`Bring item ${itemIndex + 1} of ${itemCount} forward`}
              onKeyDown={handleKeyDown}
              onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                const wasDrag = dragOccurred.current;
                focusActiveAfterSelection.current =
                  !wasDrag && event.detail === 0;
                setActiveIndex((current) =>
                  resolveRecededSelection(
                    current,
                    itemIndex,
                    itemCount,
                    wasDrag,
                  ),
                );
                dragOccurred.current = false;
              }}
            >
              <ThemeImage alt="" depth={depth} item={item} />
            </motion.button>
          );
        })}
      </motion.div>

      <div className="depth-carousel__companion">
        {activeItem.kind !== 'blog' && (
          <p className="depth-carousel__eyebrow">
            {activeItem.kind === 'research'
              ? 'Research'
              : activeItem.kind === 'project'
                ? 'Project'
                : 'Work'}
          </p>
        )}
        <h3 className="depth-carousel__title">
          <a
            ref={activeLinkRef}
            href={activeItem.href}
            onKeyDown={handleKeyDown}
          >
            {activeItem.title}
          </a>
        </h3>
        <p className="depth-carousel__summary">{activeItem.summary}</p>
        <ul className="depth-carousel__facts">
          {activeItem.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="depth-carousel__position"
      >
        Item {activeIndex + 1} of {itemCount}
      </p>

      {itemCount > 1 && (
        <div className="depth-carousel__navigation">
          <div className="depth-carousel__control-row">
            <button
              type="button"
              className="action action--outline action--compact action--icon depth-carousel__control"
              aria-label={`Previous ${label.toLocaleLowerCase()} item`}
              onKeyDown={handleKeyDown}
              onClick={() => move(-1)}
            >
              <ChevronLeft aria-hidden="true" size={20} />
            </button>
            <button
              type="button"
              className="action action--outline action--compact action--icon depth-carousel__control"
              aria-label={`Next ${label.toLocaleLowerCase()} item`}
              onKeyDown={handleKeyDown}
              onClick={() => move(1)}
            >
              <ChevronRight aria-hidden="true" size={20} />
            </button>
          </div>
          <div
            className="depth-carousel__indicators"
            aria-label={`${label} positions`}
          >
            {items.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                className="depth-carousel__indicator"
                aria-label={`Go to item ${itemIndex + 1} of ${itemCount}`}
                aria-current={itemIndex === activeIndex ? 'step' : undefined}
                onKeyDown={handleKeyDown}
                onClick={() => setActiveIndex(itemIndex)}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DepthCarousel(props: DepthCarouselProps) {
  if (props.items.length === 0) return null;
  return (
    <CarouselBoundary>
      <DepthCarouselStage {...props} />
    </CarouselBoundary>
  );
}
