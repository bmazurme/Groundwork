import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { Element, Root } from 'hast';
import { MermaidDiagram } from './MermaidDiagram';
import { highlightTerms } from './highlight-terms';
import { stripHtmlComments } from './strip-html-comments';
import './MarkdownContent.css';

const remarkPlugins = [() => stripHtmlComments];

function mermaidCodeNode(node: Element | undefined): Element | undefined {
  const codeNode = node?.children?.[0];
  if (!codeNode || codeNode.type !== 'element' || codeNode.tagName !== 'code') return undefined;
  const className = codeNode.properties?.className;
  const classes = Array.isArray(className) ? className : [];
  return classes.includes('language-mermaid') ? codeNode : undefined;
}

function textContent(node: Element): string {
  const textNode = node.children?.[0];
  return textNode && textNode.type === 'text' ? textNode.value : '';
}

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  pre: ({ node, children }) => {
    const codeNode = mermaidCodeNode(node);
    return codeNode ? <MermaidDiagram code={textContent(codeNode)} /> : <pre>{children}</pre>;
  },
};

export function MarkdownContent({
  content,
  highlightTerms: terms,
}: {
  content: string;
  highlightTerms?: string[];
}) {
  const rehypePlugins = useMemo(
    () => (terms && terms.length > 0 ? [() => (tree: Root) => highlightTerms(tree, terms)] : []),
    [terms],
  );

  return (
    <div className="markdown-content">
      <ReactMarkdown components={components} remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
