export type ActionState = { error?: string; success?: string; href?: string };
export type FormAction = (
  previous: ActionState,
  form: FormData,
) => Promise<ActionState>;
