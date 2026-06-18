import { useEffect, useRef, type ReactNode } from "react";
import { isAppVisible, onAppVisibilityChange } from "../appVisibility";
import { useInterfacePrefs } from "./InterfacePrefsProvider";

const GLASS_SELECTOR = ".card, .stat-box, .liquid-glass, .glass-panel";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return current + diff * t;
}

export function LiquidGlassProvider({ children }: { children: ReactNode }) {
  const { prefs } = useInterfacePrefs();
  const rafRef = useRef(0);
  const cursorRef = useRef({ x: 0, y: 0 });
  const lightRef = useRef({ angle: 0, intensity: 0.5 });
  const activeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (prefs.performanceMode) return;

    let running = isAppVisible();

    const tick = () => {
      if (!running) return;
      const active = activeRef.current;
      if (active) {
        const w = active.clientWidth || 1;
        const h = active.clientHeight || 1;
        const cx = w / 2;
        const cy = h / 2;
        const x = cursorRef.current.x;
        const y = cursorRef.current.y;

        const targetAngle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
        lightRef.current.angle = lerpAngle(lightRef.current.angle, targetAngle, 0.1);

        const dist = Math.hypot(x - cx, y - cy);
        const maxDist = Math.hypot(cx, cy) || 1;
        const edgeFactor = Math.min(1, dist / maxDist);
        const targetIntensity = 0.45 + edgeFactor * 0.55;

        lightRef.current.intensity = lerp(lightRef.current.intensity, targetIntensity, 0.1);

        active.style.setProperty("--light-angle", `${lightRef.current.angle}deg`);
        active.style.setProperty("--light-intensity", String(lightRef.current.intensity));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (!running) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      if (activeRef.current) {
        activeRef.current.removeAttribute("data-lens-active");
        activeRef.current = null;
      }
    };

    const setActive = (el: HTMLElement | null) => {
      if (!running) return;
      if (activeRef.current === el) return;
      if (activeRef.current) {
        activeRef.current.removeAttribute("data-lens-active");
      }
      activeRef.current = el;
      if (el) {
        el.setAttribute("data-lens-active", "");
        lightRef.current.intensity = 0.35;
      }
    };

    const updateCursor = (el: HTMLElement, clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      cursorRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const findGlassAt = (clientX: number, clientY: number): HTMLElement | null => {
      const direct = document.elementFromPoint(clientX, clientY);
      const onGlass = direct?.closest(GLASS_SELECTOR) as HTMLElement | null;
      if (onGlass) return onGlass;

      let nearest: HTMLElement | null = null;
      let minDist = Infinity;
      document.querySelectorAll<HTMLElement>(GLASS_SELECTOR).forEach((el) => {
        const r = el.getBoundingClientRect();
        const dx =
          clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0;
        const dy =
          clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
        const dist = Math.hypot(dx, dy);
        if (dist < 140 && dist < minDist) {
          minDist = dist;
          nearest = el;
        }
      });
      return nearest;
    };

    const onMove = (e: MouseEvent) => {
      if (!running) return;
      const el = findGlassAt(e.clientX, e.clientY);
      setActive(el);
      if (el) {
        updateCursor(el, e.clientX, e.clientY);
      }
    };

    const onLeave = () => setActive(null);

    const resume = () => {
      running = true;
      startLoop();
    };

    if (isAppVisible()) {
      resume();
    }

    const unsubVisibility = onAppVisibilityChange((visible) => {
      if (visible) resume();
      else stopLoop();
    });

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);

    return () => {
      unsubVisibility();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      stopLoop();
    };
  }, [prefs.performanceMode]);

  return <>{children}</>;
}
