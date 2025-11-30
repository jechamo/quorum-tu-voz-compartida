import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Manejo de CORS para peticiones desde el navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { entity, module, context } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('Falta la clave API de OpenAI');
    }

    // Construcción del Prompt optimizado
    const systemPrompt = `
      Eres un experto analista en ${module === 'politica' ? 'política española' : 'fútbol español (La Liga)'}.
      Tu objetivo es generar una pregunta para una encuesta que genere debate y controversia, pero manteniendo un tono periodístico totalmente objetivo y neutral.
      
      Reglas:
      1. La pregunta debe ser sobre: ${entity}.
      2. ${context ? `Basa la pregunta en este contexto/noticia reciente: "${context}".` : 'Busca un tema de actualidad reciente o un debate histórico activo sobre esta entidad.'}
      3. Genera exactamente 4 opciones de respuesta breves (máx 5 palabras cada una). Las opciones deben cubrir diferentes espectros de opinión (ej: A favor, En contra, Escéptico, Otra visión).
      4. Devuelve SOLO un objeto JSON válido con esta estructura: { "question": "Texto de la pregunta", "options": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"] }.
      5. Idioma: Español de España.
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera la encuesta para ${entity}.` }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Limpieza por si el modelo devuelve bloques de código markdown
    const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedContent = JSON.parse(jsonStr);

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
