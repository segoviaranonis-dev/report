"use client";

export type RamoOperativa = "calzado" | "confecciones";

type Props = {
  value: RamoOperativa;
  onChange: (r: RamoOperativa) => void;
  showConfecciones: boolean;
};

export function RamoOperativaToggle({ value, onChange, showConfecciones }: Props) {
  return (
    <div className="inline-flex rounded-lg border-2 border-bazzar-naranja/25 bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange("calzado")}
        className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
          value === "calzado"
            ? "bg-bazzar-naranja text-white"
            : "text-bazzar-text-dark hover:bg-bazzar-naranja/10"
        }`}
      >
        👟 Calzado
      </button>
      {showConfecciones && (
        <button
          type="button"
          onClick={() => onChange("confecciones")}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
            value === "confecciones"
              ? "bg-bazzar-naranja text-white"
              : "text-bazzar-text-dark hover:bg-bazzar-naranja/10"
          }`}
        >
          👕 Confecciones
        </button>
      )}
    </div>
  );
}
