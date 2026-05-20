import { Voice } from "@/components/primitives";
import { CaptureForm } from "./capture-form";

export default function CapturePage() {
  return (
    <main className="mx-auto max-w-md px-5 py-8 flex-1">
      <header className="text-center mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Capture</p>
        <h1 className="text-3xl mt-1">What are you having?</h1>
      </header>

      <Voice className="text-center mb-8">“Hold the band steady, sir. I'll do the rest.”</Voice>

      <CaptureForm />
    </main>
  );
}
