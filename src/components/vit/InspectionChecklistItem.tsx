
import React from "react";

type ChecklistItemProps = {
  label: string;
  value: string;
  isPositive: (value: string) => boolean;
}

export const InspectionChecklistItem: React.FC<ChecklistItemProps> = ({ label, value, isPositive }) => {
  return (
    <li className="flex justify-between">
      <span className="text-sm">{label}</span>
      <span className={`text-sm font-medium ${
        isPositive(value) ? "text-green-600" : "text-red-600"
      }`}>
        {value}
      </span>
    </li>
  );
};
