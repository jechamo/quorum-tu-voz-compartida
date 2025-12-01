import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Info } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";

interface StatsFiltersProps {
  module: "politica" | "futbol";
  onFiltersChange: (filters: FilterState) => void;
}

export interface FilterState {
  partyIds: string[]; // <-- CAMBIO A ARRAY
  teamIds: string[]; // <-- CAMBIO A ARRAY
  gender: string | null;
  ageMin: number | null;
  ageMax: number | null;
}

const AGE_RANGES = [
  { label: "Todos", min: null, max: null },
  { label: "18-25", min: 18, max: 25 },
  { label: "26-35", min: 26, max: 35 },
  { label: "36-42", min: 36, max: 42 },
  { label: "43-55", min: 43, max: 55 },
  { label: "56-64", min: 56, max: 64 },
  { label: "65+", min: 65, max: null },
];

export const StatsFilters = ({ module, onFiltersChange }: StatsFiltersProps) => {
  const [parties, setParties] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  // Estado inicial con arrays vacíos
  const [filters, setFilters] = useState<FilterState>({
    partyIds: [],
    teamIds: [],
    gender: null,
    ageMin: null,
    ageMax: null,
  });
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (module === "politica") {
      loadParties();
    } else {
      loadTeams();
    }
  }, [module]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onFiltersChange(filters);
  }, [filters]);

  const loadParties = async () => {
    const { data } = await supabase.from("parties").select("*").order("name");
    if (data) setParties(data);
  };

  const loadTeams = async () => {
    const { data } = await supabase.from("teams").select("*").order("name");
    if (data) setTeams(data);
  };

  const handleAgeRangeChange = (value: string) => {
    const range = AGE_RANGES.find((r) => r.label === value);
    if (range) {
      setFilters((prev) => ({ ...prev, ageMin: range.min, ageMax: range.max }));
    }
  };

  return (
    <Card className="p-4 bg-muted/20 space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground border-b pb-2">
        <Info className="w-4 h-4" />
        <span className="text-sm font-medium">Filtros para visualizar Resultados (No afectan a tu voto)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {module === "politica" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Partidos Políticos</Label>
            <MultiSelect
              options={parties.map((p) => ({ label: p.name, value: p.id }))}
              selected={filters.partyIds}
              onChange={(selected) => setFilters((prev) => ({ ...prev, partyIds: selected }))}
              placeholder="Selecciona partidos..."
            />
          </div>
        )}

        {module === "futbol" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Equipos de Fútbol</Label>
            <MultiSelect
              options={teams.map((t) => ({ label: t.name, value: t.id }))}
              selected={filters.teamIds}
              onChange={(selected) => setFilters((prev) => ({ ...prev, teamIds: selected }))}
              placeholder="Selecciona equipos..."
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Sexo</Label>
          <Select
            value={filters.gender || "all"}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, gender: value === "all" ? null : value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="femenino">Femenino</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Rango de Edad</Label>
          <Select
            value={AGE_RANGES.find((r) => r.min === filters.ageMin && r.max === filters.ageMax)?.label || "Todos"}
            onValueChange={handleAgeRangeChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {AGE_RANGES.map((range) => (
                <SelectItem key={range.label} value={range.label}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
};
