import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Save, Loader2, Calendar as CalendarIcon, Trash2, Globe, Zap, Layers } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getCurrentWeekStart } from "@/lib/dateUtils";
import { Switch } from "@/components/ui/switch";

interface GeneratedQuestion {
  id: string;
  question: string;
  options: string[];
  target_entity_id?: string;
  target_entity_name?: string;
}

export const AIQuestionGenerator = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // -- CONFIGURACIÓN --
  const [module, setModule] = useState<"politica" | "futbol">("politica");
  // AQUÍ ESTÁ TU PREFERENCIA: Por defecto gpt-4o-mini
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [isBatchMode, setIsBatchMode] = useState(false);

  const [parties, setParties] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  // Inputs
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [topic, setTopic] = useState("");
  const [weekStartDate, setWeekStartDate] = useState<Date | undefined>(new Date(getCurrentWeekStart()));

  // Resultados (Lista)
  const [results, setResults] = useState<GeneratedQuestion[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const { data: p } = await supabase.from("parties").select("*").order("name");
      if (p) setParties(p);
      const { data: t } = await supabase.from("teams").select("*").order("name");
      if (t) setTeams(t);
    };
    loadData();
  }, []);

  const handleGenerate = async () => {
    if (!isBatchMode && !selectedEntityId) {
      toast({ title: "Error", description: "Selecciona una entidad o activa el modo Lote.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const entityList = module === "politica" ? parties : teams;
      let payload: any = {
        topic: topic.trim(),
        module,
        model: aiModel, // Enviamos el modelo seleccionado (gpt-4o-mini por defecto)
        mode: isBatchMode ? "batch" : "single",
      };

      if (isBatchMode) {
        payload.entitiesList = entityList.map((e) => e.name);
      } else {
        payload.entity = entityList.find((e) => e.id === selectedEntityId)?.name || "Entidad";
      }

      // Llamada al Backend (que ya soporta búsqueda en Tavily y GPT-5)
      const { data, error } = await supabase.functions.invoke("generate-ai-question", { body: payload });

      if (error) throw error;

      if (data && data.results) {
        const processed = data.results.map((item: any, idx: number) => {
          let matchedId = selectedEntityId;
          let matchedName = item.target_entity;

          if (isBatchMode) {
            const match = entityList.find(
              (e) => item.target_entity && e.name.toLowerCase().includes(item.target_entity.toLowerCase()),
            );
            if (match) {
              matchedId = match.id;
              matchedName = match.name;
            } else {
              matchedId = "";
              matchedName = "General / Actualidad";
            }
          }

          return {
            id: Date.now() + idx.toString(),
            question: item.question,
            options: item.options,
            target_entity_id: matchedId,
            target_entity_name: matchedName || (isBatchMode ? "General" : payload.entity),
          };
        });
        setResults(processed);
        toast({ title: "¡Noticias analizadas!", description: `Se han generado ${processed.length} propuestas.` });
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Fallo al conectar con la IA. ¿Tienes la API de Tavily configurada?",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (q: GeneratedQuestion) => {
    if (!weekStartDate) {
      toast({ title: "Fecha requerida", description: "Selecciona una fecha arriba.", variant: "destructive" });
      return;
    }

    try {
      const qPayload: any = {
        text: q.question,
        module,
        scope: q.target_entity_id ? "specific" : "general",
        week_start_date: format(weekStartDate, "yyyy-MM-dd"),
        is_mandatory: false,
      };

      if (q.target_entity_id) {
        if (module === "politica") qPayload.party_id = q.target_entity_id;
        else qPayload.team_id = q.target_entity_id;
      }

      const { data: qData, error: qErr } = await supabase.from("questions").insert(qPayload).select().single();
      if (qErr) throw qErr;

      const oPayload = q.options.map((t, i) => ({ question_id: qData.id, text: t, option_order: i }));
      await supabase.from("answer_options").insert(oPayload);

      toast({ title: "Publicado", description: "Pregunta enviada a la App." });
      setResults((prev) => prev.filter((i) => i.id !== q.id));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Helpers de edición
  const updateText = (id: string, field: "question" | "option", val: string, optIdx?: number) => {
    setResults((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === "question") return { ...item, question: val };
        const newOpts = [...item.options];
        if (typeof optIdx === "number") newOpts[optIdx] = val;
        return { ...item, options: newOpts };
      }),
    );
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    setWeekStartDate(d);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* PANEL IZQUIERDO */}
      <div className="lg:col-span-4 space-y-4">
        <Card className="border-l-4 border-l-primary shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              Redacción IA
            </CardTitle>
            <CardDescription>Busca noticias reales y genera debate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* SELECTOR DE MODELO */}
            <div className="flex items-center justify-between bg-muted/40 p-2 rounded border">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <Label>Modelo</Label>
              </div>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Default)</SelectItem>
                  <SelectItem value="gpt-5-mini">GPT-5 Mini (Preview)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (Experto)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Módulo</Label>
              <Select
                value={module}
                onValueChange={(v: any) => {
                  setModule(v);
                  setSelectedEntityId("");
                  setResults([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="politica">Política</SelectItem>
                  <SelectItem value="futbol">Fútbol</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label htmlFor="batch" className="flex flex-col cursor-pointer">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Modo Lote (Batch)
                </span>
                <span className="font-normal text-xs text-muted-foreground">Generar batería completa de preguntas</span>
              </Label>
              <Switch id="batch" checked={isBatchMode} onCheckedChange={setIsBatchMode} />
            </div>

            {!isBatchMode && (
              <div className="space-y-2 animate-in fade-in">
                <Label>Entidad Específica</Label>
                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(module === "politica" ? parties : teams).map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tema / Búsqueda (Opcional)</Label>
              <Textarea
                placeholder={
                  isBatchMode ? "Ej: Escándalos recientes, Polémica arbitral..." : "Ej: Declaraciones de ayer..."
                }
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="resize-none h-24"
              />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label>Fecha Publicación</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !weekStartDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {weekStartDate ? format(weekStartDate, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={weekStartDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || (!isBatchMode && !selectedEntityId)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {loading ? "Investigando..." : "Buscar y Generar"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* PANEL DERECHO: RESULTADOS */}
      <div className="lg:col-span-8 space-y-4">
        {results.length > 0 && (
          <div className="flex justify-between items-center pb-2">
            <h3 className="text-xl font-bold text-foreground">Borradores ({results.length})</h3>
            <Button variant="destructive" size="sm" onClick={() => setResults([])}>
              <Trash2 className="w-4 h-4 mr-2" /> Limpiar
            </Button>
          </div>
        )}

        <div className="grid gap-6">
          {results.map((item) => (
            <Card key={item.id} className="border-2 border-gray-800 shadow-lg bg-card overflow-hidden">
              {/* CABECERA: GRIS OSCURO */}
              <CardHeader className="bg-gray-800 py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded bg-blue-900/50 text-blue-100 text-xs font-bold border border-blue-800 uppercase tracking-wide">
                    {item.target_entity_name}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setResults((p) => p.filter((i) => i.id !== item.id))}
                    className="text-gray-400 hover:text-red-400 hover:bg-gray-700 h-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handlePublish(item)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold h-8 shadow-sm"
                  >
                    <Save className="w-3 h-3 mr-1.5" /> Publicar
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-5 bg-card space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Pregunta
                  </Label>
                  {/* TEXTAREA: FONDO CLARO PARA LEGIBILIDAD SOBRE CARD OSCURA */}
                  <Textarea
                    value={item.question}
                    onChange={(e) => updateText(item.id, "question", e.target.value)}
                    className="font-bold text-lg min-h-[70px] border-gray-700 bg-gray-900/50 text-gray-100 shadow-sm focus-visible:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Opciones
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {item.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-gray-700 text-gray-200 text-xs font-bold border border-gray-600">
                          {idx + 1}
                        </span>
                        {/* INPUT: FONDO CLARO PARA LEGIBILIDAD */}
                        <Input
                          value={opt}
                          onChange={(e) => updateText(item.id, "option", e.target.value, idx)}
                          className="h-9 border-gray-700 bg-gray-900/50 text-gray-100 shadow-sm focus-visible:ring-blue-500 font-medium"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {results.length === 0 && !loading && (
            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-lg bg-gray-900/20 text-muted-foreground">
              <Globe className="w-12 h-12 mb-4 opacity-20" />
              <p>Configura el agente a la izquierda para buscar noticias.</p>
            </div>
          )}

          {loading && (
            <div className="h-64 flex flex-col items-center justify-center space-y-4 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
              <div>
                <p className="text-lg font-medium text-foreground">Analizando actualidad...</p>
                <p className="text-sm text-muted-foreground">Leyendo periódicos digitales en busca de polémica.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
