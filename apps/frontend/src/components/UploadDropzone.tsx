import { useRef, useState } from 'react';
import { Icon, Loader, Text } from '@gravity-ui/uikit';
import { FileArrowUp } from '@gravity-ui/icons';
import styles from './UploadDropzone.module.css';

const ACCEPT = '.pdf,.docx,.html,.htm,.md,.markdown,.txt';

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled: boolean;
}

export function UploadDropzone({ onFileSelected, disabled }: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div
      className={styles.dropzone}
      data-drag-over={isDragOver || undefined}
      data-disabled={disabled || undefined}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        if (!disabled) handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        className={styles.input}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
      {disabled ? (
        <Loader size="s" />
      ) : (
        <Icon data={FileArrowUp} size={24} className={styles.icon} />
      )}
      <Text variant="body-1">
        {disabled ? 'Uploading…' : 'Drag & drop a file, or click to browse'}
      </Text>
      <Text variant="caption-2" color="secondary">
        PDF, DOCX, HTML, or Markdown
      </Text>
    </div>
  );
}
