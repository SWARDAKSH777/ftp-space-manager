
import React, { useState } from 'react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import MobileSidebar from '@/components/layout/MobileSidebar';
import DesktopSidebar from '@/components/layout/DesktopSidebar';
import NewFilesTab from '@/components/tabs/NewFilesTab';
import StatisticsTab from '@/components/tabs/StatisticsTab';
import HistoryTab from '@/components/tabs/HistoryTab';
import AdminPanel from '@/components/admin/AdminPanel';
import ServerSettings from '@/components/admin/ServerSettings';
import { HardDrive } from 'lucide-react';

const NewDashboard = () => {
  const [activeTab, setActiveTab] = useState('files');
  const { isAdmin, userProfile, loading } = useUserPermissions();

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'files':
        return <NewFilesTab />;
      case 'statistics':
        return <StatisticsTab />;
      case 'history':
        return <HistoryTab />;
      case 'admin':
        return isAdmin ? <AdminPanel /> : <NewFilesTab />;
      case 'users':
        return isAdmin ? <AdminPanel /> : <NewFilesTab />;
      case 'settings':
        return isAdmin ? <ServerSettings /> : <NewFilesTab />;
      default:
        return <NewFilesTab />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <HardDrive className="h-12 w-12 text-blue-600 mx-auto animate-pulse mb-4" />
          <p className="text-gray-600">Loading your family files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <HardDrive className="h-6 w-6 text-blue-600" />
          <h1 className="text-lg font-bold text-gray-900">Family Files</h1>
        </div>
        <MobileSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          isAdmin={isAdmin}
        />
      </div>

      <div className="flex">
        <DesktopSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          isAdmin={isAdmin}
        />
        
        <main className="flex-1 overflow-auto">
          {/* Welcome Banner for Mobile */}
          <div className="md:hidden bg-blue-50 border-b border-blue-100 p-4">
            <p className="text-sm text-blue-700">
              Welcome, {userProfile?.full_name || 'User'}! 
              {isAdmin && <span className="ml-1 font-medium">(Administrator)</span>}
            </p>
          </div>
          
          {renderActiveTab()}
        </main>
      </div>
    </div>
  );
};

export default NewDashboard;
