import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { topic, entity, module, model, mode, entitiesList } = await req.json();

    // Recuperar claves
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

    if (!OPENAI_API_KEY || !TAVILY_API_KEY) {
      throw new Error("Faltan claves API (OpenAI o Tavily)");
    }

    // 1. FASE DE INVESTIGACIÓN (Búsqueda en Internet)
    // Construimos la query de búsqueda
    let searchQuery = "";
    if (mode === "batch") {
      searchQuery = `Noticias polémicas última hora ${module} España actualidad debate`;
    } else {
      searchQuery = `Noticias última hora polémica ${entity} ${module} España ${topic || ""}`;
    }

    console.log(`🔎 Buscando en internet: "${searchQuery}"...`);

    const searchResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: searchQuery,
        search_depth: "news", // Prioriza noticias recientes
        include_domains: ["elpais.com", "elmundo.es", "marca.com", "as.com", "elconfidencial.com"], // Fuentes fiables
        max_results: 5,
      }),
    });

    const searchData = await searchResponse.json();
    const contextNews = searchData.results.map((r: any) => `- ${r.title}: ${r.content}`).join("\n");

    console.log("📰 Noticias encontradas:", searchData.results.length);

    // 2. FASE DE GENERACIÓN (GPT)
    const systemPrompt = `
      Actúa como un redactor jefe de un medio digital deportivo/político. Tienes acceso a noticias de última hora.
      
      TU MISIÓN:
      Generar encuestas de debate MUY ACTUALES y POLÉMICAS basadas en las noticias proporcionadas.
      
      REGLAS DE ESTILO:
      - Tono: Periodístico pero incisivo. Busca la controversia.
      - Preguntas: Nada de "¿Qué opinas?". Usa "¿Es un error...?", "¿Debería dimitir...?", "¿Robo o acierto?".
      - Opciones: 4 opciones cortas (máx 5 palabras). Deben cubrir: [Muy a favor], [Muy en contra], [Postura matizada], [Otra visión].
      
      NOTICIAS DE HOY (Contexto Real):
      ${contextNews}
      
      FORMATO JSON OBLIGATORIO:
      Devuelve un objeto con un array "results":
      {
        "results": [
          { 
            "question": "Texto de la pregunta", 
            "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
            "target_entity": "Nombre de la entidad (o 'General')"
          }
        ]
      }
    `;

    let userPrompt = "";
    if (mode === "batch") {
      userPrompt = `
        Genera una batería de preguntas (BATCH):
        1. Una pregunta GENERAL sobre la noticia más importante de hoy en ${module}.
        2. Una pregunta específica para cada uno de estos protagonistas (si hay noticias sobre ellos en el contexto): ${entitiesList.join(", ")}.
        Si no hay noticias relevantes de alguno, sáltalo.
      `;
    } else {
      userPrompt = `Genera una encuesta específica y picante sobre: ${entity}. Contexto extra: ${topic}`;
    }

    // Usamos el modelo que pidió el usuario (gpt-5-mini o el que sea)
    const aiModel = model || "gpt-4o-mini";

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8, // Creatividad alta para polémica
        response_format: { type: "json_object" }, // Forzar JSON
      }),
    });

    const aiJson = await openAiResponse.json();
    const content = aiJson.choices[0].message.content;
    const result = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
