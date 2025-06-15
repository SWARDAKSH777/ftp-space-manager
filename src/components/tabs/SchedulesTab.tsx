
import React from 'react';

const SchedulesTab = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Schedules</h1>
        <p className="text-gray-600">Manage automated upload schedules</p>
      </div>
      
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Schedules Coming Soon</h3>
        <p className="text-gray-600">
          Set up automated upload schedules with cron expressions
        </p>
      </div>
    </div>
  );
};

export default SchedulesTab;
