import { redirect } from "next/navigation";
import { PERSONAL_TASTINGS_PATH } from "@/lib/navigation/paths";

export default function YouTastingsRedirect() {
  redirect(PERSONAL_TASTINGS_PATH);
}
