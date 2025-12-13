import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import FileUploader, { UploadedFile } from './FileUploader';
import { FileText } from 'lucide-react';

interface ContentInputsProps {
  additionalContext: string;
  onContextChange: (context: string) => void;
  uploadedFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
}

const ContentInputs: React.FC<ContentInputsProps> = ({
  additionalContext,
  onContextChange,
  uploadedFiles,
  onFilesChange,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Additional Context */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <label className="text-sm font-medium">Additional Context</label>
          <span className="text-xs text-muted-foreground">(optional)</span>
        </div>
        <Textarea
          value={additionalContext}
          onChange={(e) => onContextChange(e.target.value)}
          placeholder="Add any extra context, key points, or specific instructions for the AI..."
          className="min-h-[100px] bg-card/50 border-border/50 resize-none"
        />
      </div>

      {/* File Uploads */}
      <div className="space-y-3">
        <label className="text-sm font-medium block">
          Upload Media <span className="text-xs text-muted-foreground">(optional)</span>
        </label>
        <FileUploader
          files={uploadedFiles}
          onFilesChange={onFilesChange}
          maxFiles={5}
        />
      </div>
    </div>
  );
};

export default ContentInputs;
