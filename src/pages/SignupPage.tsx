import { Layout } from "@/components/layout/Layout";

export default function SignupPage() {
  return (
    <div className="relative min-h-screen">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: "url('/images/ops.png')",
          zIndex: -1
        }}
      />
      <Layout>
        <div className="container mx-auto py-4 sm:py-10 px-4">
          <div className="max-w-[90%] sm:max-w-md mx-auto">
            <div className="flex justify-center mb-4 sm:mb-6">
              <img src="/ecg-images/ecg-logo.png" alt="ECG Logo" className="h-12 sm:h-16 w-auto" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center">Sign Up for ECG Network Management System</h1>
            <div className="text-center text-gray-700 text-base">
              <p>Sign up is managed via Azure Active Directory.</p>
              <p>If you need access, please contact your system administrator.</p>
            </div>
          </div>
        </div>
      </Layout>
    </div>
  );
}
