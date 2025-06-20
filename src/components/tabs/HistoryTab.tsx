import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  History, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Clock,
  Search,
  Filter,
  RefreshCw,
  Loader,
  User,
  Activity
} from 'lucide-react';

interface ActivityLogItem {
  id: string;
  user_id: string;
  action: string;
  details: any;
  ip_address: string | null;
  created_at: string;
}

const HistoryTab = () => {
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);
  const [filteredActivity, setFilteredActivity] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchActivityLog();
  }, []);

  useEffect(() => {
    filterActivity();
  }, [activityLog, searchTerm, actionFilter]);

  const fetchActivityLog = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData: ActivityLogItem[] = (data || []).map(item => ({
        ...item,
        ip_address: item.ip_address as string | null
      }));

      setActivityLog(transformedData);
    } catch (error: any) {
      toast({
        title: "Failed to fetch activity log",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterActivity = () => {
    let filtered = activityLog;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(item.details).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by action
    if (actionFilter !== 'all') {
      filtered = filtered.filter(item => item.action === actionFilter);
    }

    setFilteredActivity(filtered);
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
      case 'sign_in':
        return <User className="h-4 w-4 text-green-500" />;
      case 'logout':
      case 'sign_out':
        return <User className="h-4 w-4 text-red-500" />;
      case 'upload':
        return <Upload className="h-4 w-4 text-blue-500" />;
      case 'delete':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
      case 'sign_in':
        return <Badge variant="default" className="bg-green-100 text-green-800">Sign In</Badge>;
      case 'logout':
      case 'sign_out':
        return <Badge variant="destructive">Sign Out</Badge>;
      case 'upload':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Upload</Badge>;
      case 'delete':
        return <Badge variant="destructive">Delete</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return 'No additional details';
    
    if (typeof details === 'string') return details;
    
    return Object.entries(details).map(([key, value]) => 
      `${key}: ${value}`
    ).join(', ');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity History</h1>
          <p className="text-gray-600">Track all system activities and user actions</p>
        </div>
        <Button onClick={fetchActivityLog} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search actions or details..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="login">Sign In</SelectItem>
                  <SelectItem value="logout">Sign Out</SelectItem>
                  <SelectItem value="upload">Upload</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredActivity.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activityLog.length === 0 ? 'No Activity History' : 'No Results Found'}
            </h3>
            <p className="text-gray-600">
              {activityLog.length === 0 
                ? 'User activities will appear here as they occur'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredActivity.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      {getActionIcon(item.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          {item.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h3>
                        {getActionBadge(item.action)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                        <div>
                          <span className="font-medium">User ID:</span> {item.user_id.slice(0, 8)}...
                        </div>
                        {item.ip_address && (
                          <div>
                            <span className="font-medium">IP Address:</span> {item.ip_address}
                          </div>
                        )}
                        <div className="md:col-span-2">
                          <span className="font-medium">Details:</span> {formatDetails(item.details)}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{new Date(item.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryTab;
