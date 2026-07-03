import { redirect } from "next/navigation";
import { CELLAR_PATH } from "@/lib/navigation/paths";

export default function ShelfRedirect() {
  redirect(CELLAR_PATH);
}
