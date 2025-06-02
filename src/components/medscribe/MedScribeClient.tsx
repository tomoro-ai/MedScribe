
"use client";

import type { MapConditionsToInsuranceCodesOutput } from '@/ai/flows/map-conditions-to-insurance-codes';
import { mapConditionsToInsuranceCodes } from '@/ai/flows/map-conditions-to-insurance-codes';
import type { MapProceduresToInsuranceCodesOutput } from '@/ai/flows/map-procedures-to-insurance-codes';
import { mapProceduresToInsuranceCodes } from '@/ai/flows/map-procedures-to-insurance-codes';
import { assessConditionSeverity } from '@/ai/flows/assess-condition-severity';
import { transcribeMedicalNotes } from '@/ai/flows/transcribe-medical-notes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, FilePenLine, FileText, Gauge, ListChecks, Loader2, Stethoscope, BarChartHorizontalBig, ClipboardList } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import type { AssessConditionSeverityOutput } from '@/ai/flows/assess-condition-severity';

type ConditionCodeMappingItem = MapConditionsToInsuranceCodesOutput['conditionCodeMappings'][number];

interface SeverityAssessmentResult extends AssessConditionSeverityOutput, Omit<ConditionCodeMappingItem, 'condition' | 'icdCode' | 'confidence' > {
  condition: string;
  icdCode: string;
  conditionCategory: string;
  confidence: number;
}

export default function MedScribeClient() {
  const [notesInput, setNotesInput] = useState<string>("");
  const [transcribedNotes, setTranscribedNotes] = useState<string | null>(null);
  const [codeMappings, setCodeMappings] = useState<MapConditionsToInsuranceCodesOutput['conditionCodeMappings'] | null>(null);
  const [procedureMappings, setProcedureMappings] = useState<MapProceduresToInsuranceCodesOutput['procedureCodeMappings'] | null>(null);
  const [severityAssessments, setSeverityAssessments] = useState<SeverityAssessmentResult[] | null>(null);
  const [expandedCodeMappingRows, setExpandedCodeMappingRows] = useState<Record<number, boolean>>({});
  const [expandedProcedureMappingRows, setExpandedProcedureMappingRows] = useState<Record<number, boolean>>({});


  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Operational Analytics State
  const [totalProcessingTimeMs, setTotalProcessingTimeMs] = useState<number | null>(null);
  const [notesInputLength, setNotesInputLength] = useState<number | null>(null);
  const [transcribedNotesLength, setTranscribedNotesLength] = useState<number | null>(null);
  const [identifiedConditionsCount, setIdentifiedConditionsCount] = useState<number | null>(null);
  const [identifiedProceduresCount, setIdentifiedProceduresCount] = useState<number | null>(null);


  const toggleCodeMappingRow = (index: number) => {
    setExpandedCodeMappingRows(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleProcedureMappingRow = (index: number) => {
    setExpandedProcedureMappingRows(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleProcessNotes = async () => {
    if (!notesInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter some medical notes to process.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setCurrentStep("Starting processing..."); 
    setTranscribedNotes(null);
    setCodeMappings(null);
    setProcedureMappings(null);
    setSeverityAssessments(null);
    setExpandedCodeMappingRows({});
    setExpandedProcedureMappingRows({});

    // Reset analytics states
    setTotalProcessingTimeMs(null);
    setNotesInputLength(null);
    setTranscribedNotesLength(null);
    setIdentifiedConditionsCount(null);
    setIdentifiedProceduresCount(null);


    const startTime = performance.now();
    setNotesInputLength(notesInput.trim().length);

    try {
      // Step 1: Transcribe Notes
      setCurrentStep("Transcribing notes...");
      const transcriptionResult = await transcribeMedicalNotes({ notes: notesInput });
      setTranscribedNotes(transcriptionResult.transcription);
      setTranscribedNotesLength(transcriptionResult.transcription.length);

      // Step 2a: Map Conditions to ICD Codes
      setCurrentStep("Mapping conditions to ICD codes...");
      const codesResult = await mapConditionsToInsuranceCodes({ transcribedNotes: transcriptionResult.transcription });
      setCodeMappings(codesResult.conditionCodeMappings);
      if (codesResult.conditionCodeMappings) {
        setIdentifiedConditionsCount(codesResult.conditionCodeMappings.length);
      }
      
      // Step 2b: Map Procedures to ICD Codes
      setCurrentStep("Mapping procedures to ICD codes...");
      const proceduresResult = await mapProceduresToInsuranceCodes({ transcribedNotes: transcriptionResult.transcription });
      setProcedureMappings(proceduresResult.procedureCodeMappings);
       if (proceduresResult.procedureCodeMappings) {
        setIdentifiedProceduresCount(proceduresResult.procedureCodeMappings.length);
      }


      // Step 3: Assess Condition Severity (only for conditions)
      if (codesResult.conditionCodeMappings && codesResult.conditionCodeMappings.length > 0) {
        setCurrentStep("Assessing condition severity...");
        const assessments: SeverityAssessmentResult[] = [];
        for (const mapping of codesResult.conditionCodeMappings) {
          const severityResult = await assessConditionSeverity({
            condition: mapping.condition,
            notes: transcriptionResult.transcription,
          });
          assessments.push({
            ...mapping, 
            severity: severityResult.severity,
            reason: severityResult.reason,
          });
        }
        setSeverityAssessments(assessments);
      } else {
        setSeverityAssessments([]); 
      }

      setCurrentStep(null);
      toast({
        title: "Processing Complete",
        description: "Medical notes processed successfully.",
      });
    } catch (error) {
      console.error("Processing error:", error);
      toast({
        title: "Error Processing Notes",
        description: error instanceof Error ? error.message : "An unknown error occurred. Please try again.",
        variant: "destructive",
      });
      setCurrentStep(null);
    } finally {
      const endTime = performance.now();
      setTotalProcessingTimeMs(endTime - startTime);
      setIsLoading(false);
    }
  };

  const renderSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low':
        return <Badge className="bg-accent text-accent-foreground capitalize">{severity}</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="capitalize">{severity}</Badge>;
      case 'high':
        return <Badge variant="destructive" className="capitalize">{severity}</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{severity}</Badge>;
    }
  };
  
  const showResultsSection = isLoading || transcribedNotes || codeMappings || procedureMappings || severityAssessments || totalProcessingTimeMs !== null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-primary">MedScribe AI</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-8">
        <Card className="mb-8 shadow-lg" id="notes-input-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FilePenLine className="h-6 w-6 text-primary" />
              <CardTitle className="text-xl">Doctor's Notes Input</CardTitle>
            </div>
            <CardDescription>Enter the raw medical notes below for AI processing.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste or type doctor's notes here... e.g., Pt c/o SOB, Hx HTN. CXR WNL. Plan: F/U w/ pulm. Order EKG."
              rows={10}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className="mb-4 text-base border-input focus:ring-ring focus:border-primary"
              disabled={isLoading}
            />
            <Button onClick={handleProcessNotes} disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {currentStep || "Processing..."}
                </>
              ) : (
                "Process Notes"
              )}
            </Button>
          </CardContent>
        </Card>

        {showResultsSection && (
          <div className="space-y-8">
            {/* Transcription Section */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-6 w-6 text-primary" />
                  <CardTitle className="text-xl">Transcribed Notes</CardTitle>
                </div>
                <CardDescription>Cleaned and readable version of the medical notes.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && !transcribedNotes ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : transcribedNotes ? (
                  <p className="whitespace-pre-wrap text-muted-foreground">{transcribedNotes}</p>
                ) : !isLoading && notesInputLength !== null ? ( 
                  <p className="text-muted-foreground">No transcription available or processing step not reached.</p>
                ) : null }
              </CardContent>
            </Card>

            {/* Condition Code Mapping Section */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ListChecks className="h-6 w-6 text-primary" />
                  <CardTitle className="text-xl">Diagnostic Code Mapping (Conditions)</CardTitle>
                </div>
                 <CardDescription>Identified medical conditions mapped to ICD codes. Click row to expand.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && !codeMappings && transcribedNotes ? (
                   <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : codeMappings && codeMappings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>ICD Code</TableHead>
                          <TableHead className="text-right">Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {codeMappings.map((mapping, index) => (
                          <React.Fragment key={`condition-${index}`}>
                            <TableRow onClick={() => toggleCodeMappingRow(index)} className="cursor-pointer">
                              <TableCell>
                                <Button variant="ghost" size="sm" className="w-9 p-0">
                                  {expandedCodeMappingRows[index] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </TableCell>
                              <TableCell className="font-medium">{mapping.condition}</TableCell>
                              <TableCell>{mapping.conditionCategory}</TableCell>
                              <TableCell>{mapping.icdCode}</TableCell>
                              <TableCell className="text-right">{(mapping.confidence * 100).toFixed(0)}%</TableCell>
                            </TableRow>
                            {expandedCodeMappingRows[index] && ( 
                              <TableRow>
                                <TableCell colSpan={5} className="p-4 bg-muted/50">
                                  <div className="space-y-3">
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">Source Text Snippet:</p>
                                      <p className="text-xs text-muted-foreground italic mt-1">"{mapping.sourceText}"</p>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">Justification:</p>
                                      <p className="text-xs text-muted-foreground mt-1">{mapping.justification}</p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : transcribedNotes && !isLoading ? (
                  <p className="text-muted-foreground">No ICD code mappings identified or processing step not reached.</p>
                ) : null}
              </CardContent>
            </Card>

            {/* Procedure Code Mapping Section */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-6 w-6 text-primary" />
                  <CardTitle className="text-xl">Diagnostic Code Mapping (Procedures)</CardTitle>
                </div>
                 <CardDescription>Identified medical procedures mapped to ICD codes. Click row to expand.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && !procedureMappings && transcribedNotes ? (
                   <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : procedureMappings && procedureMappings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Procedure</TableHead>
                          <TableHead>ICD Code</TableHead>
                          <TableHead className="text-right">Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {procedureMappings.map((mapping, index) => (
                          <React.Fragment key={`procedure-${index}`}>
                            <TableRow onClick={() => toggleProcedureMappingRow(index)} className="cursor-pointer">
                              <TableCell>
                                <Button variant="ghost" size="sm" className="w-9 p-0">
                                  {expandedProcedureMappingRows[index] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </TableCell>
                              <TableCell className="font-medium">{mapping.procedure}</TableCell>
                              <TableCell>{mapping.icdCode}</TableCell>
                              <TableCell className="text-right">{(mapping.confidence * 100).toFixed(0)}%</TableCell>
                            </TableRow>
                            {expandedProcedureMappingRows[index] && (
                              <TableRow>
                                <TableCell colSpan={4} className="p-4 bg-muted/50">
                                  <div className="space-y-3">
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">Source Text Snippet:</p>
                                      <p className="text-xs text-muted-foreground italic mt-1">"{mapping.sourceText}"</p>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">Justification:</p>
                                      <p className="text-xs text-muted-foreground mt-1">{mapping.justification}</p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : transcribedNotes && !isLoading ? (
                  <p className="text-muted-foreground">No procedure ICD code mappings identified or processing step not reached.</p>
                ) : null}
              </CardContent>
            </Card>


            {/* Severity Assessment Section */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Gauge className="h-6 w-6 text-primary" />
                  <CardTitle className="text-xl">Condition Severity Assessment</CardTitle>
                </div>
                <CardDescription>Severity levels assigned to identified conditions.</CardDescription>
              </CardHeader>
              <CardContent>
                 {isLoading && !severityAssessments && codeMappings && codeMappings.length > 0 ? (
                   <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : severityAssessments && severityAssessments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Condition</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Reasoning</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {severityAssessments.map((assessment, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{assessment.condition}</TableCell>
                            <TableCell>{assessment.conditionCategory}</TableCell>
                            <TableCell>{renderSeverityBadge(assessment.severity)}</TableCell>
                            <TableCell>{assessment.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : codeMappings && codeMappings.length > 0 && !isLoading ? (
                  <p className="text-muted-foreground">No severity assessments available or processing step not reached.</p>
                ) : null}
              </CardContent>
            </Card>

            {/* Processing Analytics Section */}
            {(isLoading && notesInputLength !== null) || totalProcessingTimeMs !== null ? (
              <Card className="shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChartHorizontalBig className="h-6 w-6 text-primary" />
                    <CardTitle className="text-xl">Processing Analytics</CardTitle>
                  </div>
                  <CardDescription>Details about the AI processing task.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading && totalProcessingTimeMs === null ? (
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Processing Time:</span><Skeleton className="h-4 w-1/4" /></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Input Notes Length:</span>{notesInputLength !== null ? <strong>{notesInputLength} characters</strong> : <Skeleton className="h-4 w-1/4" />}</div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Transcribed Text Length:</span><Skeleton className="h-4 w-1/4" /></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Conditions Mapped:</span><Skeleton className="h-4 w-1/4" /></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Procedures Mapped:</span><Skeleton className="h-4 w-1/4" /></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Severities Assessed:</span><Skeleton className="h-4 w-1/4" /></div>
                    </div>
                  ) : totalProcessingTimeMs !== null ? (
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">Total Processing Time:</span>
                        <strong>{(totalProcessingTimeMs / 1000).toFixed(2)} seconds</strong>
                      </li>
                      {notesInputLength !== null && (
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">Input Notes Length:</span>
                          <strong>{notesInputLength} characters</strong>
                        </li>
                      )}
                      {transcribedNotesLength !== null && (
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">Transcribed Text Length:</span>
                          <strong>{transcribedNotesLength} characters</strong>
                        </li>
                      )}
                      {identifiedConditionsCount !== null && (
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">Conditions Mapped:</span>
                          <strong>{identifiedConditionsCount}</strong>
                        </li>
                      )}
                      {identifiedProceduresCount !== null && (
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">Procedures Mapped:</span>
                          <strong>{identifiedProceduresCount}</strong>
                        </li>
                      )}
                      {severityAssessments && ( severityAssessments.length > 0 || (identifiedConditionsCount !== null && identifiedConditionsCount > 0 )) && ( 
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">Severities Assessed:</span>
                          <strong>{severityAssessments.length}</strong>
                        </li>
                      )}
                    </ul>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </main>
      <footer className="py-8 text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} MedScribe AI. All rights reserved.</p>
      </footer>
    </div>
  );
}

