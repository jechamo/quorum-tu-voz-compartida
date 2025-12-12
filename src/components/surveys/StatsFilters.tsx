import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, CalendarIcon } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { PARTY_LOGOS, TEAM_LOGOS } from "@/lib/logos";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface StatsFiltersProps {
  module: "politica" | "futbol";
  onFiltersChange: (filters: FilterState) => void;
  showDateRange?: boolean;
  showScopeFilter?: boolean;
}

export interface FilterState {
  partyIds: string[];
  teamIds: string[];
  gender: string | null;
  ageRanges: string[];
  dateFrom?: Date | null;
  dateTo?: Date | null;
  scope?: string | null;
}

export const AGE_RANGES = [
  { id: "18-25", label: "18-25 años", min: 18, max: 25 },
  { id: "26-35", label: "26-35 años", min: 26, max: 35 },
  { id: "36-42", label: "36-42 años", min: 36, max: 42 },
  { id: "43-55", label: "43-55 años", min: 43, max: 55 },
  { id: "56-64", label: "56-64 años", min: 56, max: 64 },
  { id: "65+", label: "65+ años", min: 65, max: 120 },
];

export const StatsFilters = ({ module, onFiltersChange, showDateRange = false, showScopeFilter = false }: StatsFiltersProps) => {
  const [parties, setParties] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    partyIds: [],
    teamIds: [],
    gender: null,
    ageRanges: [],
    dateFrom: showDateRange ? subMonths(new Date(), 1) : null,
    dateTo: showDateRange ? new Date() : null,
    scope: null,
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
        <span className="text-sm font-medium">Filtros para visualizar Resultados</span>
      </div>

      {showDateRange && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fecha Desde</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !filters.dateFrom && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, "PPP", { locale: es }) : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom || undefined}
                  onSelect={(date) => setFilters((prev) => ({ ...prev, dateFrom: date || null }))}
                  initialFocus
                  locale={es}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Fecha Hasta</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !filters.dateTo && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, "PPP", { locale: es }) : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo || undefined}
                  onSelect={(date) => setFilters((prev) => ({ ...prev, dateTo: date || null }))}
                  initialFocus
                  locale={es}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {showScopeFilter && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de Pregunta</Label>
              <Select
                value={filters.scope || "all"}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, scope: value === "all" ? null : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="general">Generales</SelectItem>
                  <SelectItem value="specific">Específicas</SelectItem>
                  <SelectItem value="timeless">Atemporales</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {module === "politica" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Partidos Políticos</Label>
            <MultiSelect
              options={parties.map((p) => ({
                label: p.name,
                value: p.id,
                image: PARTY_LOGOS[p.name],
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
                image: TEAM_LOGOS[t.name],
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
