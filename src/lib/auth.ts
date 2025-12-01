import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// Esquema de validación de seguridad
const signUpSchema = z.object({
  phone: z.string().regex(/^[0-9]{9}$/, "El teléfono debe tener 9 dígitos numéricos"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  username: z
    .string()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(30)
    .regex(/^[a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ ]+$/, "Nombre de usuario inválido"),
  gender: z.enum(["masculino", "femenino", "otro"]),
  age: z.number().min(13).max(120),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar los términos y condiciones" }),
  }),
});

export interface SignUpData {
  phone: string;
  password: string;
  username: string;
  gender: "masculino" | "femenino" | "otro";
  age: number;
  partyId?: string;
  teamId?: string;
  acceptedTerms: boolean;
}

export const signUp = async (data: SignUpData) => {
  // 1. Validación
  const validation = signUpSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(validation.error.errors[0].message);
  }

  // 2. Crear usuario Auth
  const email = `${data.phone}@quorum.app`;
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: data.password,
    options: {
      data: {
        phone: data.phone,
        username: data.username,
      },
      emailRedirectTo: `http://localhost`,
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("No se pudo crear el usuario");

  // ---------------------------------------------------------
  // 3. LÓGICA DE ASIGNACIÓN POR DEFECTO (Anti-Fantasmas)
  // ---------------------------------------------------------
  let finalPartyId = data.partyId;
  let finalTeamId = data.teamId;

  // Si no eligió partido, buscamos el ID de "Ninguno/Apolítico"
  if (!finalPartyId) {
    const { data: noneParty } = await supabase
      .from("parties")
      .select("id")
      .eq("name", "Ninguno/Apolítico")
      .maybeSingle();
    if (noneParty) finalPartyId = noneParty.id;
  }

  // Si no eligió equipo, buscamos el ID de "Libre/Sin equipo"
  if (!finalTeamId) {
    const { data: noneTeam } = await supabase.from("teams").select("id").eq("name", "Libre/Sin equipo").maybeSingle();
    if (noneTeam) finalTeamId = noneTeam.id;
  }
  // ---------------------------------------------------------

  // 4. Crear perfil
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    phone: data.phone,
    username: data.username,
    gender: data.gender,
    age: data.age,
    party_id: finalPartyId || null, // Ahora intentará no ser NULL
    team_id: finalTeamId || null,
    accepted_terms: data.acceptedTerms,
    accepted_terms_at: new Date().toISOString(),
  });

  if (profileError) {
    await supabase.auth.signOut();
    throw profileError;
  }

  // 5. Asignar rol
  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: authData.user.id,
    role: "user",
  });

  if (roleError) throw roleError;

  return authData;
};

export const signIn = async (phone: string, password: string) => {
  const email = `${phone}@quorum.app`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, parties(name), teams(name)")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
};

export const isAdmin = async (userId: string) => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  return !!data;
};
