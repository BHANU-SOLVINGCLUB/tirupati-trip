"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const supabase = supabaseBrowser;
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const { data: f1 } = await supabase
          .from("media_files")
          .select("id,name,storage_path,public_share_id")
          .eq("public_share_id", token);
        const { data: f2 } = await supabase
          .from("media_folders")
          .select("id,name,public_share_id")
          .eq("public_share_id", token);
        if (!cancel) {
          setFiles((f1 as any) || []);
          setFolders((f2 as any) || []);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [supabase, token]);

  function getPublicUrl(path: string) {
    return supabase.storage.from("media").getPublicUrl(path).data?.publicUrl ?? null;
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Shared Media</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {folders.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Folders</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {folders.map((d) => (
                  <div key={d.id} className="p-2 rounded border">
                    <div className="text-sm font-medium truncate">{d.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="text-sm font-medium">Files</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {files.map((f) => {
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
          </div>
        </>
      )}
    </div>
  );
}


