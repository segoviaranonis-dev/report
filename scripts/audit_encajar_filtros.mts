/**
 * Smoke auditoría encaje filtros Sales Report (sin BD).
 * npx tsx scripts/audit_encajar_filtros.mts
 */
import {
  encajarFiltrosCascada,
  encajarFiltrosTrasSyncUsuario,
  encajeAlteroSeleccion,
} from "../src/modules/sales-report/encajar-filtros-cascada.ts";
import { defaultSalesReportFilters } from "../src/modules/sales-report/types.ts";

const CASCADA = {
  departamentos: ["CALZADOS", "CONFECCIONES"],
  categorias: [
    { id_categoria: 1, nombre: "STOCK" },
    { id_categoria: 2, nombre: "PRE VENTA" },
    { id_categoria: 3, nombre: "PROGRAMADO" },
  ],
  meses_nombres: ["Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  marcas: ["MARCA_A", "MARCA_B"],
  cadenas: ["CADENA_1", "CADENA_2"],
  vendedores: ["VEND_1", "VEND_2"],
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = defaultSalesReportFilters();
let casos = 0;

function run(name: string, fn: () => void) {
  fn();
  casos++;
  console.log(`  ✓ ${name}`);
}

// —— Categorías ——
run("STOCK solo", () => {
  const f = { ...base, categoria_ids: [1], meses: ["Julio", "Agosto"] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.categoria_ids.join(",") === "1", `esperado [1], got [${out.categoria_ids}]`);
});

run("PROGRAMADO solo (bug reportado)", () => {
  const f = { ...base, categoria_ids: [3], meses: ["Julio"] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.categoria_ids.join(",") === "3", `PROGRAMADO solo → [3], got [${out.categoria_ids}]`);
  assert(!encajeAlteroSeleccion(f, out), "no debe alterar selección explícita");
});

run("STOCK + PRE VENTA", () => {
  const f = { ...base, categoria_ids: [1, 2] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.categoria_ids.join(",") === "1,2", "2 cats deben conservarse");
});

run("Las 3 categorías", () => {
  const f = { ...base, categoria_ids: [1, 2, 3] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.categoria_ids.length === 3, "3 cats deben conservarse");
});

run("Sin selección → default calzados", () => {
  const f = { ...base, categoria_ids: [] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.categoria_ids.length === 3, "vacío → default [1,2,3]");
});

run("Id inválido explícito → vacío (no inflar a 3)", () => {
  const f = { ...base, categoria_ids: [99] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.categoria_ids.length === 0, "id inválido no debe expandir a las 3");
});

// —— Meses ——
run("Meses: podar fuera de dominio", () => {
  const f = { ...base, meses: ["Julio", "Agosto", "Enero"] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.meses.join(",") === "Julio,Agosto", "meses fuera de dominio se podan");
});

run("Meses: conservar selección parcial", () => {
  const f = { ...base, meses: ["Noviembre", "Diciembre"] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.meses.join(",") === "Noviembre,Diciembre", "2 meses conservados");
});

run("Meses: default solo si vacío inicial", () => {
  const f = { ...base, meses: [] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.meses.length === 6, "sin meses → primer semestre del pool");
});

// —— Marcas / cadenas / vendedores ——
run("Marcas vacías = sin filtro", () => {
  const f = { ...base, marcas: [] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.marcas.length === 0, "marcas vacías permanecen");
});

run("Marca ghost eliminada", () => {
  const f = { ...base, marcas: ["MARCA_A", "GHOST"] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.marcas.join(",") === "MARCA_A", "marca ghost eliminada");
});

run("Cadenas: todas seleccionadas se conservan", () => {
  const f = { ...base, cadenas: ["CADENA_1", "CADENA_2"] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.cadenas.length === 2, "cadenas conservadas");
});

run("Vendedores vacíos = sin filtro", () => {
  const f = { ...base, vendedores: [] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.vendedores.length === 0, "vendedores vacíos permanecen");
});

// —— Depto ——
run("Depto inválido → primer del dominio", () => {
  const f = { ...base, departamento: "FANTASMA" };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.departamento === "CALZADOS", "depto corregido al primero");
});

// —— Idempotencia ——
run("Tras sync usuario: PROGRAMADO solo aunque encaje quiera default", () => {
  const f = { ...base, categoria_ids: [3], meses: ["Julio"] };
  const out = encajarFiltrosTrasSyncUsuario(f, CASCADA);
  assert(out.categoria_ids.join(",") === "3", "sync usuario preserva PROGRAMADO");
});

run("Ids string normalizados", () => {
  const f = { ...base, categoria_ids: ["3" as unknown as number] };
  const out = encajarFiltrosCascada(f, CASCADA);
  assert(out.categoria_ids.join(",") === "3", "coerce string id");
});

run("Segunda pasada idempotente", () => {
  const f = { ...base, categoria_ids: [3], meses: ["Julio"] };
  const once = encajarFiltrosCascada(f, CASCADA);
  const twice = encajarFiltrosCascada(once, CASCADA);
  assert(twice === once, "misma referencia si no hay cambio");
});

console.log(`\naudit_encajar_filtros: OK (${casos} casos)`);
