import { createFileRoute } from "@tanstack/react-router";

/**
 * Corti Dictation speech-to-text.
 * Accepts a complete audio file (multipart/form-data field `file`) and returns
 * the verbatim transcript.
 */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let audio: File | null = null;
        let language = "en";

        try {
          const form = await request.formData();
          const file = form.get("file");
          if (file instanceof File) audio = file;
          const lang = form.get("language");
          if (typeof lang === "string" && lang) language = lang;
        } catch {
          return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
        }

        if (!audio || audio.size < 2048) {
          return Response.json({ error: "Recording was empty — please try again." }, { status: 400 });
        }
        if (audio.size > 25 * 1024 * 1024) {
          return Response.json({ error: "Recording is too large." }, { status: 413 });
        }

        try {
          const { transcribeAudio } = await import("@/lib/corti.server");
          const { transcript, interactionId } = await transcribeAudio(await audio.arrayBuffer(), {
            language,
            identifier: `ante-intake-${Date.now()}`,
          });
          return Response.json({ transcript, interactionId });
        } catch (error) {
          console.error("Corti transcription failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Transcription failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
