import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  AlertTriangle, 
  BarChart2, 
  Clock, 
  MapPin, 
  AlertCircle, 
  LightbulbOff,
  ChevronRight
} from "lucide-react";
import { Suspense } from "react";

export default function HomePage() {
  const features = [
    {
      icon: <AlertTriangle className="h-10 w-10 text-ecg-blue" />,
      title: "Real-time Fault Reporting",
      description: "Quickly log faults with detailed information including type, location, and affected customers."
    },
    {
      icon: <BarChart2 className="h-10 w-10 text-ecg-blue" />,
      title: "Interactive Dashboard",
      description: "Monitor active and resolved faults in real-time with filtering capabilities by region and type."
    },
    {
      icon: <MapPin className="h-10 w-10 text-ecg-blue" />,
      title: "GPS Location Tracking",
      description: "Precisely locate faults on an interactive map for faster response by the nearest team."
    },
    {
      icon: <BarChart2 className="h-10 w-10 text-ecg-blue" />,
      title: "Analytics & Reporting",
      description: "Generate detailed reports on system reliability, MTTR, and outage statistics for better planning."
    },
    {
      icon: <AlertCircle className="h-10 w-10 text-ecg-blue" />,
      title: "Real-time Alerts",
      description: "Receive instant notifications about new faults and status updates to stay informed."
    },
    {
      icon: <Clock className="h-10 w-10 text-ecg-blue" />,
      title: "Automated Calculations",
      description: "Automatically calculate key metrics like unserved energy and outage duration for improved accuracy."
    }
  ];

  return (
    <Layout>
      {/* Hero Section - Critical content */}
      <section className="bg-gradient-to-r from-ecg-darkBlue to-ecg-blue py-16 text-white">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold">
              ECG Network Management System
            </h1>
            <p className="text-xl">
              A comprehensive solution for the Electricity Company of Ghana to manage power distribution faults efficiently across ECG operational areas.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-ecg-gold text-black hover:bg-ecg-gold/90">
                <Link to="/login">Get Started</Link>
              </Button>
              <Button asChild size="lg" className="bg-ecg-gold text-black hover:bg-ecg-gold/90">
                <Link to="/dashboard">View Dashboard</Link>
              </Button>
            </div>
          </div>
          
          <img 
            src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjMDA1MkNDIi8+CjxwYXRoIGQ9Ik0yMDAgMTIwSDI0MFY4MEgxNjBWMTIwSDIwMFoiIGZpbGw9IiNGNkMzNDIiLz4KPHBhdGggZD0iTTI0MCAyMDBWMTYwSDI4MFYyMDBIMjQwWiIgZmlsbD0iI0Y2QzM0MiIvPgo8cGF0aCBkPSJNMjAwIDI4MFYzMjBIMjgwVjIwMEgyNDBWMjgwSDIwMFoiIGZpbGw9IiNGNkMzNDIiLz4KPHBhdGggZD0iTTE2MCAyMDBWMTYwSDEyMFYyMDBIMTYwWiIgZmlsbD0iI0Y2QzM0MiIvPgo8cGF0aCBkPSJNMjAwIDI4MEgxNjBWMzIwSDEyMFYyMDBIMTYwVjI4MEgyMDBaIiBmaWxsPSIjRjZDMzQyIi8+CjxwYXRoIGQ9Ik0yNDAgMTYwSDIwMFYyODBIMjQwVjE2MFoiIGZpbGw9IiNGNkMzNDIiLz4KPHBhdGggZD0iTTI0MCAxMjBIMjAwVjE2MEgyNDBWMTIwWiIgZmlsbD0iI0Y2QzM0MiIvPgo8cGF0aCBkPSJNMTYwIDEyMEgxMjBWMTYwSDE2MFYxMjBaIiBmaWxsPSIjRjZDMzQyIi8+Cjwvc3ZnPgo=" 
            alt="Power Distribution Visualization" 
            className="rounded-xl shadow-lg w-64 md:w-80"
            loading="eager"
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Key Features</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Our platform provides the tools you need to efficiently manage and resolve power distribution faults.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="feature-card bg-white dark:bg-[#23272e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section - Lazy load */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <Suspense fallback={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-32 bg-gray-200 dark:bg-gray-800 rounded-lg" />
              ))}
            </div>
          }>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#23272e]">
                <LightbulbOff className="h-12 w-12 text-ecg-gold mx-auto mb-4" />
                <div className="text-4xl font-bold text-ecg-blue dark:text-ecg-gold mb-2">98.5%</div>
                <p className="text-gray-600 dark:text-gray-300">Power Uptime</p>
              </div>
              <div className="text-center p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#23272e]">
                <Clock className="h-12 w-12 text-ecg-gold mx-auto mb-4" />
                <div className="text-4xl font-bold text-ecg-blue dark:text-ecg-gold mb-2">30 min</div>
                <p className="text-gray-600 dark:text-gray-300">Average Response Time</p>
              </div>
              <div className="text-center p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#23272e]">
                <AlertTriangle className="h-12 w-12 text-ecg-gold mx-auto mb-4" />
                <div className="text-4xl font-bold text-ecg-blue dark:text-ecg-gold mb-2">15,000+</div>
                <p className="text-gray-600 dark:text-gray-300">Faults Managed</p>
              </div>
            </div>
          </Suspense>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Improve Power Distribution Management?</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto">
            Join the Electricity Company of Ghana in revolutionizing how we manage and respond to power distribution faults.
          </p>
          <Button asChild size="lg" className="bg-ecg-gold text-black hover:bg-ecg-gold/90">
            <Link to="/signup" className="flex items-center">
              Get Started Today
              <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
