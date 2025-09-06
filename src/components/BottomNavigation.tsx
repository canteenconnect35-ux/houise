import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Home, 
  Ticket, 
  Wallet, 
  History, 
  Users, 
  Trophy, 
  Settings,
  Plus,
  LogOut,
  Calendar,
  TestTube
} from "lucide-react";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userType: "user" | "admin";
  onLogout: () => void;
}

const BottomNavigation = ({ activeTab, onTabChange, userType, onLogout }: BottomNavigationProps) => {
  const [pendingCount, setPendingCount] = useState(0);

  const userTabs = [
    { id: "games", label: "Games", icon: Home },
    { id: "tickets", label: "Tickets", icon: Ticket },
    { id: "wallet", label: "Wallet", icon: Wallet },
    { id: "history", label: "History", icon: History },
  ];

  const adminTabs = [
    { id: "games", label: "Games", icon: Trophy },
    { id: "scheduled", label: "Scheduled", icon: Calendar },
    { id: "withdrawals", label: "Withdrawals", icon: Users },
    { id: "create", label: "Create", icon: Plus },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const tabs = userType === "user" ? userTabs : adminTabs;

  const getTabClass = (tabId: string) => {
    const baseClass = "flex flex-col items-center justify-center p-2 min-w-0 flex-1 transition-all duration-200";
    return activeTab === tabId 
      ? `${baseClass} text-primary bg-primary/10 rounded-t-lg border-t-2 border-primary` 
      : `${baseClass} text-muted-foreground hover:text-foreground hover:bg-accent/50`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border/50 shadow-lg z-50">
      <div className="flex items-center h-16 px-2">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={getTabClass(tab.id)}
            >
            <div className="relative">
              <IconComponent className="w-5 h-5 mb-1" />
              {tab.id === "withdrawals" && userType === "admin" && pendingCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs bg-destructive">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </Badge>
              )}
            </div>
              <span className="text-xs font-medium truncate">{tab.label}</span>
            </button>
          );
        })}
        
        {/* Logout button */}
        <button
          onClick={onLogout}
          className="flex flex-col items-center justify-center p-2 min-w-0 w-16 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5 mb-1" />
          <span className="text-xs font-medium">Exit</span>
        </button>
      </div>
    </div>
  );
};

export default BottomNavigation;