import { Layout } from "@/components/layout/Layout";
import { MusicManager } from "@/components/admin/MusicManager";
import { PageHeader } from "@/components/ui/page-header";

export default function MusicManagementPage() {
  return (
    <Layout>
      <PageHeader
        title="Music Management"
        description="Upload and manage background music for the application"
      />
      <div className="container mx-auto py-6">
        <MusicManager />
      </div>
    </Layout>
  );
} 