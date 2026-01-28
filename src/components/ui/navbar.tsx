import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Bell, 
  Settings, 
  User, 
  LogOut, 
  HelpCircle,
  Menu,
  Wallet,
  Shield
} from 'lucide-react';

interface NavbarProps {
  title?: string;
  user?: {
    name: string;
    email: string;
    avatar?: string;
    role?: string;
    tokenBalance?: string;
  };
  onMenuClick?: () => void;
  onLogout?: () => void;
  className?: string;
  showSearch?: boolean;
  notifications?: number;
}

export function Navbar({ 
  title = "Dashboard",
  user,
  onMenuClick,
  onLogout,
  className,
  showSearch = true,
  notifications = 0
}: NavbarProps) {
  return (
    <header className={cn(
      "flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200",
      className
    )}>
      {/* Left Section */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuClick}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </div>
      </div>

      {/* Center Section - Search */}
      {showSearch && (
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search..."
              className="pl-10 bg-gray-50 border-gray-200 focus:bg-white"
            />
          </div>
        </div>
      )}

      {/* Right Section */}
      <div className="flex items-center space-x-3">
        {/* Notifications */}
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {notifications > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
            >
              {notifications > 99 ? '99+' : notifications}
            </Badge>
          )}
        </Button>

        {/* User Menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                  {user.role && (
                    <Badge variant="outline" className="w-fit text-xs">
                      {user.role}
                    </Badge>
                  )}
                </div>
              </DropdownMenuLabel>
              
              {user.tokenBalance && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <div className="flex items-center space-x-2 text-sm">
                      <Wallet className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">Balance:</span>
                      <span className="font-medium text-green-600">
                        {user.tokenBalance} DEV
                      </span>
                    </div>
                  </div>
                </>
              )}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Shield className="mr-2 h-4 w-4" />
                <span>Privacy</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Help & Support</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}