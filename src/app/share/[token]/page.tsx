"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Folder = { id: string; name: string; parent_id: string | null };
type FileRow = { id: string; name: string; storage_path: string; folder_id: string | null };

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const supabase = supabaseBrowser;
  const [loading, setLoading] = useState(true);
  const [rootFolders, setRootFolders] = useState<Folder[]>([]);
  const [rootFiles, setRootFiles] = useState<FileRow[]>([]);
  const [cwd, setCwd] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const { data: items, error } = await supabase
          .from("share_items")
          .select("file_id, folder_id")
          .eq("token", token);
        if (error) throw error;
        const fileIds = (items || []).filter((i: { file_id: string | null }) => i.file_id).map((i: { file_id: string }) => i.file_id);
        const folderIds = (items || []).filter((i: { folder_id: string | null }) => i.folder_id).map((i: { folder_id: string }) => i.folder_id);
        const filesRes = fileIds.length
          ? await supabase.from("media_files").select("id,name,storage_path,folder_id").in("id", fileIds)
          : { data: [] as FileRow[] };
        const foldersRes = folderIds.length
          ? await supabase.from("media_folders").select("id,name,parent_id").in("id", folderIds)
          : { data: [] as Folder[] };
        if (!cancel) {
          setRootFiles((filesRes.data as FileRow[]) || []);
          setRootFolders((foldersRes.data as Folder[]) || []);
          setCwd(null);
        }
      } catch {
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [supabase, token]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (cwd == null) {
          setFolders(rootFolders);
          setFiles(rootFiles);
          return;
        }
        const [fRes, fiRes] = await Promise.all([
          supabase.from("media_folders").select("id,name,parent_id").eq("parent_id", cwd),
          supabase.from("media_files").select("id,name,storage_path,folder_id").eq("folder_id", cwd),
        ]);
        if (!cancel) {
          setFolders((fRes.data as Folder[]) || []);
          setFiles((fiRes.data as FileRow[]) || []);
        }
      } catch {
      }
    })();
    return () => {
      cancel = true;
    };
  }, [cwd, rootFiles, rootFolders, supabase]);

  function getPublicUrl(path: string) {
    return supabase.storage.from("media").getPublicUrl(path).data?.publicUrl ?? null;
  }

  const shownFolders = folders.filter((d) => (query ? d.name.toLowerCase().includes(query.toLowerCase()) : true));
  const shownFiles = files.filter((f) => (query ? f.name.toLowerCase().includes(query.toLowerCase()) : true));

  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Shared Media</h1>
      <div className="flex items-center gap-2 text-sm">
        <button className="underline" onClick={() => setCwd(null)} disabled={cwd === null}>Root</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button variant="outline" onClick={() => setView(view === "list" ? "grid" : "list")}>{view === "list" ? "Grid view" : "List view"}</Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="text-sm font-medium">Folders</div>
            {shownFolders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No folders</p>
            ) : view === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {shownFolders.map((d) => (
                  <button key={d.id} className="p-2 rounded border text-left" onClick={() => setCwd(d.id)}>
                    <div className="aspect-square rounded bg-muted" />
                    <div className="text-[11px] text-muted-foreground truncate mt-1">{d.name}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="divide-y rounded border">
                {shownFolders.map((d) => (
                  <button key={d.id} className="p-2 text-left w-full hover:bg-muted" onClick={() => setCwd(d.id)}>
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Files</div>
            {shownFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files</p>
            ) : view === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {shownFiles.map((f) => {
                  const url = getPublicUrl(f.storage_path);
                  const isImg = /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f.name);
                  const isVid = /\.(mp4|webm|ogg|mov)$/i.test(f.name);
                  return (
                    <a key={f.id} className="block p-1 rounded border" href={url ?? undefined} target="_blank" rel="noreferrer">
                      <div className="aspect-square bg-muted overflow-hidden rounded flex items-center justify-center">
                        {isImg && url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={f.name} className="h-full w-full object-cover" />
                        )}
                        {isVid && url && (
                          <video src={url} className="h-full w-full object-cover" muted playsInline />
                        )}
                        {!isImg && !isVid && <div className="text-xs">{f.name}</div>}
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y rounded border">
                {shownFiles.map((f) => {
                  const url = getPublicUrl(f.storage_path);
                  return (
                    <a key={f.id} className="p-2 block hover:bg-muted" href={url ?? undefined} target="_blank" rel="noreferrer">
                      {f.name}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


