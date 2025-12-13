import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mic, Pause, Play, Square, Loader2, User, LogOut, Sparkles } from "lucide-react";
import { useRealtimeRecorder } from "@/hooks/useRealtimeRecorder";
import AudioWaveform from "@/components/AudioWaveform";
import PlatformSelector from "@/components/PlatformSelector";
import PlatformOutputs from "@/components/PlatformOutputs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserProfile {
  niche: string | null;
  primary_platform: string | null;
  long_term_goal: string | null;
  tone: string | null;
}

type StudioStage = 
  | 'ready' 
  | 'recording' 
  | 'platform-select' 
  | 'processing' 
  | 'completed';

interface PlatformContent {
  platform: string;
  caption: string;
  thumbnailConcept: string;
}

const CreatorStudio = () => {
  const [stage, setStage] = useState<StudioStage>('ready');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState<PlatformContent[]>([]);
  const [processingStatus, setProcessingStatus] = useState('');
  const [recordedTranscript, setRecordedTranscript] = useState('');
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const {
    isRecording,
    isPaused,
    duration,
    liveTranscript,
    analyser,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    error: recorderError
  } = useRealtimeRecorder();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("niche, primary_platform, long_term_goal, tone, onboarding_completed")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        toast({
          title: "Error loading profile",
          description: "Please try refreshing the page.",
          variant: "destructive",
        });
        return;
      }

      if (!profileData?.onboarding_completed) {
        navigate("/onboarding");
        return;
      }

      setProfile({
        niche: profileData.niche,
        primary_platform: profileData.primary_platform,
        long_term_goal: profileData.long_term_goal,
        tone: profileData.tone,
      });
      setLoading(false);
    };

    fetchProfile();
    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveTranscript]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleStartRecording = async () => {
    await startRecording();
    setStage('recording');
  };

  const handleStopRecording = async () => {
    const { audioBlob, transcript } = await stopRecording();
    setRecordedAudioBlob(audioBlob);
    setRecordedTranscript(transcript);
    setRecordedDuration(duration);
    setStage('platform-select');
  };

  const handlePlatformConfirm = async () => {
    if (selectedPlatforms.length === 0) {
      toast({
        title: "Select platforms",
        description: "Please select at least one platform to continue.",
        variant: "destructive"
      });
      return;
    }

    setStage('processing');
    
    try {
      setProcessingStatus('Uploading audio...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create recording entry
      const { data: recording, error: insertError } = await supabase
        .from('event_recordings')
        .insert({
          user_id: user.id,
          status: 'processing',
          duration_seconds: recordedDuration
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload audio if available
      if (recordedAudioBlob) {
        const fileName = `${user.id}/${recording.id}.webm`;
        await supabase.storage
          .from('event-recordings')
          .upload(fileName, recordedAudioBlob, {
            contentType: 'audio/webm',
            upsert: true
          });
      }

      // Get transcription if needed
      setProcessingStatus('Processing transcription...');
      let transcription = recordedTranscript;
      
      if ((!transcription || transcription.length < 20) && recordedAudioBlob) {
        const formData = new FormData();
        formData.append('audio', recordedAudioBlob, 'recording.webm');
        
        const transcribeResponse = await supabase.functions.invoke('transcribe-audio', {
          body: formData
        });
        
        if (transcribeResponse.data?.transcription) {
          transcription = transcribeResponse.data.transcription;
        }
      }

      if (!transcription) {
        throw new Error('No transcription available');
      }

      // Generate content for selected platforms
      setProcessingStatus('AI is generating your content...');
      
      const processResponse = await supabase.functions.invoke('generate-platform-content', {
        body: {
          recordingId: recording.id,
          transcription,
          userProfile: profile,
          platforms: selectedPlatforms
        }
      });

      if (processResponse.error) {
        throw new Error(processResponse.error.message || 'Content generation failed');
      }

      setGeneratedContent(processResponse.data.platformContent);
      setStage('completed');
      
      toast({
        title: "Content generated!",
        description: `Created posts for ${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? 's' : ''}.`
      });

    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive"
      });
      setStage('platform-select');
    }
  };

  const handleReset = () => {
    setStage('ready');
    setSelectedPlatforms([]);
    setGeneratedContent([]);
    setRecordedTranscript('');
    setRecordedAudioBlob(null);
    setRecordedDuration(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-primary/3 rounded-full blur-3xl" />
      </div>

      {/* Top Bar */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-lg">Creator Studio</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
              <div className="px-3 py-2 border-b border-border/50">
                <p className="text-sm font-medium truncate">{profile?.niche}</p>
                <p className="text-xs text-muted-foreground">{profile?.tone} tone</p>
              </div>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Ready State - Central Record Button */}
        {stage === 'ready' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-3">
                Record Your <span className="text-gradient">Content</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Speak naturally. AI will transform your words into platform-ready posts.
              </p>
            </div>

            <button
              onClick={handleStartRecording}
              className="group relative w-40 h-40 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 hover:border-primary/60 transition-all duration-300 hover:scale-105 flex items-center justify-center glow-border"
            >
              <div className="absolute inset-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors" />
              <Mic className="w-16 h-16 text-primary relative z-10" />
            </button>

            <p className="mt-8 text-sm text-muted-foreground">
              Click to start recording
            </p>

            {recorderError && (
              <p className="mt-4 text-destructive text-sm">{recorderError}</p>
            )}
          </div>
        )}

        {/* Recording State */}
        {stage === 'recording' && isRecording && (
          <div className="animate-slide-up space-y-6">
            {/* Recording Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-muted-foreground' : 'bg-destructive animate-pulse'}`} />
                <h2 className="text-2xl font-semibold">
                  {isPaused ? 'Paused' : 'Recording'}
                </h2>
              </div>
              <div className="text-3xl font-mono font-bold text-primary">
                {formatDuration(duration)}
              </div>
            </div>

            {/* Waveform */}
            <div className="w-full h-48 rounded-2xl overflow-hidden border border-border/50 bg-card/50">
              <AudioWaveform 
                analyser={analyser} 
                isRecording={isRecording} 
                isPaused={isPaused} 
              />
            </div>

            {/* Live Transcription */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-muted-foreground' : 'bg-primary animate-pulse'}`} />
                <span className="text-sm font-medium">Live Transcription</span>
              </div>
              <ScrollArea className="h-40 rounded-xl border border-border/50 bg-card/30 p-4">
                <p className="text-sm leading-relaxed">
                  {liveTranscript || (
                    <span className="text-muted-foreground italic">
                      {isPaused ? 'Recording paused...' : 'Listening for speech...'}
                    </span>
                  )}
                </p>
                <div ref={transcriptEndRef} />
              </ScrollArea>
            </div>

            {/* Recording Controls */}
            <div className="flex justify-center gap-4 pt-4">
              {isPaused ? (
                <Button onClick={resumeRecording} variant="outline" size="lg" className="gap-2 px-8">
                  <Play className="w-5 h-5" />
                  Resume
                </Button>
              ) : (
                <Button onClick={pauseRecording} variant="outline" size="lg" className="gap-2 px-8">
                  <Pause className="w-5 h-5" />
                  Pause
                </Button>
              )}
              <Button onClick={handleStopRecording} size="lg" className="gap-2 px-8">
                <Square className="w-5 h-5" />
                Finish Recording
              </Button>
            </div>
          </div>
        )}

        {/* Platform Selection State */}
        {stage === 'platform-select' && (
          <div className="animate-slide-up space-y-8 max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Where do you want to publish?</h2>
              <p className="text-muted-foreground">
                Select one or more platforms for your content
              </p>
            </div>

            <PlatformSelector 
              selectedPlatforms={selectedPlatforms}
              onSelectionChange={setSelectedPlatforms}
            />

            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
              <Button 
                onClick={handlePlatformConfirm}
                disabled={selectedPlatforms.length === 0}
                className="px-8"
              >
                Generate Content
              </Button>
            </div>
          </div>
        )}

        {/* Processing State */}
        {stage === 'processing' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mb-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Creating Your Content</h2>
            <p className="text-muted-foreground">{processingStatus}</p>
          </div>
        )}

        {/* Completed State - Dynamic Platform Outputs */}
        {stage === 'completed' && (
          <div className="animate-slide-up space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">Your Content is Ready</h2>
                <p className="text-muted-foreground mt-1">
                  Edit as needed, then copy to your platforms
                </p>
              </div>
              <Button onClick={handleReset} variant="outline">
                Create New
              </Button>
            </div>

            <PlatformOutputs 
              content={generatedContent}
              onContentChange={(updatedContent) => setGeneratedContent(updatedContent)}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default CreatorStudio;
