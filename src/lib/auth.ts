import { supabase } from "@/integrations/supabase/client";

export interface SignUpData {
  phone: string;
  password: string;
  username: string;
  gender: "masculino" | "femenino" | "otro";
  age: number;
  partyId?: string;
  teamId?: string;
  acceptedTerms: boolean; // <--- Nuevo campo obligatorio
}

export const signUp = async (data: SignUpData) => {
  // Create auth user with phone as email (workaround for Supabase phone auth)
  const email = `${data.phone}@quorum.app`;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: data.password,
    options: {
      data: {
        phone: data.phone,
        username: data.username,
      },
      emailRedirectTo: `${window.location.origin}/`,
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
    // @ts-ignore - Ignoramos error de tipado si las columnas no están regeneradas en types.ts
    accepted_terms: data.acceptedTerms,
    // @ts-ignore
    accepted_terms_at: new Date().toISOString(),
  });

  if (profileError) throw profileError;

  // Assign user role
  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: authData.user.id,
    role: "user",
  });

  if (roleError) throw roleError;

  return authData;
};

export const signIn = async (phone: string, password: string) => {
  const email = `${phone}@quorum.app`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

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
