import { FormField, Modal, TextArea } from "@/components/ui";

type RechazoModalProps = {
  isOpen: boolean;
  motivo: string;
  onClose: () => void;
  onConfirm: () => void;
  onMotivoChange: (motivo: string) => void;
  loading: boolean;
  pedidoNro?: string;
  titulo?: string;
  confirmLabel?: string;
  placeholder?: string;
  minLength?: number;
};

export function RechazoModal({
  isOpen,
  motivo,
  onClose,
  onConfirm,
  onMotivoChange,
  loading,
  pedidoNro,
  titulo = "Rechazar Pedido",
  confirmLabel = "Confirmar Rechazo",
  placeholder = "Ej: Stock insuficiente, cliente sin crédito disponible...",
  minLength = 10,
}: RechazoModalProps) {
  const motivoTrim = motivo.trim();
  const motivoValido = motivoTrim.length >= minLength;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={titulo}
      confirmText={confirmLabel}
      cancelText="Cancelar"
      variant="danger"
      confirmDisabled={!motivoValido}
      loading={loading}
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-ink-medium">
          ¿Está seguro que desea rechazar
          {pedidoNro ? (
            <>
              {" "}
              el pedido <strong className="text-rimec-azul">{pedidoNro}</strong>
            </>
          ) : (
            " este pedido"
          )}
          ? Esta acción quedará registrada en el historial.
        </p>
        <FormField
          label="Motivo del rechazo"
          required
          error={
            motivoTrim && !motivoValido
              ? `El motivo debe tener al menos ${minLength} caracteres`
              : undefined
          }
          hint={
            !motivoTrim
              ? `Mínimo ${minLength} caracteres.`
              : `${motivoTrim.length}/${minLength} caracteres mínimos`
          }
        >
          <TextArea
            value={motivo}
            onChange={(e) => onMotivoChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            disabled={loading}
            error={motivoTrim !== "" && !motivoValido}
          />
        </FormField>
      </div>
    </Modal>
  );
}
