import { visitParents } from 'unist-util-visit-parents';
import type { Root, RootContent } from 'mdast';

const COMMENT_RE = /^<!--[\s\S]*-->$/;

interface WithChildren {
  children: RootContent[];
}

function asParentWithChildren(node: unknown): WithChildren | undefined {
  if (typeof node !== 'object' || node === null) return undefined;
  const children = (node as { children?: unknown }).children;
  return Array.isArray(children) ? (node as WithChildren) : undefined;
}

/** Removes HTML comment nodes (editorial notes like `<!-- Тип: ... -->`) so they never render as visible text. */
export function stripHtmlComments(tree: Root): void {
  const removals: Array<{ parent: WithChildren; index: number }> = [];

  visitParents(tree, 'html', (node, ancestors) => {
    if (!COMMENT_RE.test(node.value.trim())) return;
    const parent = asParentWithChildren(ancestors[ancestors.length - 1]);
    if (!parent) return;
    const index = parent.children.indexOf(node);
    if (index !== -1) removals.push({ parent, index });
  });

  for (const { parent, index } of removals.reverse()) {
    parent.children.splice(index, 1);
  }
}
