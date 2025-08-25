// mygf/src/components/join/ui/Note.tsx
import React from "react";
import { ShieldCheck } from "lucide-react";

export default function Note({ text }: { text: string }) {
  return (
    <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg flex items-start gap-2">
      <ShieldCheck className="w-4 h-4 mt-0.5" /> {text}
    </div>
  );
}
