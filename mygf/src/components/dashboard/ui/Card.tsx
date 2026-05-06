// mygf/src/components/dashboard/ui/Card.tsx
import React from "react";

type Props = React.PropsWithChildren<{
  className?: string;
}>;

export default function Card({ className = "", children }: Props) {
  return (
    <div
      className={
        "bg-white border border-gray-200 rounded-xl shadow-sm p-5 " +
        className
      }
    >
      {children}
    </div>
  );
}
