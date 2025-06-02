/**
 * @fileOverview This file defines a function for transcribing medical notes into a clean, readable format using OpenAI.
 *
 * - transcribeMedicalNotes - A function that handles the transcription process.
 * - TranscribeMedicalNotesInput - The input type for the transcribeMedicalNotes function.
 * - TranscribeMedicalNotesOutput - The return type for the transcribeMedicalNotes function.
 */

"use server";

import { openai } from "@/ai/openai";
import { z } from "zod";

const TranscribeMedicalNotesInputSchema = z.object({
  notes: z
    .string()
    .describe("The doctor's notes, either as text or a link to an audio file."),
});

export type TranscribeMedicalNotesInput = z.infer<
  typeof TranscribeMedicalNotesInputSchema
>;

const TranscribeMedicalNotesOutputSchema = z.object({
  transcription: z
    .string()
    .describe(
      "The transcribed notes in a clear, readable format, free of acronyms and jargon.",
    ),
});

export type TranscribeMedicalNotesOutput = z.infer<
  typeof TranscribeMedicalNotesOutputSchema
>;

export async function transcribeMedicalNotes(
  input: TranscribeMedicalNotesInput,
): Promise<TranscribeMedicalNotesOutput> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            'You are a medical scribe. Please transcribe the following doctor\'s notes into a clear, readable format, removing acronyms and jargon. Respond with a JSON object with a "transcription" field containing the transcribed notes.',
        },
        {
          role: "user",
          content: `Notes: ${input.notes}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    const validatedOutput = TranscribeMedicalNotesOutputSchema.parse(result);

    return validatedOutput;
  } catch (error) {
    console.error(
      `OpenAI transcribeMedicalNotes failed. Input: ${JSON.stringify(input, null, 2)}. Error: ${error}`,
    );
    throw new Error(
      `The AI model failed to generate a valid response for transcribeMedicalNotes.`,
    );
  }
}
