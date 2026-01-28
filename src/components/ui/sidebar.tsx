import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronLeft, 
  ChevronRight,
  Home,
  User,
  Settings,
  HelpCircle,
  LogOut,
  Bell,
  Search
} from 'lucide-react';

interface SidebarProps {
  children?: React.ReactNode;
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  badge?: string | number;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}

interface SidebarGroupProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function Sidebar({ 
  children, 
  className, 
  collapsed = false, 
  onCollapsedChange 
}: SidebarProps) {
  return (
    <div className={cn(
      "flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-300",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Toggle Button */}
      <div className="flex items-center justify-end p-2 border-b border-gray-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCollapsedChange?.(!collapsed)}
          className="h-8 w-8 p-0"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export function SidebarItem({ 
  icon, 
  label, 
  href, 
  active = false, 
  badge, 
  onClick, 
  children,
  className 
}: SidebarItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = React.Children.count(children) > 0;

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
    onClick?.();
  };

  return (
    <div className={cn("w-full", className)}>
      <Button
        variant={active ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start h-10 px-3 font-normal",
          active && "bg-blue-50 text-blue-700 border-r-2 border-blue-600"
        )}
        onClick={handleClick}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {icon}
            </div>
            <span className="truncate">{label}</span>
          </div>
          <div className="flex items-center space-x-2">
            {badge && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {badge}
              </Badge>
            )}
            {hasChildren && (
              <ChevronRight 
                className={cn(
                  "h-4 w-4 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            )}
          </div>
        </div>
      </Button>
      
      {hasChildren && isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

export function SidebarGroup({ label, children, className }: SidebarGroupProps) {
  return (
    <div className={cn("py-2", className)}>
      {label && (
        <div className="px-3 py-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {label}
          </h3>
        </div>
      )}
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

export function SidebarSeparator() {
  return <Separator className="my-2" />;
}

// Collapsed sidebar item for when sidebar is minimized
export function SidebarItemCollapsed({ 
  icon, 
  label, 
  active = false, 
  badge, 
  onClick 
}: Omit<SidebarItemProps, 'children'>) {
  return (
    <div className="relative group">
      <Button
        variant={active ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "w-12 h-12 p-0 mx-auto",
          active && "bg-blue-50 text-blue-700"
        )}
        onClick={onClick}
      >
        <div className="relative">
          {icon}
          {badge && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs flex items-center justify-center"
            >
              {badge}
            </Badge>
          )}
        </div>
      </Button>
      
      {/* Tooltip */}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {label}
      </div>
    </div>
  );
}