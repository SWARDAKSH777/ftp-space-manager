
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { HardDrive, Files, Folder, Clock, TrendingUp } from 'lucide-react';

interface ServerStats {
  id: string;
  server_id: string;
  total_files: number;
  total_directories: number;
  total_size: number;
  last_scan: string;
  file_types: Record<string, number>;
  size_distribution: Record<string, number>;
}

interface FtpServer {
  id: string;
  name: string;
  host: string;
}

const StatisticsTab = () => {
  const [servers, setServers] = useState<FtpServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    if (selectedServerId) {
      fetchStatistics();
    }
  }, [selectedServerId]);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('ftp_servers')
        .select('id, name, host')
        .order('name');

      if (error) throw error;
      setServers(data || []);
      if (data && data.length > 0) {
        setSelectedServerId(data[0].id);
      }
    } catch (error: any) {
      toast({
        title: "Failed to fetch servers",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchStatistics = async () => {
    if (!selectedServerId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('server_statistics')
        .select('*')
        .eq('server_id', selectedServerId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setStats(data);
      } else {
        // Generate mock statistics for demo
        await generateMockStatistics();
      }
    } catch (error: any) {
      toast({
        title: "Failed to fetch statistics",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateMockStatistics = async () => {
    const mockStats = {
      server_id: selectedServerId,
      total_files: Math.floor(Math.random() * 1000) + 100,
      total_directories: Math.floor(Math.random() * 50) + 10,
      total_size: Math.floor(Math.random() * 10000000000) + 1000000000, // 1-10GB
      file_types: {
        'txt': Math.floor(Math.random() * 50) + 10,
        'pdf': Math.floor(Math.random() * 30) + 5,
        'jpg': Math.floor(Math.random() * 100) + 20,
        'png': Math.floor(Math.random() * 80) + 15,
        'doc': Math.floor(Math.random() * 25) + 5,
        'zip': Math.floor(Math.random() * 15) + 3
      },
      size_distribution: {
        '<1MB': Math.floor(Math.random() * 200) + 50,
        '1-10MB': Math.floor(Math.random() * 150) + 30,
        '10-100MB': Math.floor(Math.random() * 50) + 10,
        '>100MB': Math.floor(Math.random() * 20) + 5
      }
    };

    try {
      const { data, error } = await supabase
        .from('server_statistics')
        .upsert([{
          ...mockStats,
          last_scan: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      setStats(data);
    } catch (error: any) {
      console.error('Failed to generate mock statistics:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fileTypeData = stats?.file_types ? Object.entries(stats.file_types).map(([type, count]) => ({
    name: type.toUpperCase(),
    value: count
  })) : [];

  const sizeDistributionData = stats?.size_distribution ? Object.entries(stats.size_distribution).map(([range, count]) => ({
    name: range,
    count: count
  })) : [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Statistics</h1>
        <p className="text-gray-600">View usage statistics and analytics</p>
      </div>

      {/* Server Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Server</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedServerId} onValueChange={setSelectedServerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a server" />
            </SelectTrigger>
            <SelectContent>
              {servers.map((server) => (
                <SelectItem key={server.id} value={server.id}>
                  {server.name} ({server.host})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {stats && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                <Files className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_files.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Directories</CardTitle>
                <Folder className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_directories.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Size</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBytes(stats.total_size)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Scan</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium">
                  {new Date(stats.last_scan).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* File Types Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>File Types Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={fileTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {fileTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Size Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>File Size Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sizeDistributionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!stats && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Statistics Available</h3>
            <p className="text-gray-600">
              Connect to a server and browse files to generate statistics
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StatisticsTab;
