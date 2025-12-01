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
  PSOE: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Logotipo_del_PSOE.svg/267px-Logotipo_del_PSOE.svg.png",
  "Partido Popular":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Partido_Popular.svg/177px-Partido_Popular.svg.png",
  VOX: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/VOX_logo.svg/365px-VOX_logo.svg.png",
  Sumar: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Sumar_logo.svg/512px-Sumar_logo.svg.png",
  ERC: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/ERC_logotipo_compacto.svg/50px-ERC_logotipo_compacto.svg.png",
  Junts:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Logotip_Junts_per_Catalunya.svg/100px-Logotip_Junts_per_Catalunya.svg.png",
  Bildu:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Icono_de_EH_Bildu_%282023%29.svg/282px-Icono_de_EH_Bildu_%282023%29.svg.png",
  PNV: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Icono_EAJ-PNV_2025.svg/605px-Icono_EAJ-PNV_2025.svg.png",
  Podemos:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Podemos_logo_2020.svg/279px-Podemos_logo_2020.svg.png",
  BNG: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/BNG_logo.svg/400px-BNG_logo.svg.png",
  Compromís:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Comprom%C3%ADs-Podemos-%C3%89s_el_moment.svg/344px-Comprom%C3%ADs-Podemos-%C3%89s_el_moment.svg.png",
  Ciudadanos:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Ciudadanos_logo_2017.svg/580px-Ciudadanos_logo_2017.svg.png",
};

const TEAM_LOGOS: Record<string, string> = {
  "FC Barcelona":
    "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/512px-FC_Barcelona_%28crest%29.svg.png",
  "Real Madrid": "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/512px-Real_Madrid_CF.svg.png",
  "Atlético de Madrid":
    "https://upload.wikimedia.org/wikinews/en/thumb/c/c1/Atletico_Madrid_logo.svg/274px-Atletico_Madrid_logo.svg.png",
  "Athletic Club":
    "https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Club_Athletic_Bilbao_logo.svg/512px-Club_Athletic_Bilbao_logo.svg.png",
  "Real Betis":
    "https://upload.wikimedia.org/wikipedia/en/thumb/1/13/Real_betis_logo.svg/512px-Real_betis_logo.svg.png",
  "Sevilla FC":
    "https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Sevilla_FC_logo.svg/512px-Sevilla_FC_logo.svg.png",
  "Real Sociedad":
    "https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/512px-Real_Sociedad_logo.svg.png",
  "Villarreal CF":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Escudo_de_Vila-Real.svg/960px-Escudo_de_Vila-Real.svg.png",
  "Valencia CF": "https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/Valenciacf.svg/512px-Valenciacf.svg.png",
  "RCD Espanyol":
    "https://upload.wikimedia.org/wikipedia/en/thumb/d/d6/Rcd_espanyol_logo.svg/512px-Rcd_espanyol_logo.svg.png",
  "Getafe CF": "https://upload.wikimedia.org/wikipedia/commons/b/b9/Getafe_CF_Logo.png",
  "RCD Mallorca": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Rcd_mallorca.svg/362px-Rcd_mallorca.svg.png",
  "CA Osasuna": "https://upload.wikimedia.org/wikipedia/en/thumb/d/db/Osasuna_logo.svg/512px-Osasuna_logo.svg.png",
  "Rayo Vallecano": "https://upload.wikimedia.org/wikipedia/an/c/cc/Rayo_Vallecano_logo.svg.png",
  "Celta de Vigo":
    "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/RC_Celta_de_Vigo_logo.svg/512px-RC_Celta_de_Vigo_logo.svg.png",
  "Deportivo Alavés":
    "https://upload.wikimedia.org/wikipedia/en/thumb/f/f8/Deportivo_Alaves_logo_%282020%29.svg/300px-Deportivo_Alaves_logo_%282020%29.svg.png",
  "Girona FC":
    "https://upload.wikimedia.org/wikipedia/ca/thumb/a/a5/For_article_Girona_FC.svg.png/600px-For_article_Girona_FC.svg.png",
  "UD Las Palmas":
    "https://upload.wikimedia.org/wikipedia/sco/thumb/2/20/UD_Las_Palmas_logo.svg/152px-UD_Las_Palmas_logo.svg.png",
  "CD Leganés":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Escudo_de_Legan%C3%A9s_%28Madrid%29.svg/500px-Escudo_de_Legan%C3%A9s_%28Madrid%29.svg.png",
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
