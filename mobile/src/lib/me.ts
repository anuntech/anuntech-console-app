import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** Who is signed in and the companies they reach (me.get). */
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api.me.get({}) });
}
