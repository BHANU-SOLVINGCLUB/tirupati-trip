"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [sort, setSort] = useState<"created" | "due">("created");
  const [editing, setEditing] = useState<BoardItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<string>("");
  const [editDue, setEditDue] = useState("");
  const [showAdd, setShowAdd] = useState(false);
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
        // realtime
        const ch = supabase
          .channel("rt-board")
          .on("postgres_changes", { event: "*", schema: "public", table: "board_items" }, (payload) => {
            setItems((prev) => {
              if (payload.eventType === "INSERT") return [...prev, payload.new as BoardItem];
              if (payload.eventType === "UPDATE") return prev.map((x) => (x.id === (payload.new as BoardItem).id ? (payload.new as BoardItem) : x));
              if (payload.eventType === "DELETE") return prev.filter((x) => x.id !== (payload.old as BoardItem).id);
              return prev;
            });
          })
          .subscribe();
        return () => { supabase.removeChannel(ch); };
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load board");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    const cleanup = bootstrap();
    return () => {
      isCancelled = true;
      if (typeof cleanup === "function") cleanup();
    };
  }, [supabase]);

  const shown: BoardItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter((i) => (filterStatus ? i.status_id === filterStatus : true));
    if (q) list = list.filter((i) => i.title.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (sort === "created") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return ad - bd;
    });
    return list;
  }, [items, filterStatus, query, sort]);

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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="border rounded h-9 px-2 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((s) => (<option key={s.id} value={s.id}>{s.title}</option>))}
          </select>
          <select className="border rounded h-9 px-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as "created" | "due")}>
            <option value="created">Sort by created</option>
            <option value="due">Sort by due date</option>
          </select>
        </div>
      </Card>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        ) : (
          shown.map((it) => {
            const status = statuses.find((s) => s.id === it.status_id);
            return (
              <Card key={it.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div onClick={() => { setEditing(it); setEditTitle(it.title); setEditDesc(it.description || ""); setEditStatus(it.status_id || ""); setEditDue(it.due_date || ""); }} className="cursor-pointer">
                    <p className="font-medium">{it.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {status ? status.title : "No status"} • Due: {it.due_date ? new Date(it.due_date).toDateString() : "—"}
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

      {/* Floating Add button */}
      <button
        className="fixed right-4 bottom-20 md:bottom-6 z-40 h-12 w-12 rounded-full bg-foreground text-background text-xl shadow-lg flex items-center justify-center"
        aria-label="Add"
        onClick={() => setShowAdd(true)}
      >
        +
      </button>

      <Dialog open={showAdd} onOpenChange={(o: boolean) => setShowAdd(o)}>
        <DialogHeader>
          <DialogTitle>Add item</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-2">
            <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select className="border rounded h-9 px-2 text-sm" value={defaultStatusId || ""} onChange={() => {}} disabled>
                <option value="">Default status</option>
                {statuses.map((s) => (<option key={s.id} value={s.id}>{s.title}</option>))}
              </select>
              <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
              <Button onClick={async () => { await addItem(); setShowAdd(false); }} disabled={!newTitle.trim()}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o: boolean) => !o && setEditing(null)}>
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-2">
            <Input placeholder="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <Input placeholder="Description" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select className="border rounded h-9 px-2 text-sm" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                <option value="">No status</option>
                {statuses.map((s) => (<option key={s.id} value={s.id}>{s.title}</option>))}
              </select>
              <Input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
              <Button onClick={async () => {
                if (!editing) return;
                try {
                  const { error } = await supabase
                    .from("board_items")
                    .update({ title: editTitle.trim(), description: editDesc.trim() || null, status_id: editStatus || null, due_date: editDue || null })
                    .eq("id", editing.id);
                  if (error) throw error;
                  setEditing(null);
                } catch (er) { toast.error("Update failed"); }
              }} disabled={!editTitle.trim()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


