import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";
import { getCurrentWeekStart } from "@/lib/dateUtils";
import { StatsFilters, FilterState } from "./StatsFilters";
import { QuestionComments } from "./QuestionComments";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface WeeklySurveysProps {
  module: "politica" | "futbol";
  userId: string;
}

export const WeeklySurveys = ({ module, userId }: WeeklySurveysProps) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [filters, setFilters] = useState<FilterState>({
    partyId: null,
    teamId: null,
    gender: null,
    ageMin: null,
    ageMax: null,
  });
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("party_id, team_id").eq("id", userId).single();
      setUserProfile(data);
    };
    fetchProfile();
    loadWeeklyQuestions();
  }, [module, userId]);

  useEffect(() => {
    Object.keys(userAnswers).forEach((questionId) => {
      loadResults(questionId);
    });
  }, [filters]);

  const loadWeeklyQuestions = async () => {
    const weekStart = getCurrentWeekStart();
    const { data: questionsData } = await supabase
      .from("questions")
      .select("*, answer_options(*), parties(name), teams(name)")
      .eq("module", module)
      .eq("week_start_date", weekStart)
      .order("is_mandatory", { ascending: false });

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

        for (const questionId of Object.keys(answersMap)) {
          await loadResults(questionId);
        }
      }
    }
  };

  const loadResults = async (questionId: string) => {
    const { data: statsData, error } = await supabase.rpc("get_question_stats_filtered", {
      question_uuid: questionId,
      filter_party_id: filters.partyId,
      filter_team_id: filters.teamId,
      filter_gender: filters.gender as any,
      filter_age_min: filters.ageMin,
      filter_age_max: filters.ageMax,
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
      toast({ title: "Error", description: error.message || "No se pudo enviar la respuesta", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Agrupación
  const generalQuestions = questions.filter((q) => q.scope === "general");

  const myAffiliationQuestions = questions.filter((q) => {
    if (q.scope !== "specific") return false;
    if (module === "politica") return q.party_id === userProfile?.party_id;
    if (module === "futbol") return q.team_id === userProfile?.team_id;
    return false;
  });

  const otherQuestions = questions.filter((q) => !generalQuestions.includes(q) && !myAffiliationQuestions.includes(q));

  // Ordenar "Otros" alfabéticamente (ya que no tenemos columna 'escaños' en BD)
  otherQuestions.sort((a, b) => {
    const nameA = a.parties?.name || a.teams?.name || "";
    const nameB = b.parties?.name || b.teams?.name || "";
    return nameA.localeCompare(nameB);
  });

  const renderQuestionCard = (question: any) => {
    const hasAnswered = !!userAnswers[question.id];
    const result = results[question.id];

    return (
      <Card key={question.id} className="p-6 bg-card">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
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

  if (questions.length === 0) {
    return (
      <Card className="p-8 text-center bg-card">
        <p className="text-muted-foreground">No hay encuestas disponibles para esta semana</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold text-foreground">Encuestas de esta semana</h2>
        <span className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>

      <StatsFilters module={module} onFiltersChange={setFilters} />

      <Accordion type="multiple" defaultValue={["general", "my-affiliation", "others"]} className="space-y-4">
        {/* BLOQUE 1: GENERAL */}
        {generalQuestions.length > 0 && (
          <AccordionItem value="general" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="text-lg font-bold text-foreground">Preguntas Generales</span>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-4 space-y-4">
              {generalQuestions.map(renderQuestionCard)}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* BLOQUE 2: MI AFILIACIÓN */}
        {myAffiliationQuestions.length > 0 && (
          <AccordionItem value="my-affiliation" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="text-lg font-bold text-foreground">
                Mi {module === "politica" ? "Partido" : "Equipo"}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-4 space-y-4">
              {myAffiliationQuestions.map(renderQuestionCard)}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* BLOQUE 3: OTROS */}
        {otherQuestions.length > 0 && (
          <AccordionItem value="others" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="text-lg font-bold text-foreground">
                Otras Encuestas ({module === "politica" ? "Resto de Partidos" : "Resto de Equipos"})
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-4 space-y-4">
              {otherQuestions.map(renderQuestionCard)}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
};
