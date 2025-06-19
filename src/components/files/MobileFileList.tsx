
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Folder, 
  File, 
  Download, 
  Trash2,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FtpFile {
  name: string;
  size: number;
  type: 'file' | 'directory';
  modified_at: string;
  path: string;
}

interface MobileFileListProps {
  files: FtpFile[];
  permissions: {
    can_read: boolean;
    can_write: boolean;
    can_delete: boolean;
  };
  onFileClick: (file: FtpFile) => void;
  onDownload: (file: FtpFile) => void;
  onDelete: (file: FtpFile) => void;
}

const MobileFileList = ({ 
  files, 
  permissions, 
  onFileClick, 
  onDownload, 
  onDelete 
}: MobileFileListProps) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <Card key={index} className="overflow-hidden">
          <CardContent className="p-0">
            <div 
              className="flex items-center p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => onFileClick(file)}
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {file.type === 'directory' ? (
                  <Folder className="h-8 w-8 text-blue-600 flex-shrink-0" />
                ) : (
                  <File className="h-8 w-8 text-gray-600 flex-shrink-0" />
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center text-sm text-gray-500 space-x-2">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span>{formatDate(file.modified_at)}</span>
                  </div>
                </div>
              </div>
              
              {file.type === 'file' && file.name !== '..' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {permissions.can_read && (
                      <DropdownMenuItem onClick={() => onDownload(file)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </DropdownMenuItem>
                    )}
                    {permissions.can_delete && (
                      <DropdownMenuItem 
                        onClick={() => onDelete(file)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MobileFileList;
