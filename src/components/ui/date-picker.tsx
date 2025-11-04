import * as React from "react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  picker?: "date" | "month";
  className?: string;
}

export function DatePicker({ value, onChange, picker = "date", className }: DatePickerProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : null;
    onChange(date);
  };

  const formatValue = (date: Date | null) => {
    if (!date) return '';
    if (picker === "month") {
      return format(date, "yyyy-MM");
    }
    return format(date, "yyyy-MM-dd");
  };

  return (
    <div className={className}>
      <Input
        type={picker === "month" ? "month" : "date"}
        value={formatValue(value)}
        onChange={handleChange}
        className="w-full"
      />
    </div>
  );
} 