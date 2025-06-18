
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ShareServerDialog from '@/components/teams/ShareServerDialog';
import { 
  Server, 
  Edit, 
  Trash2, 
  Wifi, 
  WifiOff,
  AlertCircle
} from 'lucide-react';

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

interface ServerCardProps {
  server: FtpServer;
  onEdit: (server: FtpServer) => void;
  onDelete: (id: string) => void;
  onConnect: (server: FtpServer) => void;
}

const ServerCard = ({ server, onEdit, onDelete, onConnect }: ServerCardProps) => {
  const getStatusIcon = () => {
    switch (server.status) {
      case 'active':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (server.status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Connected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Server className="mr-2 h-5 w-5" />
          {server.name}
        </CardTitle>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Host:</span>
            <span className="font-mono">{server.host}:{server.port}</span>
          </div>
          <div className="flex justify-between">
            <span>Protocol:</span>
            <span className="uppercase">{server.protocol}</span>
          </div>
          <div className="flex justify-between">
            <span>Username:</span>
            <span>{server.username}</span>
          </div>
          {server.last_connected && (
            <div className="flex justify-between">
              <span>Last Connected:</span>
              <span>{new Date(server.last_connected).toLocaleString()}</span>
            </div>
          )}
        </div>
        
        <div className="flex space-x-2 mt-4">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={() => onConnect(server)}
            disabled={server.status === 'active'}
          >
            {server.status === 'active' ? 'Connected' : 'Connect'}
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onEdit(server)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <ShareServerDialog serverId={server.id} serverName={server.name} />
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onDelete(server.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServerCard;
