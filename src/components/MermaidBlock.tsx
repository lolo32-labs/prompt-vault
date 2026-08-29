"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidBlockProps {
  chart: string;
}

export default function MermaidBlock({ chart }: MermaidBlockProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const prefixRef = useRef(`mmd-${Math.random().toString(36).slice(2, 8)}`);
  const counterRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setSvg("");
    setError(null);

    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
        });
        const id = `${prefixRef.current}-${counterRef.current++}`;
        const { svg: rendered } = await mermaid.render(id, chart);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <pre className="text-rose-400 text-xs font-mono p-4 whitespace-pre-wrap my-4 rounded-lg bg-rose-500/5 border border-rose-500/20">
        {error}
      </pre>
    );
  }

  return (
    <div
      className="mermaid-block overflow-x-auto my-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
