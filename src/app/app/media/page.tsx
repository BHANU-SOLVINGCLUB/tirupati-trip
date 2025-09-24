"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Folder as FolderIcon, File as FileIcon, ArrowLeft } from "lucide-react";

type Folder = { id: string; name: string; parent_id: string | null; public_share_id: string | null };
type FileRow = { id: string; name: string; folder_id: string | null; storage_path: string; size_bytes: number | null; public_share_id: string | null; user_id?: string | null };

const BUCKET = "media";

export default function MediaPage() {
  const supabase = supabaseBrowser;
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [cwd, setCwd] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const currentFolder = useMemo(() => folders.find((f) => f.id === cwd) || null, [folders, cwd]);
  const pathPrefix = useMemo(() => (currentFolder ? `${currentFolder.name}/` : ""), [currentFolder]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [dense, setDense] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Ensure bucket exists
        // Note: If bucket already exists, this will fail silently for anon users; skip errors.
        try {
          // @ts-ignore admin-only; best-effort in client is no-op
          await supabase.storage.createBucket(BUCKET, { public: true });
        } catch {}

        const { data: f } = await supabase.from("media_folders").select("id,name,parent_id,public_share_id").order("created_at");
        const { data: fi } = await supabase
          .from("media_files")
          .select("id,name,folder_id,storage_path,size_bytes,public_share_id,user_id")
          .order("created_at");
        if (!isCancelled) {
          setFolders((f as any) || []);
          setFiles((fi as any) || []);
        }
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load media");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [supabase]);

  const shownFolders = folders.filter((d) => (cwd ? d.parent_id === cwd : d.parent_id === null));
  // Files within current folder
  const shownFiles = files.filter((f) => f.folder_id === cwd);
  // Files within current folder to show in grid (images, videos, pdfs, others)
  const itemsGrid = shownFiles.filter((f) => {
    if (!query.trim()) return true;
    return f.name.toLowerCase().includes(query.toLowerCase());
  }).sort((a,b) => b.id.localeCompare(a.id));

  async function createFolder() {
    try {
      if (!newFolder.trim()) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("media_folders")
        .insert({ name: newFolder.trim(), parent_id: cwd, user_id: user.id })
        .select("id,name,parent_id,public_share_id")
        .single();
      if (error) throw error;
      setFolders((prev) => [...prev, data as any]);
      setNewFolder("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not create folder");
    }
  }

  async function uploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    for (const file of Array.from(filesList)) {
      const storagePath = `${user.id}/${pathPrefix}${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) {
        toast.error(upErr.message);
        continue;
      }
      const { data, error } = await supabase
        .from("media_files")
        .insert({
          name: file.name,
          folder_id: cwd,
          storage_path: storagePath,
          size_bytes: file.size,
          user_id: user.id,
        })
        .select("id,name,folder_id,storage_path,size_bytes,public_share_id,user_id")
        .single();
      if (!error) setFiles((prev) => [...prev, data as any]);
    }
    // Clear the input reliably using the ref to avoid null currentTarget
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function publicUrl(row: FileRow) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(row.storage_path);
    if (data?.publicUrl) {
      const ok = await copyToClipboard(data.publicUrl);
      toast[ok ? "success" : "error"](ok ? "Public link copied" : "Unable to copy. Select text manually.");
    }
  }

  function fileKind(name: string) {
    const lower = name.toLowerCase();
    if (/(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.avif)$/.test(lower)) return "image";
    if (/(\.mp4|\.webm|\.ogg|\.mov)$/.test(lower)) return "video";
    if (/(\.pdf)$/.test(lower)) return "pdf";
    return "other";
  }

  function getPublicUrl(path: string): string | null {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl ?? null;
  }

  async function copyToClipboard(text: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }

  async function deleteFile(row: FileRow) {
    try {
      if (!confirm(`Delete ${row.name}?`)) return;
      const { error: stErr } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
      if (stErr) throw stErr;
      const { error: dbErr } = await supabase.from("media_files").delete().eq("id", row.id);
      if (dbErr) throw dbErr;
      setFiles((prev) => prev.filter((f) => f.id !== row.id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }

  async function deleteFolder(folder: Folder) {
    try {
      const hasChildren = folders.some((f) => f.parent_id === folder.id);
      const hasFiles = files.some((f) => f.folder_id === folder.id);
      if (hasChildren || hasFiles) {
        toast.error("Folder is not empty");
        return;
      }
      const { error } = await supabase.from("media_folders").delete().eq("id", folder.id);
      if (error) throw error;
      setFolders((prev) => prev.filter((d) => d.id !== folder.id));
      if (cwd === folder.id) setCwd(null);
      toast.success("Folder deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }
  async function renameFile(row: FileRow) {
    try {
      const newName = prompt("Rename file", row.name)?.trim();
      if (!newName || newName === row.name) return;
      const parts = row.storage_path.split("/");
      parts[parts.length - 1] = `${Date.now()}_${newName}`;
      const newPath = parts.join("/");
      const { error: mvErr } = await supabase.storage.from(BUCKET).move(row.storage_path, newPath);
      if (mvErr) throw mvErr;
      const { error: dbErr } = await supabase
        .from("media_files")
        .update({ name: newName, storage_path: newPath })
        .eq("id", row.id);
      if (dbErr) throw dbErr;
      setFiles((prev) => prev.map((f) => (f.id === row.id ? { ...f, name: newName, storage_path: newPath } : f)));
      toast.success("Renamed");
    } catch (e: any) {
      toast.error(e.message ?? "Rename failed");
    }
  }

  // Multi-select with long press
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // can contain file or folder ids
  const [showDetails, setShowDetails] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  function onLongPressStart(itemId: string) {
    setSelecting(true);
    setSelectedIds((prev) => new Set(prev).add(itemId));
  }

  function toggleSelect(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function clearSelection() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  async function shareSelected() {
    const links: string[] = [];
    // file links
    for (const f of shownFiles) {
      if (selectedIds.has(f.id)) {
        const url = getPublicUrl(f.storage_path);
        if (url) links.push(url);
      }
    }
    // folder links (accumulate child file links)
    for (const d of shownFolders) {
      if (selectedIds.has(d.id)) {
        const filesInFolder = files.filter((x) => x.folder_id === d.id);
        for (const f of filesInFolder) {
          const url = getPublicUrl(f.storage_path);
          if (url) links.push(url);
        }
      }
    }
    if (links.length) {
      const ok = await copyToClipboard(links.join("\n"));
      toast[ok ? "success" : "error"](ok ? "Links copied" : "Unable to copy. Select text manually.");
    }
  }

  async function deleteSelected() {
    const fileTargets = shownFiles.filter((f) => selectedIds.has(f.id));
    const folderTargets = shownFolders.filter((d) => selectedIds.has(d.id));
    const total = fileTargets.length + folderTargets.length;
    if (!total) return;
    if (!confirm(`Delete ${total} item(s)?`)) return;
    for (const t of fileTargets) await deleteFile(t);
    for (const d of folderTargets) await deleteFolder(d);
    clearSelection();
  }

  function openPreview(id: string) {
    if (selecting) {
      toggleSelect(id);
      return;
    }
    setPreviewId(id);
  }

  function previewCtx() {
    const idx = itemsGrid.findIndex((f) => f.id === previewId);
    const file = idx >= 0 ? itemsGrid[idx] : null;
    const nextId = idx >= 0 && idx < itemsGrid.length - 1 ? itemsGrid[idx + 1].id : null;
    const prevId = idx > 0 ? itemsGrid[idx - 1].id : null;
    return { file, nextId, prevId };
  }

  async function createShareAndOpen() {
    try {
      const token = crypto.randomUUID();
      const idsFiles = shownFiles.filter((f) => selectedIds.has(f.id)).map((f) => f.id);
      const idsFolders = shownFolders.filter((d) => selectedIds.has(d.id)).map((d) => d.id);
      if (idsFiles.length === 0 && idsFolders.length === 0) {
        toast.error("Select files or folders to share");
        return;
      }
      if (idsFiles.length) {
        const { error } = await supabase
          .from("media_files")
          .update({ public_share_id: token })
          .in("id", idsFiles);
        if (error) throw error;
      }
      if (idsFolders.length) {
        const { error } = await supabase
          .from("media_folders")
          .update({ public_share_id: token })
          .in("id", idsFolders);
        if (error) throw error;
      }
      const url = `${window.location.origin}/share/${token}`;
      await copyToClipboard(url);
      window.open(url, "_blank");
      toast.success("Share link created");
    } catch (e: any) {
      toast.error(e.message ?? "Share failed");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Media</h1>
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <button className="flex items-center gap-1" onClick={() => setCwd(currentFolder?.parent_id ?? null)} disabled={!currentFolder}>
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex flex-wrap items-center gap-1">
            <button className="underline" onClick={() => setCwd(null)}>Root</button>
            {(() => {
              const crumbs: { id: string; name: string }[] = [];
              let p = currentFolder;
              while (p) {
                crumbs.unshift({ id: p.id, name: p.name });
                p = folders.find((x) => x.id === p!.parent_id) || null;
              }
              return crumbs.map((c, i) => (
                <span key={c.id} className="inline-flex items-center gap-1">
                  <span>/</span>
                  <button className="underline" onClick={() => setCwd(c.id)}>{c.name}</button>
                </span>
              ));
            })()}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Storage path prefix: <code className="px-1 py-0.5 rounded bg-muted">{`<user-id>/${pathPrefix}`}</code></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button variant="outline" onClick={() => setDense((d) => !d)}>{dense ? "Comfortable" : "Dense"}</Button>
        </div>
        <input ref={fileInputRef} type="file" multiple onChange={uploadFiles} className="hidden" />
      </Card>

      <div className="space-y-2">
        <div className="text-sm font-medium">Folders</div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : shownFolders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No folders</p>
        ) : (
          <div className={`grid ${dense ? 'grid-cols-3 sm:grid-cols-6 gap-1' : 'grid-cols-2 sm:grid-cols-4 gap-2'}`}>
            {shownFolders.map((d) => (
              <Card key={d.id} className={`p-2 ${selectedIds.has(d.id) ? 'ring-2 ring-foreground' : ''}`}
                onContextMenu={(e) => { e.preventDefault(); onLongPressStart(d.id); }}
                onPointerDown={() => {
                  let timer: any;
                  const up = () => { clearTimeout(timer); window.removeEventListener('pointerup', up as any); };
                  timer = setTimeout(() => onLongPressStart(d.id), 400);
                  window.addEventListener('pointerup', up as any, { once: true });
                }}
              >
                <button className="w-full text-left" onClick={() => (selecting ? toggleSelect(d.id) : setCwd(d.id))}>
                  <div className="aspect-square rounded bg-muted flex items-center justify-center">
                    <FolderIcon className="h-8 w-8" />
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate px-1 mt-1">{d.name}</div>
                </button>
              </Card>
            ))}
          </div>
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

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogHeader>
          <DialogTitle>Add</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => { setShowAdd(false); fileInputRef.current?.click(); }}>Add Files</Button>
              <Button variant="outline" onClick={() => { /* show folder input below */ }}>Add Folder</Button>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Folder name</div>
              <div className="flex items-center gap-2">
                <Input placeholder="New folder name" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
                <Button onClick={async () => { await createFolder(); setShowAdd(false); }}>Create</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <div className="text-sm font-medium">Files</div>
        {itemsGrid.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files</p>
        ) : (
          <div className={`grid ${dense ? 'grid-cols-3 sm:grid-cols-6 gap-1' : 'grid-cols-2 sm:grid-cols-4 gap-2'}`}>
            {itemsGrid.map((f) => {
              const kind = fileKind(f.name);
              const url = getPublicUrl(f.storage_path);
              return (
                <Card key={f.id} className={`p-1 flex flex-col gap-2 ${selectedIds.has(f.id) ? 'ring-2 ring-foreground' : ''}`}
                  onContextMenu={(e) => { e.preventDefault(); onLongPressStart(f.id); }}
                  onPointerDown={(e) => {
                    let timer: any;
                    const up = () => { clearTimeout(timer); window.removeEventListener('pointerup', up as any); };
                    timer = setTimeout(() => onLongPressStart(f.id), 400);
                    window.addEventListener('pointerup', up as any, { once: true });
                  }}
                >
                  <div className="aspect-square overflow-hidden rounded bg-muted flex items-center justify-center" onClick={() => (selecting ? toggleSelect(f.id) : openPreview(f.id))}>
                    {kind === "image" && url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={f.name} className="h-full w-full object-cover select-none" draggable={false} />
                    )}
                    {kind === "video" && url && (
                      <video src={url} className="h-full w-full object-cover" controls={false} muted playsInline />
                    )}
                    {kind === "pdf" && url && (
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs underline">PDF</a>
                    )}
                    {kind === "other" && (
                      <FileIcon className="h-8 w-8" />
                    )}
                  </div>
                  {/* No details in grid per request */}
                </Card>
              );
            })}
          </div>
        )}
        {selecting && (
          <div className="sticky bottom-16 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-md p-2 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{selectedIds.size} selected</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={createShareAndOpen}>Share</Button>
              <Button variant="outline" onClick={deleteSelected}>Delete</Button>
              {(() => {
                if (selectedIds.size !== 1) return null;
                const id = Array.from(selectedIds)[0];
                const file = files.find((f) => f.id === id);
                if (!file) return null;
                return <Button variant="outline" onClick={() => renameFile(file)}>Rename</Button>;
              })()}
              <Button variant="outline" onClick={() => setShowDetails(true)}>Details</Button>
              <Button variant="outline" onClick={clearSelection}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
      {selecting && showDetails && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">Details</div>
          {[...selectedIds].map((id) => {
            const f = files.find((x) => x.id === id);
            if (!f) return null;
            return (
              <div key={id} className="text-xs grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 py-2 border-b last:border-b-0">
                <div className="text-muted-foreground">Filename</div>
                <div className="break-all">{f.name}</div>
                <div className="text-muted-foreground">Size</div>
                <div>{(((f.size_bytes || 0) / 1024).toFixed(2))} KB</div>
                <div className="text-muted-foreground">Uploaded by</div>
                <div>{f.user_id ? f.user_id : "Unknown"}</div>
                <div className="text-muted-foreground">Storage key</div>
                <div className="break-all">{f.storage_path}</div>
              </div>
            );
          })}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowDetails(false)}>Close</Button>
          </div>
        </Card>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {(() => {
            const { file, nextId, prevId } = previewCtx();
            if (!file) return null;
            const kind = fileKind(file.name);
            const url = getPublicUrl(file.storage_path);
            return (
              <div className="space-y-2">
                <div className="w-full max-h-[70dvh] overflow-hidden rounded bg-muted flex items-center justify-center">
                  {kind === 'image' && url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={file.name} className="max-h-[70dvh] w-auto object-contain" />
                  )}
                  {kind === 'video' && url && (
                    <video src={url} className="max-h-[70dvh] w-auto" controls autoPlay playsInline />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Button variant="outline" disabled={!prevId} onClick={() => setPreviewId(prevId)}>Prev</Button>
                  <Button variant="outline" onClick={() => publicUrl(file)}>Share</Button>
                  <Button variant="outline" onClick={() => deleteFile(file)}>Delete</Button>
                  <Button variant="outline" disabled={!nextId} onClick={() => setPreviewId(nextId)}>Next</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}


