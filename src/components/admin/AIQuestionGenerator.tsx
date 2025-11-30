import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Save, Loader2, Calendar as CalendarIcon, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getCurrentWeekStart } from "@/lib/dateUtils";

export const AIQuestionGenerator = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // -- ESTADOS DEL FORMULARIO --
  const [module, setModule] = useState<"politica" | "futbol">("politica");
  const [parties, setParties] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  // Inputs para la IA
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [topic, setTopic] = useState(""); // La noticia o tema
  const [weekStartDate, setWeekStartDate] = useState<Date | undefined>(new Date(getCurrentWeekStart()));

  // -- RESULTADO DE LA IA --
  const [generatedData, setGeneratedData] = useState<{
    question: string;
    options: string[];
  } | null>(null);

  // Cargar listas al inicio
  useEffect(() => {
    const loadData = async () => {
      const { data: p } = await supabase.from("parties").select("*").order("name");
      if (p) setParties(p);
      const { data: t } = await supabase.from("teams").select("*").order("name");
      if (t) setTeams(t);
    };
    loadData();
  }, []);

  // --- FUNCIÓN MÁGICA: LLAMAR A LA IA ---
  const handleGenerate = async () => {
    if (!selectedEntityId) {
      toast({
        title: "Falta información",
        description: "Selecciona un partido o equipo primero.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setGeneratedData(null); // Limpiamos lo anterior

    try {
      // 1. Buscamos el nombre real (Texto) de la entidad seleccionada
      const entityList = module === "politica" ? parties : teams;
      const entityName = entityList.find((e) => e.id === selectedEntityId)?.name || "Entidad desconocida";

      // 2. Llamamos a tu Edge Function
      const { data, error } = await supabase.functions.invoke("generate-ai-question", {
        body: {
          topic: topic.trim(),
          entity: entityName,
          module: module,
        },
      });

      if (error) throw error;

      // 3. ¡Éxito! Guardamos el resultado para editarlo
      setGeneratedData(data);
      toast({ title: "¡Propuesta lista!", description: "Revisa los textos antes de publicar." });
    } catch (error: any) {
      console.error("Error IA:", error);
      toast({
        title: "Error",
        description: "La IA no respondió. Verifica tu API Key o conexión.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- GUARDAR EN LA BASE DE DATOS ---
  const handleSave = async () => {
    if (!generatedData || !weekStartDate) return;

    setSaving(true);
    try {
      const formattedDate = format(weekStartDate, "yyyy-MM-dd");

      // 1. Insertar la Pregunta
      const questionPayload: any = {
        text: generatedData.question,
        module,
        scope: "specific", // Asumimos específica porque elegiste una entidad
        week_start_date: formattedDate,
        is_mandatory: false,
      };

      // Asignar al ID correcto según el módulo
      if (module === "politica") questionPayload.party_id = selectedEntityId;
      else questionPayload.team_id = selectedEntityId;

      const { data: qData, error: qError } = await supabase.from("questions").insert(questionPayload).select().single();

      if (qError) throw qError;

      // 2. Insertar las Opciones
      const optionsPayload = generatedData.options.map((text, idx) => ({
        question_id: qData.id,
        text: text,
        option_order: idx,
      }));

      const { error: oError } = await supabase.from("answer_options").insert(optionsPayload);
      if (oError) throw oError;

      toast({ title: "¡Publicado!", description: "La encuesta ya está en la base de datos." });

      // Limpiar para la siguiente
      setGeneratedData(null);
      setTopic("");
    } catch (error: any) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Ajustar fecha al lunes
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const dayOfWeek = date.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    setWeekStartDate(monday);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* --- PANEL IZQUIERDO: CONFIGURACIÓN --- */}
      <Card className="h-fit border-l-4 border-l-primary shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-purple-600 fill-purple-100" />
            Generador IA
          </CardTitle>
          <CardDescription>Dime el tema y yo redacto la encuesta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select
                value={module}
                onValueChange={(v: any) => {
                  setModule(v);
                  setSelectedEntityId("");
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

            <div className="space-y-2">
              <Label>{module === "politica" ? "Partido" : "Equipo"}</Label>
              <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {(module === "politica" ? parties : teams).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground/80">Tema o Noticia (Contexto)</Label>
            <Textarea
              placeholder={
                module === "politica"
                  ? "Ej: La nueva ley de vivienda aprobada ayer..."
                  : "Ej: La polémica arbitral del último partido..."
              }
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="resize-none h-24 text-base"
            />
            <p className="text-xs text-muted-foreground">Cuantos más detalles des, mejor será la pregunta.</p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !selectedEntityId}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium shadow-md transition-all"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Pensando preguntas...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generar Propuesta
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* --- PANEL DERECHO: RESULTADO --- */}
      {generatedData ? (
        // Quitamos bg-white para volver al fondo oscuro por defecto
        <Card className="shadow-lg border-2 border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* CABECERA: Gris oscuro (bg-gray-800) y texto claro */}
          <CardHeader className="bg-gray-800/50 pb-4 border-b border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg text-gray-100 font-bold">Borrador de Encuesta</CardTitle>
                <CardDescription className="text-gray-400">
                  Puedes editar cualquier texto antes de guardar.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGeneratedData(null)}
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Descartar
              </Button>
            </div>
          </CardHeader>

          {/* CONTENIDO: Fondo oscuro y textos legibles */}
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label className="text-purple-400 font-semibold text-base">Pregunta Generada</Label>
              {/* Textarea con fondo oscuro y letra clara */}
              <Textarea
                value={generatedData.question}
                onChange={(e) => setGeneratedData({ ...generatedData, question: e.target.value })}
                className="font-medium text-lg min-h-[80px] border-gray-700 focus-visible:ring-purple-500 bg-gray-900/50 text-gray-100 shadow-sm"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-purple-400 font-semibold text-base">Opciones de Respuesta</Label>
              {generatedData.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-900 text-purple-100 text-sm font-bold shadow-sm border border-purple-700">
                    {idx + 1}
                  </span>
                  {/* Input con fondo oscuro y letra clara */}
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...generatedData.options];
                      newOpts[idx] = e.target.value;
                      setGeneratedData({ ...generatedData, options: newOpts });
                    }}
                    className="border-gray-700 focus-visible:ring-purple-500 bg-gray-900/50 text-gray-100 shadow-sm font-medium"
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-800 space-y-2">
              <Label className="text-gray-400 font-semibold">Fecha de Publicación</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-medium border-2 border-gray-700 bg-gray-900/50 text-gray-100 shadow-sm hover:bg-gray-800 hover:text-white",
                      !weekStartDate && "text-gray-500 border-dashed",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-5 w-5 text-purple-500" />
                    {weekStartDate ? (
                      <span className="font-medium">{format(weekStartDate, "PPP", { locale: es })}</span>
                    ) : (
                      <span>Selecciona la semana...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 bg-gray-900 border-gray-700 text-gray-100 shadow-xl"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={weekStartDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    locale={es}
                    className="p-3 rounded-md border border-gray-800 bg-gray-950 text-white"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md h-12 text-base mt-2 font-bold"
              size="lg"
            >
              {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
              Aprobar y Publicar
            </Button>
          </CardContent>
        </Card>
      ) : (
        // Estado vacío (placeholder oscuro)
        <div className="hidden lg:flex h-full items-center justify-center border-2 border-dashed border-gray-800 rounded-lg bg-gray-900/20 p-12 text-center text-gray-500">
          <div>
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium opacity-50">La propuesta de la IA aparecerá aquí</p>
          </div>
        </div>
      )}
    </div>
  );
};
