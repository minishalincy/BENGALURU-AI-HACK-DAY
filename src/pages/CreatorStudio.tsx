import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mic, Pause, Play, Square, Loader2, User, LogOut, Sparkles, Wifi, WifiOff, FileText, Image, Layers, Headphones, Brain, Wand2, CheckCircle2, ArrowRight, FolderOpen, Zap, Users, Presentation, Lightbulb, MessageSquare, Target, ThumbsUp } from "lucide-react";
import { useOfflineRecorder } from "@/hooks/useOfflineRecorder";
import AudioWaveform from "@/components/AudioWaveform";
import PlatformSelector from "@/components/PlatformSelector";
import PlatformOutputs from "@/components/PlatformOutputs";
import ContentInputs from "@/components/ContentInputs";
import { UploadedFile } from "@/components/FileUploader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AILoader } from "@/components/ui/ai-loader";
import { BeamsBackground } from "@/components/ui/beams-background";
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
  | 'inputs'
  | 'platform-select' 
  | 'processing' 
  | 'completed';

type CreationMode = 'speaker' | 'creator';

interface PlatformContent {
  platform: string;
  caption: string;
  thumbnailUrl?: string;
}

interface RecommendedPlatform {
  platform: string;
  reason: string;
  score: number;
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
  const [additionalContext, setAdditionalContext] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [creationMode, setCreationMode] = useState<CreationMode>('creator');
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([]);
  const [recommendedPlatforms, setRecommendedPlatforms] = useState<RecommendedPlatform[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const {
    isRecording,
    isPaused,
    duration,
    liveTranscript,
    analyser,
    isOnline,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    error: recorderError
  } = useOfflineRecorder();

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
    setStage('inputs');
  };

  const handleContinueToSelect = () => {
    setStage('platform-select');
    setShowRecommendations(false);
  };

  const handleAcceptRecommendation = (platform: string) => {
    if (!selectedPlatforms.includes(platform.toLowerCase())) {
      setSelectedPlatforms([...selectedPlatforms, platform.toLowerCase()]);
    }
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

      const { data: recording, error: insertError } = await supabase
        .from('event_recordings')
        .insert({
          user_id: user.id,
          status: 'processing',
          duration_seconds: recordedDuration,
          creation_mode: creationMode
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (recordedAudioBlob) {
        const fileName = `${user.id}/${recording.id}.webm`;
        await supabase.storage
          .from('event-recordings')
          .upload(fileName, recordedAudioBlob, {
            contentType: 'audio/webm',
            upsert: true
          });
      }

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

      // Get file descriptions for AI context
      const uploadedFileDescriptions = uploadedFiles.map(f => 
        `${f.type}: ${f.file.name} (${(f.file.size / 1024).toFixed(1)} KB)`
      );

      setProcessingStatus('AI is analyzing your content...');
      
      const processResponse = await supabase.functions.invoke('generate-platform-content', {
        body: {
          recordingId: recording.id,
          transcription,
          additionalContext,
          userProfile: profile,
          platforms: selectedPlatforms,
          uploadedFileDescriptions,
          creationMode
        }
      });

      if (processResponse.error) {
        throw new Error(processResponse.error.message || 'Content generation failed');
      }

      // Save generated content to database
      await supabase
        .from('event_recordings')
        .update({
          status: 'completed',
          transcription: transcription,
          platforms: selectedPlatforms,
          generated_content: processResponse.data.platformContent,
          additional_context: additionalContext,
          key_takeaways: processResponse.data.keyTakeaways,
          recommended_platforms: processResponse.data.recommendedPlatforms,
          creation_mode: creationMode
        })
        .eq('id', recording.id);

      setGeneratedContent(processResponse.data.platformContent);
      setKeyTakeaways(processResponse.data.keyTakeaways || []);
      setRecommendedPlatforms(processResponse.data.recommendedPlatforms || []);
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
    setAdditionalContext('');
    setUploadedFiles([]);
    setCreationMode('creator');
    setKeyTakeaways([]);
    setRecommendedPlatforms([]);
    setShowRecommendations(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <BeamsBackground intensity="medium" className="min-h-screen flex flex-col">

      {/* Top Bar */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-lg">Creator Studio</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
              isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
            }`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>

            {/* My Creations Link */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/creations")}
              className="gap-2 border-primary/30 hover:bg-primary/10"
            >
              <FolderOpen className="w-4 h-4" />
              My Creations
            </Button>

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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Ready State */}
        {stage === 'ready' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
            
            {/* Hero Section */}
            <div className="text-center mb-8 max-w-2xl">
              <p className="text-primary font-medium text-sm uppercase tracking-wider mb-3">
                Knowledge Capture Studio
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight tracking-tight">
                Record your voice.
                <br />
                <span className="text-primary">Get ready-to-share content.</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Capture talks, workshops, meetings, or ideas — and instantly transform them into polished posts, summaries, and visuals.
              </p>
            </div>

            {/* Mode Selector */}
            <div className="mb-8 w-full max-w-md">
              <p className="text-xs text-muted-foreground text-center mb-3">Select your mode</p>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-card/50 border border-border/50">
                <button
                  onClick={() => setCreationMode('speaker')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all ${
                    creationMode === 'speaker'
                      ? 'bg-primary/10 border border-primary/30 text-primary'
                      : 'hover:bg-card/80 text-muted-foreground'
                  }`}
                >
                  <Presentation className="w-5 h-5" />
                  <span className="font-medium text-sm">Speaker Mode</span>
                  <span className="text-xs opacity-70 text-center leading-tight">
                    Structured summaries & professional tone
                  </span>
                </button>
                <button
                  onClick={() => setCreationMode('creator')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all ${
                    creationMode === 'creator'
                      ? 'bg-primary/10 border border-primary/30 text-primary'
                      : 'hover:bg-card/80 text-muted-foreground'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  <span className="font-medium text-sm">Creator Mode</span>
                  <span className="text-xs opacity-70 text-center leading-tight">
                    Engaging captions & platform-ready
                  </span>
                </button>
              </div>
            </div>

            {/* Use Cases - Who This Is For */}
            <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/50 border border-border/50 text-xs text-muted-foreground">
                <Presentation className="w-3 h-3" />
                Speakers & Founders
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/50 border border-border/50 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                Workshop Attendees
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/50 border border-border/50 text-xs text-muted-foreground">
                <Lightbulb className="w-3 h-3" />
                Content Creators
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/50 border border-border/50 text-xs text-muted-foreground">
                <Headphones className="w-3 h-3" />
                Anyone Who Listens
              </span>
            </div>

            {/* Record Button */}
            <div className="relative mb-6">
              <button
                onClick={handleStartRecording}
                className="group relative w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/40 hover:border-primary transition-all duration-300 hover:scale-105 flex items-center justify-center shadow-lg shadow-primary/10 hover:shadow-primary/20"
              >
                <div className="absolute inset-3 rounded-full bg-gradient-to-br from-primary/15 to-transparent group-hover:from-primary/25 transition-colors" />
                <Mic className="w-14 h-14 sm:w-16 sm:h-16 text-primary relative z-10" />
              </button>
              
              {/* Animated ring */}
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping opacity-30 pointer-events-none" style={{ animationDuration: '2s' }} />
            </div>

            {/* Microcopy */}
            <p className="text-sm font-medium text-foreground mb-1">
              Tap to start recording
            </p>
            <p className="text-xs text-muted-foreground mb-10">
              Works offline • Auto-saves • No notes needed
            </p>

            {/* What Happens After Recording - Horizontal */}
            <div className="w-full max-w-3xl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="group p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base mb-1.5">Transcription</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Speech converted to text in real-time
                  </p>
                </div>
                
                <div className="group p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base mb-1.5">Captions</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Optimized for LinkedIn, Instagram & more
                  </p>
                </div>
                
                <div className="group p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <Image className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base mb-1.5">Visuals</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AI thumbnails to match your content
                  </p>
                </div>
              </div>
            </div>

            {recorderError && (
              <p className="mt-6 text-destructive text-sm">{recorderError}</p>
            )}
          </div>
        )}

        {/* Recording State */}
        {stage === 'recording' && isRecording && (
          <div className="animate-slide-up space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-muted-foreground' : 'bg-destructive animate-pulse'}`} />
                <h2 className="text-2xl font-semibold">
                  {isPaused ? 'Paused' : 'Recording'}
                </h2>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  creationMode === 'speaker' 
                    ? 'bg-blue-500/10 text-blue-500' 
                    : 'bg-primary/10 text-primary'
                }`}>
                  {creationMode === 'speaker' ? 'Speaker Mode' : 'Creator Mode'}
                </span>
                {!isOnline && (
                  <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                    Offline mode
                  </span>
                )}
              </div>
              <div className="text-3xl font-mono font-bold text-primary">
                {formatDuration(duration)}
              </div>
            </div>

            <div className="w-full h-48 rounded-2xl overflow-hidden border border-border/50 bg-card/50">
              <AudioWaveform 
                analyser={analyser} 
                isRecording={isRecording} 
                isPaused={isPaused} 
              />
            </div>

            {/* Live AI Activity Panel */}
            <div className="grid grid-cols-2 gap-4">
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

              {/* AI Activity Indicators */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium">AI Processing</span>
                </div>
                <div className="h-40 rounded-xl border border-border/50 bg-card/30 p-4 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Headphones className={`w-4 h-4 ${!isPaused ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                    <span className={!isPaused ? 'text-foreground' : 'text-muted-foreground'}>
                      {!isPaused ? 'Listening...' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <FileText className={`w-4 h-4 ${liveTranscript.length > 50 ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={liveTranscript.length > 50 ? 'text-foreground' : 'text-muted-foreground'}>
                      {liveTranscript.length > 50 ? 'Extracting key points...' : 'Waiting for content...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Brain className={`w-4 h-4 ${liveTranscript.length > 100 ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={liveTranscript.length > 100 ? 'text-foreground' : 'text-muted-foreground'}>
                      {liveTranscript.length > 100 ? 'Understanding intent...' : 'Analyzing...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Image className={`w-4 h-4 ${liveTranscript.length > 150 ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={liveTranscript.length > 150 ? 'text-foreground' : 'text-muted-foreground'}>
                      {liveTranscript.length > 150 ? 'Preparing thumbnails...' : 'Waiting...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

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

        {/* Additional Inputs State */}
        {stage === 'inputs' && (
          <div className="animate-slide-up space-y-8 max-w-2xl mx-auto">
            {/* Success Message */}
            <div className="text-center p-6 rounded-2xl bg-primary/5 border border-primary/20">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Great! Recording captured.</h2>
              <p className="text-muted-foreground">
                Let's create your content. Add any extra context if needed.
              </p>
              <p className="text-xs text-primary mt-2">
                Mode: {creationMode === 'speaker' ? 'Speaker / Workshop' : 'Creator / Content'}
              </p>
            </div>

            {recordedTranscript && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Recorded Transcript (editable)
                </label>
                <textarea
                  value={recordedTranscript}
                  onChange={(e) => setRecordedTranscript(e.target.value)}
                  className="w-full min-h-[120px] p-4 rounded-xl bg-card border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Your transcription will appear here..."
                />
              </div>
            )}

            <ContentInputs
              additionalContext={additionalContext}
              onContextChange={setAdditionalContext}
              uploadedFiles={uploadedFiles}
              onFilesChange={setUploadedFiles}
            />

            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
              <Button onClick={handleContinueToSelect} className="px-8 gap-2">
                Continue
                <ArrowRight className="w-4 h-4" />
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

            {/* AI Platform Recommendations - Show if we have content to analyze */}
            {(recordedTranscript || additionalContext) && !showRecommendations && (
              <Button 
                variant="outline" 
                className="w-full gap-2 border-primary/30 hover:bg-primary/10"
                onClick={() => setShowRecommendations(true)}
              >
                <Target className="w-4 h-4" />
                Get AI Platform Recommendations
              </Button>
            )}

            {showRecommendations && recommendedPlatforms.length > 0 && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Recommended for your content</span>
                </div>
                <div className="space-y-2">
                  {recommendedPlatforms.map((rec, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50"
                    >
                      <div>
                        <span className="font-medium text-sm">{rec.platform}</span>
                        <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="gap-1"
                        onClick={() => handleAcceptRecommendation(rec.platform)}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <PlatformSelector 
              selectedPlatforms={selectedPlatforms}
              onSelectionChange={setSelectedPlatforms}
            />

            {/* Helper Text */}
            {selectedPlatforms.length > 0 && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                <p className="text-sm text-muted-foreground">
                  We'll generate <span className="text-primary font-medium">captions</span>,{' '}
                  <span className="text-primary font-medium">key takeaways</span> and{' '}
                  <span className="text-primary font-medium">AI thumbnails</span> for{' '}
                  {selectedPlatforms.length === 1 
                    ? selectedPlatforms[0] 
                    : `${selectedPlatforms.length} platforms`
                  }
                </p>
              </div>
            )}

            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={() => setStage('inputs')}>
                Back
              </Button>
              <Button 
                onClick={handlePlatformConfirm}
                disabled={selectedPlatforms.length === 0}
                className="px-8 gap-2"
              >
                <Wand2 className="w-4 h-4" />
                Generate Content
              </Button>
            </div>
          </div>
        )}

        {/* Processing State */}
        {stage === 'processing' && (
          <AILoader text={processingStatus || "Generating"} />
        )}

        {/* Completed State */}
        {stage === 'completed' && (
          <div className="animate-slide-up space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">Your Content is Ready</h2>
                <p className="text-muted-foreground mt-1">
                  Edit captions and download thumbnails
                </p>
              </div>
              <Button onClick={handleReset} variant="outline">
                Create New
              </Button>
            </div>

            {/* Key Takeaways Section */}
            {keyTakeaways.length > 0 && (
              <div className="p-6 rounded-2xl bg-card/50 border border-border/50">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">Key Takeaways</h3>
                </div>
                <ul className="space-y-3">
                  {keyTakeaways.map((takeaway, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-sm leading-relaxed">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <PlatformOutputs 
              content={generatedContent}
              onContentChange={setGeneratedContent}
            />
          </div>
        )}
      </main>
    </BeamsBackground>
  );
};

export default CreatorStudio;
