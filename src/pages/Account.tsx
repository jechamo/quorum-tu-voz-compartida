import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Account() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!session?.access_token) {
      toast({ title: "Error", description: "Sesión no encontrada", variant: "destructive" });
      return;
    }

    const confirm = window.confirm("Esta acción eliminará tu cuenta y todos tus datos. ¿Continuar?");
    if (!confirm) return;

    setLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || "/"}functions/v1/delete-account`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo eliminar la cuenta");
      }

      await supabase.auth.signOut();
      toast({ title: "Cuenta eliminada", description: "Tus datos han sido eliminados" });
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo eliminar la cuenta", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 w-full max-w-md text-center space-y-4">
          <p className="text-sm text-muted-foreground">Debes iniciar sesión para gestionar tu cuenta.</p>
          <Button onClick={() => navigate("/auth")}>Ir a iniciar sesión</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        <h1 className="text-xl font-semibold">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Eliminarás tu cuenta y todos tus datos asociados (respuestas, comentarios y perfil). Esta acción es
          irreversible.
        </p>
        <Button variant="destructive" onClick={handleDelete} disabled={loading} className="w-full">
          {loading ? "Eliminando..." : "Eliminar mi cuenta"}
        </Button>
      </Card>
    </div>
  );
}

