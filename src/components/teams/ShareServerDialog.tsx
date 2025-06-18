
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Share2, Users } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

interface ShareServerDialogProps {
  serverId: string;
  serverName: string;
}

const ShareServerDialog = ({ serverId, serverName }: ShareServerDialogProps) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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

  const shareServer = async () => {
    if (!selectedTeamId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-operations', {
        body: { 
          action: 'share_server',
          serverId,
          teamId: selectedTeamId
        }
      });

      if (error) throw error;

      const selectedTeam = teams.find(t => t.id === selectedTeamId);
      toast({
        title: "Server shared",
        description: `${serverName} has been shared with ${selectedTeam?.name}`
      });

      setIsOpen(false);
      setSelectedTeamId('');
    } catch (error: any) {
      toast({
        title: "Failed to share server",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTeams();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Server with Team</DialogTitle>
        </DialogHeader>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Share "{serverName}"</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Team</label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {team.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {teams.length === 0 && (
              <p className="text-sm text-gray-600">
                You need to create a team first before sharing servers.
              </p>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={shareServer} 
                disabled={loading || !selectedTeamId}
                className="flex-1"
              >
                Share Server
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default ShareServerDialog;
