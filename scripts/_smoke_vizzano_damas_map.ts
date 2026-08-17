/**
 * Smoke: VIZZANO → DAMAS en resolvePilaresFromCodGrupo (CARTERAS sin dígito género).
 */
import assert from "node:assert/strict";
import { resolvePilaresFromCodGrupo } from "../src/lib/pilares/sdrm-pilares-map";

const carteras = resolvePilaresFromCodGrupo({
  cod_grupo: "0203020000",
  marca: "VIZZANO",
  tipo0: "CARTERAS",
  tipo1: "PROMOCIONAL",
  tipo2: "NADA",
  ramoHint: "CALZADOS",
});
assert.equal(carteras.genero_codigo, "DAMAS", `carteras: ${carteras.genero_codigo}`);
assert.equal(carteras.marca_id, 2);

const lentes = resolvePilaresFromCodGrupo({
  cod_grupo: "0203010000",
  marca: "VIZZANO",
  tipo0: "CARTERAS",
  ramoHint: "CALZADOS",
});
assert.equal(lentes.genero_codigo, "DAMAS");

const beira = resolvePilaresFromCodGrupo({
  cod_grupo: "0103010000",
  marca: "BEIRA RIO",
  tipo0: "CARTERAS",
  ramoHint: "CALZADOS",
});
assert.notEqual(beira.genero_codigo, "DAMAS", "Beira carteras no fuerza DAMAS por marca");

console.log("PASS_VIZZANO_DAMAS_MAP", {
  carteras: carteras.genero_codigo,
  tipo1: carteras.tipo1_label,
});
