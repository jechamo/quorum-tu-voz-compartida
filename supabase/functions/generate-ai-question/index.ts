import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { topic, entity, module, mode, entitiesList, model } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

    if (!OPENAI_API_KEY || !TAVILY_API_KEY) throw new Error("Faltan API Keys");

    // 1. ESTRATEGIA DE BÚSQUEDA INTELIGENTE
    let contextNews = "";

    // Definimos dominios según el módulo
    const domains =
      module === "futbol"
        ? ["marca.com", "as.com", "mundodeportivo.com", "sport.es", "relevo.com"]
        : ["elpais.com", "elmundo.es", "elconfidencial.com", "okdiario.com", "eldiario.es", "abc.es", "elespanol.com"];

    // Construimos la Query principal
    let primaryQuery = "";
    if (mode === "batch") {
      primaryQuery = `Noticias última hora polémica ${module} España actualidad`;
    } else {
      // Truco: Quitamos la palabra "polémica" de la búsqueda estricta para encontrar más resultados,
      // la IA ya buscará la polémica dentro de la noticia.
      primaryQuery = `${entity} ${module} España noticias última hora ${topic || ""}`;
    }

    console.log(`🔎 Buscando: "${primaryQuery}"`);

    // Hacemos la búsqueda
    const searchResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: primaryQuery,
        search_depth: "news",
        include_domains: domains,
        max_results: mode === "batch" ? 7 : 5, // Más resultados para tener donde elegir
      }),
    });

    const searchData = await searchResponse.json();

    if (searchData.results && searchData.results.length > 0) {
      contextNews = searchData.results.map((r: any) => `- ${r.title}: ${r.content}`).join("\n");
      console.log(`✅ Encontradas ${searchData.results.length} noticias.`);
    } else {
      console.log("⚠️ No se encontraron noticias específicas. Usando contexto general.");
      contextNews =
        "No hay noticias de última hora específicas. Usa tu conocimiento general sobre polémicas recientes y recurrentes de esta entidad.";
    }

    // 2. PROMPT "SALSERO" REFORZADO
    const systemPrompt = `
      Eres el redactor jefe más polémico de España.
      
      TU MISIÓN: Generar debate social intenso.
      
      FUENTES (ÚSALAS SI PUEDES, SI NO, TIRA DE HEMEROTECA RECIENTE):
      ${contextNews}

      OBJETIVO:
      ${
        mode === "batch"
          ? `Genera una batería de preguntas:
           1. OBLIGATORIO: Una pregunta GENERAL sobre el tema más caliente del momento en ${module}.
           2. OPCIONAL: Preguntas específicas para: [${entitiesList ? entitiesList.join(", ") : ""}].
           IMPORTANTE: Intenta sacar al menos 3 preguntas en total. Si no hay noticia de hoy para un partido/equipo, busca su polémica más reciente (siempre hay algo).`
          : `Genera una encuesta sobre: ${entity}. Si no hay noticia de hoy, usa su polémica recurrente más famosa.`
      }

      REGLAS DE ORO:
      1. PREGUNTAS CORTAS Y DIRECTAS: "¿Es culpable...?", "¿Debe dimitir...?", "¿Acierto o error?".
      2. OPCIONES CON ACTITUD: [Indignado], [Defensor a muerte], [Escéptico], [Indiferente].
      3. PROHIBIDO: Preguntas tibias como "¿Qué opinas de la situación?".
      
      FORMATO JSON:
      {
        "results": [
          { "question": "¿...?", "options": ["...", "...", "...", "..."], "target_entity": "Nombre" }
        ]
      }
    `;

    const aiModel = model || "gpt-4o-mini";
    const requestBody: any = {
      model: aiModel,
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
    };

    if (aiModel.includes("gpt-5") || aiModel.startsWith("o1")) {
      requestBody.max_completion_tokens = 4000;
    } else {
      requestBody.max_tokens = 4000;
      requestBody.temperature = 0.9; // Subimos la temperatura para que sea más creativo si no hay noticias
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!openAiResponse.ok) {
      const err = await openAiResponse.text();
      throw new Error(`OpenAI Error: ${err}`);
    }

    const aiData = await openAiResponse.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
