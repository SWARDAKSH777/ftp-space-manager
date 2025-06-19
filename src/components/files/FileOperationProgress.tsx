
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Upload, Download } from 'lucide-react';

interface FileOperationProgressProps {
  operations: Array<{
    id: string;
    type: 'upload' | 'download';
    fileName: string;
    progress: number;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    error?: string;
  }>;
  onCancel: (id: string) => void;
  onClear: (id: string) => void;
}

const FileOperationProgress = ({ operations, onCancel, onClear }: FileOperationProgressProps) => {
  if (operations.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 max-w-[calc(100vw-2rem)] z-50 space-y-2">
      {operations.map((operation) => (
        <Card key={operation.id} className="shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {operation.type === 'upload' ? (
                  <Upload className="h-4 w-4 text-blue-600" />
                ) : (
                  <Download className="h-4 w-4 text-green-600" />
                )}
                <span className="text-sm font-medium truncate">
                  {operation.fileName}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => operation.status === 'completed' || operation.status === 'error' 
                  ? onClear(operation.id) 
                  : onCancel(operation.id)
                }
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            
            {operation.status === 'in-progress' && (
              <div className="space-y-1">
                <Progress value={operation.progress} className="h-2" />
                <p className="text-xs text-gray-500">
                  {operation.progress}% {operation.type === 'upload' ? 'uploaded' : 'downloaded'}
                </p>
              </div>
            )}
            
            {operation.status === 'completed' && (
              <p className="text-xs text-green-600">
                {operation.type === 'upload' ? 'Upload' : 'Download'} completed
              </p>
            )}
            
            {operation.status === 'error' && (
              <p className="text-xs text-red-600">
                Error: {operation.error || 'Operation failed'}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default FileOperationProgress;
