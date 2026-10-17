"use client";

import { Textarea } from "@/components/ui/textarea";

export function Notes({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (notes: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Notes</h3>
      <Textarea
        placeholder="Jot down anything..."
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        rows={8}
        className="text-sm"
      />
      <p className="text-xs text-muted-foreground">Auto-saves as you type.</p>
    </div>
  );
}
