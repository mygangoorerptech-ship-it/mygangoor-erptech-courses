// mygf/src/components/dashboard/ui/Card.tsx
import React from "react";

type Props = React.PropsWithChildren<{
  className?: string;
}>;

export default function Card({ className = "", children }: Props) {
  return (
    <div
      className={
        "bg-white rounded-2xl shadow-xl p-6 transition-transform duration-200 hover:-translate-y-0.5 " +
        className
      }
    >
      {children}
    </div>
  );
}
