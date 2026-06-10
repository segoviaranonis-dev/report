/**
 * NIIF UI - Campo de formulario con validación inline
 * Heurística: Validación en tiempo real, errores inmediatos debajo del input
 */

import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({
  label,
  required = false,
  error,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-neutral-ink">
        {label}
        {required && <span className="ml-1 text-semantic-error">*</span>}
      </label>
      {children}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border-2 border-semantic-error-light bg-semantic-error/10 px-3 py-2">
          <span className="flex-shrink-0 text-semantic-error">⚠</span>
          <p className="text-xs font-medium text-semantic-error">{error}</p>
        </div>
      )}
      {hint && !error && (
        <p className="text-xs text-neutral-ink-muted">{hint}</p>
      )}
    </div>
  );
}

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function TextInput({ error, className = "", ...props }: TextInputProps) {
  return (
    <input
      type="text"
      className={`
        w-full rounded-lg border-2 px-3 py-2 text-sm
        transition-colors duration-200
        focus:outline-none focus:ring-2
        disabled:opacity-50 disabled:bg-neutral-100 disabled:cursor-not-allowed
        ${
          error
            ? "border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20"
            : "border-neutral-300 focus:border-rimec-azul focus:ring-rimec-azul/20"
        }
        ${className}
      `}
      {...props}
    />
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function TextArea({ error, className = "", ...props }: TextAreaProps) {
  return (
    <textarea
      className={`
        w-full rounded-lg border-2 px-3 py-2 text-sm
        transition-colors duration-200
        focus:outline-none focus:ring-2
        disabled:opacity-50 disabled:bg-neutral-100 disabled:cursor-not-allowed
        ${
          error
            ? "border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20"
            : "border-neutral-300 focus:border-rimec-azul focus:ring-rimec-azul/20"
        }
        ${className}
      `}
      {...props}
    />
  );
}