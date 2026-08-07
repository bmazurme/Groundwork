import { visitParents } from 'unist-util-visit-parents';
import type { Root, Element, Text } from 'hast';

function buildPattern(terms: string[]): RegExp | null {
  const escaped = terms
    .map((term) => term.trim())
    .filter((term) => term.length > 1)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return null;
  return new RegExp(`(${escaped.join('|')})`, 'gi');
}

/** Wraps query term matches in <mark>, skipping text inside code/pre so snippets stay copy-safe. */
export function highlightTerms(tree: Root, terms: string[]): void {
  const pattern = buildPattern(terms);
  if (!pattern) return;

  const replacements: Array<{ parent: Element; index: number; nodes: (Element | Text)[] }> = [];

  visitParents(tree, 'text', (node, ancestors) => {
    if (ancestors.some((a) => a.type === 'element' && (a.tagName === 'code' || a.tagName === 'pre'))) {
      return;
    }
    const parent = ancestors[ancestors.length - 1];
    if (!parent || parent.type !== 'element') return;

    if (!pattern.test(node.value)) return;
    pattern.lastIndex = 0;

    const parts = node.value.split(pattern);
    const nodes = parts
      .map((part, i): Text | Element =>
        i % 2 === 1
          ? { type: 'element', tagName: 'mark', properties: {}, children: [{ type: 'text', value: part }] }
          : { type: 'text', value: part },
      )
      .filter((n) => !(n.type === 'text' && n.value === ''));

    const index = parent.children.indexOf(node);
    if (index !== -1) replacements.push({ parent, index, nodes });
  });

  for (const { parent, index, nodes } of replacements.reverse()) {
    parent.children.splice(index, 1, ...nodes);
  }
}
