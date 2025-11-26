import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";

export const PartiesManagement = () => {
  const [parties, setParties] = useState<any[]>([]);
  const [newPartyName, setNewPartyName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    const { data } = await supabase.from('parties').select('*').order('name');
    if (data) setParties(data);
  };

  const handleAdd = async () => {
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
      const { error } = await supabase.from('parties').insert({ name: newPartyName.trim() });
      if (error) throw error;

      toast({
        title: "Partido añadido",
        description: `${newPartyName} ha sido añadido correctamente`,
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el partido "${name}"?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('parties').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: "Partido eliminado",
        description: `${name} ha sido eliminado`,
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
        <h3 className="font-display font-semibold text-lg mb-4">Añadir Partido</h3>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="party-name">Nombre del partido</Label>
            <Input
              id="party-name"
              placeholder="Ej: Nuevo Partido"
              value={newPartyName}
              onChange={(e) => setNewPartyName(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button 
            onClick={handleAdd} 
            disabled={loading}
            className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <h3 className="font-display font-semibold text-lg">Partidos Políticos ({parties.length})</h3>
        <div className="grid gap-2">
          {parties.map((party) => (
            <Card key={party.id} className="p-3 flex items-center justify-between bg-card hover:shadow-card transition-smooth">
              <span className="text-foreground">{party.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(party.id, party.name)}
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
