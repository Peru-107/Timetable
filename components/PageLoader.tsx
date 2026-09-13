import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="frosted flex items-center gap-3 rounded-2xl px-6 py-4 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Loading...
      </div>
    </div>
  );
}
