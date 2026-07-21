import {
  parseEtiquetaDatoDuroCp,
  type DatoDuroCpPartes,
} from "@/lib/pedido-proveedor/dato-duro-cabecera";

type Props = {
  preventa?: string | null;
  quincena?: string | null;
  fallbackLabel?: string;
  labelCombinada?: string;
  className?: string;
};

function resolverPartes(props: Props): DatoDuroCpPartes & { esCp: boolean; fallback: string } {
  if (props.preventa || props.quincena) {
    return {
      preventa: String(props.preventa ?? "").trim(),
      quincena: String(props.quincena ?? "").trim(),
      esCp: Boolean(props.preventa || props.quincena),
      fallback: props.fallbackLabel ?? "Compra previa",
    };
  }
  if (props.labelCombinada) {
    const p = parseEtiquetaDatoDuroCp(props.labelCombinada);
    if (p.preventa || p.quincena) {
      return { ...p, esCp: true, fallback: props.labelCombinada };
    }
  }
  return {
    preventa: "",
    quincena: "",
    esCp: false,
    fallback: props.fallbackLabel ?? props.labelCombinada ?? "Compra previa",
  };
}

/** CP — dos filas · colores distintos (siamese RIMEC Web). */
export function DatoDuroCpFilas({
  preventa,
  quincena,
  fallbackLabel,
  labelCombinada,
  className = "",
}: Props) {
  const { preventa: pv, quincena: q, esCp, fallback } = resolverPartes({
    preventa,
    quincena,
    fallbackLabel,
    labelCombinada,
  });

  if (!esCp) {
    return (
      <span className={`block truncate text-[11px] font-semibold text-slate-800 ${className}`}>
        {fallback}
      </span>
    );
  }

  return (
    <span className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      {pv ? (
        <span className="truncate whitespace-nowrap text-[11px] font-black tabular-nums leading-none text-orange-600">
          {pv}
        </span>
      ) : null}
      {q ? (
        <span className="truncate whitespace-nowrap text-[10px] font-bold leading-none text-sky-800">{q}</span>
      ) : null}
    </span>
  );
}
