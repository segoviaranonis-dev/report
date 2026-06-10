import { FormField, Modal, TextArea } from "@/components/ui";

type RechazoModalProps = {
  isOpen: boolean;
  motivo: string;
  onClose: () => void;
  onConfirm: () => void;
  onMotivoChange: (motivo: string) => void;
  loading: boolean;
  pedidoNro?: string;
};

export function RechazoModal({
  isOpen,
  motivo,
  onClose,
  onConfirm,
  onMotivoChange,
  loading,
  pedidoNro,
}: RechazoModalProps) {
  const motivoTrim = motivo.trim();
  const motivoValido = motivoTrim.length >= 10;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Rechazar Pedido"
      confirmText="Confirmar Rechazo"
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
            motivoTrim && !motivoValido ? "El motivo debe tener al menos 10 caracteres" : undefined
          }
          hint={
            !motivoTrim
              ? "El botón de rechazo se habilitará cuando escriba un motivo válido (mínimo 10 caracteres)."
              : `${motivoTrim.length}/10 caracteres mínimos`
          }
        >
          <TextArea
            value={motivo}
            onChange={(e) => onMotivoChange(e.target.value)}
            placeholder="Ej: Stock insuficiente, cliente sin crédito disponible..."
            rows={4}
            disabled={loading}
            error={motivoTrim !== "" && !motivoValido}
          />
        </FormField>
      </div>
    </Modal>
  );
}
