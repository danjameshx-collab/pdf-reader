import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../useOnlineStatus.js";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/20 text-amber-300 text-xs px-4 py-1.5 flex items-center justify-center gap-1.5">
      <WifiOff size={12} />
      You're offline — playing downloaded content only
    </div>
  );
}
