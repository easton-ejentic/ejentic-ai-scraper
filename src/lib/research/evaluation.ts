export type EvaluationDimension =
  | "labor"
  | "repetition"
  | "informationSupport"
  | "scalability"
  | "economicConsequence"
  | "aiPlausibility"
  | "strategicAdvantage";

export interface WorkflowEvaluation {
  labor: number;
  repetition: number;
  informationSupport: number;
  scalability: number;
  economicConsequence: number;
  aiPlausibility: number;
  strategicAdvantage: number;
  overallScore: number;
  confidence: number;
  methodology: "heuristic-v1";
  evaluatedAt: string;
}

export interface EvaluationInput {
  confidence: number;
  signals: string[];
  evidenceCount: number;
  sourceCount: number;
  workflowName: string;
  description: string;
}

const clamp = (value: number, min = 0, max = 10) =>
  Math.max(min, Math.min(max, value));

function hasSignal(signals: string[], signal: string) {
  return signals.includes(signal);
}

/**
 * Development-stage scoring model.
 *
 * The seven dimensions mirror the Ejentic evaluation framework established in
 * the project. Equal weighting is intentionally provisional until the business
 * methodology is finalized. The output is therefore labeled heuristic-v1 and
 * should not be presented as a final sales qualification decision.
 */
export function evaluateWorkflow(input: EvaluationInput): WorkflowEvaluation {
  const signals = input.signals.map((signal) => signal.toLowerCase());
  const evidenceBonus = clamp(input.evidenceCount * 0.35, 0, 1.5);
  const sourceBonus = clamp(input.sourceCount * 0.25, 0, 1);
  const confidence = clamp(input.confidence, 0, 1);

  const labor = clamp(
    5 +
      (hasSignal(signals, "labor") ? 2 : 0) +
      (hasSignal(signals, "documents") ? 0.75 : 0) +
      evidenceBonus,
  );

  const repetition = clamp(
    4.5 +
      (hasSignal(signals, "repetition") ? 3 : 0) +
      sourceBonus,
  );

  const informationSupport = clamp(
    5 +
      (hasSignal(signals, "information") ? 2.5 : 0) +
      (hasSignal(signals, "documents") ? 0.75 : 0) +
      evidenceBonus,
  );

  const scalability = clamp(
    4.5 +
      (hasSignal(signals, "repetition") ? 1.5 : 0) +
      (hasSignal(signals, "information") ? 1 : 0) +
      sourceBonus,
  );

  const economicConsequence = clamp(
    4 +
      (hasSignal(signals, "economic-impact") ? 3 : 0) +
      (hasSignal(signals, "labor") ? 0.75 : 0) +
      evidenceBonus * 0.5,
  );

  const aiPlausibility = clamp(
    4.5 +
      (hasSignal(signals, "labor") ? 1.25 : 0) +
      (hasSignal(signals, "repetition") ? 1.5 : 0) +
      (hasSignal(signals, "information") ? 1.5 : 0) +
      evidenceBonus,
  );

  const strategicAdvantage = clamp(
    4 +
      (hasSignal(signals, "economic-impact") ? 1.5 : 0) +
      (hasSignal(signals, "information") ? 0.75 : 0) +
      (hasSignal(signals, "repetition") ? 0.75 : 0) +
      sourceBonus,
  );

  const dimensions = [
    labor,
    repetition,
    informationSupport,
    scalability,
    economicConsequence,
    aiPlausibility,
    strategicAdvantage,
  ];

  const overallScore = Number(
    (dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length * 10).toFixed(1),
  );

  return {
    labor: Number(labor.toFixed(1)),
    repetition: Number(repetition.toFixed(1)),
    informationSupport: Number(informationSupport.toFixed(1)),
    scalability: Number(scalability.toFixed(1)),
    economicConsequence: Number(economicConsequence.toFixed(1)),
    aiPlausibility: Number(aiPlausibility.toFixed(1)),
    strategicAdvantage: Number(strategicAdvantage.toFixed(1)),
    overallScore,
    confidence: Number((confidence * 0.7 + Math.min(1, input.evidenceCount / 6) * 0.3).toFixed(2)),
    methodology: "heuristic-v1",
    evaluatedAt: new Date().toISOString(),
  };
}
