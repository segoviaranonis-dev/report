/** Ley triada holding — Ente × Rol orgánico × Categoría (menor número = más poder). */

export type TriadaInput = {
  enteCodigo: number | null;
  rolNivel: number;
  categoriaNivel: number;
};

export function categoriasPermitidasParaRol<T extends { nivel: number; activo: boolean }>(
  rolNivel: number,
  categorias: T[],
): T[] {
  return categorias.filter((c) => c.activo && c.nivel >= rolNivel);
}

export function validarTriada(input: TriadaInput): string | null {
  const { enteCodigo, rolNivel, categoriaNivel } = input;

  if (!rolNivel || !categoriaNivel) {
    return "Rol y categoría requeridos.";
  }

  if (categoriaNivel < rolNivel) {
    return `Ley triada: categoría (nivel ${categoriaNivel}) no puede ser superior al rol (nivel ${rolNivel}).`;
  }

  if (categoriaNivel === 1) {
    if (rolNivel !== 1 || enteCodigo !== 1) {
      return "Superior requiere ente RIMEC (cod 1), rol GERENTE (nivel 1) y categoría de máximo nivel (nivel 1).";
    }
  }

  return null;
}

export type UsuarioAccordionGroup = {
  enteId: number;
  enteCodigo: number;
  enteNombre: string;
  clienteId: number | null;
  parentCodigo: number | null;
  roles: {
    rolId: number;
    rolNivel: number;
    rolNombre: string;
    categorias: {
      categoriaId: number | null;
      categoriaCodigo: string;
      categoriaNivel: number;
      usuarios: unknown[];
    }[];
  }[];
};
