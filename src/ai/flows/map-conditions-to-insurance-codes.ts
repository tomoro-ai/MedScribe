// src/ai/flows/map-conditions-to-insurance-codes.ts
"use server";
/**
 * @fileOverview Maps medical conditions extracted from transcribed notes to relevant ICD codes using OpenAI,
 * including source text snippets, justifications, and condition categories.
 *
 * - mapConditionsToInsuranceCodes - A function that maps medical conditions to ICD codes.
 * - MapConditionsToInsuranceCodesInput - The input type for the mapConditionsToInsuranceCodes function.
 * - MapConditionsToInsuranceCodesOutput - The return type for the mapConditionsToInsuranceCodes function.
 */

import { openai } from "@/ai/openai";
import { z } from "zod";

const MapConditionsToInsuranceCodesInputSchema = z.object({
  transcribedNotes: z
    .string()
    .describe("The transcribed doctor's notes to be analyzed."),
});
export type MapConditionsToInsuranceCodesInput = z.infer<
  typeof MapConditionsToInsuranceCodesInputSchema
>;

const MapConditionsToInsuranceCodesOutputSchema = z.object({
  conditionCodeMappings: z.array(
    z.object({
      condition: z.string().describe("The medical condition identified."),
      icdCode: z
        .string()
        .describe(
          "The corresponding ICD (International Classification of Diseases) code.",
        ),
      conditionCategory: z
        .string()
        .describe(
          'The classification of the condition (e.g., "Primary Diagnosis", "Secondary Diagnosis", "Comorbidity", "Symptom").',
        ),
      confidence: z
        .number()
        .describe(
          "A confidence score (0-1) indicating the relevance of the mapping.",
        ),
      sourceText: z
        .string()
        .describe(
          "A brief, relevant verbatim snippet from the original notes that supports the identified condition (max 100 characters).",
        ),
      justification: z
        .string()
        .describe(
          "A brief explanation (max 150 characters) for why this ICD code was chosen for the identified condition based on the notes.",
        ),
    }),
  ),
});
export type MapConditionsToInsuranceCodesOutput = z.infer<
  typeof MapConditionsToInsuranceCodesOutputSchema
>;

export async function mapConditionsToInsuranceCodes(
  input: MapConditionsToInsuranceCodesInput,
): Promise<MapConditionsToInsuranceCodesOutput> {
  try {
    const prompt = `You are an expert medical coder. Given the following transcribed doctor's notes:

Transcribed Notes: ${input.transcribedNotes}

Identify the medical conditions mentioned. For each condition:
1. Map it to the most relevant ICD (International Classification of Diseases) code.
2. Classify the condition (e.g., 'Primary Diagnosis', 'Secondary Diagnosis', 'Comorbidity', 'Symptom'). Use your clinical judgment to determine the most appropriate category based on the notes.
3. Include a confidence score (0-1) for each mapping.
4. Provide a 'sourceText' field containing a brief, relevant verbatim snippet from the original notes that supports the identified condition (max 100 characters).
5. Provide a 'justification' field (max 150 characters) explaining why this ICD code was chosen for the identified condition based on the notes.

Prioritize mentions that are likely to be relevant for billing and clinical documentation.
Where possible, prioritize ICD codes relevant to the Singaporean healthcare market if there are regional variations.

Format your response as a JSON object with a key "conditionCodeMappings" containing an array of objects. Each object must include 'condition', 'icdCode', 'conditionCategory', 'confidence', 'sourceText', and 'justification'.
If no conditions are identified, return an empty array for "conditionCodeMappings".`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are an expert medical coder who maps medical conditions to ICD codes. Always respond with valid JSON.",
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
      MapConditionsToInsuranceCodesOutputSchema.parse(result);

    return validatedOutput;
  } catch (error) {
    console.error(
      `OpenAI mapConditionsToInsuranceCodes failed. Input: ${JSON.stringify(input, null, 2)}. Error: ${error}`,
    );
    throw new Error(
      `The AI model failed to generate a valid response for mapConditionsToInsuranceCodes.`,
    );
  }
}
