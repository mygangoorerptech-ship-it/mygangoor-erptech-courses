// mygf/src/components/dashboard/ProfileInfoCard.tsx
import React from "react";
import Card from "./ui/Card";

type Props = {
  initials: string;
  name: string;
  handle: string;
  statusBadges: { text: string; bg: string; textColor: string }[];
  dob: string;
  registrationDate: string;
  paymentStatus: "Paid" | "Unpaid";
  accountStatus: "Active" | "Suspended";
};

export default function ProfileInfoCard({
  initials,
  name,
  handle,
  statusBadges,
  dob,
  registrationDate,
  paymentStatus,
  accountStatus,
}: Props) {
  return (
    <Card className="p-8 mb-8">
      <div className="flex items-center space-x-6 mb-8">
        <div className="relative">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {initials}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full flex items-center justify-center">
            <i className="fas fa-check text-white text-sm" />
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-bold text-gray-900">{name}</h3>
          <p className="text-gray-600">@{handle}</p>
          <div className="flex items-center mt-2 gap-2">
            {statusBadges.map((b, idx) => (
              <span
                key={idx}
                className={`${b.bg} ${b.textColor} px-3 py-1 rounded-full text-sm font-medium`}
              >
                {b.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Detail
          iconBg="bg-blue-100"
          iconClass="fas fa-calendar-alt text-blue-600"
          label="Date of Birth"
          value={dob}
        />
        <Detail
          iconBg="bg-green-100"
          iconClass="fas fa-user-plus text-green-600"
          label="Registration Date"
          value={registrationDate}
        />
        <Detail
          iconBg="bg-yellow-100"
          iconClass="fas fa-credit-card text-yellow-600"
          label="Payment Status"
          value={paymentStatus}
          valueClass={paymentStatus === "Paid" ? "text-green-600" : "text-red-600"}
        />
        <Detail
          iconBg="bg-purple-100"
          iconClass="fas fa-shield-alt text-purple-600"
          label="Account Status"
          value={accountStatus}
          valueClass={accountStatus === "Active" ? "text-green-600" : "text-red-600"}
        />
      </div>
    </Card>
  );
}

function Detail({
  iconBg,
  iconClass,
  label,
  value,
  valueClass = "text-gray-900",
}: {
  iconBg: string;
  iconClass: string;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center space-x-3">
        <div className={`${iconBg} p-2 rounded-lg`}>
          <i className={iconClass} />
        </div>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className={`font-semibold ${valueClass}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
