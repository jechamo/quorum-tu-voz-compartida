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
  partyIds: string[];
  teamIds: string[];
  gender: string | null;
  ageRanges: string[];
}

export const AGE_RANGES = [
  { id: "18-25", label: "18-25 años", min: 18, max: 25 },
  { id: "26-35", label: "26-35 años", min: 26, max: 35 },
  { id: "36-42", label: "36-42 años", min: 36, max: 42 },
  { id: "43-55", label: "43-55 años", min: 43, max: 55 },
  { id: "56-64", label: "56-64 años", min: 56, max: 64 },
  { id: "65+", label: "65+ años", min: 65, max: 120 },
];

// --- LOGOS CORREGIDOS (URLs más estables de 500px) ---
const PARTY_LOGOS: Record<string, string> = {
  PSOE: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Logotipo_del_PSOE.svg/512px-Logotipo_del_PSOE.svg.png",
  "Partido Popular": "https://upload.wikimedia.org/wikipedia/commons/b/bb/Partido_Popular.svg",
  VOX: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/VOX_logo.svg/512px-VOX_logo.svg.png",
  Sumar: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Sumar_Logo_2023.svg/512px-Sumar_Logo_2023.svg.png",
  ERC: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Esquerra_Republicana_de_Catalunya_logo_%282024%29.svg/512px-Esquerra_Republicana_de_Catalunya_logo_%282024%29.svg.png",
  Junts:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Junts_per_Catalunya_2020.svg/512px-Junts_per_Catalunya_2020.svg.png",
  Bildu:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/EH_Bildu_logotipoa.svg/512px-EH_Bildu_logotipoa.svg.png",
  PNV: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/EAJ-PNV_logo_2016.svg/512px-EAJ-PNV_logo_2016.svg.png",
  Podemos: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Podemos_logo.svg/512px-Podemos_logo.svg.png",
  BNG: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/BNG_logo_2016.svg/512px-BNG_logo_2016.svg.png",
  Compromís:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Compromis_logo.svg/512px-Compromis_logo.svg.png",
  Ciudadanos: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Ciudadanos-Cs.svg/512px-Ciudadanos-Cs.svg.png",
};

const TEAM_LOGOS: Record<string, string> = {
  "FC Barcelona":
    "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/512px-FC_Barcelona_%28crest%29.svg.png",
  "Real Madrid": "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/512px-Real_Madrid_CF.svg.png",
  "Atlético de Madrid":
    "https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Atletico_Madrid_2017_logo.svg/512px-Atletico_Madrid_2017_logo.svg.png",
  "Athletic Club":
    "https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Club_Athletic_Bilbao_logo.svg/512px-Club_Athletic_Bilbao_logo.svg.png",
  "Real Betis":
    "https://upload.wikimedia.org/wikipedia/en/thumb/1/13/Real_betis_logo.svg/512px-Real_betis_logo.svg.png",
  "Sevilla FC":
    "https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Sevilla_FC_logo.svg/512px-Sevilla_FC_logo.svg.png",
  "Real Sociedad":
    "https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/512px-Real_Sociedad_logo.svg.png",
  "Villarreal CF":
    "https://upload.wikimedia.org/wikipedia/en/thumb/7/70/Villarreal_CF_logo.svg/512px-Villarreal_CF_logo.svg.png",
  "Valencia CF": "https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/Valenciacf.svg/512px-Valenciacf.svg.png",
  "RCD Espanyol":
    "https://upload.wikimedia.org/wikipedia/en/thumb/d/d6/Rcd_espanyol_logo.svg/512px-Rcd_espanyol_logo.svg.png",
  "Getafe CF": "https://upload.wikimedia.org/wikipedia/en/thumb/4/45/Getafe_CF_logo.svg/512px-Getafe_CF_logo.svg.png",
  "RCD Mallorca":
    "https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/RCD_Mallorca_logo.svg/512px-RCD_Mallorca_logo.svg.png",
  "CA Osasuna": "https://upload.wikimedia.org/wikipedia/en/thumb/d/db/Osasuna_logo.svg/512px-Osasuna_logo.svg.png",
  "Rayo Vallecano":
    "https://upload.wikimedia.org/wikipedia/en/thumb/1/1b/Rayo_Vallecano_logo.svg/512px-Rayo_Vallecano_logo.svg.png",
  "Celta de Vigo":
    "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/RC_Celta_de_Vigo_logo.svg/512px-RC_Celta_de_Vigo_logo.svg.png",
  "Deportivo Alavés":
    "https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/Deportivo_Alaves_logo.svg/512px-Deportivo_Alaves_logo.svg.png",
  "Girona FC": "https://upload.wikimedia.org/wikipedia/en/thumb/9/90/Girona_FC_Crest.svg/512px-Girona_FC_Crest.svg.png",
  "UD Las Palmas":
    "https://upload.wikimedia.org/wikipedia/en/thumb/7/76/UD_Las_Palmas_logo.svg/512px-UD_Las_Palmas_logo.svg.png",
  "CD Leganés":
    "https://upload.wikimedia.org/wikipedia/en/thumb/0/02/Club_Deportivo_Legan%C3%A9s.svg/512px-Club_Deportivo_Legan%C3%A9s.svg.png",
  "Real Valladolid":
    "https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/Real_Valladolid_Logo.svg/512px-Real_Valladolid_Logo.svg.png",
};

export const StatsFilters = ({ module, onFiltersChange }: StatsFiltersProps) => {
  const [parties, setParties] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    partyIds: [],
    teamIds: [],
    gender: null,
    ageRanges: [],
  });
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (module === "politica") loadParties();
    else loadTeams();
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
              // Inyectamos las imágenes desde el mapa corregido
              options={parties.map((p) => ({
                label: p.name,
                value: p.id,
                image: PARTY_LOGOS[p.name], // Clave exacta
              }))}
              selected={filters.partyIds}
              onChange={(selected) => setFilters((prev) => ({ ...prev, partyIds: selected }))}
              placeholder="Todos los partidos"
            />
          </div>
        )}

        {module === "futbol" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Equipos de Fútbol</Label>
            <MultiSelect
              options={teams.map((t) => ({
                label: t.name,
                value: t.id,
                image: TEAM_LOGOS[t.name], // Clave exacta
              }))}
              selected={filters.teamIds}
              onChange={(selected) => setFilters((prev) => ({ ...prev, teamIds: selected }))}
              placeholder="Todos los equipos"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Rango de Edad</Label>
          <MultiSelect
            options={AGE_RANGES.map((r) => ({ label: r.label, value: r.id }))}
            selected={filters.ageRanges}
            onChange={(selected) => setFilters((prev) => ({ ...prev, ageRanges: selected }))}
            placeholder="Todas las edades"
          />
        </div>

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
      </div>
    </Card>
  );
};
