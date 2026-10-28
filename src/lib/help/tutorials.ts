import type { TutorialId } from "./help-model";

/*
 * The tutorial videos (videos/tutorial-* in the working copy, light versions
 * made like videos/central-tutoriais/gerar.py: H.264 CRF 30, 650 kbps, AAC 64 kbps,
 * faststart). Only fictitious data appears in them. Files in public/ajuda/videos
 * carry a hash in the name, so a new render is a new file and caches never
 * serve an old one. The captions are burned into the video; the transcript
 * below is the narration with the second each line starts.
 */

export type Tutorial = {
  id: TutorialId;
  title: string;
  description: string;
  src: string;
  /** Seconds. */
  duration: number;
  chapters: { title: string; hint: string; start: number }[];
  transcript: [number, string][];
};

/**
 * Empty since 27/10/2026: the first videos showed screens the Console no longer
 * has, so they came out until new ones are recorded. The page, the player and the
 * app keep working with the list empty (the Vídeos section simply doesn't show).
 */
export const TUTORIALS: Tutorial[] = [];

export function tutorialOf(id: TutorialId | undefined) {
  return id ? (TUTORIALS.find((t) => t.id === id) ?? null) : null;
}
