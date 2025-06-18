
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, Plus, Trash2, UserPlus, Crown, Shield, User } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  team_members: { role: string }[];
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  teams: {
    id: string;
    name: string;
  };
}

const TeamManagementDialog = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
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

  const fetchTeamMembers = async (teamId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('team-operations', {
        body: { action: 'get_team_members', teamId }
      });

      if (error) throw error;
      setTeamMembers(data.members || []);
    } catch (error: any) {
      toast({
        title: "Failed to fetch team members",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-operations', {
        body: { 
          action: 'create_team',
          teamName: newTeamName.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Team created",
        description: `Team "${newTeamName}" has been created successfully`
      });

      setNewTeamName('');
      fetchTeams();
    } catch (error: any) {
      toast({
        title: "Failed to create team",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addMember = async () => {
    if (!selectedTeam || !newMemberEmail.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-operations', {
        body: { 
          action: 'add_member',
          teamId: selectedTeam.id,
          userEmail: newMemberEmail.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Member added",
        description: `User has been added to ${selectedTeam.name}`
      });

      setNewMemberEmail('');
      fetchTeamMembers(selectedTeam.id);
    } catch (error: any) {
      toast({
        title: "Failed to add member",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!selectedTeam) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-operations', {
        body: { 
          action: 'remove_member',
          teamId: selectedTeam.id,
          userId
        }
      });

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "User has been removed from the team"
      });

      fetchTeamMembers(selectedTeam.id);
    } catch (error: any) {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
    if (isOpen) {
      fetchTeams();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id);
    }
  }, [selectedTeam]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          Manage Teams
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Team Management</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="teams">My Teams</TabsTrigger>
            <TabsTrigger value="create">Create Team</TabsTrigger>
          </TabsList>

          <TabsContent value="teams" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((team) => (
                <Card 
                  key={team.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedTeam?.id === team.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedTeam(team)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {team.name}
                      {getRoleBadge(team.team_members[0]?.role || 'member')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(team.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedTeam && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {selectedTeam.name} Members
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter email address"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addMember()}
                    />
                    <Button onClick={addMember} disabled={loading}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(member.role)}
                          <span className="font-medium">User {member.user_id.slice(0, 8)}...</span>
                          {getRoleBadge(member.role)}
                        </div>
                        {member.role !== 'owner' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeMember(member.user_id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create New Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team Name</Label>
                  <Input
                    id="team-name"
                    placeholder="Enter team name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createTeam()}
                  />
                </div>
                <Button onClick={createTeam} disabled={loading || !newTeamName.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Team
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TeamManagementDialog;
