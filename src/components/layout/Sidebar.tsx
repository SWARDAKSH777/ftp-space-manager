
import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  HardDrive, 
  Plus, 
  BarChart3, 
  Clock, 
  History, 
  Settings,
  LogOut,
  Users
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

const Sidebar = ({ activeTab, onTabChange, className }: SidebarProps) => {
  const { signOut } = useAuth();

  const menuItems = [
    { id: 'servers', label: 'FTP Servers', icon: HardDrive },
    { id: 'files', label: 'File Browser', icon: Plus },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'schedules', label: 'Schedules', icon: Clock },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className={cn("w-64 bg-white border-r border-gray-200 flex flex-col", className)}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <HardDrive className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">FTP Manager</h1>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "default" : "ghost"}
            className={cn(
              "w-full justify-start",
              activeTab === item.id && "bg-blue-600 text-white hover:bg-blue-700"
            )}
            onClick={() => onTabChange(item.id)}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
