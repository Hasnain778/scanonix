import type { ScanAnalysisPromptPayload } from "@/lib/ai/scan-analysis/types";

/** Shared system prompt — reused for every scan analysis request. */
export const SCAN_ANALYSIS_SYSTEM_PROMPT = `You are Scanonix Security Analyst AI. Your job is to explain EXISTING scanner findings in clear language for security and business stakeholders.

STRICT RULES — violations are unacceptable:
1. Use ONLY the structured findings provided in the user message. Never analyse raw HTML, files, or URLs directly.
2. Never invent vulnerabilities, CVEs, malware names, breach claims, or findings not present in the input.
3. Never claim compromise, active exploitation, or malware infection unless the scanner finding explicitly supports it with evidence.
4. Every statement must map to one or more provided finding IDs. Reference finding titles when explaining priorities.
5. If scanner confidence is low or evidence is limited, say so explicitly in confidenceExplanation.
6. Do not add new finding IDs. Do not omit required fields.
7. Return valid JSON matching the requested schema exactly.

Output British English. Be concise but actionable.`;

export function buildScanAnalysisUserPrompt(payload: ScanAnalysisPromptPayload): string {
  return `Explain the following Scanonix scan results. Input contains ONLY verified scanner findings.

Target: ${payload.target}
Target type: ${payload.targetType}
Risk score: ${payload.riskScore}/100
${payload.intelligenceSummary ? `Scanner summary: ${payload.intelligenceSummary}\n` : ""}${payload.domainReputationSummary ? `Domain reputation: ${payload.domainReputationSummary}\n` : ""}
Findings JSON:
${JSON.stringify(payload.findings, null, 2)}

Return JSON with this exact shape:
{
  "findings": [
    {
      "id": "<must match an input finding id exactly>",
      "plainEnglishExplanation": "<non-technical explanation>",
      "whyItMatters": "<why this finding matters>",
      "businessImpact": "<business/operational impact>",
      "technicalImpact": "<technical/security impact>",
      "remediationSteps": ["<step 1>", "<step 2>"],
      "estimatedDifficulty": "easy|moderate|hard",
      "estimatedRiskReduction": <number 1-35>,
      "confidenceExplanation": "<explain confidence based on scanner evidence; note uncertainty if low>",
      "priority": "critical|high|medium|low"
    }
  ],
  "report": {
    "executiveSummary": "<2-3 sentences for executives; reference finding count and risk score>",
    "technicalSummary": "<2-4 sentences for engineers; reference categories and severities from findings>",
    "topPriorities": ["<priority tied to finding title>", "..."],
    "overallSecurityPosture": "<assessment based on risk score and findings only>",
    "immediateActions": ["<action tied to critical/high findings>"],
    "longTermRecommendations": ["<sustainable improvements from medium/low findings>"]
  }
}

Include an entry in "findings" for every input finding ID. Do not invent additional findings.`;
}
