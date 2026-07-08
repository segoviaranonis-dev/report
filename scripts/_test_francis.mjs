import { loadFrancisTranslator, carlosVendedorIdFrancis } from "../src/lib/pedido-proveedor/csv-vendedor-francis";

const t = loadFrancisTranslator();
console.log("translator", t);
console.log("ACT-BRSPORT", carlosVendedorIdFrancis("ACT-BRSPORT", t));
console.log("default", carlosVendedorIdFrancis("", t));
