import { redirect } from "next/navigation";
import { APP_HOME_PATH } from "@/lib/navigation/paths";

export default function ShelfRedirect() {
  redirect(`${APP_HOME_PATH}#shelf`);
}
