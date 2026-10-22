import "server-only";
import { firstStepsFor } from "../../guide/first-steps";
import { guideSections } from "../../guide/guide-content";
import { guideTermsFor, markGuideReadAs } from "../../guide/guide-terms";
import { markCompanyStep } from "../../guide/mark-step";
import { api } from "../server";
import { guard, missing } from "../access";

/** Como trabalhamos and Primeiros passos: the same rules as /como-trabalhamos and the overview's card. */
export const guide = {
  get: api.guide.get.use(guard({ self: true })).handler(async ({ context }) => {
    const terms = await guideTermsFor(context.actor);
    return {
      sections: guideSections,
      // The clause behind each fact stays on the web; the app shows the words.
      terms: terms.map((c) => ({
        company: c.company,
        items: c.items.map((item) => ({
          title: item.title,
          promises: item.promises.map((f) => ({ text: f.text })),
          asks: item.asks.map((f) => ({ text: f.text })),
        })),
      })),
      staff: context.actor.admin,
    };
  }),
  markRead: api.guide.markRead.use(guard({ self: true })).handler(async ({ context }) => {
    await markGuideReadAs(context.actor);
    return { ok: true as const };
  }),
  firstSteps: api.guide.firstSteps.use(guard({ self: true })).handler(async ({ context }) => {
    const found = await firstStepsFor(context.actor);
    return { steps: found ? { companyId: found.companyId, forced: !!found.forced, steps: found.steps } : null };
  }),
  markStep: api.guide.markStep
    .use(guard({ area: "overview", company: (input: { companyId: string }) => input.companyId }))
    .handler(async ({ input, context }) => {
      if (!(await markCompanyStep(context.actor, input.companyId, input.key))) throw missing();
      return { ok: true as const };
    }),
};
