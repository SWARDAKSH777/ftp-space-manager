
import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  HardDrive, 
  File, 
  BarChart3, 
  History, 
  Settings,
  LogOut,
  Users,
  Shield
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface DesktopSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
  className?: string;
}

const DesktopSidebar = ({ activeTab, onTabChange, isAdmin, className }: DesktopSidebarProps) => {
  const { signOut } = useAuth();

  const menuItems = [
    { id: 'files', label: 'Files', icon: File },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
    ...(isAdmin ? [
      { id: 'admin', label: 'Admin Panel', icon: Shield },
      { id: 'users', label: 'Manage Users', icon: Users },
      { id: 'settings', label: 'Server Settings', icon: Settings },
    ] : []),
  ];

  return (
    <div className={cn("w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex", className)}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <HardDrive className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Family Files</h1>
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

export default DesktopSidebar;
