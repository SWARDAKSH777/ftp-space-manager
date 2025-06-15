import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';

interface UploadRecord {
  id: string;
  file_name: string;
  file_size: number | null;
  remote_path: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  server_name?: string;
}

interface FtpServer {
  id: string;
  name: string;
}

const HistoryTab = () => {
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [servers, setServers] = useState<FtpServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchServers();
    fetchHistory();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [selectedServerId, statusFilter]);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('ftp_servers')
        .select('id, name')
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

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('upload_history')
        .select(`
          *,
          ftp_servers!inner(name)
        `)
        .order('started_at', { ascending: false });

      if (selectedServerId !== 'all') {
        query = query.eq('server_id', selectedServerId);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'pending' | 'in_progress' | 'completed' | 'failed');
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData = (data || []).map(record => ({
        ...record,
        server_name: record.ftp_servers?.name || 'Unknown Server'
      }));

      setHistory(formattedData);
    } catch (error: any) {
      toast({
        title: "Failed to fetch history",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      in_progress: 'default',
      pending: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return '-';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const filteredHistory = history.filter(record => 
    record.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.remote_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (record.server_name && record.server_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload History</h1>
        <p className="text-gray-600">View your file transfer history</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by filename, path, or server..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedServerId} onValueChange={setSelectedServerId}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All servers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Servers</SelectItem>
                {servers.map((server) => (
                  <SelectItem key={server.id} value={server.id}>
                    {server.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchHistory}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History List */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Loading history...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Transfer History</h3>
              <p className="text-gray-600">Start uploading files to see your transfer history here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((record) => (
                <div key={record.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(record.status)}
                      <div>
                        <h4 className="font-medium">{record.file_name}</h4>
                        <p className="text-sm text-gray-500">{record.remote_path}</p>
                      </div>
                    </div>
                    {getStatusBadge(record.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Server:</span> {record.server_name}
                    </div>
                    <div>
                      <span className="font-medium">Size:</span> {formatFileSize(record.file_size)}
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span> {formatDuration(record.started_at, record.completed_at)}
                    </div>
                    <div>
                      <span className="font-medium">Started:</span> {new Date(record.started_at).toLocaleString()}
                    </div>
                  </div>
                  
                  {record.error_message && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <strong>Error:</strong> {record.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoryTab;
