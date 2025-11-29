import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { StatsFilters, FilterState } from "./StatsFilters";
import { useToast } from "@/hooks/use-toast";
import { QuestionComments } from "./QuestionComments";
import { useAuth } from "@/contexts/AuthContext"; // <--- 1. Importamos useAuth

interface WeeklyHistoryProps {
  module: "politica" | "futbol";
  userId: string;
}

export const WeeklyHistory = ({ module, userId }: WeeklyHistoryProps) => {
  const { toast } = useToast();
  const { isAdmin } = useAuth(); // <--- 2. Obtenemos si es admin
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<any>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: string }>({});
  const [filters, setFilters] = useState<FilterState>({
    partyId: null,
    teamId: null,
    gender: null,
    ageMin: null,
    ageMax: null,
  });

  useEffect(() => {
    loadWeeks();
  }, [module, isAdmin]); // Añadimos isAdmin a las dependencias por si cambia

  useEffect(() => {
    if (selectedWeek) {
      loadWeekData(selectedWeek);
    }
  }, [selectedWeek, filters]);

  const loadWeeks = async () => {
    // 3. Construimos la consulta base
    let query = supabase.from("questions").select("week_start_date").eq("module", module);

    // 4. Si NO es admin, filtramos para que solo vea hasta hoy
    if (!isAdmin) {
      const today = new Date().toISOString().split("T")[0];
      query = query.lte("week_start_date", today);
    }

    // Ejecutamos la consulta con el orden y límite
    const { data } = await query.order("week_start_date", { ascending: false }).limit(100);

    if (data) {
      const uniqueWeeks = Array.from(new Set(data.map((d) => d.week_start_date)));
      setWeeks(uniqueWeeks);
      if (uniqueWeeks.length > 0) {
        setSelectedWeek(uniqueWeeks[0]);
      } else {
        setWeeks([]);
        setSelectedWeek(null);
      }
    }
  };

  const loadWeekData = async (weekStart: string) => {
    const { data: questions } = await supabase
      .from("questions")
      .select("*, answer_options(*), parties(name), teams(name)")
      .eq("module", module)
      .eq("week_start_date", weekStart);

    if (questions) {
      // Load user's answers for this week
      const { data: existingAnswers } = await supabase
        .from("user_answers")
        .select("question_id, answer_option_id")
        .eq("user_id", userId)
        .in(
          "question_id",
          questions.map((q) => q.id),
        );

      const answersMap: { [key: string]: string } = {};
      existingAnswers?.forEach((answer) => {
        answersMap[answer.question_id] = answer.answer_option_id;
      });
      setUserAnswers(answersMap);

      const questionsWithResults = await Promise.all(
        questions.map(async (question) => {
          const { data: statsData } = await supabase.rpc("get_question_stats_filtered", {
            question_uuid: question.id,
            filter_party_id: filters.partyId,
            filter_team_id: filters.teamId,
            filter_gender: filters.gender as any,
            filter_age_min: filters.ageMin,
            filter_age_max: filters.ageMax,
          });

          const total = statsData && statsData.length > 0 ? Number(statsData[0].total_votes) : 0;
          const options =
            statsData?.map((stat) => ({
              id: stat.option_id,
              text: stat.option_text,
              option_order: stat.option_order,
              count: Number(stat.vote_count),
              percentage: stat.percentage,
            })) || [];

          return { ...question, results: { options, total } };
        }),
      );

      setWeekData(questionsWithResults);
    }
  };

  const getWeekIndex = () => weeks.indexOf(selectedWeek || "");

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
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  };

  const handleAnswer = async (questionId: string) => {
    const answerId = answers[questionId];
    if (!answerId) {
      toast({
        title: "Error",
        description: "Por favor selecciona una respuesta",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("user_answers").insert({
        user_id: userId,
        question_id: questionId,
        answer_option_id: answerId,
      });

      if (error) throw error;

      toast({
        title: "¡Respuesta enviada!",
        description: "Tu respuesta ha sido registrada correctamente",
      });

      // Reload data to show results
      if (selectedWeek) {
        loadWeekData(selectedWeek);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar la respuesta",
        variant: "destructive",
      });
    }
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
        <h2 className="text-2xl font-display font-bold text-foreground">Historial de Encuestas</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevWeek} disabled={getWeekIndex() === weeks.length - 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground px-4">
            {selectedWeek && formatWeekDate(selectedWeek)}
          </span>
          <Button variant="outline" size="sm" onClick={goToNextWeek} disabled={getWeekIndex() === 0}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <StatsFilters module={module} onFiltersChange={setFilters} />

      {weekData && weekData.length > 0 ? (
        <div className="space-y-4">
          {weekData.map((question: any) => {
            const hasAnswered = !!userAnswers[question.id];

            return (
              <Card key={question.id} className="p-6 bg-card">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {hasAnswered && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      {question.is_mandatory && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                          Obligatoria
                        </span>
                      )}
                      {question.scope === "specific" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {question.parties ? question.parties.name : question.teams.name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{question.text}</h3>
                  </div>

                  {!hasAnswered ? (
                    <div className="space-y-4">
                      <RadioGroup
                        value={answers[question.id] || ""}
                        onValueChange={(value) => setAnswers((prev) => ({ ...prev, [question.id]: value }))}
                      >
                        {question.answer_options
                          .sort((a: any, b: any) => a.option_order - b.option_order)
                          .map((option: any) => (
                            <div key={option.id} className="flex items-center space-x-2">
                              <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                              <Label htmlFor={`${question.id}-${option.id}`} className="cursor-pointer">
                                {option.text}
                              </Label>
                            </div>
                          ))}
                      </RadioGroup>
                      <Button
                        onClick={() => handleAnswer(question.id)}
                        className="w-full"
                        variant={module === "politica" ? "default" : "secondary"}
                      >
                        Enviar Respuesta
                      </Button>
                    </div>
                  ) : (
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
                              className={`h-full transition-all ${module === "politica" ? "bg-primary" : "bg-secondary"}`}
                              style={{ width: `${option.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <QuestionComments questionId={question.id} />
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center bg-card">
          <p className="text-muted-foreground">No hay datos para esta semana</p>
        </Card>
      )}
    </div>
  );
};
