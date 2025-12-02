import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Flag } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // <--- Avatar
import { PARTY_LOGOS } from "@/lib/logos"; // <--- Logos

export const PartiesManagement = () => {
  const [parties, setParties] = useState<any[]>([]);
  const [newPartyName, setNewPartyName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    const { data } = await supabase.from("parties").select("*").order("name");
    if (data) setParties(data);
  };

  const handleAddParty = async () => {
    if (!newPartyName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del partido no puede estar vacío",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("parties").insert({ name: newPartyName.trim() });
      if (error) throw error;

      toast({
        title: "Partido añadido",
        description: "El partido ha sido añadido correctamente",
      });
      setNewPartyName("");
      loadParties();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo añadir el partido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteParty = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este partido?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("parties").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Partido eliminado",
        description: "El partido ha sido eliminado correctamente",
      });
      loadParties();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el partido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-card">
        <h3 className="font-display font-semibold text-lg mb-4">Añadir Nuevo Partido</h3>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="party-name">Nombre del Partido</Label>
            <Input
              id="party-name"
              placeholder="Ej: Partido Nuevo"
              value={newPartyName}
              onChange={(e) => setNewPartyName(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button onClick={handleAddParty} disabled={loading} className="mt-6">
            <Plus className="w-4 h-4 mr-2" />
            Añadir
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <h3 className="font-display font-semibold text-lg">Partidos Existentes ({parties.length})</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {parties.map((party) => (
            <Card
              key={party.id}
              className="p-3 flex items-center justify-between bg-card hover:shadow-card transition-smooth"
            >
              <div className="flex items-center gap-3">
                {/* LOGO AÑADIDO */}
                <Avatar className="h-8 w-8">
                  <AvatarImage src={PARTY_LOGOS[party.name]} />
                  <AvatarFallback>
                    <Flag className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{party.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteParty(party.id)}
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
