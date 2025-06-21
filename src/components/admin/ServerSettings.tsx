
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Server, Save, TestTube } from 'lucide-react';

interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: string;
  passive_mode: boolean;
  is_active: boolean;
}

const ServerSettings = () => {
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    id: '',
    name: 'Family Server',
    host: '',
    port: 21,
    username: '',
    password: '',
    protocol: 'ftp',
    passive_mode: true,
    is_active: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchServerConfig();
  }, []);

  const fetchServerConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('server_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching server config:', error);
        throw error;
      }

      if (data) {
        setServerConfig(data);
      }
    } catch (error: any) {
      console.error('Error fetching server config:', error);
      toast({
        title: "Failed to fetch server configuration",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveServerConfig = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const configData = {
        name: serverConfig.name,
        host: serverConfig.host,
        port: serverConfig.port,
        username: serverConfig.username,
        password: serverConfig.password,
        protocol: serverConfig.protocol,
        passive_mode: serverConfig.passive_mode,
        is_active: serverConfig.is_active,
        created_by: userData.user?.id
      };

      if (serverConfig.id) {
        // Update existing
        const { error } = await supabase
          .from('server_config')
          .update(configData)
          .eq('id', serverConfig.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('server_config')
          .insert(configData)
          .select()
          .single();

        if (error) throw error;
        setServerConfig(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: "Server configuration saved",
        description: "FTP server settings have been updated successfully"
      });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: "Failed to save configuration",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!serverConfig.host) {
      toast({
        title: "Missing configuration",
        description: "Please fill in server details first",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    try {
      // First save the config if it's new
      if (!serverConfig.id) {
        await saveServerConfig();
      }

      const { data, error } = await supabase.functions.invoke('ftp-operations', {
        body: {
          action: 'test_connection',
          config: {
            host: serverConfig.host,
            port: serverConfig.port,
            username: serverConfig.username,
            password: serverConfig.password,
            passive_mode: serverConfig.passive_mode
          }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Connection successful",
          description: "Successfully connected to the FTP server"
        });
      } else {
        throw new Error(data?.error || 'Connection test failed');
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const updateConfig = (field: keyof ServerConfig, value: any) => {
    setServerConfig(prev => ({ ...prev, [field]: value }));
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
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-2 mb-6">
        <Server className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Server Settings</h1>
        {serverConfig.is_active && <Badge variant="default">Active</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>FTP Server Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Server Name</Label>
              <Input
                id="name"
                value={serverConfig.name}
                onChange={(e) => updateConfig('name', e.target.value)}
                placeholder="Family Server"
              />
            </div>
            
            <div>
              <Label htmlFor="host">Host/IP Address</Label>
              <Input
                id="host"
                value={serverConfig.host}
                onChange={(e) => updateConfig('host', e.target.value)}
                placeholder="ftp.example.com"
              />
            </div>
            
            <div>
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={serverConfig.port}
                onChange={(e) => updateConfig('port', parseInt(e.target.value) || 21)}
              />
            </div>
            
            <div>
              <Label htmlFor="protocol">Protocol</Label>
              <Input
                id="protocol"
                value={serverConfig.protocol}
                onChange={(e) => updateConfig('protocol', e.target.value)}
                placeholder="ftp"
              />
            </div>
            
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={serverConfig.username}
                onChange={(e) => updateConfig('username', e.target.value)}
                placeholder="FTP Username"
              />
            </div>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={serverConfig.password}
                onChange={(e) => updateConfig('password', e.target.value)}
                placeholder="FTP Password"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                checked={serverConfig.passive_mode}
                onCheckedChange={(checked) => updateConfig('passive_mode', checked)}
              />
              <Label>Passive Mode</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={serverConfig.is_active}
                onCheckedChange={(checked) => updateConfig('is_active', checked)}
              />
              <Label>Server Active</Label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={saveServerConfig} 
              disabled={saving || !serverConfig.host}
              className="flex-1 sm:flex-none"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
            
            <Button 
              variant="outline"
              onClick={testConnection}
              disabled={testing || !serverConfig.host}
              className="flex-1 sm:flex-none"
            >
              <TestTube className="mr-2 h-4 w-4" />
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Security Notice</h4>
            <p className="text-sm text-yellow-700">
              Only administrators can view and modify server credentials. Regular users will not have access to this sensitive information.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ServerSettings;
