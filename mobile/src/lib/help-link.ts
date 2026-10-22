import { router } from "expo-router";

/** Opens a help article inside the app (Ajuda, mobile/task.md frente 7). */
export function openHelp(slug: string) {
  router.push({ pathname: "/ajuda/[slug]", params: { slug } } as never);
}
