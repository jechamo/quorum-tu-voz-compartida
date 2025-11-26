import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentWeekStart } from "@/lib/dateUtils";
import { BarChart3 } from "lucide-react";

export const SurveyStats = () => {
  const [politicaStats, setPoliticaStats] = useState<any[]>([]);
  const [futbolStats, setFutbolStats] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const weekStart = getCurrentWeekStart();

    // Load política stats
    const { data: politicaQuestions } = await supabase
      .from('questions')
      .select('*, answer_options(*)')
      .eq('module', 'politica')
      .eq('week_start_date', weekStart);

    if (politicaQuestions) {
      const statsPromises = politicaQuestions.map(async (q) => {
        const { data: statsData } = await supabase
          .rpc('get_question_stats', { question_uuid: q.id });

        const total = statsData && statsData.length > 0 ? Number(statsData[0].total_votes) : 0;
        const optionsWithPercentage = statsData?.map(stat => ({
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

    // Load fútbol stats
    const { data: futbolQuestions } = await supabase
      .from('questions')
      .select('*, answer_options(*)')
      .eq('module', 'futbol')
      .eq('week_start_date', weekStart);

    if (futbolQuestions) {
      const statsPromises = futbolQuestions.map(async (q) => {
        const { data: statsData } = await supabase
          .rpc('get_question_stats', { question_uuid: q.id });

        const total = statsData && statsData.length > 0 ? Number(statsData[0].total_votes) : 0;
        const optionsWithPercentage = statsData?.map(stat => ({
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
  };

  const StatsContent = ({ stats, color }: { stats: any[]; color: string }) => {
    if (stats.length === 0) {
      return (
        <Card className="p-8 text-center bg-card">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            No hay estadísticas disponibles para esta semana
          </p>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {stats.map((question) => (
          <Card key={question.id} className="p-6 bg-card">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {question.text}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Total de respuestas: {question.totalAnswers}
                </p>
              </div>

              <div className="space-y-3">
                {question.options.map((option: any) => (
                  <div key={option.id} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-foreground font-medium">
                        {option.text}
                      </span>
                      <div className="text-right">
                        <span className="font-semibold text-foreground">
                          {option.percentage}%
                        </span>
                        <span className="text-muted-foreground ml-2">
                          ({option.count})
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full transition-all ${color}`}
                        style={{ width: `${option.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Estadísticas de Encuestas
        </h2>
        <p className="text-muted-foreground">
          Resultados de las encuestas de esta semana
        </p>
      </div>

      <Tabs defaultValue="politica" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="politica">Política</TabsTrigger>
          <TabsTrigger value="futbol">Fútbol</TabsTrigger>
        </TabsList>

        <TabsContent value="politica" className="mt-6">
          <StatsContent stats={politicaStats} color="bg-primary" />
        </TabsContent>

        <TabsContent value="futbol" className="mt-6">
          <StatsContent stats={futbolStats} color="bg-secondary" />
        </TabsContent>
      </Tabs>
    </div>
  );
};
