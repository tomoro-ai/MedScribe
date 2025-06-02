// src/ai/flows/map-procedures-to-insurance-codes.ts
"use server";
/**
 * @fileOverview Maps medical procedures extracted from transcribed notes to relevant ICD codes using OpenAI,
 * including source text snippets and justifications for each mapping.
 *
 * - mapProceduresToInsuranceCodes - A function that maps medical procedures to ICD codes.
 * - MapProceduresToInsuranceCodesInput - The input type for the mapProceduresToInsuranceCodes function.
 * - MapProceduresToInsuranceCodesOutput - The return type for the mapProceduresToInsuranceCodes function.
 */

import { openai } from "@/ai/openai";
import { z } from "zod";

const MapProceduresToInsuranceCodesInputSchema = z.object({
  transcribedNotes: z
    .string()
    .describe("The transcribed doctor's notes to be analyzed for procedures."),
});
export type MapProceduresToInsuranceCodesInput = z.infer<
  typeof MapProceduresToInsuranceCodesInputSchema
>;

const MapProceduresToInsuranceCodesOutputSchema = z.object({
  procedureCodeMappings: z.array(
    z.object({
      procedure: z.string().describe("The medical procedure identified."),
      icdCode: z
        .string()
        .describe(
          "The corresponding ICD (International Classification of Diseases) code for the procedure.",
        ),
      confidence: z
        .number()
        .describe(
          "A confidence score (0-1) indicating the relevance of the mapping.",
        ),
      sourceText: z
        .string()
        .describe(
          "A brief, relevant verbatim snippet from the original notes that supports the identified procedure (max 100 characters).",
        ),
      justification: z
        .string()
        .describe(
          "A brief explanation (max 150 characters) for why this ICD code was chosen for the identified procedure based on the notes.",
        ),
    }),
  ),
});
export type MapProceduresToInsuranceCodesOutput = z.infer<
  typeof MapProceduresToInsuranceCodesOutputSchema
>;

export async function mapProceduresToInsuranceCodes(
  input: MapProceduresToInsuranceCodesInput,
): Promise<MapProceduresToInsuranceCodesOutput> {
  try {
    const prompt = `You are an expert medical coder specializing in procedures. Given the following transcribed doctor's notes, identify any medical procedures requested or mentioned and map them to the most relevant ICD (International Classification of Diseases) codes.

Where possible, prioritize ICD codes relevant to the Singaporean healthcare market.

Prioritize mentions that are likely to be relevant for billing purposes. Include a confidence score (0-1) for each mapping.
For each mapping, also include a 'sourceText' field containing a brief, relevant verbatim snippet from the original notes that supports the identified procedure (max 100 characters), and a 'justification' field (max 150 characters) explaining why the specific ICD code was chosen based on the notes.

Transcribed Notes: ${input.transcribedNotes}

Format your response as a JSON object with a key "procedureCodeMappings" containing an array of objects, where each object has "procedure", "icdCode", "confidence", "sourceText", and "justification" fields.
If no procedures are identified, return an empty array for "procedureCodeMappings".`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are an expert medical coder who maps medical procedures to ICD codes. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    const validatedOutput =
      MapProceduresToInsuranceCodesOutputSchema.parse(result);

    return validatedOutput;
  } catch (error) {
    console.error(
      `OpenAI mapProceduresToInsuranceCodes failed. Input: ${JSON.stringify(input, null, 2)}. Error: ${error}`,
    );
    throw new Error(
      `The AI model failed to generate a valid response for mapProceduresToInsuranceCodes.`,
    );
  }
}
