"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Top3Item } from "@/hooks/use-daily-page";

type DoneBlock = {
  id: string;
  title: string;
  work_note: string | null;
  start: string;
  end: string;
  goal: { title: string; colour: string } | null;
};

export function DoneToday({ date, top3 }: { date: string; top3: Top3Item[] }) {
  const [doneBlocks, setDoneBlocks] = useState<DoneBlock[]>([]);

  useEffect(() => {
    async function fetchDone() {
      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const res = await fetch(
        `/api/time-blocks?start=${dayStart.toISOString()}&end=${dayEnd.toISOString()}`,
      );
      if (res.ok) {
        const blocks = await res.json();
        setDoneBlocks(blocks.filter((b: DoneBlock & { done: boolean }) => b.done));
      }
    }
    fetchDone();
  }, [date]);

  const doneTop3 = top3.filter((i) => i.done);
  const hasAnything = doneBlocks.length > 0 || doneTop3.length > 0;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        Done Today
      </h3>

      {!hasAnything && (
        <p className="text-xs text-muted-foreground">Nothing completed yet. Keep going!</p>
      )}

      {doneTop3.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Priorities</p>
          <ul className="space-y-1">
            {doneTop3.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                <span className="line-through">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {doneBlocks.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Completed blocks</p>
          <ul className="space-y-2">
            {doneBlocks.map((block) => (
              <li key={block.id} className="rounded border p-2">
                <div className="flex items-center gap-2">
                  {block.goal && (
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: block.goal.colour }}
                    />
                  )}
                  <span className="text-sm font-medium">{block.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(block.start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" - "}
                    {new Date(block.end).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {block.work_note && (
                  <p className="mt-1 text-xs text-muted-foreground">{block.work_note}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
