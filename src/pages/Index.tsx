import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Zap, RefreshCw, Layout, PenLine } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Attention Insights",
    description: "Understand why your content grabs or loses attention",
  },
  {
    icon: RefreshCw,
    title: "Idea Repetition Check",
    description: "Never unknowingly repeat the same content ideas",
  },
  {
    icon: Layout,
    title: "Smart Format Picker",
    description: "AI decides the best format for each idea",
  },
  {
    icon: PenLine,
    title: "Hook Generator",
    description: "Create attention-grabbing openings ranked by strength",
  },
];

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if onboarded
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (profile?.onboarding_completed) {
          navigate("/dashboard");
        } else {
          navigate("/onboarding");
        }
      }
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] bg-primary/4 rounded-full blur-3xl animate-float" style={{ animationDelay: "4s" }} />
      </div>

      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center glow-border">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-lg">ContentForge</span>
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 pt-16 pb-24 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              AI-Powered Content Strategy
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight animate-slide-up">
            Stop guessing.
            <br />
            <span className="text-gradient">Start creating with clarity.</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            A strategic content advisor that helps you understand attention, avoid repetition, and create content aligned with your goals.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="h-14 px-8 text-lg gap-2 glow-primary"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Button>
            <p className="text-sm text-muted-foreground">
              No credit card required
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="max-w-5xl mx-auto mt-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="glass-card rounded-xl p-6 animate-slide-up"
                style={{ animationDelay: `${0.3 + index * 0.1}s` }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="max-w-3xl mx-auto mt-24 text-center">
          <h2 className="text-3xl font-bold mb-12">How it works</h2>
          <div className="space-y-8">
            {[
              {
                step: "1",
                title: "Set up your profile",
                desc: "Tell us your niche, platform, goal, and preferred tone",
              },
              {
                step: "2",
                title: "Enter your ideas",
                desc: "Paste hooks, captions, or content concepts",
              },
              {
                step: "3",
                title: "Get strategic guidance",
                desc: "Receive actionable insights, not just generic tips",
              },
            ].map((item, index) => (
              <div
                key={item.step}
                className="flex items-start gap-6 text-left animate-slide-up"
                style={{ animationDelay: `${0.7 + index * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="font-bold text-primary">{item.step}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-2xl mx-auto mt-24 text-center glass-card rounded-2xl p-10 glow-border animate-slide-up" style={{ animationDelay: "1s" }}>
          <h2 className="text-2xl font-bold mb-4">
            Ready to create better content?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join creators who make strategic decisions, not random guesses.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="h-12 px-6 gap-2"
          >
            Start Creating
            <Sparkles className="w-4 h-4" />
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-border/30 relative z-10">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4" />
          <span>ContentForge — Strategic content, made simple</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
