
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus, Settings } from 'lucide-react';

const SchedulesTab = () => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Schedules</h1>
          <p className="text-gray-600">Manage automated file upload schedules</p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Add Schedule
        </Button>
      </div>

      <Card>
        <CardContent className="text-center py-12">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Scheduling Feature Coming Soon</h3>
          <p className="text-gray-600 mb-4">
            This feature will allow you to schedule automated file uploads and synchronization tasks.
          </p>
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <Settings className="h-4 w-4" />
            <span>Configure your FTP servers first in the admin panel</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchedulesTab;
