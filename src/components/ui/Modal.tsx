"use client";

import { ReactNode, useEffect } from "react";
import { Button } from "./Button";

/**
 * NIIF UI - Modal de confirmación
 * Reemplaza prompt() nativo con fricción segura
 * Heurística: botón destructivo requiere acción explícita
 */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "info" | "warning" | "danger";
  confirmDisabled?: boolean;
  loading?: boolean;
}

const variantStyles = {
  info: "border-semantic-info/20",
  warning: "border-semantic-warning/20",
  danger: "border-semantic-error/20",
};

export function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "info",
  confirmDisabled = false,
  loading = false,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={`
          relative w-full max-w-md
          bg-neutral-50 rounded-2xl
          border-2 ${variantStyles[variant]}
          shadow-2xl
          animate-in fade-in zoom-in-95 duration-200
        `}
      >
        {/* Header */}
        <div className="border-b border-neutral-300 px-6 py-4">
          <h2 className="text-xl font-semibold text-neutral-ink">
            {title}
          </h2>
        </div>

        {/* Body */}
        {children && (
          <div className="px-6 py-4 text-neutral-ink-medium">
            {children}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 border-t border-neutral-300 bg-neutral-100 px-6 py-4 rounded-b-2xl">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            {cancelText}
          </Button>
          {onConfirm && (
            <Button
              variant={variant === "danger" ? "danger" : "primary"}
              size="md"
              onClick={onConfirm}
              disabled={confirmDisabled || loading}
              loading={loading}
              className="flex-1"
            >
              {confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}