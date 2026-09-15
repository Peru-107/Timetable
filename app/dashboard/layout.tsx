import { PageTransition } from "@/components/PageTransition";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
