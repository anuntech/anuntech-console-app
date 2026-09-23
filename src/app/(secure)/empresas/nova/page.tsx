import { redirect } from "next/navigation";
/** The form now opens as a sheet on the list; keep old links working. */
export default function Page() {
  redirect("/empresas?nova=1");
}
