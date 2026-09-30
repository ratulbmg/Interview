import { useEffect, useState } from "react";
import { Button, cn } from "@repo/ui";
import { TbRefresh, TbWifiOff } from "react-icons/tb";

/** A bottom-right toast that appears the moment the browser goes offline
 * and disappears once the connection is back — mounted once in
 * app/providers.tsx so it works on every page (Login and the public Room
 * page included, not just the recruiter-authenticated ones). Deliberately
 * non-blocking (no full-screen overlay) so it never gets in the way of an
 * in-progress form, or worse, a live interview call on the Room page. */
export default function OfflineNotice() {
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] transition-all duration-300 sm:bottom-6 sm:right-6",
        isOffline
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-xl">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-destructive/20 bg-muted text-destructive">
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full border border-destructive/30"
          />
          <TbWifiOff className="relative size-4" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            No internet connection
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Reconnects automatically — or try again now.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 h-7 px-2.5 text-xs"
            onClick={() => setIsOffline(!navigator.onLine)}
          >
            <TbRefresh className="size-3.5" aria-hidden />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
