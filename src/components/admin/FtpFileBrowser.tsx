
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Folder, File, RefreshCw } from 'lucide-react';

interface FtpFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

interface ServerConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  passive_mode: boolean;
}

interface FtpFileBrowserProps {
  onPathSelect: (path: string) => void;
  selectedPath: string;
}

const FtpFileBrowser = ({ onPathSelect, selectedPath }: FtpFileBrowserProps) => {
  const [files, setFiles] = useState<FtpFile[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchServerConfig();
  }, []);

  useEffect(() => {
    if (serverConfig) {
      fetchFiles();
    }
  }, [currentPath, serverConfig]);

  const fetchServerConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('server_config')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setServerConfig(data);
      }
    } catch (error: any) {
      console.error('Error fetching server config:', error);
    }
  };

  const fetchFiles = async () => {
    if (!serverConfig) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ftp-operations', {
        body: {
          action: 'list_files',
          path: currentPath,
          config: {
            host: serverConfig.host,
            port: serverConfig.port,
            username: serverConfig.username,
            password: serverConfig.password,
            passive_mode: serverConfig.passive_mode
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        setFiles(data.files || []);
      } else {
        throw new Error(data.error || 'Failed to list files');
      }
    } catch (error: any) {
      console.error('Failed to fetch files:', error);
      toast({
        title: "Failed to fetch files",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const navigateToPath = (path: string) => {
    setCurrentPath(path);
  };

  const getSelectableItems = () => {
    const items = [
      { value: '/', label: '/ (Root)', type: 'directory' as const }
    ];

    // Add current path if it's not root
    if (currentPath !== '/') {
      items.push({
        value: currentPath,
        label: currentPath,
        type: 'directory' as const
      });
    }

    // Add directories from current listing
    files
      .filter(file => file.type === 'directory' && file.name !== '..')
      .forEach(file => {
        if (!items.some(item => item.value === file.path)) {
          items.push({
            value: file.path,
            label: file.path,
            type: 'directory' as const
          });
        }
      });

    return items;
  };

  const pathParts = currentPath.split('/').filter(part => part);

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium">Browse Server Files:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchFiles}
          disabled={loading || !serverConfig}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {!serverConfig ? (
        <div className="text-sm text-gray-500">No server configured</div>
      ) : (
        <>
          {/* Breadcrumb navigation */}
          <div className="flex items-center space-x-1 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateToPath('/')}
              className="h-6 px-2"
            >
              <Folder className="h-3 w-3 mr-1" />
              Root
            </Button>
            {pathParts.map((part, index) => (
              <React.Fragment key={index}>
                <span>/</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateToPath('/' + pathParts.slice(0, index + 1).join('/'))}
                  className="h-6 px-2"
                >
                  {part}
                </Button>
              </React.Fragment>
            ))}
          </div>

          {/* File listing */}
          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-sm text-gray-500">Loading...</div>
            ) : files.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">Empty directory</div>
            ) : (
              <div className="space-y-1">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                      file.type === 'directory' ? 'text-blue-600' : 'text-gray-600'
                    }`}
                    onClick={() => {
                      if (file.type === 'directory') {
                        if (file.name === '..') {
                          const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
                          navigateToPath(parentPath);
                        } else {
                          navigateToPath(file.path);
                        }
                      }
                    }}
                  >
                    {file.type === 'directory' ? (
                      <Folder className="h-4 w-4" />
                    ) : (
                      <File className="h-4 w-4" />
                    )}
                    <span className="text-sm">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Path selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Path to Grant Access:</label>
            <Select value={selectedPath} onValueChange={onPathSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a path" />
              </SelectTrigger>
              <SelectContent>
                {getSelectableItems().map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    <div className="flex items-center space-x-2">
                      <Folder className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
};

export default FtpFileBrowser;
