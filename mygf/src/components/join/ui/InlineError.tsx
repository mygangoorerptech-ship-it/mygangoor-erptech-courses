// mygf/src/components/join/ui/InlineError.tsx
import React from "react";
import { AlertCircle } from "lucide-react";

export default function InlineError({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-rose-700">
      <AlertCircle className="w-4 h-4" /> {msg}
    </div>
  );
}
