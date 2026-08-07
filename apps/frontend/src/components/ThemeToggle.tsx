import { Button, Icon, useThemeType } from '@gravity-ui/uikit';
import type { Theme } from '@gravity-ui/uikit';
import { Moon, Sun } from '@gravity-ui/icons';

interface ThemeToggleProps {
  onChange: (theme: Theme) => void;
}

export function ThemeToggle({ onChange }: ThemeToggleProps) {
  const resolvedTheme = useThemeType();

  return (
    <Button
      view="flat"
      size="m"
      onClick={() => onChange(resolvedTheme === 'dark' ? 'light' : 'dark')}
      title={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <Icon data={resolvedTheme === 'dark' ? Sun : Moon} size={16} />
    </Button>
  );
}
