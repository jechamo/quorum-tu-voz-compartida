import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { StatsFilters, FilterState, AGE_RANGES } from "./StatsFilters";
import { useToast } from "@/hooks/use-toast";
import { QuestionComments } from "./QuestionComments";
import { useAuth } from "@/contexts/AuthContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// --- RANKINGS (Mismos que en WeeklySurveys) ---
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

interface WeeklyHistoryProps {
  module: "politica" | "futbol";
  userId: string;
}

export const WeeklyHistory = ({ module, userId }: WeeklyHistoryProps) => {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<any>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: string }>({});
  const [userProfile, setUserProfile] = useState<any>(null);

  const [filters, setFilters] = useState<FilterState>({
    partyIds: [],
    teamIds: [],
    gender: null,
    ageRanges: [],
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("party_id, team_id").eq("id", userId).single();
      setUserProfile(data);
    };
    fetchProfile();
    loadWeeks();
  }, [module, isAdmin, userId]);

  useEffect(() => {
    if (selectedWeek) {
      loadWeekData(selectedWeek);
    }
  }, [selectedWeek, filters]);

  const loadWeeks = async () => {
    let query = supabase.from("questions").select("week_start_date").eq("module", module);
    if (!isAdmin) {
      const today = new Date().toISOString().split("T")[0];
      query = query.lte("week_start_date", today);
    }
    const { data } = await query.order("week_start_date", { ascending: false }).limit(100);

    if (data) {
      const uniqueWeeks = Array.from(new Set(data.map((d) => d.week_start_date)));
      setWeeks(uniqueWeeks);
      if (uniqueWeeks.length > 0) setSelectedWeek(uniqueWeeks[0]);
      else {
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
          // Prepare params for RPC
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

          const { data: statsData } = await supabase.rpc("get_question_stats_filtered", {
            question_uuid: question.id,
            filter_party_ids: partyIdsParam,
            filter_team_ids: teamIdsParam,
            filter_gender: filters.gender as any,
            filter_age_mins: ageMins,
            filter_age_maxs: ageMaxs,
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
    if (index < weeks.length - 1) setSelectedWeek(weeks[index + 1]);
  };
  const goToNextWeek = () => {
    const index = getWeekIndex();
    if (index > 0) setSelectedWeek(weeks[index - 1]);
  };
  const formatWeekDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

  const handleAnswer = async (questionId: string) => {
    const answerId = answers[questionId];
    if (!answerId) {
      toast({ title: "Error", description: "Selecciona respuesta", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from("user_answers").insert({
        user_id: userId,
        question_id: questionId,
        answer_option_id: answerId,
      });
      if (error) throw error;
      toast({ title: "Respuesta enviada", description: "Registrada correctamente" });
      if (selectedWeek) loadWeekData(selectedWeek);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo enviar", variant: "destructive" });
    }
  };

  // Grouping & Sorting Logic (Identical to WeeklySurveys)
  const questionsList = weekData || [];
  const generalQuestions = questionsList.filter((q: any) => q.scope === "general");
  const myAffiliationQuestions = questionsList.filter((q: any) => {
    if (q.scope !== "specific") return false;
    if (module === "politica") return q.party_id === userProfile?.party_id;
    if (module === "futbol") return q.team_id === userProfile?.team_id;
    return false;
  });
  const otherQuestions = questionsList.filter(
    (q: any) => !generalQuestions.includes(q) && !myAffiliationQuestions.includes(q),
  );

  otherQuestions.sort((a: any, b: any) => {
    const nameA = a.parties?.name || a.teams?.name || "";
    const nameB = b.parties?.name || b.teams?.name || "";
    const rankA = (module === "politica" ? PARTY_RANKING[nameA] : TEAM_RANKING[nameA]) || 999;
    const rankB = (module === "politica" ? PARTY_RANKING[nameB] : TEAM_RANKING[nameB]) || 999;
    if (rankA !== rankB) return rankA - rankB;
    return nameA.localeCompare(nameB);
  });

  const renderQuestionCard = (question: any) => {
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
              <p className="text-sm font-semibold text-foreground">Resultados ({question.results.total} respuestas):</p>
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
  };

  if (weeks.length === 0)
    return (
      <Card className="p-8 text-center bg-card">
        <p className="text-muted-foreground">No hay historial disponible</p>
      </Card>
    );

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
      ) : (
        <Card className="p-8 text-center bg-card">
          <p className="text-muted-foreground">No hay datos para esta semana</p>
        </Card>
      )}
    </div>
  );
};
