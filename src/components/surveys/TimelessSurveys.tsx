import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock } from "lucide-react";
import { StatsFilters, FilterState, AGE_RANGES } from "./StatsFilters";
import { QuestionComments } from "./QuestionComments";

interface TimelessSurveysProps {
  module: "politica" | "futbol";
  userId: string;
}

export const TimelessSurveys = ({ module, userId }: TimelessSurveysProps) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    partyIds: [],
    teamIds: [],
    gender: null,
    ageRanges: [],
  });
  const { toast } = useToast();

  useEffect(() => {
    loadTimelessQuestions();
  }, [module, userId]);

  useEffect(() => {
    Object.keys(userAnswers).forEach((questionId) => {
      loadResults(questionId);
    });
  }, [filters]);

  const loadTimelessQuestions = async () => {
    const { data: questionsData } = await supabase
      .from("questions")
      .select("*, answer_options(*)")
      .eq("module", module)
      .eq("scope", "timeless")
      .order("created_at", { ascending: false });

    if (questionsData) {
      setQuestions(questionsData);
      const { data: userAnswersData } = await supabase
        .from("user_answers")
        .select("*, answer_options(id, question_id, text)")
        .eq("user_id", userId)
        .in(
          "question_id",
          questionsData.map((q) => q.id),
        );

      if (userAnswersData) {
        const answersMap: Record<string, any> = {};
        userAnswersData.forEach((ua) => {
          answersMap[ua.answer_options.question_id] = ua;
        });
        setUserAnswers(answersMap);
        for (const questionId of Object.keys(answersMap)) await loadResults(questionId);
      }
    }
  };

  const loadResults = async (questionId: string) => {
    const partyIdsParam = filters.partyIds.length > 0 ? filters.partyIds : null;
    const teamIdsParam = filters.teamIds.length > 0 ? filters.teamIds : null;
    let ageMins: number[] | null = null;
    let ageMaxs: number[] | null = null;

    if (filters.ageRanges.length > 0) {
      ageMins = [];
      ageMaxs = [];
      filters.ageRanges.forEach((rangeId) => {
        const range = AGE_RANGES.find((r) => r.id === rangeId);
        if (range) {
          ageMins!.push(range.min);
          ageMaxs!.push(range.max);
        }
      });
    }

    const { data: statsData, error } = await supabase.rpc("get_question_stats_filtered", {
      question_uuid: questionId,
      filter_party_ids: partyIdsParam,
      filter_team_ids: teamIdsParam,
      filter_gender: filters.gender as any,
      filter_age_mins: ageMins,
      filter_age_maxs: ageMaxs,
    });

    if (statsData && !error) {
      const total = statsData.length > 0 ? Number(statsData[0].total_votes) : 0;
      const options = statsData.map((stat) => ({
        id: stat.option_id,
        text: stat.option_text,
        option_order: stat.option_order,
        count: Number(stat.vote_count),
        percentage: stat.percentage,
      }));
      setResults((prev) => ({ ...prev, [questionId]: { options, total } }));
    }
  };

  const handleAnswer = async (questionId: string) => {
    const optionId = answers[questionId];
    if (!optionId) {
      toast({ title: "Error", description: "Selecciona una opción", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("user_answers").insert({
        user_id: userId,
        question_id: questionId,
        answer_option_id: optionId,
      });
      if (error) throw error;
      toast({ title: "Respuesta enviada", description: "Tu respuesta ha sido registrada" });
      await loadResults(questionId);
      setUserAnswers((prev) => ({ ...prev, [questionId]: { answer_option_id: optionId } }));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionCard = (question: any) => {
    const hasAnswered = !!userAnswers[question.id];
    const result = results[question.id];

    return (
      <Card key={question.id} className="p-6 bg-card shadow-sm border">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Atemporal
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground">{question.text}</h3>
            </div>
            {hasAnswered && (
              <CheckCircle2 className={`w-6 h-6 ${module === "politica" ? "text-primary" : "text-secondary"}`} />
            )}
          </div>

          {!hasAnswered ? (
            <div className="space-y-4">
              <RadioGroup
                value={answers[question.id] || ""}
                onValueChange={(value) => setAnswers({ ...answers, [question.id]: value })}
              >
                {question.answer_options.map((option: any) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.id} id={option.id} />
                    <Label htmlFor={option.id} className="cursor-pointer">
                      {option.text}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <Button
                onClick={() => handleAnswer(question.id)}
                disabled={loading}
                className={
                  module === "politica" ? "bg-primary hover:bg-primary/90" : "bg-secondary hover:bg-secondary/90"
                }
              >
                Enviar respuesta
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Resultados ({result?.total || 0} respuestas):</p>
              {result?.options.map((option: any) => (
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
  };

  if (questions.length === 0)
    return (
      <Card className="p-8 text-center bg-card">
        <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No hay preguntas atemporales disponibles</p>
        <p className="text-sm text-muted-foreground mt-2">
          Las preguntas atemporales son debates clásicos que no dependen de la actualidad
        </p>
      </Card>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Preguntas Atemporales</h2>
          <p className="text-sm text-muted-foreground mt-1">Debates clásicos que trascienden la actualidad</p>
        </div>
        <span className="text-sm text-muted-foreground">{questions.length} preguntas</span>
      </div>

      <StatsFilters module={module} onFiltersChange={setFilters} />

      <div className="space-y-4">
        {questions.map(renderQuestionCard)}
      </div>
    </div>
  );
};
