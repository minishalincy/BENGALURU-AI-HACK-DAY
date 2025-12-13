import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Pause, Square, Play, Loader2, CheckCircle, AlertCircle, Radio } from 'lucide-react';
import { useRealtimeRecorder } from '@/hooks/useRealtimeRecorder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import AudioWaveform from '@/components/AudioWaveform';

interface UserProfile {
  niche: string | null;
  primary_platform: string | null;
  long_term_goal: string | null;
  tone: string | null;
}

interface LiveEventRecorderProps {
  userProfile: UserProfile | null;
}

type ProcessingStage = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'generating' | 'completed' | 'error';

interface GeneratedContent {
  linkedin: { post: string; explanation: string };
  instagram: { caption: string; explanation: string };
  twitter: { thread: string; explanation: string };
}

const LiveEventRecorder: React.FC<LiveEventRecorderProps> = ({ userProfile }) => {
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
  
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll transcript
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

  const handleStopAndProcess = async () => {
    const { audioBlob, transcript } = await stopRecording();
    
    if (!audioBlob) {
      toast({
        title: "Recording Error",
        description: "No audio was recorded.",
        variant: "destructive"
      });
      return;
    }

    // Use the live transcript if available, otherwise fall back to AI transcription
    const finalTranscript = transcript.trim();

    try {
      setProcessingStage('uploading');
      setErrorMessage(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create recording entry
      const { data: recording, error: insertError } = await supabase
        .from('event_recordings')
        .insert({
          user_id: user.id,
          status: 'processing',
          duration_seconds: duration
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload audio
      const fileName = `${user.id}/${recording.id}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('event-recordings')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('event-recordings')
        .getPublicUrl(fileName);

      await supabase
        .from('event_recordings')
        .update({ audio_url: publicUrl })
        .eq('id', recording.id);

      // If we have a live transcript, use it directly
      // Otherwise, use AI transcription
      let transcription = finalTranscript;
      
      if (!transcription || transcription.length < 20) {
        setProcessingStage('transcribing');
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const transcribeResponse = await supabase.functions.invoke('transcribe-audio', {
          body: formData
        });

        if (transcribeResponse.error) {
          throw new Error(transcribeResponse.error.message || 'Transcription failed');
        }

        transcription = transcribeResponse.data?.transcription || '';
      }

      if (!transcription) {
        throw new Error('No transcription available');
      }

      // Generate content
      setProcessingStage('analyzing');

      const processResponse = await supabase.functions.invoke('process-event-audio', {
        body: {
          recordingId: recording.id,
          transcription,
          userProfile
        }
      });

      if (processResponse.error) {
        throw new Error(processResponse.error.message || 'Processing failed');
      }

      setProcessingStage('generating');
      await new Promise(resolve => setTimeout(resolve, 500));

      setGeneratedContent(processResponse.data.content);
      setProcessingStage('completed');

      toast({
        title: "Content Generated!",
        description: "Your event audio has been analyzed and content is ready."
      });

    } catch (error) {
      console.error('Processing error:', error);
      setProcessingStage('error');
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive"
      });
    }
  };

  const handleReset = () => {
    setProcessingStage('idle');
    setGeneratedContent(null);
    setErrorMessage(null);
  };

  // Initial state - not recording
  if (processingStage === 'idle' && !isRecording) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Record Live Event</CardTitle>
          <CardDescription className="text-muted-foreground">
            Capture insights from workshops, talks, or panels with real-time transcription and waveform visualization.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="w-full h-[200px] bg-secondary/30 rounded-xl flex items-center justify-center border border-border/50">
            <div className="text-center">
              <Mic className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Waveform will appear here</p>
            </div>
          </div>
          
          <Button 
            onClick={startRecording}
            size="lg"
            className="gap-2"
          >
            <Mic className="w-5 h-5" />
            Start Recording
          </Button>
          
          {recorderError && (
            <p className="text-destructive text-sm">{recorderError}</p>
          )}
          
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Real-time transcription works best in Chrome or Edge. Speak clearly for accurate results.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Active recording UI with waveform and live transcript
  if (isRecording) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-muted-foreground' : 'bg-destructive animate-pulse'}`} />
              <CardTitle className="text-xl">
                {isPaused ? 'Paused' : 'Recording Live'}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 text-2xl font-mono font-bold text-primary">
              <Radio className={`w-5 h-5 ${isPaused ? 'text-muted-foreground' : 'text-destructive'}`} />
              {formatDuration(duration)}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Waveform Visualization */}
          <div className="w-full h-[200px] rounded-xl overflow-hidden border border-border/50">
            <AudioWaveform 
              analyser={analyser} 
              isRecording={isRecording} 
              isPaused={isPaused} 
            />
          </div>

          {/* Live Transcription */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-muted-foreground' : 'bg-primary animate-pulse'}`} />
              <span className="text-sm font-medium">Live Transcription</span>
            </div>
            <ScrollArea className="h-[150px] w-full rounded-lg border border-border/50 bg-secondary/20 p-4">
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

          {/* Controls */}
          <div className="flex justify-center gap-3 pt-2">
            {isPaused ? (
              <Button onClick={resumeRecording} variant="outline" size="lg" className="gap-2">
                <Play className="w-5 h-5" />
                Resume
              </Button>
            ) : (
              <Button onClick={pauseRecording} variant="outline" size="lg" className="gap-2">
                <Pause className="w-5 h-5" />
                Pause
              </Button>
            )}
            <Button onClick={handleStopAndProcess} variant="destructive" size="lg" className="gap-2">
              <Square className="w-5 h-5" />
              Stop & Generate Content
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Processing UI
  if (['uploading', 'transcribing', 'analyzing', 'generating'].includes(processingStage)) {
    const stages = [
      { key: 'uploading', label: 'Uploading audio' },
      { key: 'transcribing', label: 'Finalizing transcription' },
      { key: 'analyzing', label: 'Extracting insights' },
      { key: 'generating', label: 'Generating content' }
    ];

    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Processing Your Event</CardTitle>
          <CardDescription className="text-muted-foreground">
            AI is analyzing your recording...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>

          <div className="space-y-3 w-full max-w-sm">
            {stages.map((stage, index) => {
              const stageIndex = stages.findIndex(s => s.key === processingStage);
              const isComplete = index < stageIndex;
              const isCurrent = stage.key === processingStage;

              return (
                <div key={stage.key} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isCurrent ? 'bg-primary/10' : isComplete ? 'bg-muted/50' : 'opacity-50'
                }`}>
                  {isComplete ? (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span className={isCurrent ? 'font-medium' : ''}>{stage.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error UI
  if (processingStage === 'error') {
    return (
      <Card className="border-destructive/50 bg-card/50 backdrop-blur">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-destructive">Processing Failed</CardTitle>
          <CardDescription className="text-muted-foreground">
            {errorMessage || 'An error occurred while processing your recording.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-destructive/10 border-2 border-destructive flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <Button onClick={handleReset} variant="outline" size="lg">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Results UI
  if (processingStage === 'completed' && generatedContent) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-primary" />
            Content Ready
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Platform-specific posts generated from your event. Edit as needed before posting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="linkedin" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
              <TabsTrigger value="instagram">Instagram</TabsTrigger>
              <TabsTrigger value="twitter">Twitter/X</TabsTrigger>
            </TabsList>

            <TabsContent value="linkedin" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">LinkedIn Post</label>
                <Textarea 
                  value={generatedContent.linkedin.post}
                  onChange={(e) => setGeneratedContent({
                    ...generatedContent,
                    linkedin: { ...generatedContent.linkedin, post: e.target.value }
                  })}
                  className="min-h-[200px] bg-background/50"
                />
              </div>
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Why this works: </span>
                  {generatedContent.linkedin.explanation}
                </p>
              </div>
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(generatedContent.linkedin.post);
                  toast({ title: "Copied to clipboard!" });
                }}
                variant="outline"
                className="w-full"
              >
                Copy to Clipboard
              </Button>
            </TabsContent>

            <TabsContent value="instagram" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Instagram Caption</label>
                <Textarea 
                  value={generatedContent.instagram.caption}
                  onChange={(e) => setGeneratedContent({
                    ...generatedContent,
                    instagram: { ...generatedContent.instagram, caption: e.target.value }
                  })}
                  className="min-h-[200px] bg-background/50"
                />
              </div>
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Why this works: </span>
                  {generatedContent.instagram.explanation}
                </p>
              </div>
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(generatedContent.instagram.caption);
                  toast({ title: "Copied to clipboard!" });
                }}
                variant="outline"
                className="w-full"
              >
                Copy to Clipboard
              </Button>
            </TabsContent>

            <TabsContent value="twitter" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Twitter/X Thread</label>
                <Textarea 
                  value={generatedContent.twitter.thread}
                  onChange={(e) => setGeneratedContent({
                    ...generatedContent,
                    twitter: { ...generatedContent.twitter, thread: e.target.value }
                  })}
                  className="min-h-[200px] bg-background/50"
                />
              </div>
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Why this works: </span>
                  {generatedContent.twitter.explanation}
                </p>
              </div>
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(generatedContent.twitter.thread);
                  toast({ title: "Copied to clipboard!" });
                }}
                variant="outline"
                className="w-full"
              >
                Copy to Clipboard
              </Button>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-4 border-t border-border">
            <Button onClick={handleReset} variant="ghost" className="w-full">
              Record Another Event
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default LiveEventRecorder;
