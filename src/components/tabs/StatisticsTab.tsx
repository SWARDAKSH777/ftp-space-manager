
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, Users, Server, HardDrive } from 'lucide-react';

interface StatsData {
  totalUsers: number;
  activeUsers: number;
  totalServers: number;
  activeServers: number;
  totalFiles: number;
  totalStorage: number;
  recentActivity: number;
}

const StatisticsTab = () => {
  const [stats, setStats] = useState<StatsData>({
    totalUsers: 0,
    activeUsers: 0,
    totalServers: 0,
    activeServers: 0,
    totalFiles: 0,
    totalStorage: 0,
    recentActivity: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      // Fetch user statistics
      const { data: userProfiles, error: userError } = await supabase
        .from('user_profiles')
        .select('is_active');

      if (userError) throw userError;

      // Fetch server statistics
      const { data: servers, error: serverError } = await supabase
        .from('server_config')
        .select('is_active');

      if (serverError) throw serverError;

      // Fetch file cache statistics
      const { data: fileCache, error: fileError } = await supabase
        .from('file_cache')
        .select('size');

      if (fileError) throw fileError;

      // Fetch recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentActivity, error: activityError } = await supabase
        .from('activity_log')
        .select('id')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (activityError) throw activityError;

      // Calculate statistics
      const totalUsers = userProfiles?.length || 0;
      const activeUsers = userProfiles?.filter(user => user.is_active).length || 0;
      const totalServers = servers?.length || 0;
      const activeServers = servers?.filter(server => server.is_active).length || 0;
      const totalFiles = fileCache?.length || 0;
      const totalStorage = fileCache?.reduce((sum, file) => sum + (file.size || 0), 0) || 0;

      setStats({
        totalUsers,
        activeUsers,
        totalServers,
        activeServers,
        totalFiles,
        totalStorage,
        recentActivity: recentActivity?.length || 0
      });
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const chartData = [
    { name: 'Users', total: stats.totalUsers, active: stats.activeUsers },
    { name: 'Servers', total: stats.totalServers, active: stats.activeServers },
  ];

  const pieData = [
    { name: 'Active Users', value: stats.activeUsers, color: '#3b82f6' },
    { name: 'Inactive Users', value: stats.totalUsers - stats.activeUsers, color: '#e5e7eb' },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Statistics</h1>
        <p className="text-gray-600">Overview of your family file management system</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-xs text-gray-500">{stats.activeUsers} active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Server className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Servers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalServers}</p>
                <p className="text-xs text-gray-500">{stats.activeServers} active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Files Cached</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalFiles}</p>
                <p className="text-xs text-gray-500">{formatFileSize(stats.totalStorage)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                <p className="text-2xl font-bold text-gray-900">{stats.recentActivity}</p>
                <p className="text-xs text-gray-500">Last 30 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#e5e7eb" name="Total" />
                <Bar dataKey="active" fill="#3b82f6" name="Active" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatisticsTab;
