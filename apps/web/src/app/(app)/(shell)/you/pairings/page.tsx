import { redirect } from "next/navigation";
import { PERSONAL_PAIRINGS_PATH } from "@/lib/navigation/paths";

export default function YouPairingsRedirect() {
  redirect(PERSONAL_PAIRINGS_PATH);
}
