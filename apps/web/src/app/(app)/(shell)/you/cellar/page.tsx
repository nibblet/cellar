import { redirect } from "next/navigation";
import { SHELF_PATH } from "@/lib/navigation/paths";

export default function YouCellarPage() {
  redirect(SHELF_PATH);
}
