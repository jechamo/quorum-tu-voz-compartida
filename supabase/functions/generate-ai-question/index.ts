import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Manejo de CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { topic, entity, module, mode, entitiesList, model } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

    if (!OPENAI_API_KEY || !TAVILY_API_KEY) {
      throw new Error("Faltan API Keys (OpenAI o Tavily)");
    }

    // ---------------------------------------------------------
    // 1. ESTRATEGIA DE BÚSQUEDA (TAVILY)
    // ---------------------------------------------------------

    // Construcción de la query
    let searchQuery = "";
    if (mode === "batch") {
      searchQuery = `Noticias última hora ${module} España actualidad hoy polémica`;
    } else {
      const topicQuery = topic ? topic : "noticias última hora actualidad";
      searchQuery = `${entity} ${module} España ${topicQuery}`;
    }

    console.log(`🔎 Buscando: "${searchQuery}"`);

    // Dominios fiables para filtrar (Intento 1)
    const domains =
      module === "futbol"
        ? ["marca.com", "as.com", "mundodeportivo.com", "sport.es", "relevo.com", "elpais.com"]
        : [
            "elpais.com",
            "elmundo.es",
            "elconfidencial.com",
            "okdiario.com",
            "eldiario.es",
            "abc.es",
            "elespanol.com",
            "lavanguardia.com",
          ];

    // INTENTO 1: Búsqueda estricta en medios fiables
    // DOCS: topic="news", search_depth="basic", time_range="day" (últimas 24h)
    let searchResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: searchQuery,
        topic: "news", // <--- CORRECTO
        search_depth: "basic", // <--- CORRECTO (basic o advanced)
        include_domains: domains,
        max_results: mode === "batch" ? 7 : 5,
        time_range: "day", // <--- CLAVE: Solo noticias de hoy
      }),
    });

    // Verificación de errores de Tavily
    if (!searchResponse.ok) {
      const errText = await searchResponse.text();
      console.error("❌ Error Tavily Intento 1:", errText);
      // No lanzamos throw todavía, dejamos que intente el plan B
    }

    let searchData = searchResponse.ok ? await searchResponse.json() : { results: [] };
    let contextNews = "";

    // INTENTO 2 (RESCATE): Si no hay resultados, buscamos en todo internet sin filtros
    if (!searchData.results || searchData.results.length === 0) {
      console.log("⚠️ Filtro estricto sin resultados. Lanzando BÚSQUEDA ABIERTA...");

      searchResponse = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: searchQuery,
          topic: "news",
          search_depth: "basic",
          // Quitamos include_domains
          max_results: 5,
          time_range: "day",
        }),
      });

      if (!searchResponse.ok) {
        const errText = await searchResponse.text();
        console.error("❌ Error Tavily Intento 2:", errText);
        // Aquí sí que no podemos hacer más
      } else {
        searchData = await searchResponse.json();
      }
    }

    // Procesar resultados finales
    if (searchData.results && searchData.results.length > 0) {
      console.log(`✅ ¡ÉXITO! ${searchData.results.length} noticias encontradas.`);
      contextNews = searchData.results
        .map((r: any) => `TITULAR: ${r.title}\nFUENTE: ${r.url}\nRESUMEN: ${r.content}`)
        .join("\n\n");
    } else {
      console.log("❌ IMPOSIBLE: Tavily no encontró nada hoy.");
      contextNews =
        "NO HAY NOTICIAS DE HOY (últimas 24h). IMPORTANTE: No inventes noticias falsas. Genera una pregunta sobre un tema 'Evergreen' (histórico/recurrente) de esta entidad.";
    }

    // ---------------------------------------------------------
    // 2. GENERACIÓN (OPENAI)
    // ---------------------------------------------------------

    const systemPrompt = `
      Eres un redactor jefe de un medio digital en España.
      
      TU MISIÓN: Crear encuestas basadas en HECHOS REALES encontrados abajo.
      
      NOTICIAS DE HOY (LA VERDAD):
      ${contextNews}

      OBJETIVO:
      ${
        mode === "batch"
          ? `Genera una batería de preguntas (mínimo 3). 1 General y otras para: [${entitiesList ? entitiesList.join(", ") : ""}]. Si no hay noticia para uno, SÁLTALO.`
          : `Genera una encuesta sobre: ${entity}.`
      }

      REGLAS DE ORO (ESTRICTAS):
      1. BASADO EN HECHOS: Solo usa las noticias proporcionadas arriba. Si no hay, usa temas históricos generales.
      2. PREGUNTAS INTELIGENTES: Nada de "¿Qué opinas?". Usa fórmulas como: "¿Es admisible...?", "¿Debe dimitir...?", "¿Acierto o error?".
      3. OPCIONES NATURALES (¡PROHIBIDO CORCHETES!):
         - MAL: "[Indignado]", "[A favor]"
         - BIEN: "Es una vergüenza absoluta", "Totalmente de acuerdo", "Tienen parte de razón", "Es una cortina de humo".
      
      FORMATO JSON:
      {
        "results": [
          { "question": "¿Pregunta?", "options": ["Frase A", "Frase B", "Frase C", "Frase D"], "target_entity": "Nombre" }
        ]
      }
    `;

    const aiModel = model || "gpt-4o-mini";
    const requestBody: any = {
      model: aiModel,
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
    };

    // Ajuste de parámetros según modelo (gpt-5/o1 vs gpt-4)
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
    // ARREGLO DEL ERROR TS18046
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("🔥 Error Function:", errorMessage);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
