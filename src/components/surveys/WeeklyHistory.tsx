import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface WeeklyHistoryProps {
  module: 'politica' | 'futbol';
}

export const WeeklyHistory = ({ module }: WeeklyHistoryProps) => {
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<any>(null);

  useEffect(() => {
    loadWeeks();
  }, [module]);

  useEffect(() => {
    if (selectedWeek) {
      loadWeekData(selectedWeek);
    }
  }, [selectedWeek]);

  const loadWeeks = async () => {
    // Get last 4 weeks
    const { data } = await supabase
      .from('questions')
      .select('week_start_date')
      .eq('module', module)
      .order('week_start_date', { ascending: false })
      .limit(4);

    if (data) {
      const uniqueWeeks = Array.from(new Set(data.map(d => d.week_start_date)));
      setWeeks(uniqueWeeks);
      if (uniqueWeeks.length > 0) {
        setSelectedWeek(uniqueWeeks[0]);
      }
    }
  };

  const loadWeekData = async (weekStart: string) => {
    const { data: questions } = await supabase
      .from('questions')
      .select('*, answer_options(*), parties(name), teams(name)')
      .eq('module', module)
      .eq('week_start_date', weekStart);

    if (questions) {
      const questionsWithResults = await Promise.all(
        questions.map(async (question) => {
          const { data: answersData } = await supabase
            .from('user_answers')
            .select('answer_option_id')
            .eq('question_id', question.id);

          const total = answersData?.length || 0;
          const options = question.answer_options.map((opt: any) => ({
            ...opt,
            count: answersData?.filter(a => a.answer_option_id === opt.id).length || 0,
            percentage: total > 0 ? Math.round((answersData?.filter(a => a.answer_option_id === opt.id).length || 0) / total * 100) : 0,
          }));

          return { ...question, results: { options, total } };
        })
      );

      setWeekData(questionsWithResults);
    }
  };

  const getWeekIndex = () => weeks.indexOf(selectedWeek || '');

  const goToPrevWeek = () => {
    const index = getWeekIndex();
    if (index < weeks.length - 1) {
      setSelectedWeek(weeks[index + 1]);
    }
  };

  const goToNextWeek = () => {
    const index = getWeekIndex();
    if (index > 0) {
      setSelectedWeek(weeks[index - 1]);
    }
  };

  const formatWeekDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (weeks.length === 0) {
    return (
      <Card className="p-8 text-center bg-card">
        <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No hay historial de encuestas disponible</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold text-foreground">
          Historial de Encuestas
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevWeek}
            disabled={getWeekIndex() === weeks.length - 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground px-4">
            {selectedWeek && formatWeekDate(selectedWeek)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextWeek}
            disabled={getWeekIndex() === 0}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {weekData && weekData.length > 0 ? (
        <div className="space-y-4">
          {weekData.map((question: any) => (
            <Card key={question.id} className="p-6 bg-card">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {question.is_mandatory && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                        Obligatoria
                      </span>
                    )}
                    {question.scope === 'specific' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {question.parties ? question.parties.name : question.teams.name}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{question.text}</h3>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">
                    Resultados ({question.results.total} respuestas):
                  </p>
                  {question.results.options.map((option: any) => (
                    <div key={option.id} className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-foreground">{option.text}</span>
                        <span className="font-semibold text-foreground">{option.percentage}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${module === 'politica' ? 'bg-primary' : 'bg-secondary'}`}
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
      ) : (
        <Card className="p-8 text-center bg-card">
          <p className="text-muted-foreground">No hay datos para esta semana</p>
        </Card>
      )}
    </div>
  );
};
