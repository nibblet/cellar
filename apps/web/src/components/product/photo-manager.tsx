"use client";

import { useRef, useState } from "react";
import { Camera, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button, Divider } from "@/components/primitives";
import { compressPhotoForUpload } from "@/lib/image/compress-for-upload";
import { cn } from "@/lib/utils";

export type MemberPhoto = {
  id: string;
  url: string;
  contributor: string | null;
};

type PhotoManagerProps = {
  productId: string;
  catalogUrl: string | null;
  memberPhotos: MemberPhoto[];
};

type DeleteConfirm = { target: "catalog" } | { target: "member"; imageId: string } | null;

export function PhotoManager({ productId, catalogUrl, memberPhotos }: PhotoManagerProps) {
  const [catalog, setCatalog] = useState(catalogUrl);
  const [members, setMembers] = useState(memberPhotos);
  const [confirm, setConfirm] = useState<DeleteConfirm>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function clearFeedback() {
    setFeedback(null);
  }

  async function handleDelete() {
    if (!confirm) return;
    setDeleting(true);
    clearFeedback();

    try {
      const body =
        confirm.target === "catalog"
          ? { productId, target: "catalog" }
          : { productId, target: "member", imageId: confirm.imageId };

      const res = await fetch("/api/product-photo", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed" }));
        setFeedback({ type: "error", text: data.error ?? "Delete failed" });
      } else if (confirm.target === "catalog") {
        setCatalog(null);
        setFeedback({ type: "ok", text: "Catalog photo removed" });
      } else {
        setMembers((prev) => prev.filter((p) => p.id !== confirm.imageId));
        setFeedback({ type: "ok", text: "Member photo removed" });
      }
    } catch {
      setFeedback({ type: "error", text: "Network error" });
    } finally {
      setDeleting(false);
      setConfirm(null);
    }
  }

  async function handleUpload(target: "catalog" | "member") {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    clearFeedback();

    try {
      const compressed = await compressPhotoForUpload(file);
      const form = new FormData();
      form.set("productId", productId);
      form.set("target", target);
      form.set("file", compressed);

      const res = await fetch("/api/product-photo", { method: "POST", body: form });
      const data = await res.json().catch(() => ({ error: "Upload failed" }));

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error ?? "Upload failed" });
      } else if (target === "catalog") {
        setCatalog(data.url);
        setFeedback({ type: "ok", text: "Catalog photo replaced" });
      } else {
        setMembers((prev) => [
          ...prev,
          { id: crypto.randomUUID(), url: data.url, contributor: "You" },
        ]);
        setFeedback({ type: "ok", text: "Member photo added" });
      }
    } catch {
      setFeedback({ type: "error", text: "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRefetch() {
    setRefetching(true);
    clearFeedback();

    try {
      const res = await fetch("/api/enrich-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, imageOnly: true }),
      });
      const data = await res.json().catch(() => ({ error: "Re-fetch failed" }));

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error ?? "Re-fetch failed" });
      } else if (data.imageUrl) {
        setCatalog(data.imageUrl);
        setFeedback({ type: "ok", text: "New catalog photo fetched" });
      } else {
        setFeedback({
          type: "error",
          text: data.apifyError
            ? `Apify error: ${data.apifyError}`
            : "No suitable image found on the web",
        });
      }
    } catch {
      setFeedback({ type: "error", text: "Network error" });
    } finally {
      setRefetching(false);
    }
  }

  const busy = deleting || uploading || refetching;

  return (
    <div className="mt-8 pt-2">
      <Divider label="Photos" />

      {feedback ? (
        <p
          className={cn(
            "text-xs mt-3 text-center",
            feedback.type === "ok" ? "text-moss-500" : "text-ember-500",
          )}
          role="status"
        >
          {feedback.text}
        </p>
      ) : null}

      {/* ── Catalog stock photo ── */}
      <section className="mt-5">
        <p className="text-xs uppercase tracking-widest text-foreground-subtle mb-3">
          Catalog photo
        </p>

        {catalog ? (
          <div className="flex gap-3 items-start">
            <div className="relative w-20 aspect-[4/5] rounded-lg border border-border overflow-hidden bg-surface shrink-0">
              {/* biome-ignore lint/performance/noImgElement: catalog URL varies */}
              <img
                src={catalog}
                alt="Catalog"
                className="absolute inset-0 w-full h-full object-contain p-1"
              />
              <span className="absolute bottom-0 inset-x-0 text-[8px] uppercase tracking-widest text-center text-foreground-subtle bg-paper-50/80 leading-tight py-px">
                Catalog
              </span>
            </div>

            <div className="flex flex-col gap-2 flex-1 min-w-0">
              {confirm?.target === "catalog" ? (
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-foreground-muted">Remove?</span>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs text-ember-500"
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? "Removing…" : "Yes"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    disabled={deleting}
                    onClick={() => setConfirm(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="h-8 px-3 text-xs justify-start"
                  disabled={busy}
                  onClick={() => setConfirm({ target: "catalog" })}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">No catalog photo</p>
        )}

        <div className="flex gap-2 mt-3">
          <UploadButton
            label="Upload catalog"
            icon={<Upload className="w-3.5 h-3.5" />}
            disabled={busy}
            onSelect={() => {
              if (fileRef.current) {
                fileRef.current.dataset.target = "catalog";
                fileRef.current.click();
              }
            }}
          />
          <Button
            variant="ghost"
            className="h-9 px-3 text-xs flex-1"
            disabled={busy}
            onClick={handleRefetch}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refetching && "animate-spin")} />
            {refetching ? "Fetching…" : "Re-fetch from web"}
          </Button>
        </div>
      </section>

      {/* ── Member-contributed photos ── */}
      <section className="mt-6">
        <p className="text-xs uppercase tracking-widest text-foreground-subtle mb-3">
          Member photos
        </p>

        {members.length === 0 ? (
          <p className="text-sm text-foreground-muted">No member photos</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {members.map((photo) => (
              <div key={photo.id} className="relative">
                <div className="aspect-[4/5] rounded-lg border border-border overflow-hidden bg-surface">
                  {/* biome-ignore lint/performance/noImgElement: signed URL varies */}
                  <img
                    src={photo.url}
                    alt={photo.contributor ? `By ${photo.contributor}` : "Member photo"}
                    className="w-full h-full object-cover"
                  />
                </div>
                {photo.contributor ? (
                  <p className="text-[10px] text-foreground-subtle mt-0.5 truncate">
                    {photo.contributor}
                  </p>
                ) : null}
                {confirm?.target === "member" && confirm.imageId === photo.id ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink-900/60 rounded-lg">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="h-7 px-2 text-[10px] font-medium rounded-md bg-ember-500 text-paper-50"
                        disabled={deleting}
                        onClick={handleDelete}
                      >
                        {deleting ? "…" : "Remove"}
                      </button>
                      <button
                        type="button"
                        className="h-7 px-2 text-[10px] font-medium rounded-md bg-paper-50/80 text-ink-900"
                        disabled={deleting}
                        onClick={() => setConfirm(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-ink-900/50 text-paper-50 hover:bg-ink-900/70 transition-colors"
                    aria-label={`Remove photo${photo.contributor ? ` by ${photo.contributor}` : ""}`}
                    disabled={busy}
                    onClick={() => setConfirm({ target: "member", imageId: photo.id })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <UploadButton
            label="Add member photo"
            icon={<Camera className="w-3.5 h-3.5" />}
            disabled={busy}
            onSelect={() => {
              if (fileRef.current) {
                fileRef.current.dataset.target = "member";
                fileRef.current.click();
              }
            }}
          />
        </div>
      </section>

      {/* Hidden file input shared by both upload actions */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={() => {
          const target = fileRef.current?.dataset.target as "catalog" | "member" | undefined;
          if (target) handleUpload(target);
        }}
      />

      {uploading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-foreground-muted">
          <div className="h-4 w-4 rounded-full border-2 border-border border-t-accent animate-spin" />
          Uploading…
        </div>
      ) : null}
    </div>
  );
}

function UploadButton({
  label,
  icon,
  disabled,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="ghost"
      className="h-9 px-3 text-xs flex-1"
      disabled={disabled}
      onClick={onSelect}
    >
      {icon}
      {label}
    </Button>
  );
}
