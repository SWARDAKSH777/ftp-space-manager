
import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react';

interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface FileUploaderProps {
  serverId: string;
  currentPath: string;
  onUploadComplete: () => void;
}

const FileUploader = ({ serverId, currentPath, onUploadComplete }: FileUploaderProps) => {
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newUploads = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: 'pending' as const
    }));

    setUploadQueue(prev => [...prev, ...newUploads]);
  };

  const uploadFile = async (uploadItem: FileUploadItem) => {
    try {
      setUploadQueue(prev =>
        prev.map(item =>
          item.id === uploadItem.id
            ? { ...item, status: 'uploading', progress: 0 }
            : item
        )
      );

      // Read file content
      const fileContent = await uploadItem.file.arrayBuffer();
      const base64Content = btoa(String.fromCharCode(...new Uint8Array(fileContent)));

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadQueue(prev =>
          prev.map(item =>
            item.id === uploadItem.id && item.progress < 90
              ? { ...item, progress: item.progress + 10 }
              : item
          )
        );
      }, 200);

      const { data, error } = await supabase.functions.invoke('ftp-operations', {
        body: {
          action: 'upload_file',
          serverId,
          fileData: {
            fileName: uploadItem.file.name,
            size: uploadItem.file.size,
            localPath: uploadItem.file.name,
            remotePath: `${currentPath}/${uploadItem.file.name}`,
            content: base64Content
          }
        }
      });

      clearInterval(progressInterval);

      if (error) throw error;

      if (data.success) {
        setUploadQueue(prev =>
          prev.map(item =>
            item.id === uploadItem.id
              ? { ...item, status: 'completed', progress: 100 }
              : item
          )
        );

        toast({
          title: "Upload successful",
          description: `${uploadItem.file.name} has been uploaded`
        });

        onUploadComplete();
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error: any) {
      setUploadQueue(prev =>
        prev.map(item =>
          item.id === uploadItem.id
            ? { ...item, status: 'error', error: error.message }
            : item
        )
      );

      toast({
        title: "Upload failed",
        description: `Failed to upload ${uploadItem.file.name}: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const startUploads = async () => {
    const pendingUploads = uploadQueue.filter(item => item.status === 'pending');
    
    for (const upload of pendingUploads) {
      await uploadFile(upload);
    }
  };

  const removeUpload = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearCompleted = () => {
    setUploadQueue(prev => prev.filter(item => item.status !== 'completed'));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Upload className="mr-2 h-5 w-5" />
          File Upload
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            Drop files here or click to browse
          </p>
          <p className="text-gray-600 mb-4">
            Upload files to {currentPath}
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
          >
            Select Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>

        {/* Upload Queue */}
        {uploadQueue.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Upload Queue</h3>
              <div className="space-x-2">
                <Button
                  onClick={startUploads}
                  disabled={uploadQueue.every(item => item.status !== 'pending')}
                  size="sm"
                >
                  Start Upload
                </Button>
                <Button
                  onClick={clearCompleted}
                  variant="outline"
                  size="sm"
                >
                  Clear Completed
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {uploadQueue.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(item.status)}
                      <div>
                        <p className="font-medium">{item.file.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUpload(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {item.status === 'uploading' && (
                    <Progress value={item.progress} className="mb-2" />
                  )}

                  {item.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {item.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUploader;
