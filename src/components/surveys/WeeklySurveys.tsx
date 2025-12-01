import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";
import { getCurrentWeekStart } from "@/lib/dateUtils";
import { StatsFilters, FilterState, AGE_RANGES } from "./StatsFilters";
import { QuestionComments } from "./QuestionComments";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// --- RANKINGS ---
const PARTY_RANKING: Record<string, number> = {
  "Partido Popular": 1,
  PSOE: 2,
  VOX: 3,
  Sumar: 4,
  ERC: 5,
  Junts: 6,
  Bildu: 7,
  PNV: 8,
  Podemos: 9,
  BNG: 10,
  Compromís: 11,
  Ciudadanos: 99,
};

const TEAM_RANKING: Record<string, number> = {
  "FC Barcelona": 1,
  "Real Madrid": 2,
  "Villarreal CF": 3,
  "Atlético de Madrid": 4,
  "Real Betis": 5,
  "RCD Espanyol": 6,
  "Getafe CF": 7,
  "Athletic Club": 8,
  "Real Sociedad": 9,
  "Rayo Vallecano": 10,
  "Celta de Vigo": 11,
  "Sevilla FC": 12,
  "Deportivo Alavés": 13,
  "RCD Mallorca": 14,
  "Valencia CF": 15,
  "CA Osasuna": 16,
  "Girona FC": 17,
  "UD Las Palmas": 18,
  "CD Leganés": 19,
  "Real Valladolid": 20,
};

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
    partyIds: [],
    teamIds: [],
    gender: null,
    ageRanges: [], // Multi-select edad
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
        for (const questionId of Object.keys(answersMap)) await loadResults(questionId);
      }
    }
  };

  const loadResults = async (questionId: string) => {
    // 1. Preparar Arrays de IDs
    const partyIdsParam = filters.partyIds.length > 0 ? filters.partyIds : null;
    const teamIdsParam = filters.teamIds.length > 0 ? filters.teamIds : null;

    // 2. Preparar Arrays de Edad (Mins y Maxs)
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
      filter_age_mins: ageMins, // Nueva firma SQL
      filter_age_maxs: ageMaxs, // Nueva firma SQL
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

  // --- ORDENACIÓN Y AGRUPACIÓN ---
  const generalQuestions = questions.filter((q) => q.scope === "general");

  const myAffiliationQuestions = questions.filter((q) => {
    if (q.scope !== "specific") return false;
    if (module === "politica") return q.party_id === userProfile?.party_id;
    if (module === "futbol") return q.team_id === userProfile?.team_id;
    return false;
  });

  const otherQuestions = questions.filter((q) => !generalQuestions.includes(q) && !myAffiliationQuestions.includes(q));

  otherQuestions.sort((a, b) => {
    const nameA = a.parties?.name || a.teams?.name || "";
    const nameB = b.parties?.name || b.teams?.name || "";
    const rankA = (module === "politica" ? PARTY_RANKING[nameA] : TEAM_RANKING[nameA]) || 999;
    const rankB = (module === "politica" ? PARTY_RANKING[nameB] : TEAM_RANKING[nameB]) || 999;
    if (rankA !== rankB) return rankA - rankB;
    return nameA.localeCompare(nameB);
  });

  const renderQuestionCard = (question: any) => {
    const hasAnswered = !!userAnswers[question.id];
    const result = results[question.id];

    return (
      <Card key={question.id} className="p-6 bg-card shadow-sm border">
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

  if (questions.length === 0)
    return (
      <Card className="p-8 text-center bg-card">
        <p className="text-muted-foreground">No hay encuestas disponibles</p>
      </Card>
    );

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
        {generalQuestions.length > 0 && (
          <AccordionItem value="general" className="border rounded-lg bg-card px-4 shadow-sm">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="text-lg font-bold text-foreground">Preguntas Generales</span>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-4 space-y-4">
              {generalQuestions.map(renderQuestionCard)}
            </AccordionContent>
          </AccordionItem>
        )}
        {myAffiliationQuestions.length > 0 && (
          <AccordionItem value="my-affiliation" className="border rounded-lg bg-card px-4 shadow-sm">
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
        {otherQuestions.length > 0 && (
          <AccordionItem value="others" className="border rounded-lg bg-card px-4 shadow-sm">
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
