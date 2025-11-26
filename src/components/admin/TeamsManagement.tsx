import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";

export const TeamsManagement = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('name');
    if (data) setTeams(data);
  };

  const handleAdd = async () => {
    if (!newTeamName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del equipo no puede estar vacío",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('teams').insert({ name: newTeamName.trim() });
      if (error) throw error;

      toast({
        title: "Equipo añadido",
        description: `${newTeamName} ha sido añadido correctamente`,
      });
      setNewTeamName("");
      loadTeams();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo añadir el equipo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el equipo "${name}"?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: "Equipo eliminado",
        description: `${name} ha sido eliminado`,
      });
      loadTeams();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el equipo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-card">
        <h3 className="font-display font-semibold text-lg mb-4">Añadir Equipo</h3>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="team-name">Nombre del equipo</Label>
            <Input
              id="team-name"
              placeholder="Ej: Nuevo CF"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button 
            onClick={handleAdd} 
            disabled={loading}
            className="mt-6 bg-secondary hover:bg-secondary/90 text-secondary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <h3 className="font-display font-semibold text-lg">Equipos de Fútbol ({teams.length})</h3>
        <div className="grid gap-2">
          {teams.map((team) => (
            <Card key={team.id} className="p-3 flex items-center justify-between bg-card hover:shadow-card transition-smooth">
              <span className="text-foreground">{team.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(team.id, team.name)}
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
