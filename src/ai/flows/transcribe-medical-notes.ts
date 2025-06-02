
/**
 * @fileOverview This file defines a Genkit flow for transcribing medical notes into a clean, readable format.
 *
 * - transcribeMedicalNotes - A function that handles the transcription process.
 * - TranscribeMedicalNotesInput - The input type for the transcribeMedicalNotes function.
 * - TranscribeMedicalNotesOutput - The return type for the transcribeMedicalNotes function.
 */

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranscribeMedicalNotesInputSchema = z.object({
  notes: z
    .string()
    .describe('The doctor\u2019s notes, either as text or a link to an audio file.'),
});

export type TranscribeMedicalNotesInput = z.infer<typeof TranscribeMedicalNotesInputSchema>;

const TranscribeMedicalNotesOutputSchema = z.object({
  transcription: z
    .string()
    .describe('The transcribed notes in a clear, readable format, free of acronyms and jargon.'),
});

export type TranscribeMedicalNotesOutput = z.infer<typeof TranscribeMedicalNotesOutputSchema>;

export async function transcribeMedicalNotes(input: TranscribeMedicalNotesInput): Promise<TranscribeMedicalNotesOutput> {
  return transcribeMedicalNotesFlow(input);
}

const transcribeMedicalNotesPrompt = ai.definePrompt({
  name: 'transcribeMedicalNotesPrompt',
  input: {schema: TranscribeMedicalNotesInputSchema},
  output: {schema: TranscribeMedicalNotesOutputSchema},
  prompt: `You are a medical scribe. Please transcribe the following doctor's notes into a clear, readable format, removing acronyms and jargon.

Notes: {{{notes}}}`,
});

const transcribeMedicalNotesFlow = ai.defineFlow(
  {
    name: 'transcribeMedicalNotesFlow',
    inputSchema: TranscribeMedicalNotesInputSchema,
    outputSchema: TranscribeMedicalNotesOutputSchema,
  },
  async input => {
    const response = await transcribeMedicalNotesPrompt(input);
    if (!response.output) {
      console.error(
        `Genkit prompt '${transcribeMedicalNotesPrompt.name}' did not return the expected output. Input: ${JSON.stringify(input, null, 2)}. Full response: ${JSON.stringify(response, null, 2)}`
      );
      throw new Error(
        `The AI model failed to generate a valid response for prompt '${transcribeMedicalNotesPrompt.name}'.`
      );
    }
    return response.output;
  }
);
