import "server-only";
import { cookies } from "next/headers";
import { LIST_LAYOUT_COOKIES, parseListLayout, type ListLayoutArea } from "./list-layout";

/** The layout the viewer chose for this area, read on the server so it renders without a flash of the other one. */
export async function listLayoutFor(area: ListLayoutArea) {
  return parseListLayout((await cookies()).get(LIST_LAYOUT_COOKIES[area])?.value);
}
