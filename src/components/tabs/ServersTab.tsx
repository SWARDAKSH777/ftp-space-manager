
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ServerCard from '@/components/ftp/ServerCard';
import AddServerDialog from '@/components/ftp/AddServerDialog';
import { Loader2 } from 'lucide-react';

interface FtpServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  protocol: string;
  status: 'active' | 'inactive' | 'error';
  last_connected: string | null;
}

const ServersTab = () => {
  const [servers, setServers] = useState<FtpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('ftp_servers')
        .select('*')
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

  useEffect(() => {
    fetchServers();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ftp_servers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Server deleted",
        description: "FTP server has been removed"
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

  const handleEdit = (server: FtpServer) => {
    // TODO: Implement edit functionality
    toast({
      title: "Edit functionality",
      description: "Edit functionality will be implemented soon"
    });
  };

  const handleConnect = async (server: FtpServer) => {
    // TODO: Implement connection functionality
    toast({
      title: "Connection functionality",
      description: "FTP connection will be implemented via Edge Functions"
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FTP Servers</h1>
          <p className="text-gray-600">Manage your FTP server connections</p>
        </div>
        <AddServerDialog onServerAdded={fetchServers} />
      </div>

      {servers.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No FTP servers</h3>
          <p className="text-gray-600 mb-4">Get started by adding your first FTP server</p>
          <AddServerDialog onServerAdded={fetchServers} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onConnect={handleConnect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ServersTab;
