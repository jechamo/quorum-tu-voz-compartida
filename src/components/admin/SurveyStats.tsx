import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentWeekStart } from "@/lib/dateUtils";
import { BarChart3 } from "lucide-react";
import { StatsFilters, FilterState, AGE_RANGES } from "../surveys/StatsFilters";

interface StatsContentProps {
  stats: any[];
  color: string;
  module: "politica" | "futbol";
  onFiltersChange: (filters: FilterState) => void;
}

const StatsContent = ({ stats, color, module, onFiltersChange }: StatsContentProps) => {
  return (
    <div className="space-y-6">
      <StatsFilters module={module} onFiltersChange={onFiltersChange} />

      {stats.length === 0 ? (
        <Card className="p-8 text-center bg-card">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No hay estadísticas disponibles para esta semana</p>
        </Card>
      ) : (
        <>
          {stats.map((question) => (
            <Card key={question.id} className="p-6 bg-card">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">{question.text}</h3>
                  <p className="text-sm text-muted-foreground">Total de respuestas: {question.totalAnswers}</p>
                </div>

                <div className="space-y-3">
                  {question.options.map((option: any) => (
                    <div key={option.id} className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-foreground font-medium">{option.text}</span>
                        <div className="text-right">
                          <span className="font-semibold text-foreground">{option.percentage}%</span>
                          <span className="text-muted-foreground ml-2">({option.count})</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div className={`h-full transition-all ${color}`} style={{ width: `${option.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

export const SurveyStats = () => {
  const [politicaStats, setPoliticaStats] = useState<any[]>([]);
  const [futbolStats, setFutbolStats] = useState<any[]>([]);

  // Estado inicial actualizado a la nueva estructura (Arrays)
  const [politicaFilters, setPoliticaFilters] = useState<FilterState>({
    partyIds: [],
    teamIds: [],
    gender: null,
    ageRanges: [],
  });

  const [futbolFilters, setFutbolFilters] = useState<FilterState>({
    partyIds: [],
    teamIds: [],
    gender: null,
    ageRanges: [],
  });

  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  const loadStats = useCallback(async (filters: { politica: FilterState; futbol: FilterState }) => {
    const weekStart = getCurrentWeekStart();

    // --- CARGAR ESTADÍSTICAS POLÍTICA ---
    const { data: politicaQuestions } = await supabase
      .from("questions")
      .select("*, answer_options(*)")
      .eq("module", "politica")
      .eq("week_start_date", weekStart);

    if (politicaQuestions) {
      const statsPromises = politicaQuestions.map(async (q) => {
        // Preparar filtros de edad política
        let ageMinsP: number[] | null = null;
        let ageMaxsP: number[] | null = null;
        if (filters.politica.ageRanges.length > 0) {
          ageMinsP = [];
          ageMaxsP = [];
          filters.politica.ageRanges.forEach((id) => {
            const r = AGE_RANGES.find((ar) => ar.id === id);
            if (r) {
              ageMinsP!.push(r.min);
              ageMaxsP!.push(r.max);
            }
          });
        }

        const { data: statsData } = await supabase.rpc("get_question_stats_filtered", {
          question_uuid: q.id,
          filter_party_ids: filters.politica.partyIds.length > 0 ? filters.politica.partyIds : null,
          filter_team_ids: filters.politica.teamIds.length > 0 ? filters.politica.teamIds : null,
          filter_gender: filters.politica.gender as any,
          filter_age_mins: ageMinsP,
          filter_age_maxs: ageMaxsP,
        });

        const total = statsData && statsData.length > 0 ? Number(statsData[0].total_votes) : 0;
        const optionsWithPercentage =
          statsData?.map((stat) => ({
            id: stat.option_id,
            text: stat.option_text,
            option_order: stat.option_order,
            count: Number(stat.vote_count),
            percentage: stat.percentage,
          })) || [];

        return {
          ...q,
          totalAnswers: total,
          options: optionsWithPercentage,
        };
      });

      const stats = await Promise.all(statsPromises);
      setPoliticaStats(stats);
    }

    // --- CARGAR ESTADÍSTICAS FÚTBOL ---
    const { data: futbolQuestions } = await supabase
      .from("questions")
      .select("*, answer_options(*)")
      .eq("module", "futbol")
      .eq("week_start_date", weekStart);

    if (futbolQuestions) {
      const statsPromises = futbolQuestions.map(async (q) => {
        // Preparar filtros de edad fútbol
        let ageMinsF: number[] | null = null;
        let ageMaxsF: number[] | null = null;
        if (filters.futbol.ageRanges.length > 0) {
          ageMinsF = [];
          ageMaxsF = [];
          filters.futbol.ageRanges.forEach((id) => {
            const r = AGE_RANGES.find((ar) => ar.id === id);
            if (r) {
              ageMinsF!.push(r.min);
              ageMaxsF!.push(r.max);
            }
          });
        }

        const { data: statsData } = await supabase.rpc("get_question_stats_filtered", {
          question_uuid: q.id,
          filter_party_ids: filters.futbol.partyIds.length > 0 ? filters.futbol.partyIds : null,
          filter_team_ids: filters.futbol.teamIds.length > 0 ? filters.futbol.teamIds : null,
          filter_gender: filters.futbol.gender as any,
          filter_age_mins: ageMinsF,
          filter_age_maxs: ageMaxsF,
        });

        const total = statsData && statsData.length > 0 ? Number(statsData[0].total_votes) : 0;
        const optionsWithPercentage =
          statsData?.map((stat) => ({
            id: stat.option_id,
            text: stat.option_text,
            option_order: stat.option_order,
            count: Number(stat.vote_count),
            percentage: stat.percentage,
          })) || [];

        return {
          ...q,
          totalAnswers: total,
          options: optionsWithPercentage,
        };
      });

      const stats = await Promise.all(statsPromises);
      setFutbolStats(stats);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!hasLoadedInitial) {
      loadStats({ politica: politicaFilters, futbol: futbolFilters });
      setHasLoadedInitial(true);
    }
  }, [hasLoadedInitial, loadStats, politicaFilters, futbolFilters]);

  const handlePoliticaFiltersChange = useCallback(
    (filters: FilterState) => {
      setPoliticaFilters(filters);
      loadStats({ politica: filters, futbol: futbolFilters });
    },
    [loadStats, futbolFilters],
  );

  const handleFutbolFiltersChange = useCallback(
    (filters: FilterState) => {
      setFutbolFilters(filters);
      loadStats({ politica: politicaFilters, futbol: filters });
    },
    [loadStats, politicaFilters],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Estadísticas de Encuestas</h2>
        <p className="text-muted-foreground">Resultados de las encuestas de esta semana</p>
      </div>

      <Tabs defaultValue="politica" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="politica">Política</TabsTrigger>
          <TabsTrigger value="futbol">Fútbol</TabsTrigger>
        </TabsList>

        <TabsContent value="politica" className="mt-6">
          <StatsContent
            stats={politicaStats}
            color="bg-primary"
            module="politica"
            onFiltersChange={handlePoliticaFiltersChange}
          />
        </TabsContent>

        <TabsContent value="futbol" className="mt-6">
          <StatsContent
            stats={futbolStats}
            color="bg-secondary"
            module="futbol"
            onFiltersChange={handleFutbolFiltersChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
