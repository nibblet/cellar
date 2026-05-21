import { Spinner } from "@/components/primitives";

export default function AppLoading() {
  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <Spinner className="py-24" label="Loading" />
    </main>
  );
}
