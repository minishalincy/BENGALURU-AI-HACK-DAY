import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateThumbnail(prompt: string, platform: string, apiKey: string): Promise<string | null> {
  try {
    console.log(`Generating thumbnail for ${platform}`);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Create a professional, eye-catching thumbnail image for ${platform}. 
            
The thumbnail should be:
- Visually striking and attention-grabbing
- Suitable for ${platform}'s format and audience
- Modern and clean design
- Without any text overlays

Context: ${prompt}

Create the image now.`
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      console.error('Image generation error:', response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      console.log(`Thumbnail generated for ${platform}`);
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { recordingId, transcription, additionalContext, userProfile, platforms, uploadedFileDescriptions } = await req.json();

    if (!recordingId || !platforms || platforms.length === 0) {
      throw new Error('Recording ID and platforms are required');
    }

    const contentSource = transcription || additionalContext || 'No content provided';
    console.log('Generating content for platforms:', platforms);

    const niche = userProfile?.niche || 'general content';
    const goal = userProfile?.long_term_goal || 'engage audience';
    const tone = userProfile?.tone || 'professional';

    const platformsList = platforms.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
    
    // Build context from all inputs
    let fullContext = '';
    if (transcription) {
      fullContext += `AUDIO TRANSCRIPTION:\n${transcription}\n\n`;
    }
    if (additionalContext) {
      fullContext += `ADDITIONAL CONTEXT:\n${additionalContext}\n\n`;
    }
    if (uploadedFileDescriptions && uploadedFileDescriptions.length > 0) {
      fullContext += `UPLOADED FILES:\n${uploadedFileDescriptions.join('\n')}\n\n`;
    }

    // Generate captions
    const captionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an expert social media content creator. Create platform-ready posts.

Creator Profile:
- Niche: ${niche}
- Goal: ${goal}
- Tone: ${tone}

Guidelines:
- Create authentic content matching the creator's voice
- Optimize for each platform's algorithm and format
- Include appropriate emojis and formatting
- Content should be ready to post immediately
- Generate a brief thumbnail concept for each platform

IMPORTANT: Output valid JSON only.`
          },
          {
            role: "user",
            content: `Create platform-specific content from this input.

${fullContext}

PLATFORMS: ${platformsList}

Return JSON with this structure:
{
  "platforms": [
    {
      "platform": "platform_name",
      "caption": "Full post text ready to publish with line breaks (\\n) and hashtags where appropriate",
      "thumbnailPrompt": "A brief description for generating a thumbnail image (2-3 sentences)"
    }
  ]
}

Generate content for: ${platformsList}`
          }
        ],
      }),
    });

    if (!captionResponse.ok) {
      const errorText = await captionResponse.text();
      console.error('Caption AI error:', captionResponse.status, errorText);
      
      if (captionResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (captionResponse.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to continue.');
      }
      throw new Error('Failed to generate captions');
    }

    const captionData = await captionResponse.json();
    const contentText = captionData.choices?.[0]?.message?.content || '';
    
    console.log('Caption response length:', contentText.length);

    let platformContent: Array<{
      platform: string;
      caption: string;
      thumbnailPrompt?: string;
      thumbnailUrl?: string;
    }> = [];

    try {
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        platformContent = parsed.platforms || [];
      }
    } catch (parseError) {
      console.error('Caption parse error:', parseError);
    }

    // Fallback content
    if (!platformContent || platformContent.length === 0) {
      platformContent = platforms.map((platform: string) => ({
        platform,
        caption: `🎯 Key insights:\n\n${contentSource.substring(0, 200)}...\n\nWhat do you think? 👇`,
        thumbnailPrompt: `Professional thumbnail for ${platform} content about ${niche}`
      }));
    }

    // Generate actual thumbnails for each platform
    console.log('Generating thumbnails...');
    const contentWithThumbnails = await Promise.all(
      platformContent.map(async (item) => {
        const thumbnailPrompt = item.thumbnailPrompt || `Professional ${item.platform} thumbnail for ${niche} content`;
        const thumbnailUrl = await generateThumbnail(thumbnailPrompt, item.platform, LOVABLE_API_KEY);
        
        return {
          platform: item.platform,
          caption: item.caption,
          thumbnailUrl: thumbnailUrl || undefined,
        };
      })
    );

    // Store the generated content
    const { error: updateError } = await supabaseClient
      .from('event_recordings')
      .update({
        transcription: transcription || additionalContext,
        insights: { platforms: contentWithThumbnails },
        status: 'completed'
      })
      .eq('id', recordingId);

    if (updateError) {
      console.error('Database update error:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      platformContent: contentWithThumbnails
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Generate platform content error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
