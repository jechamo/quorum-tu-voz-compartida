import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Shirt } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // <--- Avatar
import { TEAM_LOGOS } from "@/lib/logos"; // <--- Logos

export const TeamsManagement = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    const { data } = await supabase.from("teams").select("*").order("name");
    if (data) setTeams(data);
  };

  const handleAddTeam = async () => {
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
      const { error } = await supabase.from("teams").insert({ name: newTeamName.trim() });
      if (error) throw error;

      toast({
        title: "Equipo añadido",
        description: "El equipo ha sido añadido correctamente",
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

  const handleDeleteTeam = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este equipo?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Equipo eliminado",
        description: "El equipo ha sido eliminado correctamente",
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
        <h3 className="font-display font-semibold text-lg mb-4">Añadir Nuevo Equipo</h3>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="team-name">Nombre del Equipo</Label>
            <Input
              id="team-name"
              placeholder="Ej: Nuevo Club de Fútbol"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button onClick={handleAddTeam} disabled={loading} className="mt-6">
            <Plus className="w-4 h-4 mr-2" />
            Añadir
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <h3 className="font-display font-semibold text-lg">Equipos Existentes ({teams.length})</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {teams.map((team) => (
            <Card
              key={team.id}
              className="p-3 flex items-center justify-between bg-card hover:shadow-card transition-smooth"
            >
              <div className="flex items-center gap-3">
                {/* LOGO AÑADIDO */}
                <Avatar className="h-8 w-8">
                  <AvatarImage src={TEAM_LOGOS[team.name]} />
                  <AvatarFallback>
                    <Shirt className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{team.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteTeam(team.id)}
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
