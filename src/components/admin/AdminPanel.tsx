
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Shield, Plus, Trash2 } from 'lucide-react';
import FtpFileBrowser from './FtpFileBrowser';

interface FilePermission {
  id: string;
  user_id: string;
  path: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  user_profiles?: {
    username: string;
    full_name: string;
  };
}

interface User {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  is_admin: boolean;
}

const AdminPanel = () => {
  const [permissions, setPermissions] = useState<FilePermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newPermission, setNewPermission] = useState({
    user_id: '',
    path: '',
    can_read: true,
    can_write: false,
    can_delete: false
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, user_id, username, full_name, is_admin')
        .eq('is_active', true);

      if (usersError) throw usersError;

      // Fetch permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('file_permissions')
        .select(`
          id,
          user_id,
          path,
          can_read,
          can_write,
          can_delete
        `);

      if (permissionsError) throw permissionsError;

      // Join permissions with user data
      const permissionsWithProfiles = permissionsData?.map(permission => {
        const userProfile = usersData?.find(user => user.user_id === permission.user_id);
        return {
          ...permission,
          user_profiles: userProfile ? {
            username: userProfile.username,
            full_name: userProfile.full_name
          } : undefined
        };
      }) || [];

      setUsers(usersData || []);
      setPermissions(permissionsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Failed to fetch data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addPermission = async () => {
    if (!newPermission.user_id || !newPermission.path) {
      toast({
        title: "Missing fields",
        description: "Please select a user and choose a path",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('file_permissions')
        .insert({
          ...newPermission,
          granted_by: userData.user?.id
        });

      if (error) throw error;

      toast({
        title: "Permission added",
        description: "File permission has been granted successfully"
      });

      setNewPermission({
        user_id: '',
        path: '',
        can_read: true,
        can_write: false,
        can_delete: false
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Failed to add permission",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deletePermission = async (id: string) => {
    try {
      const { error } = await supabase
        .from('file_permissions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Permission deleted",
        description: "File permission has been removed"
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Failed to delete permission",
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
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center space-x-2">
        <Shield className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">File Permissions</h1>
      </div>

      {/* Add New Permission */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Grant File Access</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="user-select">Select User</Label>
              <Select 
                value={newPermission.user_id} 
                onValueChange={(value) => setNewPermission(prev => ({ ...prev, user_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(user => !user.is_admin).map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name} (@{user.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Browser */}
          <FtpFileBrowser
            selectedPath={newPermission.path}
            onPathSelect={(path) => setNewPermission(prev => ({ ...prev, path }))}
          />

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={newPermission.can_read}
                onCheckedChange={(checked) => setNewPermission(prev => ({ ...prev, can_read: checked }))}
              />
              <Label>Can Read</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={newPermission.can_write}
                onCheckedChange={(checked) => setNewPermission(prev => ({ ...prev, can_write: checked }))}
              />
              <Label>Can Write/Upload</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={newPermission.can_delete}
                onCheckedChange={(checked) => setNewPermission(prev => ({ ...prev, can_delete: checked }))}
              />
              <Label>Can Delete</Label>
            </div>
          </div>

          <Button onClick={addPermission} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Grant Access
          </Button>
        </CardContent>
      </Card>

      {/* Current Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Current File Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No file permissions set</p>
          ) : (
            <div className="space-y-3">
              {permissions.map((permission) => (
                <div key={permission.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium">
                        {permission.user_profiles?.full_name || 'Unknown User'}
                      </span>
                      <span className="text-gray-500">
                        (@{permission.user_profiles?.username || 'unknown'})
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Path: <code className="bg-gray-100 px-1 rounded">{permission.path}</code>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {permission.can_read && <Badge variant="secondary">Read</Badge>}
                      {permission.can_write && <Badge variant="default">Write</Badge>}
                      {permission.can_delete && <Badge variant="destructive">Delete</Badge>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deletePermission(permission.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
