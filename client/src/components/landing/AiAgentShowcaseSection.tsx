import { AgentGovernanceMonitor } from "./AgentGovernanceMonitor";

export function AiAgentShowcaseSection({ isStandalonePage = false }: { isStandalonePage?: boolean }) {
  return <AgentGovernanceMonitor isStandalonePage={isStandalonePage} />;
}
