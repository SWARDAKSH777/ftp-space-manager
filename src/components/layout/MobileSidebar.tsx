
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
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface MobileSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
}

const MobileSidebar = ({ activeTab, onTabChange, isAdmin }: MobileSidebarProps) => {
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
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="md:hidden">
          <HardDrive className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center space-x-2">
            <HardDrive className="h-6 w-6 text-blue-600" />
            <span>Family Files</span>
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-2">
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
          
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 mt-4"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MobileSidebar;
