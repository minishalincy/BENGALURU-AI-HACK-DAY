import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Layout, Loader2, Target, ArrowRight } from "lucide-react";

interface FormatRecommendationProps {
  userProfile: {
    niche: string;
    primary_platform: string;
    long_term_goal: string;
    tone: string;
  };
}

interface FormatResult {
  recommendedFormat: string;
  reasoning: string;
  alternativeFormat: string;
  alternativeReasoning: string;
  goalAlignment: string;
}

const formatIcons: Record<string, string> = {
  reel: "🎬",
  carousel: "📱",
  thread: "🧵",
  "single post": "📝",
  story: "⏱️",
  "long-form video": "🎥",
  post: "📝",
};

export const FormatRecommendation = ({ userProfile }: FormatRecommendationProps) => {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FormatResult | null>(null);
  const { toast } = useToast();

  const handleGetFormat = async () => {
    if (!idea.trim()) {
      toast({
        title: "Enter your idea",
        description: "Please enter a content idea to get format recommendation.",
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

      // Get format recommendation
      const { data, error } = await supabase.functions.invoke("analyze-content", {
        body: {
          type: "format",
          idea: idea.trim(),
          userProfile,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const formatResult = data.result as FormatResult;
      setResult(formatResult);

      // Save analysis
      await supabase.from("analysis_results").insert({
        content_idea_id: ideaData.id,
        user_id: session.user.id,
        analysis_type: "format",
        recommended_format: formatResult.recommendedFormat,
        explanation: formatResult.reasoning,
      });

    } catch (error) {
      toast({
        title: "Failed to get recommendation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFormatIcon = (format: string) => {
    const key = format.toLowerCase();
    return formatIcons[key] || "📄";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Layout className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Format Recommendation</h2>
          <p className="text-muted-foreground">
            Get the best format for your content idea
          </p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Describe your content idea..."
          className="min-h-[120px] bg-secondary/50 border-border/50 resize-none text-base"
        />

        <Button
          onClick={handleGetFormat}
          disabled={loading || !idea.trim()}
          className="mt-4 gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Layout className="w-4 h-4" />
              Get Best Format
            </>
          )}
        </Button>
      </div>

      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Main Recommendation */}
          <div className="glass-card rounded-xl p-6 glow-border">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl bg-emerald-500/10 flex items-center justify-center text-3xl">
                {getFormatIcon(result.recommendedFormat)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Best Format</p>
                <h3 className="text-2xl font-bold text-emerald-400 capitalize">
                  {result.recommendedFormat}
                </h3>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {result.reasoning}
            </p>
          </div>

          {/* Alternative */}
          {result.alternativeFormat && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{getFormatIcon(result.alternativeFormat)}</span>
                <div>
                  <p className="text-sm text-muted-foreground">Alternative</p>
                  <span className="font-medium capitalize">{result.alternativeFormat}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {result.alternativeReasoning}
              </p>
            </div>
          )}

          {/* Goal Alignment */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <span className="font-medium">Goal Alignment</span>
            </div>
            <div className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-primary mt-1 shrink-0" />
              <p className="text-muted-foreground">{result.goalAlignment}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
