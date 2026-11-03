import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Icon from "./icons";

const MIN_SCALE = 0.35;
const MAX_SCALE = 1.8;
const PAD = 40;
/** Never auto-fit smaller than this — below it the cards stop being readable.
 *  A phone needs larger text than a desktop monitor, so the floor depends on width. */
const minFit = (viewportWidth: number) => (viewportWidth >= 768 ? 0.42 : 0.6);

const clamp = (n: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));

interface Props {
  /** Natural (scale 1) size of the content, in px. */
  contentWidth: number;
  contentHeight: number;
  /** A point (in content px) to bring to the middle of the view when it resets. */
  focusX: number;
  focusY: number;
  /** Changing this re-fits and re-centres (e.g. a different root person). */
  resetKey: string;
  children: ReactNode;
}

/**
 * Scrollable, zoomable stage for the family tree.
 *
 *  - Pan: native scrolling (touch drags and trackpads just work), plus
 *    click-and-drag with a mouse.
 *  - Zoom: the +/- buttons, `+` `-` `0` keys, Ctrl/⌘ + wheel, and two-finger
 *    pinch. Zoom is anchored on the gesture point so content doesn't slide away.
 *
 * Scaling is a CSS transform on a wrapper sized to the scaled content, so the
 * tree's own absolute layout is untouched.
 */
export default function PanZoomCanvas({
  contentWidth,
  contentHeight,
  focusX,
  focusY,
  resetKey,
  children,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Sets a new scale, keeping the content point under (ax, ay) fixed on screen. */
  const zoomTo = useCallback((next: number, ax?: number, ay?: number) => {
    const el = scroller.current;
    const target = clamp(next);
    if (!el || target === scaleRef.current) return;
    const anchorX = ax ?? el.clientWidth / 2;
    const anchorY = ay ?? el.clientHeight / 2;
    const ratio = target / scaleRef.current;
    pendingScroll.current = {
      left: (el.scrollLeft + anchorX) * ratio - anchorX,
      top: (el.scrollTop + anchorY) * ratio - anchorY,
    };
    scaleRef.current = target;
    setScale(target);
  }, []);

  const centreOnFocus = useCallback(
    (s: number) => {
      const el = scroller.current;
      if (!el) return;
      el.scrollLeft = PAD + focusX * s - el.clientWidth / 2;
      el.scrollTop = PAD + focusY * s - el.clientHeight / 2;
    },
    [focusX, focusY],
  );

  const fit = useCallback(() => {
    const el = scroller.current;
    // No layout (e.g. a test DOM): leave the natural size alone.
    if (!el || el.clientWidth === 0) return;
    const s = clamp(
      Math.min(
        (el.clientWidth - PAD) / contentWidth,
        (el.clientHeight - PAD) / contentHeight,
        1,
      ),
    );
    scaleRef.current = s;
    pendingScroll.current = null;
    setScale(s);
    requestAnimationFrame(() => centreOnFocus(s));
  }, [contentWidth, contentHeight, centreOnFocus]);

  // Start each person's tree readable (never below MIN_FIT) and centred on them.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    const s = clamp(Math.max(minFit(el.clientWidth), Math.min(1, (el.clientWidth - PAD) / contentWidth)));
    scaleRef.current = s;
    pendingScroll.current = null;
    setScale(s);
    // Scroll size only reflects the new scale after this render commits.
    requestAnimationFrame(() => centreOnFocus(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only for a new person / new content size
  }, [resetKey, contentWidth, contentHeight]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pendingScroll.current) {
      el.scrollLeft = pendingScroll.current.left;
      el.scrollTop = pendingScroll.current.top;
      pendingScroll.current = null;
    }
  }, [scale]);

  // Wheel + pinch need non-passive listeners so the page doesn't zoom/scroll too.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomTo(scaleRef.current * Math.exp(-e.deltaY * 0.002), e.clientX - rect.left, e.clientY - rect.top);
    };

    let pinch: { dist: number; scale: number } | null = null;
    const distance = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);

    const onTouchStart = (e: TouchEvent) => {
      pinch = e.touches.length === 2 ? { dist: distance(e.touches), scale: scaleRef.current } : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 - rect.left;
      const my = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 - rect.top;
      zoomTo(pinch.scale * (distance(e.touches) / pinch.dist), mx, my);
    };
    const onTouchEnd = () => {
      pinch = null;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [zoomTo]);

  function onPointerDown(e: React.PointerEvent) {
    const el = scroller.current;
    if (!el || e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const el = scroller.current;
    const d = drag.current;
    if (!el || !d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      setDragging(true);
    }
    if (d.moved) {
      el.scrollLeft = d.left - dx;
      el.scrollTop = d.top - dy;
    }
  }

  function endDrag() {
    setDragging(false);
    // Keep `moved` readable for the click that follows the mouseup, then clear it.
    setTimeout(() => {
      drag.current = null;
    }, 0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "+" || e.key === "=") zoomTo(scaleRef.current * 1.2);
    else if (e.key === "-") zoomTo(scaleRef.current / 1.2);
    else if (e.key === "0") fit();
  }

  const controlClass =
    "inline-flex size-10 cursor-pointer items-center justify-center text-ctp-subtext1 transition " +
    "hover:bg-ctp-surface0 hover:text-ctp-text active:bg-ctp-surface1 disabled:opacity-40 pointer-coarse:size-12";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ctp-surface0 bg-ctp-mantle shadow-card">
      <div
        ref={scroller}
        role="region"
        aria-label="Family tree — drag to pan, pinch or use the buttons to zoom"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={(e) => {
          // A drag that ends over a card must not also open that person's profile.
          if (drag.current?.moved) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        style={{ touchAction: "pan-x pan-y" }}
        className={
          "max-h-[calc(100dvh-15rem)] min-h-[22rem] overflow-auto overscroll-contain outline-none sm:max-h-[calc(100dvh-14rem)] " +
          "bg-[radial-gradient(color-mix(in_oklab,var(--ctp-overlay0)_28%,transparent)_1px,transparent_1px)] " +
          "bg-size-[22px_22px] " +
          (dragging ? "cursor-grabbing select-none" : "cursor-grab")
        }
      >
        <div
          className="relative"
          style={{ width: contentWidth * scale + PAD * 2, height: contentHeight * scale + PAD * 2 }}
        >
          <div
            className="absolute"
            style={{
              left: PAD,
              top: PAD,
              width: contentWidth,
              height: contentHeight,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            {children}
          </div>
        </div>
      </div>

      <div
        className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-xl border border-ctp-surface1
                   bg-ctp-mantle/95 shadow-pop backdrop-blur"
        role="group"
        aria-label="Zoom controls"
      >
        <button className={controlClass} onClick={() => zoomTo(scaleRef.current * 1.25)} aria-label="Zoom in" disabled={scale >= MAX_SCALE}>
          <Icon name="zoomIn" className="size-5" />
        </button>
        <button className={`${controlClass} border-y border-ctp-surface0`} onClick={() => zoomTo(scaleRef.current / 1.25)} aria-label="Zoom out" disabled={scale <= MIN_SCALE}>
          <Icon name="zoomOut" className="size-5" />
        </button>
        <button className={controlClass} onClick={fit} aria-label="Fit the whole tree" title="Fit the whole tree">
          <Icon name="maximize" className="size-5" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-ctp-mantle/90 px-2.5 py-1 text-xs font-semibold text-ctp-subtext1 shadow-sm backdrop-blur">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
