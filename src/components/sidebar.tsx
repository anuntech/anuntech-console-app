import BottomMenu, { type NavigationProps } from "./legacy-ui/bottom-menu";

export function WorkspaceHeader(props: NavigationProps) {
  return <BottomMenu {...props} />;
}
