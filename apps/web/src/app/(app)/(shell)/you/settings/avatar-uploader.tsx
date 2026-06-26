"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/primitives";
import { type AvatarFormState, uploadAvatar } from "./actions";

const INITIAL: AvatarFormState = { ok: false, message: null };

export function AvatarUploader({
  currentSignedUrl,
  initial,
}: {
  currentSignedUrl: string | null;
  initial: string;
}) {
  const [state, formAction, pending] = useActionState(uploadAvatar, INITIAL);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentSignedUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-tint to-accent/30 border border-accent/40 flex items-center justify-center overflow-hidden">
        {previewUrl ? (
          // biome-ignore lint/performance/noImgElement: signed URL, no Next image loader needed here
          <img src={previewUrl} alt="Your avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="font-display text-4xl text-foreground">{initial}</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setPreviewUrl(URL.createObjectURL(file));
        }}
      />
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={() => inputRef.current?.click()}>
          Choose photo
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Save"}
        </Button>
      </div>
      {state.message ? (
        <span className={state.ok ? "text-sm text-foreground-muted" : "text-sm text-ember-500"}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
