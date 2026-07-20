import { getHerramientaReposicion } from "../src/lib/herramienta-reposicion/queries.ts";
import { getRimecPool } from "../src/lib/rimec/pool.ts";

const d = await getHerramientaReposicion(getRimecPool());
console.log("kpis", d.kpis);
console.log("moleculas_pp", d.articulos.filter((a) => a.totales.ppAbierto > 0).length);
