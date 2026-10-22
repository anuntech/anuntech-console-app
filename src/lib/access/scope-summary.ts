/** How a Membro's access reads in a list: "Tudo da empresa" or "3 itens". Shared by the web table and the app's API. */
export function scopeSummary(scope: { access: "all" | "selected"; ids: string[] } | undefined) {
  if (!scope || scope.access === "all") return "Tudo da empresa";
  const n = scope.ids.length;
  return n === 0 ? "Nada escolhido" : n === 1 ? "1 item" : `${n} itens`;
}
