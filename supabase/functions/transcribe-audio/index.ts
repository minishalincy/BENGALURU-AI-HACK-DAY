import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    console.log('Received audio file:', audioFile.name, 'Size:', audioFile.size);

    // Convert audio to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64Audio = btoa(binary);
    const mimeType = audioFile.type || 'audio/webm';

    console.log('Sending audio to Gemini for transcription...');

    // Step 1: Initial transcription with acronym awareness
    const transcriptionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Transcribe this audio recording with high accuracy. Follow these rules:

1. ACRONYM DETECTION: When speakers pronounce individual letters (like "R O I", "G D P", "C A C"), preserve them as uppercase acronyms (ROI, GDP, CAC).

2. COMMON ABBREVIATIONS: Detect and correctly format common abbreviations:
   - Business: ROI, CAC, LTV, KPI, OKR, B2B, B2C, SaaS, MVP, IPO, CEO, CFO, CTO, CMO
   - Tech: API, SDK, UI, UX, HTML, CSS, JS, AI, ML, SaaS, CRM, ERP
   - Academic: PhD, MBA, BA, MA, GPA
   - Metrics: YoY, MoM, QoQ, ARR, MRR, NPS, CAGR
   
3. Clean up filler words (um, uh, like, you know) while preserving meaning.

4. Format as clean paragraphs. Indicate speaker changes with line breaks.

5. Keep technical terms and industry jargon intact.

Output ONLY the transcription, no commentary.`
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: mimeType.includes('mp3') ? 'mp3' : mimeType.includes('wav') ? 'wav' : 'webm'
                }
              }
            ]
          }
        ],
      }),
    });

    if (!transcriptionResponse.ok) {
      if (transcriptionResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (transcriptionResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await transcriptionResponse.text();
      console.error('Transcription API error:', transcriptionResponse.status, errorText);
      throw new Error('Failed to transcribe audio');
    }

    const transcriptionData = await transcriptionResponse.json();
    let transcription = transcriptionData.choices?.[0]?.message?.content || '';

    console.log('Initial transcription completed. Length:', transcription.length);

    // Step 2: AI Post-Processing for acronym correction and cleanup
    if (transcription.length > 0) {
      console.log('Running AI post-processing for acronym correction...');
      
      const postProcessResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a transcription post-processor. Your job is to:

1. DETECT AND FIX ACRONYMS: Find any spelled-out letters that should be acronyms and convert them:
   - "r o i" or "R O I" or "return on investment" when used as a metric → ROI
   - "g d p" or "G D P" → GDP
   - "c a c" or "customer acquisition cost" → CAC
   - Individual letters spoken together → Uppercase acronym

2. CONTEXT-AWARE CORRECTION: Use surrounding context to determine if something is:
   - An abbreviation (format as uppercase: MBA, PhD, CEO)
   - A regular word (keep as-is)
   - A misheard word (correct based on context)

3. PRESERVE INTENT: Keep the speaker's meaning intact while improving readability.

4. FORMAT CLEANLY: Ensure proper capitalization, punctuation, and paragraph breaks.

Output ONLY the corrected transcription, nothing else.`
            },
            {
              role: "user",
              content: `Please post-process and correct this transcription, focusing on properly formatting acronyms and abbreviations:\n\n${transcription}`
            }
          ],
        }),
      });

      if (postProcessResponse.ok) {
        const postProcessData = await postProcessResponse.json();
        const correctedTranscription = postProcessData.choices?.[0]?.message?.content;
        
        if (correctedTranscription && correctedTranscription.length > 0) {
          transcription = correctedTranscription;
          console.log('Post-processing completed. Final length:', transcription.length);
        }
      } else {
        console.log('Post-processing skipped due to API error, using initial transcription');
      }
    }

    console.log('Final transcription ready');

    return new Response(JSON.stringify({ transcription }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
