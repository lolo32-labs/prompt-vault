"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import MermaidBlock from "./MermaidBlock";

const components: Components = {
  // Unwrap the default <pre> wrapper so block-level renderers (syntax
  // highlighter / mermaid) control their own container.
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "");
    const language = match?.[1];
    const code = String(children).replace(/\n$/, "");

    if (language === "mermaid") {
      return <MermaidBlock chart={code} />;
    }

    if (match) {
      return (
        <div className="my-4 rounded-xl overflow-hidden border border-surface-800/50">
          <SyntaxHighlighter
            language={language}
            style={atomDark}
            PreTag="div"
            customStyle={{
              background: "transparent",
              margin: 0,
              fontSize: "0.8125rem",
              lineHeight: "1.7",
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );
    }

    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  a({ href, children, ...props }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export default function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}
