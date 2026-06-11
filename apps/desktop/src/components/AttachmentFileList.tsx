import { FileText, Image as ImageIcon, X } from "lucide-react";

interface Props {
  files: File[];
  onRemove: (index: number) => void;
}

function fileIcon(file: File) {
  return file.type.startsWith("image/") ? ImageIcon : FileText;
}

export function AttachmentFileList({ files, onRemove }: Props) {
  if (files.length === 0) return null;

  return (
    <ul className="attachment-file-list" aria-label="Прикреплённые файлы">
      {files.map((file, index) => {
        const Icon = fileIcon(file);
        return (
          <li key={`${file.name}-${file.size}-${index}`} className="attachment-file-item">
            <Icon size={16} strokeWidth={2} aria-hidden className="attachment-file-icon" />
            <span className="attachment-file-name" title={file.name}>
              {file.name}
            </span>
            <span className="attachment-file-size">
              {file.size < 1024 * 1024
                ? `${Math.max(1, Math.round(file.size / 1024))} КБ`
                : `${(file.size / (1024 * 1024)).toFixed(1)} МБ`}
            </span>
            <button
              type="button"
              className="attachment-file-remove"
              aria-label={`Удалить ${file.name}`}
              onClick={() => onRemove(index)}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
