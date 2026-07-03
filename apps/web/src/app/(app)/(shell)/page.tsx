import { redirect } from "next/navigation";
import { APP_HOME_PATH } from "@/lib/navigation/paths";

export default function RootPersonalRedirect() {
  redirect(APP_HOME_PATH);
}
