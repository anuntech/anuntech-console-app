import { notFound } from "next/navigation";

// The @ticket catch-all matches every URL, so this group's children slot needs a fallback.
// Next 16.4 no longer adds one implicitly; this keeps the 404 it used to render.
export default function Default() {
  notFound();
}
