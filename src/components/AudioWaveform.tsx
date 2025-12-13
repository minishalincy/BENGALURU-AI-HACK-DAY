import React, { useEffect, useRef } from 'react';

interface AudioWaveformProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
  isPaused: boolean;
}

const AudioWaveform: React.FC<AudioWaveformProps> = ({ analyser, isRecording, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!ctx || !canvas) return;

      const width = canvas.width;
      const height = canvas.height;

      analyser.getByteTimeDomainData(dataArray);

      // Clear canvas with gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(20, 20, 25, 0.95)');
      gradient.addColorStop(1, 'rgba(15, 15, 18, 0.95)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw center line
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Draw waveform
      ctx.lineWidth = 2;
      
      // Glow effect
      ctx.shadowBlur = 15;
      ctx.shadowColor = isPaused ? 'rgba(100, 100, 100, 0.5)' : 'rgba(234, 179, 8, 0.8)';
      
      const waveGradient = ctx.createLinearGradient(0, 0, width, 0);
      if (isPaused) {
        waveGradient.addColorStop(0, 'rgba(150, 150, 150, 0.8)');
        waveGradient.addColorStop(0.5, 'rgba(180, 180, 180, 1)');
        waveGradient.addColorStop(1, 'rgba(150, 150, 150, 0.8)');
      } else {
        waveGradient.addColorStop(0, 'rgba(234, 179, 8, 0.8)');
        waveGradient.addColorStop(0.5, 'rgba(251, 191, 36, 1)');
        waveGradient.addColorStop(1, 'rgba(234, 179, 8, 0.8)');
      }
      ctx.strokeStyle = waveGradient;

      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw frequency bars in background
      analyser.getByteFrequencyData(dataArray);
      const barCount = 64;
      const barWidth = width / barCount;
      const barGap = 2;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * (bufferLength / barCount));
        const barHeight = (dataArray[dataIndex] / 255) * (height * 0.4);
        const barX = i * barWidth;

        const alpha = isPaused ? 0.1 : 0.2;
        ctx.fillStyle = `rgba(234, 179, 8, ${alpha})`;
        ctx.fillRect(barX + barGap / 2, height - barHeight, barWidth - barGap, barHeight);
        ctx.fillRect(barX + barGap / 2, 0, barWidth - barGap, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    if (isRecording) {
      draw();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isRecording, isPaused]);

  // Draw idle state when not recording
  useEffect(() => {
    if (isRecording) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Idle gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(20, 20, 25, 0.95)');
    gradient.addColorStop(1, 'rgba(15, 15, 18, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw static center line
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={200}
      className="w-full h-full rounded-xl"
      style={{ maxHeight: '200px' }}
    />
  );
};

export default AudioWaveform;
