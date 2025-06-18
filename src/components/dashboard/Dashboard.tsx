
import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import ServersTab from '@/components/tabs/ServersTab';
import FilesTab from '@/components/tabs/FilesTab';
import StatisticsTab from '@/components/tabs/StatisticsTab';
import SchedulesTab from '@/components/tabs/SchedulesTab';
import HistoryTab from '@/components/tabs/HistoryTab';
import SettingsTab from '@/components/tabs/SettingsTab';
import TeamsTab from '@/components/tabs/TeamsTab';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('servers');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'servers':
        return <ServersTab />;
      case 'files':
        return <FilesTab />;
      case 'statistics':
        return <StatisticsTab />;
      case 'schedules':
        return <SchedulesTab />;
      case 'history':
        return <HistoryTab />;
      case 'teams':
        return <TeamsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <ServersTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-auto">
        {renderActiveTab()}
      </main>
    </div>
  );
};

export default Dashboard;
