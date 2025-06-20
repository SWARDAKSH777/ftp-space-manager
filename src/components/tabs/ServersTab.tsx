
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AddServerDialog from '@/components/ftp/AddServerDialog';
import { Trash2, Edit2, Server, Globe } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  is_active: boolean;
  created_at: string;
}

const ServersTab = () => {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isAdmin } = useUserPermissions();

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('server_config')
        .select('id, name, host, port, protocol, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServers(data || []);
    } catch (error: any) {
      toast({
        title: "Failed to fetch servers",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteServer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('server_config')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Server deleted",
        description: `${name} has been removed`
      });

      fetchServers();
    } catch (error: any) {
      toast({
        title: "Failed to delete server",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const toggleServerStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('server_config')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Server status updated",
        description: `Server has been ${!currentStatus ? 'activated' : 'deactivated'}`
      });

      fetchServers();
    } catch (error: any) {
      toast({
        title: "Failed to update server status",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Server Management</h1>
          <p className="text-gray-600">Configure and manage your family file servers</p>
        </div>
        {isAdmin && <AddServerDialog onServerAdded={fetchServers} />}
      </div>

      {servers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Servers Configured</h3>
            <p className="text-gray-600 mb-4">
              Add your first server to start managing family files
            </p>
            {isAdmin && <AddServerDialog onServerAdded={fetchServers} />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <Card key={server.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">{server.name}</CardTitle>
                  </div>
                  <Badge variant={server.is_active ? "default" : "secondary"}>
                    {server.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>
                  {server.protocol.toUpperCase()} • {server.host}:{server.port}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Protocol:</span>
                      <span className="font-medium">{server.protocol.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Port:</span>
                      <span className="font-medium">{server.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Created:</span>
                      <span className="font-medium">{new Date(server.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex space-x-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleServerStatus(server.id, server.is_active)}
                        className="flex-1"
                      >
                        {server.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteServer(server.id, server.name)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServersTab;
