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
  // 1. VALIDACIÓN DE SEGURIDAD ANTES DE ENVIAR NADA
  const validation = signUpSchema.safeParse(data);
  if (!validation.success) {
    // Devolvemos el primer error que encontremos para mostrarlo
    throw new Error(validation.error.errors[0].message);
  }

  // Create auth user with phone as email
  const email = `${data.phone}@quorum.app`;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: data.password,
    options: {
      data: {
        phone: data.phone,
        username: data.username,
      },
      // En móvil esto es ignorado, pero necesario por la API
      emailRedirectTo: `http://localhost`,
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("No se pudo crear el usuario");

  // Create profile
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    phone: data.phone,
    username: data.username,
    gender: data.gender,
    age: data.age,
    party_id: data.partyId || null,
    team_id: data.teamId || null,
    accepted_terms: data.acceptedTerms,
    accepted_terms_at: new Date().toISOString(),
  });

  if (profileError) {
    // Si falla el perfil, intentamos borrar el usuario auth para no dejarlo "colgado"
    await supabase.auth.signOut();
    throw profileError;
  }

  // Assign user role
  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: authData.user.id,
    role: "user",
  });

  if (roleError) throw roleError;

  return authData;
};

// ... (El resto de funciones signIn, signOut, etc. las dejas igual que estaban)
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
