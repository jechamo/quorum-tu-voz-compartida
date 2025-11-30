import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // AHORA RECIBIMOS 'mode' Y 'entitiesList' PARA PODER HACER LA BÚSQUEDA MASIVA
    const { topic, entity, module, mode, entitiesList } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

    if (!OPENAI_API_KEY || !TAVILY_API_KEY) throw new Error("Faltan API Keys");

    // 1. CONFIGURACIÓN DE BÚSQUEDA INTELIGENTE
    let searchQuery = "";
    let domains = [];

    // Filtro de dominios según el tema para ser MÁS ESTRICTOS
    if (module === "futbol") {
      domains = ["marca.com", "as.com", "mundodeportivo.com", "sport.es", "relevo.com"];
      searchQuery = `Noticias última hora polémica fútbol La Liga España ${mode === "batch" ? "actualidad general" : entity} ${topic || ""}`;
    } else {
      domains = ["elpais.com", "elmundo.es", "elconfidencial.com", "okdiario.com", "eldiario.es", "abc.es"];
      searchQuery = `Noticias última hora polémica política España gobierno oposición ${mode === "batch" ? "actualidad general" : entity} ${topic || ""}`;
    }

    console.log(`🔎 Buscando: "${searchQuery}" en ${domains.length} fuentes especializadas.`);

    const searchResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: searchQuery,
        search_depth: "news",
        include_domains: domains, // <--- AQUI APLICAMOS EL FILTRO DE SEGURIDAD
        max_results: mode === "batch" ? 7 : 4, // Si es batch, buscamos más noticias
      }),
    });

    const searchData = await searchResponse.json();
    const contextNews = searchData.results
      ? searchData.results.map((r: any) => `- ${r.title}: ${r.content}`).join("\n")
      : "No hay noticias recientes.";

    // 2. PROMPT PARA GPT (EL REDACTOR JEFE)
    const systemPrompt = `
      Eres un redactor jefe experto en ${module}.
      
      NOTICIAS DE HOY:
      ${contextNews}

      OBJETIVO:
      ${
        mode === "batch"
          ? `Genera una lista de preguntas:
           1. Una pregunta GENERAL sobre la noticia más importante del día.
           2. Una pregunta ESPECÍFICA para cada uno de estos protagonistas: [${entitiesList ? entitiesList.join(", ") : ""}], PERO SOLO SI hay noticias relacionadas en el texto de arriba. Si no hay polémica sobre ellos hoy, NO inventes la pregunta.`
          : `Genera una encuesta polémica sobre: ${entity}.`
      }

      REGLAS:
      1. Tono incisivo y de debate actual.
      2. Si no hay noticias sobre una entidad específica, IGNÓRALA. No inventes.
      
      FORMATO JSON:
      {
        "results": [
          { "question": "¿...?", "options": ["...", "...", "...", "..."], "target_entity": "Nombre o 'General'" }
        ]
      }
    `;

    // Usamos gpt-4o porque entiende mejor las instrucciones complejas de "si no hay noticia, no inventes"
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    const aiData = await openAiResponse.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
