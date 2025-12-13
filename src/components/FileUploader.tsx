import React, { useRef, useState } from 'react';
import { Upload, X, Image, Video, Music, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface UploadedFile {
  id: string;
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  preview?: string;
}

interface FileUploaderProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  files, 
  onFilesChange,
  maxFiles = 5 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getFileType = (file: File): UploadedFile['type'] => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleFiles = (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];
    
    Array.from(fileList).forEach((file) => {
      if (files.length + newFiles.length >= maxFiles) return;
      
      const fileType = getFileType(file);
      const uploadedFile: UploadedFile = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        type: fileType,
      };

      // Create preview for images
      if (fileType === 'image') {
        uploadedFile.preview = URL.createObjectURL(file);
      }

      newFiles.push(uploadedFile);
    });

    onFilesChange([...files, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }
    onFilesChange(files.filter(f => f.id !== id));
  };

  const getFileIcon = (type: UploadedFile['type']) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all
          ${isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-border/50 hover:border-primary/50'
          }
          ${files.length >= maxFiles ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        
        <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          <span className="text-primary font-medium">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Images, videos, or audio files ({files.length}/{maxFiles})
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uploadedFile) => (
            <div
              key={uploadedFile.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30"
            >
              {uploadedFile.preview ? (
                <img 
                  src={uploadedFile.preview} 
                  alt="" 
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                  {getFileIcon(uploadedFile.type)}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{uploadedFile.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(uploadedFile.file.size)}
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(uploadedFile.id);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
