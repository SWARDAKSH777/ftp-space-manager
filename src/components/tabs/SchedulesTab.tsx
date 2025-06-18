
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Pause, Plus, Edit, Trash2 } from 'lucide-react';

interface Schedule {
  id: string;
  name: string;
  schedule_cron: string;
  local_path: string;
  remote_path: string;
  is_active: boolean;
  last_run: string | null;
  next_run: string | null;
  server_name?: string;
}

const SchedulesTab = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('upload_schedules')
        .select(`
          *,
          ftp_servers!inner(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map(schedule => ({
        ...schedule,
        server_name: schedule.ftp_servers?.name || 'Unknown Server'
      }));

      setSchedules(formattedData);
    } catch (error: any) {
      toast({
        title: "Failed to fetch schedules",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSchedule = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('upload_schedules')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Schedule updated",
        description: `Schedule ${!isActive ? 'activated' : 'deactivated'}`
      });

      fetchSchedules();
    } catch (error: any) {
      toast({
        title: "Failed to update schedule",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Schedules</h1>
          <p className="text-gray-600">Manage automated file upload schedules</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Schedule
        </Button>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedules</h3>
            <p className="text-gray-600 mb-4">Create your first automated upload schedule</p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Clock className="mr-2 h-5 w-5" />
                    {schedule.name}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant={schedule.is_active ? "default" : "secondary"}>
                      {schedule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleSchedule(schedule.id, schedule.is_active)}
                    >
                      {schedule.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Server:</span>
                    <p className="text-gray-600">{schedule.server_name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Schedule:</span>
                    <p className="text-gray-600">{schedule.schedule_cron}</p>
                  </div>
                  <div>
                    <span className="font-medium">Local Path:</span>
                    <p className="text-gray-600">{schedule.local_path}</p>
                  </div>
                  <div>
                    <span className="font-medium">Remote Path:</span>
                    <p className="text-gray-600">{schedule.remote_path}</p>
                  </div>
                </div>
                {schedule.last_run && (
                  <div className="mt-4 text-sm">
                    <span className="font-medium">Last Run:</span>
                    <span className="text-gray-600 ml-2">
                      {new Date(schedule.last_run).toLocaleString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchedulesTab;
