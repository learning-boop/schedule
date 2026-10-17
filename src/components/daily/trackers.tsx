"use client";

import { Droplet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function Trackers({
  water,
  fitness,
  onWaterChange,
  onFitnessChange,
}: {
  water: number;
  fitness: string | null;
  onWaterChange: (water: number) => void;
  onFitnessChange: (fitness: string | null) => void;
}) {
  const fitnessText = fitness?.replace(/^\[done\] ?/, "") ?? "";
  const fitnessDone = fitness?.startsWith("[done]") ?? false;

  function toggleFitnessDone() {
    if (fitnessDone) {
      onFitnessChange(fitnessText || null);
    } else {
      onFitnessChange(`[done] ${fitnessText}`);
    }
  }

  function updateFitnessText(text: string) {
    if (fitnessDone) {
      onFitnessChange(`[done] ${text}`);
    } else {
      onFitnessChange(text || null);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Trackers</h3>

      {/* Water tracker */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Water ({water}/9)</p>
        <div className="flex gap-1">
          {Array.from({ length: 9 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onWaterChange(i < water ? i : i + 1)}
              className="transition-colors"
              title={`${i + 1} glass${i > 0 ? "es" : ""}`}
            >
              <Droplet
                className={`h-6 w-6 ${
                  i < water ? "fill-blue-500 text-blue-500" : "fill-none text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Fitness */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Fitness</p>
        <div className="flex items-center gap-2">
          <Checkbox id="fitness-done" checked={fitnessDone} onCheckedChange={toggleFitnessDone} />
          <Label htmlFor="fitness-done" className="text-xs">
            Done
          </Label>
        </div>
        <Input
          placeholder="What did you do?"
          value={fitnessText}
          onChange={(e) => updateFitnessText(e.target.value)}
          className="mt-2 h-8 text-sm"
        />
      </div>
    </div>
  );
}
