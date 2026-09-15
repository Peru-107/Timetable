import { PageTransition } from "@/components/PageTransition";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      {children}
      {/* Reserves real space at the true bottom of each page's content so it
          doesn't sit under the fixed mobile tab bar - a spacer placed inside
          DashboardNav itself can't do this, since DashboardNav renders near
          the top of the page, not at the end of its content. */}
      <div className="h-20 sm:hidden" aria-hidden="true" />
    </PageTransition>
  );
}
