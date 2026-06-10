"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_ID } from "./lib/aprobaciones-types";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function aprobarPedidoAction(pedidoId: number) {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("aprobar_pedido", {
    p_pedido_id: pedidoId,
    p_admin_id: ADMIN_ID,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/aprobaciones");
  return data ?? { success: true };
}

export async function rechazarPedidoAction(pedidoId: number, motivo: string) {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("rechazar_pedido", {
    p_pedido_id: pedidoId,
    p_admin_id: ADMIN_ID,
    p_motivo: motivo || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/aprobaciones");
  return data ?? { success: true };
}
