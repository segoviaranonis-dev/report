import { Modal } from "@/components/ui";

type AprobacionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  pedidoNro: string;
};

export function AprobacionModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  pedidoNro,
}: AprobacionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Aprobar Pedido"
      confirmText="Confirmar Aprobación"
      cancelText="Cancelar"
      variant="info"
      loading={loading}
    >
      <p className="text-sm text-neutral-ink-medium">
        ¿Confirmás la aprobación del pedido <strong className="text-rimec-azul">{pedidoNro}</strong>?
        Esta acción quedará registrada en el historial.
      </p>
    </Modal>
  );
}
