
import React, { useState } from 'react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import DesktopSidebar from '@/components/layout/DesktopSidebar';
import MobileSidebar from '@/components/layout/MobileSidebar';
import NewFilesTab from '@/components/tabs/NewFilesTab';
import StatisticsTab from '@/components/tabs/StatisticsTab';
import HistoryTab from '@/components/tabs/HistoryTab';
import AdminPanel from '@/components/admin/AdminPanel';
import ServerSettings from '@/components/admin/ServerSettings';
import SettingsTab from '@/components/tabs/SettingsTab';

const NewDashboard = () => {
  const [activeTab, setActiveTab] = useState('files');
  const { isAdmin, loading } = useUserPermissions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Family Files...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'files':
        return <NewFilesTab />;
      case 'statistics':
        return <StatisticsTab />;
      case 'history':
        return <HistoryTab />;
      case 'admin':
        return isAdmin ? <AdminPanel /> : <div className="p-6 text-center text-gray-500">Access denied</div>;
      case 'users':
        return isAdmin ? <AdminPanel /> : <div className="p-6 text-center text-gray-500">Access denied</div>;
      case 'settings':
        return isAdmin ? <ServerSettings /> : <SettingsTab />;
      default:
        return <NewFilesTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DesktopSidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        isAdmin={isAdmin}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          isAdmin={isAdmin}
        />
        
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default NewDashboard;
