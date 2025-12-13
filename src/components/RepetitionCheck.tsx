import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Loader2, AlertTriangle, CheckCircle, Lightbulb, History } from "lucide-react";

interface RepetitionCheckProps {
  userProfile: {
    niche: string;
    primary_platform: string;
    long_term_goal: string;
    tone: string;
  };
}

interface RepetitionResult {
  similarityScore: number;
  similarIdeas: string[];
  reframesSuggestions: string[];
  verdict: "unique" | "similar" | "repetitive";
}

export const RepetitionCheck = ({ userProfile }: RepetitionCheckProps) => {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepetitionResult | null>(null);
  const [pastIdeas, setPastIdeas] = useState<string[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPastIdeas = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data } = await supabase
        .from("content_ideas")
        .select("idea_text")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        setPastIdeas(data.map((d) => d.idea_text));
      }
      setLoadingHistory(false);
    };

    fetchPastIdeas();
  }, []);

  const handleCheck = async () => {
    if (!idea.trim()) {
      toast({
        title: "Enter your idea",
        description: "Please enter a content idea to check.",
        variant: "destructive",
      });
      return;
    }

    if (pastIdeas.length === 0) {
      toast({
        title: "No history yet",
        description: "This is your first idea! We'll start tracking from here.",
      });
      // Save this first idea
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("content_ideas").insert({
          user_id: session.user.id,
          idea_text: idea.trim(),
        });
        setPastIdeas([idea.trim()]);
      }
      setResult({
        similarityScore: 0,
        similarIdeas: [],
        reframesSuggestions: [],
        verdict: "unique",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-content", {
        body: {
          type: "repetition",
          idea: idea.trim(),
          userProfile,
          pastIdeas,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data.result as RepetitionResult);

      // Save the new idea
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("content_ideas").insert({
          user_id: session.user.id,
          idea_text: idea.trim(),
        });
        setPastIdeas([idea.trim(), ...pastIdeas]);
      }

    } catch (error) {
      toast({
        title: "Check failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getVerdictDisplay = (verdict: string) => {
    switch (verdict) {
      case "unique":
        return {
          icon: CheckCircle,
          color: "text-emerald-400",
          bg: "bg-emerald-500/10",
          label: "Fresh & Unique",
        };
      case "similar":
        return {
          icon: AlertTriangle,
          color: "text-amber-400",
          bg: "bg-amber-500/10",
          label: "Somewhat Similar",
        };
      case "repetitive":
        return {
          icon: AlertTriangle,
          color: "text-red-400",
          bg: "bg-red-500/10",
          label: "Too Repetitive",
        };
      default:
        return {
          icon: CheckCircle,
          color: "text-muted-foreground",
          bg: "bg-muted",
          label: "Unknown",
        };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Repetition Check</h2>
          <p className="text-muted-foreground">
            Make sure you're not repeating yourself
          </p>
        </div>
      </div>

      {/* Past ideas count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="w-4 h-4" />
        {loadingHistory ? (
          <span>Loading history...</span>
        ) : (
          <span>{pastIdeas.length} ideas in your history</span>
        )}
      </div>

      <div className="glass-card rounded-xl p-6">
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Enter your new content idea..."
          className="min-h-[120px] bg-secondary/50 border-border/50 resize-none text-base"
        />

        <Button
          onClick={handleCheck}
          disabled={loading || !idea.trim()}
          className="mt-4 gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Check for Repetition
            </>
          )}
        </Button>
      </div>

      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Verdict */}
          <div className="glass-card rounded-xl p-6">
            {(() => {
              const verdict = getVerdictDisplay(result.verdict);
              const VerdictIcon = verdict.icon;
              return (
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-xl ${verdict.bg} flex items-center justify-center`}>
                    <VerdictIcon className={`w-8 h-8 ${verdict.color}`} />
                  </div>
                  <div>
                    <h3 className={`text-2xl font-bold ${verdict.color}`}>
                      {verdict.label}
                    </h3>
                    <p className="text-muted-foreground">
                      Similarity score: {result.similarityScore}%
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Similar Ideas */}
          {result.similarIdeas && result.similarIdeas.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-blue-400" />
                <span className="font-medium">Similar Past Ideas</span>
              </div>
              <ul className="space-y-2">
                {result.similarIdeas.map((similar, i) => (
                  <li
                    key={i}
                    className="text-muted-foreground text-sm p-3 bg-secondary/50 rounded-lg"
                  >
                    {similar}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reframe Suggestions */}
          {result.reframesSuggestions && result.reframesSuggestions.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">Fresh Angles</span>
              </div>
              <ul className="space-y-2">
                {result.reframesSuggestions.map((suggestion, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-muted-foreground"
                  >
                    <span className="text-primary mt-1">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
