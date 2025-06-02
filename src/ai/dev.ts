import { config } from 'dotenv';
config();

import '@/ai/flows/map-conditions-to-insurance-codes.ts';
import '@/ai/flows/transcribe-medical-notes.ts';
import '@/ai/flows/assess-condition-severity.ts';
import '@/ai/flows/map-procedures-to-insurance-codes.ts';
