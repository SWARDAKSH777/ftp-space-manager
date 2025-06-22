import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { 
  Folder, 
  Upload, 
  RefreshCw,
  FolderPlus,
  AlertCircle,
  Wifi,
  HardDrive
} from 'lucide-react';
import MobileFileList from '@/components/files/MobileFileList';
import FileOperationProgress from '@/components/files/FileOperationProgress';

interface FtpFile {
  name: string;
  size: number;
  type: 'file' | 'directory';
  modified_at: string;
  path: string;
}

interface FileOperation {
  id: string;
  type: 'upload' | 'download';
  fileName: string;
  progress: number;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  error?: string;
}

interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: string;
  passive_mode: boolean;
  is_active: boolean;
}

const NewFilesTab = () => {
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FtpFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | null>(null);
  const [fileOperations, setFileOperations] = useState<FileOperation[]>([]);
  const [pathPermissions, setPathPermissions] = useState({
    can_read: false,
    can_write: false,
    can_delete: false
  });
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  
  const { toast } = useToast();
  const { isAdmin, getFilePermissions } = useUserPermissions();

  useEffect(() => {
    fetchServerConfig();
  }, []);

  useEffect(() => {
    if (serverConfig) {
      fetchFiles();
    }
  }, [currentPath, serverConfig]);

  useEffect(() => {
    if (currentPath) {
      checkPathPermissions();
    }
  }, [currentPath, isAdmin]);

  const fetchServerConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('server_config')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching server config:', error);
        toast({
          title: "No server configuration found",
          description: "Please configure a server in the admin settings",
          variant: "destructive"
        });
        return;
      }

      if (!data) {
        toast({
          title: "No server configured",
          description: "Please ask an admin to configure the FTP server",
          variant: "destructive"
        });
        return;
      }

      setServerConfig(data);
    } catch (error: any) {
      console.error('Error fetching server config:', error);
      toast({
        title: "Failed to fetch server configuration",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const checkPathPermissions = async () => {
    const permissions = await getFilePermissions(currentPath);
    setPathPermissions(permissions);
  };

  const fetchFiles = async () => {
    if (!serverConfig) {
      console.log('No server config available');
      return;
    }

    setLoading(true);
    setConnectionStatus('connecting');
    
    try {
      console.log('Fetching files from server...');
      
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

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.success) {
        const filteredFiles = data.files.filter((file: FtpFile) => {
          if (isAdmin) return true;
          return pathPermissions.can_read;
        });
        
        setFiles(filteredFiles || []);
        setConnectionStatus('connected');
        console.log('Files fetched successfully:', filteredFiles?.length || 0);
      } else {
        setConnectionStatus('error');
        throw new Error(data?.error || 'Failed to list files');
      }
    } catch (error: any) {
      console.error('Failed to fetch files:', error);
      setConnectionStatus('error');
      toast({
        title: "Failed to fetch files",
        description: error.message,
        variant: "destructive"
      });
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = (file: FtpFile) => {
    if (file.type === 'directory') {
      if (file.name === '..') {
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        setCurrentPath(parentPath);
      } else {
        setCurrentPath(file.path);
      }
    }
  };

  const handleCreateDirectory = async () => {
    if (!pathPermissions.can_write) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to create folders here",
        variant: "destructive"
      });
      return;
    }

    if (!serverConfig) {
      toast({
        title: "No server configuration",
        description: "Server not configured",
        variant: "destructive"
      });
      return;
    }

    const dirName = prompt('Enter directory name:');
    if (!dirName) return;

    const dirPath = `${currentPath}/${dirName}`.replace('//', '/');

    try {
      const { data, error } = await supabase.functions.invoke('ftp-operations', {
        body: {
          action: 'create_directory',
          path: dirPath,
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
        toast({
          title: "Directory created",
          description: `${dirName} has been created`
        });
        await fetchFiles();
      } else {
        throw new Error(data.error || 'Directory creation failed');
      }
    } catch (error: any) {
      toast({
        title: "Create directory failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!pathPermissions.can_write) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to upload files here",
        variant: "destructive"
      });
      return;
    }

    if (!serverConfig) {
      toast({
        title: "No server configuration",
        description: "Server not configured",
        variant: "destructive"
      });
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    const operationId = Date.now().toString();
    const newOperation: FileOperation = {
      id: operationId,
      type: 'upload',
      fileName: file.name,
      progress: 0,
      status: 'in-progress'
    };

    setFileOperations(prev => [...prev, newOperation]);

    try {
      // Update progress while reading file
      setFileOperations(prev => prev.map(op => 
        op.id === operationId 
          ? { ...op, progress: 25 }
          : op
      ));

      // Read file content using FileReader properly to avoid recursion
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result;
          if (typeof result === 'string') {
            // Convert to base64 if it's a data URL
            const base64Content = result.includes(',') ? result.split(',')[1] : btoa(result);
            resolve(base64Content);
          } else if (result instanceof ArrayBuffer) {
            // Convert ArrayBuffer to base64
            const base64Content = btoa(String.fromCharCode(...new Uint8Array(result)));
            resolve(base64Content);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file); // Use ArrayBuffer to avoid string encoding issues
      });

      setFileOperations(prev => prev.map(op => 
        op.id === operationId 
          ? { ...op, progress: 50 }
          : op
      ));

      const remotePath = `${currentPath}/${file.name}`.replace('//', '/');

      const { data, error } = await supabase.functions.invoke('ftp-operations', {
        body: {
          action: 'upload_file',
          config: {
            host: serverConfig.host,
            port: serverConfig.port,
            username: serverConfig.username,
            password: serverConfig.password,
            passive_mode: serverConfig.passive_mode
          },
          fileData: {
            fileName: file.name,
            size: file.size,
            localPath: file.name,
            remotePath: remotePath,
            content: fileContent
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        setFileOperations(prev => prev.map(op => 
          op.id === operationId 
            ? { ...op, progress: 100, status: 'completed' }
            : op
        ));
        
        toast({
          title: "Upload successful",
          description: `${file.name} has been uploaded`
        });
        
        await fetchFiles();
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (uploadError: any) {
      console.error('Upload error:', uploadError);
      setFileOperations(prev => prev.map(op => 
        op.id === operationId 
          ? { ...op, status: 'error', error: uploadError.message }
          : op
      ));
      
      toast({
        title: "Upload failed",
        description: uploadError.message,
        variant: "destructive"
      });
    }

    // Clear the input
    event.target.value = '';
  };

  const handleDownload = async (file: FtpFile) => {
    if (!pathPermissions.can_read) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to download this file",
        variant: "destructive"
      });
      return;
    }

    if (!serverConfig) {
      toast({
        title: "No server configuration",
        description: "Server not configured",
        variant: "destructive"
      });
      return;
    }

    const operationId = Date.now().toString();
    const newOperation: FileOperation = {
      id: operationId,
      type: 'download',
      fileName: file.name,
      progress: 0,
      status: 'in-progress'
    };

    setFileOperations(prev => [...prev, newOperation]);

    try {
      const progressInterval = setInterval(() => {
        setFileOperations(prev => prev.map(op => 
          op.id === operationId 
            ? { ...op, progress: Math.min(op.progress + 15, 90) }
            : op
        ));
      }, 150);

      const { data, error } = await supabase.functions.invoke('ftp-operations', {
        body: {
          action: 'download_file',
          path: file.path,
          config: {
            host: serverConfig.host,
            port: serverConfig.port,
            username: serverConfig.username,
            password: serverConfig.password,
            passive_mode: serverConfig.passive_mode
          }
        }
      });

      clearInterval(progressInterval);

      if (error) throw error;

      if (data.success && data.content) {
        const content = atob(data.content);
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);

        setFileOperations(prev => prev.map(op => 
          op.id === operationId 
            ? { ...op, progress: 100, status: 'completed' }
            : op
        ));

        toast({
          title: "Download complete",
          description: `${file.name} has been downloaded`
        });
      } else {
        throw new Error(data.error || 'Download failed');
      }
    } catch (error: any) {
      setFileOperations(prev => prev.map(op => 
        op.id === operationId 
          ? { ...op, status: 'error', error: error.message }
          : op
      ));
    }
  };

  const handleDelete = async (file: FtpFile) => {
    if (!pathPermissions.can_delete) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to delete files here",
        variant: "destructive"
      });
      return;
    }

    if (!serverConfig) {
      toast({
        title: "No server configuration",
        description: "Server not configured",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('ftp-operations', {
        body: {
          action: 'delete_file',
          path: file.path,
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
        toast({
          title: "File deleted",
          description: `${file.name} has been deleted`
        });
        await fetchFiles();
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const renderConnectionStatus = () => {
    if (!connectionStatus) return null;
    
    switch (connectionStatus) {
      case 'connecting':
        return (
          <div className="flex items-center text-yellow-600 text-sm mb-4 p-3 bg-yellow-50 rounded-lg">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Connecting to server...
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center text-green-600 text-sm mb-4 p-3 bg-green-50 rounded-lg">
            <Wifi className="h-4 w-4 mr-2" />
            Connected to {serverConfig?.name || 'Server'}
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 mr-2" />
            Connection failed. Please contact admin.
          </div>
        );
      default:
        return null;
    }
  };

  const renderBreadcrumb = () => {
    const pathParts = currentPath.split('/').filter(part => part);
    
    return (
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink 
              onClick={() => setCurrentPath('/')}
              className="cursor-pointer"
            >
              <HardDrive className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          {pathParts.map((part, index) => (
            <React.Fragment key={index}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {index === pathParts.length - 1 ? (
                  <BreadcrumbPage>{part}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink 
                    onClick={() => setCurrentPath('/' + pathParts.slice(0, index + 1).join('/'))}
                    className="cursor-pointer"
                  >
                    {part}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    );
  };

  if (!serverConfig) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Server Configuration</h3>
          <p className="text-gray-600">
            Please ask an administrator to configure the FTP server settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Family Files</h1>
          <p className="text-gray-600">Browse and manage your family files</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pathPermissions.can_write && (
            <>
              <Button
                variant="outline"
                onClick={handleCreateDirectory}
                disabled={loading}
                size="sm"
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
              <label>
                <Button
                  variant="outline"
                  disabled={loading}
                  size="sm"
                  asChild
                >
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </span>
                </Button>
                <input
                  type="file"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </>
          )}
          <Button
            variant="outline"
            onClick={fetchFiles}
            disabled={loading}
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {renderConnectionStatus()}
      {renderBreadcrumb()}

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Loading files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {connectionStatus === 'error' ? 'Connection Failed' : 'Empty Directory'}
              </h3>
              <p className="text-gray-600">
                {connectionStatus === 'error' 
                  ? 'Unable to connect to the server. Please contact your admin.' 
                  : pathPermissions.can_read 
                    ? 'This directory is empty'
                    : 'You don\'t have permission to view files in this directory'
                }
              </p>
            </div>
          ) : (
            <MobileFileList
              files={files}
              permissions={pathPermissions}
              onFileClick={handleFileClick}
              onDownload={handleDownload}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>

      <FileOperationProgress
        operations={fileOperations}
        onCancel={(id) => {
          setFileOperations(prev => prev.filter(op => op.id !== id));
        }}
        onClear={(id) => {
          setFileOperations(prev => prev.filter(op => op.id !== id));
        }}
      />
    </div>
  );
};

export default NewFilesTab;
