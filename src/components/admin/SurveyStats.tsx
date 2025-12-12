import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Download, Clock } from "lucide-react";
import { StatsFilters, FilterState, AGE_RANGES } from "../surveys/StatsFilters";
import { format, subMonths } from "date-fns";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

interface StatsContentProps {
  stats: any[];
  color: string;
  module: "politica" | "futbol";
  onFiltersChange: (filters: FilterState) => void;
  onDownload: () => void;
  loading: boolean;
}

const StatsContent = ({ stats, color, module, onFiltersChange, onDownload, loading }: StatsContentProps) => {
  return (
    <div className="space-y-6">
      <StatsFilters 
        module={module} 
        onFiltersChange={onFiltersChange} 
        showDateRange={true}
        showScopeFilter={true}
      />

      <div className="flex justify-end">
        <Button onClick={onDownload} disabled={stats.length === 0 || loading} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Descargar Excel
        </Button>
      </div>

      {stats.length === 0 ? (
        <Card className="p-8 text-center bg-card">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No hay estadísticas disponibles para los filtros seleccionados</p>
        </Card>
      ) : (
        <>
          {stats.map((question) => (
            <Card key={question.id} className="p-6 bg-card">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {question.scope === "timeless" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Atemporal
                      </span>
                    )}
                    {question.scope === "specific" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600">
                        Específica
                      </span>
                    )}
                    {question.scope === "general" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600">
                        General
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(question.week_start_date), "dd/MM/yyyy")}
                    </span>
                  </div>
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
  const { toast } = useToast();
  const [politicaStats, setPoliticaStats] = useState<any[]>([]);
  const [futbolStats, setFutbolStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [parties, setParties] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  const [politicaFilters, setPoliticaFilters] = useState<FilterState>({
    partyIds: [],
    teamIds: [],
    gender: null,
    ageRanges: [],
    dateFrom: subMonths(new Date(), 1),
    dateTo: new Date(),
    scope: null,
  });

  const [futbolFilters, setFutbolFilters] = useState<FilterState>({
    partyIds: [],
    teamIds: [],
    gender: null,
    ageRanges: [],
    dateFrom: subMonths(new Date(), 1),
    dateTo: new Date(),
    scope: null,
  });

  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  useEffect(() => {
    loadEntities();
  }, []);

  const loadEntities = async () => {
    const [partiesRes, teamsRes] = await Promise.all([
      supabase.from("parties").select("*").order("name"),
      supabase.from("teams").select("*").order("name"),
    ]);
    if (partiesRes.data) setParties(partiesRes.data);
    if (teamsRes.data) setTeams(teamsRes.data);
  };

  const loadStats = useCallback(async (filters: { politica: FilterState; futbol: FilterState }) => {
    setLoading(true);

    // --- CARGAR ESTADÍSTICAS POLÍTICA ---
    let politicaQuery = supabase
      .from("questions")
      .select("*, answer_options(*)")
      .eq("module", "politica");

    if (filters.politica.dateFrom) {
      politicaQuery = politicaQuery.gte("week_start_date", format(filters.politica.dateFrom, "yyyy-MM-dd"));
    }
    if (filters.politica.dateTo) {
      politicaQuery = politicaQuery.lte("week_start_date", format(filters.politica.dateTo, "yyyy-MM-dd"));
    }
    if (filters.politica.scope) {
      politicaQuery = politicaQuery.eq("scope", filters.politica.scope as "general" | "specific" | "timeless");
    }

    const { data: politicaQuestions } = await politicaQuery.order("week_start_date", { ascending: false });

    if (politicaQuestions) {
      const statsPromises = politicaQuestions.map(async (q) => {
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
    let futbolQuery = supabase
      .from("questions")
      .select("*, answer_options(*)")
      .eq("module", "futbol");

    if (filters.futbol.dateFrom) {
      futbolQuery = futbolQuery.gte("week_start_date", format(filters.futbol.dateFrom, "yyyy-MM-dd"));
    }
    if (filters.futbol.dateTo) {
      futbolQuery = futbolQuery.lte("week_start_date", format(filters.futbol.dateTo, "yyyy-MM-dd"));
    }
    if (filters.futbol.scope) {
      futbolQuery = futbolQuery.eq("scope", filters.futbol.scope as "general" | "specific" | "timeless");
    }

    const { data: futbolQuestions } = await futbolQuery.order("week_start_date", { ascending: false });

    if (futbolQuestions) {
      const statsPromises = futbolQuestions.map(async (q) => {
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

    setLoading(false);
  }, []);

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

  const generateExcelData = async (module: "politica" | "futbol", stats: any[], filters: FilterState) => {
    // Obtener todas las respuestas con información del usuario
    const questionIds = stats.map((s) => s.id);
    
    const { data: answers } = await supabase
      .from("user_answers")
      .select(`
        id,
        question_id,
        answer_option_id,
        answered_at,
        answer_options!inner(text, question_id),
        profiles:user_id(username, age, gender, party_id, team_id)
      `)
      .in("question_id", questionIds);

    if (!answers || answers.length === 0) {
      toast({ title: "Sin datos", description: "No hay respuestas para exportar", variant: "destructive" });
      return null;
    }

    // Crear filas para Excel
    const rows = answers.map((answer: any) => {
      const question = stats.find((s) => s.id === answer.question_id);
      const partyName = answer.profiles?.party_id 
        ? parties.find((p) => p.id === answer.profiles.party_id)?.name || "N/A"
        : "N/A";
      const teamName = answer.profiles?.team_id 
        ? teams.find((t) => t.id === answer.profiles.team_id)?.name || "N/A"
        : "N/A";

      return {
        "Pregunta": question?.text || "N/A",
        "Tipo": question?.scope === "timeless" ? "Atemporal" : question?.scope === "specific" ? "Específica" : "General",
        "Fecha Pregunta": question?.week_start_date || "N/A",
        "Respuesta": answer.answer_options?.text || "N/A",
        "Usuario": answer.profiles?.username || "Anónimo",
        "Edad": answer.profiles?.age || "N/A",
        "Sexo": answer.profiles?.gender || "N/A",
        "Partido Político": partyName,
        "Equipo de Fútbol": teamName,
        "Fecha Respuesta": answer.answered_at ? format(new Date(answer.answered_at), "dd/MM/yyyy HH:mm") : "N/A",
      };
    });

    return rows;
  };

  const handleDownloadPolitica = async () => {
    setLoading(true);
    try {
      const data = await generateExcelData("politica", politicaStats, politicaFilters);
      if (!data) {
        setLoading(false);
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Política");

      // Ajustar anchos de columna
      const colWidths = [
        { wch: 50 }, // Pregunta
        { wch: 12 }, // Tipo
        { wch: 12 }, // Fecha Pregunta
        { wch: 30 }, // Respuesta
        { wch: 15 }, // Usuario
        { wch: 8 },  // Edad
        { wch: 12 }, // Sexo
        { wch: 20 }, // Partido
        { wch: 20 }, // Equipo
        { wch: 18 }, // Fecha Respuesta
      ];
      worksheet["!cols"] = colWidths;

      XLSX.writeFile(workbook, `estadisticas_politica_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast({ title: "Éxito", description: "Excel descargado correctamente" });
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast({ title: "Error", description: "No se pudo generar el Excel", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleDownloadFutbol = async () => {
    setLoading(true);
    try {
      const data = await generateExcelData("futbol", futbolStats, futbolFilters);
      if (!data) {
        setLoading(false);
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Fútbol");

      const colWidths = [
        { wch: 50 },
        { wch: 12 },
        { wch: 12 },
        { wch: 30 },
        { wch: 15 },
        { wch: 8 },
        { wch: 12 },
        { wch: 20 },
        { wch: 20 },
        { wch: 18 },
      ];
      worksheet["!cols"] = colWidths;

      XLSX.writeFile(workbook, `estadisticas_futbol_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast({ title: "Éxito", description: "Excel descargado correctamente" });
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast({ title: "Error", description: "No se pudo generar el Excel", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Estadísticas de Encuestas</h2>
        <p className="text-muted-foreground">Filtra por rango de fechas, tipo de pregunta y demografía</p>
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
            onDownload={handleDownloadPolitica}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="futbol" className="mt-6">
          <StatsContent
            stats={futbolStats}
            color="bg-secondary"
            module="futbol"
            onFiltersChange={handleFutbolFiltersChange}
            onDownload={handleDownloadFutbol}
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
