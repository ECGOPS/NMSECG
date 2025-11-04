import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useLocation, NavLink } from "react-router-dom";
import { Menu, User, LogOut, FileText, History, Music, Database, Shield, Settings, Megaphone, BarChart3, Target, FileCheck } from "lucide-react";
import { OfflineBadgeCompact } from "@/components/common/OfflineBadge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { PermissionService } from "@/services/PermissionService";
import { AudioPlayer } from "@/components/dashboard/AudioPlayer";
import { Separator } from "@/components/ui/separator";
import { useAudio } from "@/contexts/AudioContext";

export function Navbar() {
  const { user, logout, isAuthenticated } = useAzureADAuth();
  const { audioRef } = useAudio();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const permissionService = PermissionService.getInstance();
  
  console.log('[Navbar] Current theme:', theme);

  const handleLogout = () => {
    // Stop music playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    logout(() => navigate("/login"));
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    console.log('[Theme] Switching from', theme, 'to', newTheme);
    setTheme(newTheme);
  };

  // Check if the current path starts with a specific route
  const isActiveRoute = (route: string) => {
    return location.pathname.startsWith(route);
  };

  const showMenuItem = (requiredRole: string) => {
    if (!user?.role) return false;
    if (user.role === "system_admin") return true;
    if (user.role === "technician") {
      return requiredRole === "district_engineer" && !location.pathname.startsWith("/analytics");
    }
    if (user.role === "district_engineer" || user.role === "district_manager") {
      return (
        requiredRole === "district_engineer" ||
        requiredRole === "district_manager" ||
        requiredRole === "global_engineer"
      );
    }
    if (user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager" || user.role === "ashsubt" || user.role === "accsubt") {
      return (
        requiredRole === "district_engineer" ||
        requiredRole === "district_manager" ||
        requiredRole === "regional_engineer" ||
        requiredRole === "project_engineer" ||
        requiredRole === "regional_general_manager" ||
        requiredRole === "ashsubt" ||
        requiredRole === "accsubt" ||
        requiredRole === "global_engineer"
      );
    }
    if (user.role === "global_engineer") {
      return true;
    }
    return false;
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <img src="/ecg-images/ecg-logo.png" alt="ECG Logo" className="h-10 w-auto" />
            <span className="font-bold text-base">ECG Network Management System</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Offline Status Badge */}
          <OfflineBadgeCompact />
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col overflow-y-auto">
              {/* User Profile and Logout */}
              {isAuthenticated && (
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/user-profile" className="flex items-center gap-2">
                        <User size={16} />
                        <span>{user?.name || "User"}</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleLogout}>
                      <LogOut size={18} />
                    </Button>
                  </div>
                  <Separator />
                  <div className="w-full">
                    <AudioPlayer />
                  </div>
                </div>
              )}
              
              <nav className="flex flex-col gap-2">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    cn(
                      "px-3 py-2 rounded-md transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-foreground hover:text-primary hover:bg-primary/5"
                    )
                  }
                >
                  Home
                </NavLink>
                
                {isAuthenticated && (
                  <>
                    <NavLink 
                      to="/dashboard"
                      end
                      className={({ isActive }) =>
                        cn(
                          "px-3 py-2 rounded-md transition-colors",
                          isActive 
                            ? "bg-primary/20 text-primary font-medium border border-primary/30" 
                            : "text-foreground hover:text-primary hover:bg-primary/5"
                        )
                      }
                    >
                      Dashboard
                    </NavLink>
                    
                    <NavLink 
                      to="/report-fault" 
                      className={({ isActive }) =>
                        cn(
                          "px-3 py-2 rounded-md transition-colors",
                          isActive 
                            ? "bg-primary/10 text-primary font-medium" 
                            : "text-foreground hover:text-primary hover:bg-primary/5"
                        )
                      }
                    >
                      LV Outage Log
                    </NavLink>
                    
                    <NavLink 
                      to="/control-system-outage" 
                      className={({ isActive }) =>
                        cn(
                          "px-3 py-2 rounded-md transition-colors",
                          isActive 
                            ? "bg-primary/10 text-primary font-medium" 
                            : "text-foreground hover:text-primary hover:bg-primary/5"
                        )
                      }
                    >
                      HT Outage Log
                    </NavLink>
                    
                    {/* Analytics Links */}
                    {(showMenuItem("district_engineer") || showMenuItem("district_manager") || showMenuItem("regional_engineer") || showMenuItem("project_engineer") || showMenuItem("regional_general_manager") || showMenuItem("ashsubt") || showMenuItem("accsubt")) && (
                      <>
                        <NavLink 
                          to="/analytics" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Fault Analytics
                        </NavLink>
                        <NavLink 
                          to="/control-system-analytics" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Situational Report Analytics
                        </NavLink>
                      </>
                    )}
                    
                    {/* Asset Management Links */}
                    {showMenuItem("district_engineer") && (
                      <>
                        <NavLink 
                          to="/asset-management/load-monitoring" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          DT Load Monitoring
                        </NavLink>
                        <NavLink 
                          to="/asset-management/inspection-management" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Substation Inspection
                        </NavLink>
                        <NavLink 
                          to="/asset-management/vit-inspection" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Outdoor Switchgear Inspections
                        </NavLink>
                        <NavLink 
                          to="/asset-management/overhead-line" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Network Inspection
                        </NavLink>
                        <NavLink 
                          to="/asset-management/equipment-failure-reporting" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Equipment Failure Reporting
                        </NavLink>
                      </>
                    )}
                    
                    {/* District Population Link */}
                    {showMenuItem("district_engineer") && (
                      <NavLink 
                        to="/district-population" 
                        className={({ isActive }) =>
                          cn(
                            "px-3 py-2 rounded-md transition-colors",
                            isActive 
                              ? "bg-primary/10 text-primary font-medium" 
                              : "text-foreground hover:text-primary hover:bg-primary/5"
                          )
                        }
                      >
                        District Population
                      </NavLink>
                    )}
                    
                    {/* Performance Pages */}
                    {(user?.role === "system_admin" || 
                      user?.role === "global_engineer" || 
                      user?.role === "district_engineer" || 
                      user?.role === "district_manager" || 
                      user?.role === "technician") && (
                      <NavLink 
                        to="/performance/district" 
                        className={({ isActive }) =>
                          cn(
                            "px-3 py-2 rounded-md transition-colors",
                            isActive 
                              ? "bg-primary/10 text-primary font-medium" 
                              : "text-foreground hover:text-primary hover:bg-primary/5"
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          <span>My Performance</span>
                        </div>
                      </NavLink>
                    )}
                    
                    {(user?.role === "system_admin" || 
                      user?.role === "global_engineer" || 
                      user?.role === "regional_engineer" || 
                      user?.role === "regional_general_manager") && (
                      <NavLink 
                        to="/performance/regional" 
                        className={({ isActive }) =>
                          cn(
                            "px-3 py-2 rounded-md transition-colors",
                            isActive 
                              ? "bg-primary/10 text-primary font-medium" 
                              : "text-foreground hover:text-primary hover:bg-primary/5"
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          <span>Regional Performance</span>
                        </div>
                      </NavLink>
                    )}
                    
                    {/* Reports - Available to all authenticated users */}
                    <NavLink 
                      to="/reports" 
                      className={({ isActive }) =>
                        cn(
                          "px-3 py-2 rounded-md transition-colors",
                          isActive 
                            ? "bg-primary/10 text-primary font-medium" 
                            : "text-foreground hover:text-primary hover:bg-primary/5"
                        )
                      }
                    >
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-4 w-4" />
                        <span>Reports</span>
                      </div>
                    </NavLink>
                    
                    {/* Admin Menu Items */}
                    {user?.role === "system_admin" && (
                      <>
                        <NavLink 
                          to="/user-management" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          User Management
                        </NavLink>
                        <NavLink 
                          to="/system-admin/permission-management" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            <span>Permission Management</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/system-admin/role-management" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            <span>Role Management</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/system-admin/security" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Security Monitoring
                        </NavLink>
                        <NavLink 
                          to="/user-logs"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            <span>User Logs</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/admin/music"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Music className="h-4 w-4" />
                            <span>Music Management</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/system-admin/broadcast-manager"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4" />
                            <span>Broadcast Manager</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/performance/targets"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            <span>Target Management</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/test/feeder-offline"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            <span>Feeder Offline Test</span>
                          </div>
                        </NavLink>
                      </>
                    )}
                    {user?.role === "global_engineer" && (
                      <>
                        <NavLink 
                          to="/performance/targets"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            <span>Target Management</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/system-admin/broadcast-manager"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4" />
                            <span>Broadcast Manager</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/test/feeder-offline"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            <span>Feeder Offline Test</span>
                          </div>
                        </NavLink>
                      </>
                    )}
                  </>
                )}
              </nav>
              
              {/* Mobile Dark Mode Toggle */}
              <div className="mt-auto pt-4 border-t">
                <Button variant="ghost" onClick={toggleTheme} className="w-full justify-start">
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
