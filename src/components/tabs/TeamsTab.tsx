
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import TeamManagementDialog from '@/components/teams/TeamManagementDialog';
import { 
  Users, 
  Crown, 
  Shield, 
  User, 
  Server,
  Calendar,
  UserPlus
} from 'lucide-react';

interface Team {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  team_members: { role: string }[];
}

interface SharedServer {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  shared_with_team: string;
  teams: {
    name: string;
  };
}

const TeamsTab = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [sharedServers, setSharedServers] = useState<SharedServer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('team-operations', {
        body: { action: 'get_teams' }
      });

      if (error) throw error;
      setTeams(data.teams || []);
    } catch (error: any) {
      toast({
        title: "Failed to fetch teams",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchSharedServers = async () => {
    try {
      // Get servers shared with teams I'm a member of
      const { data, error } = await supabase
        .from('ftp_servers')
        .select(`
          *,
          teams!ftp_servers_shared_with_team_fkey(name)
        `)
        .not('shared_with_team', 'is', null);

      if (error) throw error;
      setSharedServers(data || []);
    } catch (error: any) {
      console.error('Error fetching shared servers:', error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      owner: 'bg-yellow-100 text-yellow-800',
      admin: 'bg-blue-100 text-blue-800',
      member: 'bg-gray-100 text-gray-800'
    };

    return (
      <Badge className={colors[role as keyof typeof colors] || colors.member}>
        {role}
      </Badge>
    );
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTeams(), fetchSharedServers()]);
      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Collaboration</h1>
          <p className="text-gray-600">Manage teams and shared FTP servers</p>
        </div>
        <TeamManagementDialog />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Teams */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            My Teams
          </h2>
          
          {teams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
                <p className="text-gray-600 text-center mb-4">
                  Create your first team to start collaborating with others
                </p>
                <TeamManagementDialog />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <Card key={team.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {getRoleIcon(team.team_members[0]?.role || 'member')}
                        {team.name}
                      </span>
                      {getRoleBadge(team.team_members[0]?.role || 'member')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Created {new Date(team.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Shared Servers */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" />
            Shared Servers
          </h2>
          
          {sharedServers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Server className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No shared servers</h3>
                <p className="text-gray-600 text-center">
                  Servers shared with your teams will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sharedServers.map((server) => (
                <Card key={server.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      {server.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Host:</span>
                        <span className="font-mono text-sm">{server.host}:{server.port}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Protocol:</span>
                        <Badge variant="outline">{server.protocol.toUpperCase()}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Team:</span>
                        <Badge className="bg-blue-100 text-blue-800">
                          {server.teams?.name || 'Unknown Team'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamsTab;
