import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  pageKey: string;
  children: ReactNode;
}

type Phase = "enter" | "exit" | "idle";

export function GlassPageTransition({ pageKey, children }: Props) {
  const [phase, setPhase] = useState<Phase>("enter");
  const [renderedKey, setRenderedKey] = useState(pageKey);
  const [content, setContent] = useState(children);
  const pendingRef = useRef<{ key: string; node: ReactNode } | null>(null);

  useEffect(() => {
    if (pageKey === renderedKey) {
      setContent(children);
      return;
    }
    pendingRef.current = { key: pageKey, node: children };
    setPhase("exit");
  }, [children, pageKey, renderedKey]);

  const handleAnimationEnd = () => {
    if (phase === "exit" && pendingRef.current) {
      const next = pendingRef.current;
      pendingRef.current = null;
      setRenderedKey(next.key);
      setContent(next.node);
      setPhase("enter");
      return;
    }
    if (phase === "enter") {
      setPhase("idle");
    }
  };

  return (
    <div
      className={`page-view page-glass-${phase}`}
      onAnimationEnd={handleAnimationEnd}
      data-page-key={renderedKey}
    >
      {content}
    </div>
  );
}
