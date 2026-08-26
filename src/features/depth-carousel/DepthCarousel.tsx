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
  resolveHorizontalDragDelta,
  resolveRecededSelection,
  wrapIndex,
} from './carouselState';
import type { DepthCarouselProps } from './types';

const ENHANCEMENT_ATTRIBUTE = 'data-carousel-enhancement-active';
const DESKTOP_X = [0, 72, 132, 180] as const;
const DESKTOP_Y = [0, 10, 20, 30] as const;
const MOBILE_X = [0, 8, 16, 24] as const;
const MOBILE_Y = [0, 54, 108, 162] as const;
const DESKTOP_SCALE = [1, 0.94, 0.88, 0.82] as const;
const MOBILE_SCALE = [1, 0.96, 0.92, 0.88] as const;
const DESKTOP_ROTATE_Y = [0, -7, -11, -14] as const;
const MOBILE_ROTATE_Y = [0, -3, -5, -7] as const;
const CONNECTED_DRAG_X = [1, 0.34, 0.22, 0.14] as const;
const CONNECTED_DRAG_Y = [1, 0.4, 0.26, 0.16] as const;
const MAX_CROSS_AXIS_DRAG = 28;
const VERTICAL_INTENT_THRESHOLD = 12;
const VERTICAL_INTENT_RATIO = 1.25;
const HIDDEN_FORWARD_DEPTH = 4;
const MAX_VISIBLE_DEPTH = 3;

interface DragOffset {
  x: number;
  y: number;
}

function clampCrossAxis(offsetY: number): number {
  return Math.max(-MAX_CROSS_AXIS_DRAG, Math.min(MAX_CROSS_AXIS_DRAG, offsetY));
}

function getVisualDepth(
  itemIndex: number,
  activeIndex: number,
  itemCount: number,
): number {
  const forwardDepth = wrapIndex(itemIndex, -activeIndex, itemCount);
  if (forwardDepth <= MAX_VISIBLE_DEPTH) return forwardDepth;
  return HIDDEN_FORWARD_DEPTH;
}

function getLayerMotion(
  depth: number,
  desktopLayout: boolean,
  dragOffset: DragOffset,
) {
  if (depth === HIDDEN_FORWARD_DEPTH) {
    return {
      x: desktopLayout ? 228 : 32,
      y: desktopLayout ? 40 : 216,
      scale: desktopLayout ? 0.76 : 0.84,
      rotateY: desktopLayout ? -17 : -9,
      opacity: 0,
      filter: 'brightness(0.56) saturate(0.46) blur(1.6px)',
    };
  }

  const x = desktopLayout ? DESKTOP_X[depth] : MOBILE_X[depth];
  const y = desktopLayout ? DESKTOP_Y[depth] : MOBILE_Y[depth];
  const scale = desktopLayout ? DESKTOP_SCALE[depth] : MOBILE_SCALE[depth];
  const rotateY = desktopLayout
    ? DESKTOP_ROTATE_Y[depth]
    : MOBILE_ROTATE_Y[depth];
  return {
    x: x + dragOffset.x * CONNECTED_DRAG_X[depth],
    y: y + dragOffset.y * CONNECTED_DRAG_Y[depth],
    scale,
    rotateY,
    opacity: [1, 0.9, 0.76, 0.62][depth],
    filter: [
      'brightness(1) saturate(1) blur(0px)',
      'brightness(0.86) saturate(0.8) blur(0.4px)',
      'brightness(0.74) saturate(0.66) blur(0.8px)',
      'brightness(0.64) saturate(0.54) blur(1.2px)',
    ][depth],
  };
}

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
        draggable="false"
      />
      <img
        src={item.image.darkUrl}
        alt={alt}
        width={item.image.width}
        height={item.image.height}
        className={`hidden ${imageClass} dark:block`}
        loading={loading}
        decoding="async"
        draggable="false"
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
      draggable="false"
    />
  );
}

function getKindLabel(kind: DepthCarouselProps['items'][number]['kind']) {
  if (kind === 'research') return 'Research';
  if (kind === 'project') return 'Project';
  return 'Work';
}

function DepthCarouselStage({ label, items }: DepthCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLElement | null>(null);
  const dragOccurred = useRef(false);
  const verticalIntent = useRef(false);
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
    rootRef.current
      ?.querySelector<HTMLAnchorElement>('[data-carousel-active]')
      ?.focus();
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
      focusActiveAfterSelection.current =
        event.currentTarget.closest('[data-carousel-layer-item]') !== null;
      move(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusActiveAfterSelection.current =
        event.currentTarget.closest('[data-carousel-layer-item]') !== null;
      move(1);
    }
  };

  const handlePanEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    setDragOffset({ x: 0, y: 0 });
    const delta = verticalIntent.current
      ? 0
      : resolveHorizontalDragDelta(info.offset.x, info.velocity.x);
    verticalIntent.current = false;
    if (delta !== 0) move(delta);
    window.requestAnimationFrame(() => {
      dragOccurred.current = false;
    });
  };

  const isDragging = dragOffset.x !== 0 || dragOffset.y !== 0;

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
    >
      <div className="depth-carousel__layout">
        {itemCount > 1 && (
          <button
            type="button"
            className="action action--outline action--compact action--icon depth-carousel__control depth-carousel__control--previous"
            aria-label={`Previous ${label.toLocaleLowerCase()} item`}
            onKeyDown={handleKeyDown}
            onClick={() => move(-1)}
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
        )}

        <div className="depth-carousel__stage" data-carousel-stage>
          {items.map((item, itemIndex) => {
            const depth = getVisualDepth(itemIndex, activeIndex, itemCount);
            const visible = depth >= 0 && depth <= MAX_VISIBLE_DEPTH;
            const motionState = getLayerMotion(
              depth,
              desktopLayout,
              dragOffset,
            );
            const transition = reducedMotion
              ? { duration: 0 }
              : isDragging
                ? { duration: 0 }
                : { type: 'spring' as const, stiffness: 250, damping: 28 };

            return (
              <motion.div
                key={item.id}
                animate={motionState}
                aria-hidden={visible ? undefined : 'true'}
                className={`depth-carousel__layer${
                  depth === 0 ? ' depth-carousel__active' : ''
                }`}
                data-carousel-depth={depth}
                data-carousel-kind={depth === 0 ? item.kind : undefined}
                data-carousel-layer-item={item.id}
                data-carousel-visible={visible ? 'true' : undefined}
                inert={visible ? undefined : true}
                initial={false}
                style={{
                  pointerEvents: visible ? 'auto' : 'none',
                  zIndex: 10 - Math.min(depth, HIDDEN_FORWARD_DEPTH),
                }}
                transition={transition}
              >
                <motion.a
                  className={`depth-carousel__surface${
                    depth === 0 ? ' depth-carousel__active-surface' : ''
                  }`}
                  href={depth === 0 ? item.href : undefined}
                  aria-hidden={depth === 0 ? undefined : 'true'}
                  data-carousel-active={depth === 0 ? '' : undefined}
                  inert={depth === 0 ? undefined : true}
                  tabIndex={depth === 0 ? undefined : -1}
                  draggable={false}
                  onPanStart={() => {
                    if (depth !== 0) return;
                    dragOccurred.current = true;
                    verticalIntent.current = false;
                  }}
                  onPan={(_event, info) => {
                    if (depth !== 0) return;
                    const verticalDistance = Math.abs(info.offset.y);
                    const horizontalDistance = Math.abs(info.offset.x);
                    if (
                      verticalDistance > VERTICAL_INTENT_THRESHOLD &&
                      verticalDistance >
                        horizontalDistance * VERTICAL_INTENT_RATIO
                    ) {
                      verticalIntent.current = true;
                      setDragOffset({ x: 0, y: 0 });
                      return;
                    }
                    if (verticalIntent.current) return;
                    setDragOffset({
                      x: info.offset.x,
                      y: clampCrossAxis(info.offset.y),
                    });
                  }}
                  onPanEnd={(event, info) => {
                    if (depth === 0) handlePanEnd(event, info);
                  }}
                  onKeyDown={depth === 0 ? handleKeyDown : undefined}
                  onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
                    if (depth !== 0 || !dragOccurred.current) return;
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <ThemeImage
                    alt={depth === 0 ? item.image.alt : ''}
                    depth={depth}
                    item={item}
                  />
                  <motion.div
                    animate={{ opacity: depth === 0 ? 1 : 0 }}
                    aria-hidden={depth === 0 ? undefined : 'true'}
                    className="depth-carousel__overlay"
                    data-carousel-overlay
                    data-carousel-active-meta={depth === 0 ? '' : undefined}
                    initial={false}
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : { duration: 0.28, ease: 'easeOut' }
                    }
                  >
                    <div className="depth-carousel__content">
                      <div
                        className="depth-carousel__heading-group"
                        data-carousel-heading
                      >
                        {item.kind !== 'blog' && (
                          <p className="depth-carousel__eyebrow">
                            {getKindLabel(item.kind)}
                          </p>
                        )}
                        <h3 className="depth-carousel__title">{item.title}</h3>
                      </div>
                      <div className="depth-carousel__details-clip">
                        <div
                          className="depth-carousel__details"
                          data-carousel-details
                        >
                          <p
                            className="depth-carousel__summary"
                            data-carousel-summary
                          >
                            {item.summary}
                          </p>
                          <ul
                            className="depth-carousel__facts"
                            data-carousel-facts
                          >
                            {item.facts.map((fact, factIndex) => (
                              <li
                                key={fact}
                                data-carousel-touch-secondary={
                                  item.kind !== 'blog' && factIndex > 0
                                    ? ''
                                    : undefined
                                }
                              >
                                {fact}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.a>
                {visible && depth !== 0 && (
                  <button
                    className="depth-carousel__promotion"
                    type="button"
                    aria-label={`Bring item ${itemIndex + 1} of ${itemCount} forward`}
                    onKeyDown={handleKeyDown}
                    onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                      focusActiveAfterSelection.current = event.detail === 0;
                      setActiveIndex((current) =>
                        resolveRecededSelection(
                          current,
                          itemIndex,
                          itemCount,
                          false,
                        ),
                      );
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {itemCount > 1 && (
          <>
            <button
              type="button"
              className="action action--outline action--compact action--icon depth-carousel__control depth-carousel__control--next"
              aria-label={`Next ${label.toLocaleLowerCase()} item`}
              onKeyDown={handleKeyDown}
              onClick={() => move(1)}
            >
              <ChevronRight aria-hidden="true" size={20} />
            </button>
            <div
              className="depth-carousel__indicators"
              aria-label={`${label} positions`}
              data-carousel-indicators
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
          </>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        Item {activeIndex + 1} of {itemCount}
      </p>
    </div>
  );
}

function CarouselSentinel() {
  return (
    <div
      className="depth-carousel__sentinel"
      data-carousel-sentinel
      aria-hidden="true"
      inert
    />
  );
}

export default function DepthCarousel(props: DepthCarouselProps) {
  const [enhance, setEnhance] = useState(false);

  useEffect(() => {
    if (props.items.length > 0) setEnhance(true);
  }, [props.items.length]);

  if (!enhance) return <CarouselSentinel />;

  return (
    <CarouselBoundary>
      <DepthCarouselStage {...props} />
    </CarouselBoundary>
  );
}
