"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type BoardStatus = { id: string; title: string; position: number };
type BoardItem = {
  id: string;
  title: string;
  description: string | null;
  status_id: string | null;
  due_date: string | null;
  created_at: string;
};

export default function BoardPage() {
  const supabase = supabaseBrowser;
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<BoardStatus[]>([]);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const defaultStatusId = useMemo(() => statuses[0]?.id ?? null, [statuses]);

  useEffect(() => {
    let isCancelled = false;
    async function bootstrap() {
      try {
        setLoading(true);
        // Ensure default statuses exist (Pending, In Progress, Completed)
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: existingStatuses } = await supabase
          .from("board_statuses")
          .select("id,title,position")
          .order("position", { ascending: true });

        let ensured: BoardStatus[] = existingStatuses ?? [];
        if (!existingStatuses || existingStatuses.length === 0) {
          const defaults = [
            { title: "Pending", position: 0 },
            { title: "In Progress", position: 1 },
            { title: "Completed", position: 2 },
          ];
          const { data: inserted, error } = await supabase
            .from("board_statuses")
            .insert(defaults.map((d) => ({ ...d, user_id: user.id })))
            .select("id,title,position")
            .order("position", { ascending: true });
          if (error) throw error;
          ensured = inserted as BoardStatus[];
        }
        if (isCancelled) return;
        setStatuses(ensured);

        const { data: fetchedItems, error: itemsErr } = await supabase
          .from("board_items")
          .select("id,title,description,status_id,due_date,created_at")
          .order("created_at", { ascending: true });
        if (itemsErr) throw itemsErr;
        if (isCancelled) return;
        setItems((fetchedItems as BoardItem[]) ?? []);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load board");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      isCancelled = true;
    };
  }, [supabase]);

  async function addItem() {
    try {
      if (!newTitle.trim()) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("board_items")
        .insert({
          title: newTitle.trim(),
          user_id: user.id,
          status_id: defaultStatusId,
          due_date: newDue ? newDue : null,
        })
        .select("id,title,description,status_id,due_date,created_at")
        .single();
      if (error) throw error;
      setItems((prev) => [...prev, data as BoardItem]);
      setNewTitle("");
      setNewDue("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not add");
    }
  }

  async function updateStatus(id: string, statusId: string) {
    try {
      const { error } = await supabase
        .from("board_items")
        .update({ status_id: statusId || null })
        .eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status_id: statusId } : it)));
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  async function removeItem(id: string) {
    try {
      const { error } = await supabase.from("board_items").delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Iteration Board</h1>
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            placeholder="Add a new item..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
          />
          <Button onClick={addItem} disabled={loading || !newTitle.trim()}>Add</Button>
        </div>
      </Card>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        ) : (
          items.map((it) => {
            const status = statuses.find((s) => s.id === it.status_id);
            return (
              <Card key={it.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div>
                    <p className="font-medium">{it.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {it.due_date ? new Date(it.due_date).toDateString() : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="border rounded-md h-9 px-2 text-sm"
                      value={it.status_id ?? ""}
                      onChange={(e) => updateStatus(it.id, e.target.value)}
                    >
                      <option value="">No status</option>
                      {statuses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                    <Button variant="outline" onClick={() => removeItem(it.id)}>Delete</Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}


