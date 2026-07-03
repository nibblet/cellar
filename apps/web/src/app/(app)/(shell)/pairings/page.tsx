import { redirect } from "next/navigation";
import { PAIRINGS_INDEX_PATH } from "@/lib/navigation/paths";

export default function PairingsIndexRedirect() {
  redirect(PAIRINGS_INDEX_PATH);
}
