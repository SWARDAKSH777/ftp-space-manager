
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AddServerDialogProps {
  onServerAdded: () => void;
}

const AddServerDialog = ({ onServerAdded }: AddServerDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 21,
    username: '',
    password: '',
    protocol: 'ftp',
    passive_mode: true
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('server_config')
        .insert([{
          ...formData,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (error) throw error;

      toast({
        title: "Server added successfully",
        description: `${formData.name} has been added to your servers`
      });

      setFormData({
        name: '',
        host: '',
        port: 21,
        username: '',
        password: '',
        protocol: 'ftp',
        passive_mode: true
      });
      setOpen(false);
      onServerAdded();
    } catch (error: any) {
      toast({
        title: "Failed to add server",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Server
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Server</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Family Server"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Hostname</Label>
              <Input
                id="host"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="ftp.example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                min={1}
                max={65535}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocol">Protocol</Label>
            <Select 
              value={formData.protocol} 
              onValueChange={(value) => setFormData({ ...formData, protocol: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ftp">FTP</SelectItem>
                <SelectItem value="ftps">FTPS</SelectItem>
                <SelectItem value="sftp">SFTP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="passive"
              checked={formData.passive_mode}
              onCheckedChange={(checked) => setFormData({ ...formData, passive_mode: checked })}
            />
            <Label htmlFor="passive">Use Passive Mode</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Server"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddServerDialog;
