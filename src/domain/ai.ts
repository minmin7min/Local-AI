export interface Evidence { id: string; kind: "document" | "record"; text: string; title: string; version?: number; section?: string; page?: number; updatedAt: string }
export interface GroundedAnswer { answer: string; evidenceIds: string[]; factualStatement: string; guidance?: string }
export interface AIProvider { answer(question: string, evidence: readonly Evidence[]): Promise<GroundedAnswer> }
export const NO_ANSWER = "I could not find an approved company policy that answers this question. Please contact your manager or HR.";
export class DeterministicProvider implements AIProvider {
  async answer(_question: string, evidence: readonly Evidence[]): Promise<GroundedAnswer> {
    if (evidence.length === 0) return { answer: NO_ANSWER, evidenceIds: [], factualStatement: NO_ANSWER };
    const first = evidence[0]!;
    return { answer: first.text, factualStatement: first.text, evidenceIds: [first.id] };
  }
}
export function validateAnswer(answer: GroundedAnswer, evidence: readonly Evidence[]): GroundedAnswer {
  const allowed = new Set(evidence.map((item) => item.id));
  if (answer.evidenceIds.some((id) => !allowed.has(id))) throw new Error("AI returned an invalid citation");
  if (evidence.length === 0 && answer.answer !== NO_ANSWER) throw new Error("Ungrounded answer rejected");
  return answer;
}
