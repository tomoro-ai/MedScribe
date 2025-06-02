// src/ai/flows/assess-condition-severity.ts
"use server";
/**
 * @fileOverview Assigns a severity level (low, medium, high) to each identified condition
 * based on the transcribed notes using OpenAI.
 *
 * - assessConditionSeverity - A function that handles the severity assessment process.
 * - AssessConditionSeverityInput - The input type for the assessConditionSeverity function.
 * - AssessConditionSeverityOutput - The return type for the assessConditionSeverity function.
 */

import { openai } from "@/ai/openai";
import { z } from "zod";

const AssessConditionSeverityInputSchema = z.object({
  condition: z.string().describe("The medical condition to assess."),
  notes: z
    .string()
    .describe("The transcribed doctor's notes related to the condition."),
});
export type AssessConditionSeverityInput = z.infer<
  typeof AssessConditionSeverityInputSchema
>;

const AssessConditionSeverityOutputSchema = z.object({
  severity: z
    .enum(["low", "medium", "high"])
    .describe("The assessed severity level of the condition."),
  reason: z.string().describe("The reasoning behind the severity assessment."),
});
export type AssessConditionSeverityOutput = z.infer<
  typeof AssessConditionSeverityOutputSchema
>;

export async function assessConditionSeverity(
  input: AssessConditionSeverityInput,
): Promise<AssessConditionSeverityOutput> {
  try {
    const prompt = `You are an expert medical professional tasked with assessing the severity of a medical condition based on doctor's notes.

Condition: ${input.condition}
Notes: ${input.notes}

Assess the severity of the condition as either "low", "medium", or "high". Provide a brief reason for your assessment.
Consider cross-referencing medical databases and using your reasoning ability to identify likely severity levels based on the provided information.
Return the severity and reason in the JSON format with keys "severity" and "reason".`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are an expert medical professional who assesses the severity of medical conditions. Always respond with valid JSON.",
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

    const validatedOutput = AssessConditionSeverityOutputSchema.parse(result);

    return validatedOutput;
  } catch (error) {
    console.error(
      `OpenAI assessConditionSeverity failed. Input: ${JSON.stringify(input, null, 2)}. Error: ${error}`,
    );
    throw new Error(
      `The AI model failed to generate a valid response for assessConditionSeverity.`,
    );
  }
}
