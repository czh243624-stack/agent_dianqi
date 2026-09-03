import type { ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  confirmType?: "primary" | "success" | "warning" | "danger";
  busy?: boolean;
  size?: "sm" | "md" | "lg";
};

export function Dialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmText = "确定",
  confirmType = "primary",
  busy,
  size = "md",
}: Props) {
  if (!open) return null;
  return (
    <div className="ry-modal-mask" onClick={onClose}>
        <div className={`ry-modal ${size === "sm" ? "sm" : size === "lg" ? "lg" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="ry-modal-hd">
          <span>{title}</span>
          <button className="ry-btn ry-btn-text" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="ry-modal-bd">{children}</div>
        <div className="ry-modal-ft">
          <button className="ry-btn ry-btn-plain" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          {onConfirm ? (
            <button
              className={`ry-btn ry-btn-${confirmType}`}
              type="button"
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? "处理中…" : confirmText}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
