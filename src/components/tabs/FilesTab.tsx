
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Folder, 
  File, 
  ArrowLeft, 
  RefreshCw, 
  Upload,
  Download,
  Trash2,
  Search,
  Loader2
} from 'lucide-react';

interface FtpServer {
  id: string;
  name: string;
  host: string;
  status: 'active' | 'inactive' | 'error';
}

interface FtpFile {
  name: string;
  size: number;
  type: 'file' | 'directory';
  modified_at: string;
  path: string;
}

const FilesTab = () => {
  const [servers, setServers] = useState<FtpServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FtpFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [connected, setConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('ftp_servers')
        .select('id, name, host, status')
        .order('name');

      if (error) throw error;
      setServers(data || []);
    } catch (error: any) {
      toast({
        title: "Failed to fetch servers",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const connectToServer = async () => {
    if (!selectedServerId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ftp-operations', {
        body: {
          action: 'test_connection',
          serverId: selectedServerId
        }
      });

      if (error) throw error;

      if (data.success) {
        setConnected(true);
        setCurrentPath('/');
        await listFiles('/');
        toast({
          title: "Connected successfully",
          description: "FTP connection established"
        });
      } else {
        throw new Error(data.error || 'Connection failed');
      }
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const listFiles = async (path: string) => {
    if (!selectedServerId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ftp-operations', {
        body: {
          action: 'list_files',
          serverId: selectedServerId,
          path: path
        }
      });

      if (error) throw error;

      if (data.success) {
        setFiles(data.files || []);
        setCurrentPath(path);
      } else {
        throw new Error(data.error || 'Failed to list files');
      }
    } catch (error: any) {
      toast({
        title: "Failed to list files",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const navigateToPath = (path: string) => {
    listFiles(path);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">File Browser</h1>
        <p className="text-gray-600">Browse and manage files on your FTP servers</p>
      </div>

      {/* Server Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Server Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an FTP server" />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      {server.name} ({server.host})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={connectToServer} 
              disabled={!selectedServerId || loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {connected ? 'Reconnect' : 'Connect'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {connected && (
        <>
          {/* Navigation Bar */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigateToPath('/')}
                    disabled={currentPath === '/'}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">Path:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">{currentPath}</code>
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => listFiles(currentPath)}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search files and folders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          <Card>
            <CardHeader>
              <CardTitle>Files and Folders</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No files found
                    </div>
                  ) : (
                    filteredFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                        onClick={() => file.type === 'directory' && navigateToPath(file.path)}
                      >
                        <div className="flex items-center space-x-3">
                          {file.type === 'directory' ? (
                            <Folder className="h-5 w-5 text-blue-500" />
                          ) : (
                            <File className="h-5 w-5 text-gray-500" />
                          )}
                          <div>
                            <div className="font-medium">{file.name}</div>
                            <div className="text-sm text-gray-500">
                              {formatDate(file.modified_at)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-500">
                            {formatFileSize(file.size)}
                          </span>
                          {file.type === 'file' && (
                            <div className="flex space-x-1">
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default FilesTab;
