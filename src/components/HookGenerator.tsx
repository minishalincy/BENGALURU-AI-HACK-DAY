import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PenLine, Loader2, Copy, Check, Sparkles } from "lucide-react";

interface HookGeneratorProps {
  userProfile: {
    niche: string;
    primary_platform: string;
    long_term_goal: string;
    tone: string;
  };
}

interface Hook {
  style: string;
  hook: string;
  attentionScore: number;
  explanation: string;
}

interface HooksResult {
  hooks: Hook[];
}

const styleEmojis: Record<string, string> = {
  curiosity: "🔮",
  authority: "👑",
  storytelling: "📖",
  contrarian: "⚡",
};

export const HookGenerator = ({ userProfile }: HookGeneratorProps) => {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HooksResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!idea.trim()) {
      toast({
        title: "Enter your idea",
        description: "Please enter a content idea to generate hooks.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          title: "Not authenticated",
          description: "Please sign in again.",
          variant: "destructive",
        });
        return;
      }

      // Save the idea
      const { data: ideaData, error: ideaError } = await supabase
        .from("content_ideas")
        .insert({
          user_id: session.user.id,
          idea_text: idea.trim(),
        })
        .select()
        .single();

      if (ideaError) throw ideaError;

      // Generate hooks
      const { data, error } = await supabase.functions.invoke("analyze-content", {
        body: {
          type: "hooks",
          idea: idea.trim(),
          userProfile,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const hooksResult = data.result as HooksResult;
      
      // Sort by attention score
      if (hooksResult.hooks) {
        hooksResult.hooks.sort((a, b) => b.attentionScore - a.attentionScore);
      }
      
      setResult(hooksResult);

      // Save analysis
      await supabase.from("analysis_results").insert({
        content_idea_id: ideaData.id,
        user_id: session.user.id,
        analysis_type: "hooks",
        hooks: hooksResult.hooks as unknown as import("@/integrations/supabase/types").Json,
      });

    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (hook: string, index: number) => {
    await navigator.clipboard.writeText(hook);
    setCopiedIndex(index);
    toast({
      title: "Copied!",
      description: "Hook copied to clipboard.",
    });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-400 bg-emerald-500/10";
    if (score >= 6) return "text-amber-400 bg-amber-500/10";
    return "text-muted-foreground bg-muted";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <PenLine className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Hook Generator</h2>
          <p className="text-muted-foreground">
            Create attention-grabbing opening hooks
          </p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Describe your content idea to generate hooks..."
          className="min-h-[120px] bg-secondary/50 border-border/50 resize-none text-base"
        />

        <Button
          onClick={handleGenerate}
          disabled={loading || !idea.trim()}
          className="mt-4 gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Hooks
            </>
          )}
        </Button>
      </div>

      {result && result.hooks && (
        <div className="space-y-4 animate-slide-up">
          <p className="text-sm text-muted-foreground">
            Ranked by attention strength
          </p>

          {result.hooks.map((hook, index) => (
            <div
              key={index}
              className="glass-card rounded-xl p-5 transition-all hover:glow-border"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {styleEmojis[hook.style.toLowerCase()] || "✨"}
                  </span>
                  <span className="font-medium capitalize">{hook.style}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium px-2 py-0.5 rounded-full ${getScoreColor(
                      hook.attentionScore
                    )}`}
                  >
                    {hook.attentionScore}/10
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(hook.hook, index)}
                    className="h-8 w-8 p-0"
                  >
                    {copiedIndex === index ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-lg mb-3 leading-relaxed">"{hook.hook}"</p>

              <p className="text-sm text-muted-foreground">{hook.explanation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
