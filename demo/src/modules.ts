import type { AgentModule } from "./HomeModules";

/** 当前工作台开放询盘处理入口 */
export const ACTIVE_MODULES: AgentModule[] = ["inquiry"];

export function isModuleOpen(module: AgentModule) {
  return ACTIVE_MODULES.includes(module);
}
