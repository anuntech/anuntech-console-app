import type { JourneyBriefing, JourneyFacts, JourneyStatus, ResolvedJourney } from "@/lib/journeys/journey-model";

/** A staff member who can own a journey or a step. */
export type StaffOption = { id: string; name: string; email: string; image: string | null };

/** Records of the journey's company that "Vincular" offers. */
export type JourneyCandidates = {
  quotes: { id: string; label: string; taken: boolean }[];
  projects: { id: string; label: string }[];
  hosting: { id: string; label: string }[];
  tickets: { id: string; label: string }[];
};

export type JourneyDetailData = {
  journey: {
    id: string;
    title: string;
    status: JourneyStatus;
    company: { id: string; name: string } | null;
    lead: { name: string; contact?: string; email?: string; phone?: string } | null;
    owner: StaffOption | null;
    ticketId: string | null;
    quoteId: string | null;
    engagementId: string | null;
    hostingEngagementId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  briefing: JourneyBriefing | null;
  resolved: ResolvedJourney;
  facts: JourneyFacts;
  staff: StaffOption[];
  companies: { id: string; name: string; document: string | null }[];
  candidates: JourneyCandidates | null;
  activity: { id: string; label: string; who: string; at: string }[];
  /** The microphone under the notes (dictation), when the server has it on. */
  voice: boolean;
  /** ISO instant the page was rendered at. */
  now: string;
};

export type JourneyListRow = {
  id: string;
  title: string;
  status: JourneyStatus;
  /** The company, or "Contato: …" while it is a lead. */
  who: string;
  lead: boolean;
  stage: string;
  done: number;
  total: number;
  next: string | null;
  owner: StaffOption | null;
  updatedAt: string;
  stalled: boolean;
};
