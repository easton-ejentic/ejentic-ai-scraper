"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

interface RevealProps {
  children: React.ReactNode;
  /** Stagger in milliseconds. */
  delay?: number;
  className?: string;
}

/**
 * Read the client-only capability once, during render, instead of setting
 * state inside an effect.
 *
 * The server snapshot assumes the observer *will* run so the server markup
 * matches the first client render - otherwise the content would paint
 * visible, flip to hidden on hydration and then fade back in. A `<noscript>`
 * rule in the marketing layout unhides everything if JS never arrives.
 */
function subscribeToNothing() {
  return () => undefined;
}
const canObserveOnClient = () => typeof IntersectionObserver !== "undefined";
const canObserveOnServer = () => true;

export function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const supported = useSyncExternalStore(
    subscribeToNothing,
    canObserveOnClient,
    canObserveOnServer,
  );

  useEffect(() => {
    if (!supported) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [supported]);

  const shown = !supported || visible;

  return (
    <div
      ref={ref}
      className={["mk-reveal", shown ? "is-visible" : "", className].filter(Boolean).join(" ")}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
