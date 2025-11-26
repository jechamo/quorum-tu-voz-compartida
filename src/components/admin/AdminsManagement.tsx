import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Trash2 } from "lucide-react";

export const AdminsManagement = () => {
  const [admins, setAdmins] = useState<any[]>([]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('*, profiles(phone, username)')
      .eq('role', 'admin');
    if (data) setAdmins(data);
  };

  const handlePromote = async () => {
    if (!phone.trim()) {
      toast({
        title: "Error",
        description: "Introduce el teléfono del usuario",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Find user by phone
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone.trim())
        .single();

      if (profileError || !profile) {
        toast({
          title: "Error",
          description: "Usuario no encontrado con ese teléfono",
          variant: "destructive",
        });
        return;
      }

      // Check if already admin
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (existing) {
        toast({
          title: "Info",
          description: "Este usuario ya es administrador",
        });
        return;
      }

      // Add admin role
      const { error } = await supabase.from('user_roles').insert({
        user_id: profile.id,
        role: 'admin',
      });

      if (error) throw error;

      toast({
        title: "Admin añadido",
        description: "El usuario ahora es administrador",
      });
      setPhone("");
      loadAdmins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo añadir el administrador",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (roleId: string, username: string) => {
    if (!confirm(`¿Quitar permisos de admin a ${username}?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('user_roles').delete().eq('id', roleId);
      if (error) throw error;

      toast({
        title: "Admin removido",
        description: `${username} ya no es administrador`,
      });
      loadAdmins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo remover el administrador",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-card">
        <h3 className="font-display font-semibold text-lg mb-4">Añadir Administrador</h3>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="admin-phone">Teléfono del usuario</Label>
            <Input
              id="admin-phone"
              type="tel"
              placeholder="Ej: 679656914"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button 
            onClick={handlePromote} 
            disabled={loading}
            className="mt-6 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Shield className="w-4 h-4 mr-2" />
            Promover
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <h3 className="font-display font-semibold text-lg">Administradores ({admins.length})</h3>
        <div className="grid gap-2">
          {admins.map((admin) => (
            <Card key={admin.id} className="p-3 flex items-center justify-between bg-card hover:shadow-card transition-smooth">
              <div>
                <p className="font-medium text-foreground">{admin.profiles?.username}</p>
                <p className="text-sm text-muted-foreground">{admin.profiles?.phone}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(admin.id, admin.profiles?.username)}
                disabled={loading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
