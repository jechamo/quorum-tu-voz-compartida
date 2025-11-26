import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export const QuestionsManagement = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Form state
  const [questionText, setQuestionText] = useState("");
  const [module, setModule] = useState<'politica' | 'futbol'>('politica');
  const [scope, setScope] = useState<'general' | 'specific'>('general');
  const [selectedParty, setSelectedParty] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [weekStartDate, setWeekStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isMandatory, setIsMandatory] = useState(false);
  const [options, setOptions] = useState<string[]>(["", ""]);

  useEffect(() => {
    loadQuestions();
    loadParties();
    loadTeams();
  }, []);

  const loadQuestions = async () => {
    const { data } = await supabase
      .from('questions')
      .select('*, parties(name), teams(name), answer_options(*)')
      .order('week_start_date', { ascending: false });
    if (data) setQuestions(data);
  };

  const loadParties = async () => {
    const { data } = await supabase.from('parties').select('*').order('name');
    if (data) setParties(data);
  };

  const loadTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('name');
    if (data) setTeams(data);
  };

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast({
        title: "Error",
        description: "Debe haber al menos 2 opciones",
        variant: "destructive",
      });
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    if (!questionText.trim()) {
      toast({
        title: "Error",
        description: "La pregunta no puede estar vacía",
        variant: "destructive",
      });
      return;
    }

    const filledOptions = options.filter(o => o.trim());
    if (filledOptions.length < 2) {
      toast({
        title: "Error",
        description: "Debe haber al menos 2 opciones con texto",
        variant: "destructive",
      });
      return;
    }

    if (scope === 'specific') {
      if (module === 'politica' && !selectedParty) {
        toast({
          title: "Error",
          description: "Selecciona un partido para pregunta específica",
          variant: "destructive",
        });
        return;
      }
      if (module === 'futbol' && !selectedTeam) {
        toast({
          title: "Error",
          description: "Selecciona un equipo para pregunta específica",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const questionData: any = {
        text: questionText.trim(),
        module,
        scope,
        week_start_date: weekStartDate,
        is_mandatory: isMandatory,
      };

      if (scope === 'specific') {
        if (module === 'politica') {
          questionData.party_id = selectedParty;
        } else {
          questionData.team_id = selectedTeam;
        }
      }

      const { data: question, error: qError } = await supabase
        .from('questions')
        .insert(questionData)
        .select()
        .single();

      if (qError) throw qError;

      const answerOptions = filledOptions.map((text, index) => ({
        question_id: question.id,
        text: text.trim(),
        option_order: index,
      }));

      const { error: oError } = await supabase.from('answer_options').insert(answerOptions);
      if (oError) throw oError;

      toast({
        title: "Pregunta creada",
        description: "La pregunta ha sido creada correctamente",
      });

      // Reset form
      setQuestionText("");
      setScope('general');
      setSelectedParty("");
      setSelectedTeam("");
      setIsMandatory(false);
      setOptions(["", ""]);
      loadQuestions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la pregunta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta pregunta?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: "Pregunta eliminada",
        description: "La pregunta ha sido eliminada",
      });
      loadQuestions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la pregunta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card">
        <h3 className="font-display font-semibold text-lg mb-4">Crear Nueva Pregunta</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="module">Módulo</Label>
              <Select value={module} onValueChange={(v: any) => setModule(v)}>
                <SelectTrigger id="module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="politica">Política</SelectItem>
                  <SelectItem value="futbol">La Liga</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="week">Fecha inicio semana</Label>
              <Input
                id="week"
                type="date"
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="question">Pregunta</Label>
            <Input
              id="question"
              placeholder="¿Cuál es tu opinión sobre...?"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="scope">Tipo</Label>
              <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="specific">Específica (partido/equipo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === 'specific' && module === 'politica' && (
              <div>
                <Label htmlFor="party">Partido</Label>
                <Select value={selectedParty} onValueChange={setSelectedParty}>
                  <SelectTrigger id="party">
                    <SelectValue placeholder="Selecciona partido" />
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === 'specific' && module === 'futbol' && (
              <div>
                <Label htmlFor="team">Equipo</Label>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger id="team">
                    <SelectValue placeholder="Selecciona equipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="mandatory"
              checked={isMandatory}
              onCheckedChange={(checked) => setIsMandatory(checked as boolean)}
            />
            <Label htmlFor="mandatory" className="cursor-pointer">
              Pregunta obligatoria
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Opciones de respuesta</Label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Opción ${index + 1}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                />
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(index)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" onClick={handleAddOption} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Añadir opción
            </Button>
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            Crear Pregunta
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="font-display font-semibold text-lg">Preguntas Existentes ({questions.length})</h3>
        {questions.map((q) => (
          <Card key={q.id} className="p-4 bg-card">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${q.module === 'politica' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'}`}>
                    {q.module === 'politica' ? 'Política' : 'La Liga'}
                  </span>
                  {q.is_mandatory && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                      Obligatoria
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Semana: {new Date(q.week_start_date).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-medium text-foreground">{q.text}</p>
                {q.scope === 'specific' && (
                  <p className="text-sm text-muted-foreground">
                    {q.parties ? `Partido: ${q.parties.name}` : `Equipo: ${q.teams.name}`}
                  </p>
                )}
                <div className="mt-2 space-y-1">
                  {q.answer_options?.map((opt: any) => (
                    <div key={opt.id} className="text-sm text-muted-foreground">
                      • {opt.text}
                    </div>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(q.id)}
                disabled={loading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
