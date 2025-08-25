// mygf/src/components/dashboard/RecentCertificatesCard.tsx
import React from "react";
import Card from "./ui/Card";
import type { CertificateItem } from "./types";

type Props = {
  items: CertificateItem[];
  onViewAll?: () => void;
};

export default function RecentCertificatesCard({ items, onViewAll }: Props) {
  const handleClick = () => {
    if (onViewAll) return onViewAll();
    alert("Opening certificates page... (Demo functionality)");
  };

  return (
    <Card>
      <h4 className="text-lg font-bold text-gray-900 mb-4">Recent Certificates</h4>
      <div className="space-y-3">
        {items.map((c) => (
          <div
            key={c.id}
            className={`bg-gradient-to-r ${c.bgGradient} rounded-lg p-3 border ${c.borderColor}`}
          >
            <div className="flex items-center space-x-3">
              <i className={`fas fa-award ${c.iconColor} text-lg`} />
              <div>
                <p className="font-semibold text-gray-900 text-sm">{c.title}</p>
                <p className="text-xs text-gray-600">Issued: {c.issued}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleClick}
        className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium"
      >
        View All Certificates
      </button>
    </Card>
  );
}
