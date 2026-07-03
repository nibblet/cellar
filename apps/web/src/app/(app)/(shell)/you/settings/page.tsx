import { redirect } from "next/navigation";
import { SETTINGS_PATH } from "@/lib/navigation/paths";

export default function LegacyYouSettingsRedirect() {
  redirect(SETTINGS_PATH);
}
