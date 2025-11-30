import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. AHORA SÍ RECUPERAMOS 'model' DEL FRONTEND
    const { topic, entity, module, mode, entitiesList, model } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

    if (!OPENAI_API_KEY || !TAVILY_API_KEY) throw new Error("Faltan API Keys");

    // 2. LÓGICA DE BÚSQUEDA (TAVILY)
    let searchQuery = "";
    let domains = [];

    // Filtros de dominios estrictos
    if (module === "futbol") {
      domains = ["marca.com", "as.com", "mundodeportivo.com", "sport.es", "relevo.com"];
      searchQuery = `Noticias última hora polémica fútbol La Liga España ${mode === "batch" ? "actualidad general" : entity} ${topic || ""}`;
    } else {
      domains = ["elpais.com", "elmundo.es", "elconfidencial.com", "okdiario.com", "eldiario.es", "abc.es"];
      searchQuery = `Noticias última hora polémica política España gobierno oposición ${mode === "batch" ? "actualidad general" : entity} ${topic || ""}`;
    }

    console.log(`🔎 Buscando (${searchQuery}) con modelo: ${model || "default"}...`);

    const searchResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: searchQuery,
        search_depth: "news",
        include_domains: domains,
        max_results: mode === "batch" ? 7 : 4,
      }),
    });

    const searchData = await searchResponse.json();
    const contextNews = searchData.results
      ? searchData.results.map((r: any) => `- ${r.title}: ${r.content}`).join("\n")
      : "No hay noticias recientes.";

    // 3. PROMPT DINÁMICO
    const systemPrompt = `
      Eres un redactor jefe experto en ${module}.
      
      NOTICIAS DE HOY:
      ${contextNews}

      OBJETIVO:
      ${
        mode === "batch"
          ? `Genera una lista de preguntas:
           1. Una pregunta GENERAL sobre la noticia más importante del día.
           2. Una pregunta ESPECÍFICA para cada uno de estos protagonistas: [${entitiesList ? entitiesList.join(", ") : ""}], PERO SOLO SI hay noticias relacionadas en el texto de arriba.`
          : `Genera una encuesta polémica sobre: ${entity}.`
      }

      REGLAS:
      1. Tono incisivo y de debate actual.
      2. Si no hay noticias sobre una entidad, NO inventes nada.
      
      FORMATO JSON:
      {
        "results": [
          { "question": "¿...?", "options": ["...", "...", "...", "..."], "target_entity": "Nombre o 'General'" }
        ]
      }
    `;

    // 4. SELECCIÓN DEL MODELO (Aquí estaba el fallo antes)
    const aiModel = model || "gpt-4o-mini"; // Prioriza el del front, si no usa mini

    // Configuración del cuerpo de la petición
    const requestBody: any = {
      model: aiModel,
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
    };

    // Ajuste para modelos nuevos (gpt-5 / o1) que usan parámetros distintos
    if (aiModel.includes("gpt-5") || aiModel.startsWith("o1")) {
      requestBody.max_completion_tokens = 4000;
    } else {
      requestBody.max_tokens = 4000;
      requestBody.temperature = 0.8;
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
