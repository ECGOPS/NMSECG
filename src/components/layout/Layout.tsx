import { Navbar } from "@/components/layout/Navbar";
import { lazy, Suspense } from "react";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { BroadcastPopup } from "@/components/broadcast/BroadcastPopup";

// Lazy load non-critical components
const Sidebar = lazy(() => import("@/components/layout/Sidebar"));
const Footer = lazy(() => import("@/components/layout/Footer"));

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated } = useAzureADAuth();
  // Always call the hook, let the hook itself handle the authentication check
  useIdleTimer();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Define pages that should not show the sidebar (auth pages and home page)
  const pagesWithoutSidebar = ['/login', '/signup', '/forgot-password', '/unauthorized', '/'];
  const shouldHideSidebar = pagesWithoutSidebar.includes(location.pathname);
  
  // Show sidebar only when authenticated and not on pages that should hide it
  const shouldShowSidebar = isAuthenticated && !shouldHideSidebar;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Broadcast Popup - Shows announcements to users */}
      {isAuthenticated && <BroadcastPopup />}
      
      {/* Mobile Navbar - Show only when authenticated and not on auth pages */}
      {shouldShowSidebar && (
        <div className="md:hidden">
          <Navbar />
        </div>
      )}
      
      {/* Desktop Sidebar - Show only when authenticated and not on auth pages */}
      {shouldShowSidebar && (
        <div className="hidden md:block">
          <Suspense fallback={<div className="w-64 bg-background" />}>
            <Sidebar onCollapseChange={setIsSidebarCollapsed} />
          </Suspense>
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-grow transition-all duration-300",
        shouldShowSidebar && "md:ml-16", // Default margin for collapsed sidebar
        shouldShowSidebar && !isSidebarCollapsed && "md:ml-64" // Margin for expanded sidebar
      )}>
        {children}
      </main>
      
      {/* Footer - Show only on home page */}
      {location.pathname === "/" && (
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      )}
    </div>
  );
}
