
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Shield, Plus, Trash2, Edit2 } from 'lucide-react';

interface FilePermission {
  id: string;
  user_id: string;
  path: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  user_profiles: {
    username: string;
    full_name: string;
  } | null;
}

interface User {
  id: string;
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
      // Fetch users - map user_id to id for interface compatibility
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('user_id, username, full_name, is_admin');

      if (usersError) throw usersError;

      // Transform the data to match our User interface
      const transformedUsers = usersData?.map(user => ({
        id: user.user_id,
        username: user.username,
        full_name: user.full_name || '',
        is_admin: user.is_admin || false
      })) || [];

      // Fetch permissions with user info using a proper join
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('file_permissions')
        .select(`
          id,
          user_id,
          path,
          can_read,
          can_write,
          can_delete,
          created_at,
          updated_at,
          granted_by
        `);

      if (permissionsError) throw permissionsError;

      // Manually join with user profiles data
      const permissionsWithProfiles = permissionsData?.map(permission => {
        const userProfile = transformedUsers.find(user => user.id === permission.user_id);
        return {
          ...permission,
          user_profiles: userProfile ? {
            username: userProfile.username,
            full_name: userProfile.full_name
          } : null
        };
      }) || [];

      setUsers(transformedUsers);
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
        description: "Please select a user and enter a path",
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

  const toggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    try {
      if (isCurrentlyAdmin) {
        // Remove from admin_users
        const { error: deleteError } = await supabase
          .from('admin_users')
          .delete()
          .eq('user_id', userId);

        if (deleteError) throw deleteError;
      } else {
        // Add to admin_users
        const { data: userData } = await supabase.auth.getUser();
        const { error: insertError } = await supabase
          .from('admin_users')
          .insert({
            user_id: userId,
            created_by: userData.user?.id
          });

        if (insertError) throw insertError;
      }

      // Update user_profiles
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ is_admin: !isCurrentlyAdmin })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      toast({
        title: "Admin status updated",
        description: `User ${isCurrentlyAdmin ? 'removed from' : 'added to'} admin role`
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Failed to update admin status",
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
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
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
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} (@{user.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="path-input">File/Folder Path</Label>
              <Input
                id="path-input"
                value={newPermission.path}
                onChange={(e) => setNewPermission(prev => ({ ...prev, path: e.target.value }))}
                placeholder="/path/to/folder or /file.txt"
              />
            </div>
          </div>

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

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{user.full_name}</span>
                    <span className="text-gray-500">(@{user.username})</span>
                    {user.is_admin && <Badge>Admin</Badge>}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor={`admin-${user.id}`}>Admin</Label>
                  <Switch
                    id={`admin-${user.id}`}
                    checked={user.is_admin}
                    onCheckedChange={() => toggleAdmin(user.id, user.is_admin)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
