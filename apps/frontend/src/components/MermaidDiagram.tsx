import { useEffect, useId, useState } from 'react';
import { useThemeType } from '@gravity-ui/uikit';
import mermaid from 'mermaid';

export function MermaidDiagram({ code }: { code: string }) {
  const id = useId().replace(/:/g, '-');
  const themeType = useThemeType();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // suppressErrorRendering keeps a parse failure inside our try/catch instead of mermaid
    // injecting its own error-diagram SVG straight into document.body, outside this component.
    mermaid.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: themeType === 'dark' ? 'dark' : 'default',
    });
    mermaid
      .render(`mermaid-${id}`, code)
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code, id, themeType]);

  if (error) {
    return <pre className="markdown-mermaid-fallback">{code}</pre>;
  }
  if (!svg) return null;

  return <div className="markdown-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />;
}
