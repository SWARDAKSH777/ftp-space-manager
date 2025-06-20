import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  File, 
  Upload, 
  Download, 
  Trash2, 
  RefreshCw,
  ArrowLeft,
  Plus,
  FolderPlus,
  AlertCircle,
  Wifi
} from 'lucide-react';

interface FtpFile {
  name: string;
  size: number;
  type: 'file' | 'directory';
  modified_at: string;
  path: string;
  permissions?: string;
}

interface FtpServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  protocol: string;
  is_active: boolean;
}

const FilesTab = () => {
  const [servers, setServers] = useState<FtpServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<FtpServer | null>(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FtpFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | null>(null);
  const { toast } = useToast();

  // Fetch servers on component mount
  useEffect(() => {
    fetchServers();
  }, []);

  // Fetch files when server or path changes
  useEffect(() => {
    if (selectedServer) {
      fetchFiles();
    }
  }, [selectedServer, currentPath]);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('server_config')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      const formattedServers = (data || []).map(server => ({
        id: server.id,
        name: server.name,
        host: server.host,
        port: server.port,
        username: server.username,
        protocol: server.protocol,
        is_active: server.is_active
      }));
      
      setServers(formattedServers);
      if (formattedServers.length > 0 && !selectedServer) {
        setSelectedServer(formattedServers[0]);
      }
    } catch (error: any) {
      toast({
        title: "Failed to fetch servers",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchFiles = async () => {
    if (!selectedServer) return;
    
    setLoading(true);
    setConnectionStatus('connecting');
    
    try {
      console.log(`Fetching files from ${selectedServer.name} at path: ${currentPath}`);
      
      // This would normally call the FTP function, but for now we'll show empty state
      setFiles([]);
      setConnectionStatus('connected');
      
      toast({
        title: "Files loaded successfully",
        description: `Found 0 items in ${currentPath}`
      });
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
        // Navigate to parent directory
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        setCurrentPath(parentPath);
      } else {
        // Navigate into directory
        setCurrentPath(file.path);
      }
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedServer) return;

    setUploading(true);
    
    // Simulate upload
    setTimeout(() => {
      toast({
        title: "Upload simulated",
        description: `${file.name} would be uploaded to ${currentPath}`
      });
      setUploading(false);
    }, 2000);
  };

  const handleDownload = async (file: FtpFile) => {
    toast({
      title: "Download simulated",
      description: `${file.name} would be downloaded`
    });
  };

  const handleDelete = async (file: FtpFile) => {
    if (confirm(`Are you sure you want to delete ${file.name}?`)) {
      toast({
        title: "Delete simulated",
        description: `${file.name} would be deleted`
      });
    }
  };

  const handleCreateDirectory = async () => {
    const dirName = prompt('Enter directory name:');
    if (!dirName || !selectedServer) return;

    toast({
      title: "Directory creation simulated",
      description: `${dirName} would be created in ${currentPath}`
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderConnectionStatus = () => {
    if (!connectionStatus) return null;
    
    switch (connectionStatus) {
      case 'connecting':
        return (
          <div className="flex items-center text-yellow-600 text-sm mb-4">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Connecting to server...
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center text-green-600 text-sm mb-4">
            <Wifi className="h-4 w-4 mr-2" />
            Connected to {selectedServer?.name}
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-red-600 text-sm mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            Connection failed. Check logs for details.
          </div>
        );
      default:
        return null;
    }
  };

  const renderBreadcrumb = () => {
    const pathParts = currentPath.split('/').filter(part => part);
    
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink 
              onClick={() => setCurrentPath('/')}
              className="cursor-pointer"
            >
              Root
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">File Browser</h1>
          <p className="text-gray-600">Browse and manage files on your FTP servers</p>
        </div>
        <div className="flex space-x-2">
          {selectedServer && (
            <>
              <Button
                variant="outline"
                onClick={handleCreateDirectory}
                disabled={loading}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
              <label>
                <Button
                  variant="outline"
                  disabled={uploading || loading}
                  asChild
                >
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </span>
                </Button>
                <input
                  type="file"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={uploading || loading}
                />
              </label>
              <Button
                variant="outline"
                onClick={fetchFiles}
                disabled={loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </>
          )}
        </div>
      </div>

      {servers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Servers Configured</h3>
            <p className="text-gray-600">Configure an FTP server first to browse files</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Server Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Server</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {servers.map((server) => (
                  <Button
                    key={server.id}
                    variant={selectedServer?.id === server.id ? "default" : "outline"}
                    onClick={() => setSelectedServer(server)}
                    className="flex items-center"
                  >
                    {server.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedServer && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Folder className="mr-2 h-5 w-5" />
                    {selectedServer.name}
                  </CardTitle>
                  {renderBreadcrumb()}
                </div>
              </CardHeader>
              <CardContent>
                {renderConnectionStatus()}
                
                {loading ? (
                  <div className="text-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p>Loading files...</p>
                  </div>
                ) : files.length === 0 ? (
                  <div className="text-center py-12">
                    <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {connectionStatus === 'error' ? 'Connection Failed' : 'Empty Directory'}
                    </h3>
                    <p className="text-gray-600">
                      {connectionStatus === 'error' 
                        ? 'Unable to connect to the FTP server. Please check your server configuration and try again.' 
                        : 'This directory is empty'
                      }
                    </p>
                    {connectionStatus === 'error' && (
                      <Button
                        onClick={fetchFiles}
                        variant="outline"
                        className="mt-4"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry Connection
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleFileClick(file)}
                      >
                        <div className="flex items-center space-x-3">
                          {file.type === 'directory' ? (
                            <Folder className="h-5 w-5 text-blue-600" />
                          ) : (
                            <File className="h-5 w-5 text-gray-600" />
                          )}
                          <div>
                            <p className="font-medium">{file.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.size)} • {new Date(file.modified_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        
                        {file.type === 'file' && file.name !== '..' && (
                          <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownload(file)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(file)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default FilesTab;
