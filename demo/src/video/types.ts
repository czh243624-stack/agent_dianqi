export type AspectRatio = "9:16" | "16:9" | "1:1";
export type Platform = "TikTok" | "YouTube Shorts" | "YouTube";

export type PipelineStatus =
  | "idle"
  | "drafting"
  | "script"
  | "building"
  | "review"
  | "approved"
  | "scheduled"
  | "failed";

export type Brief = {
  product: string;
  sellingPoints: string;
  audience: string;
  platform: Platform;
  aspectRatio: AspectRatio;
  duration: number;
  voice: string;
  language: string;
};

export type ScriptOption = {
  id: string;
  title: string;
  angle: string;
  script: string;
};

export type Scene = {
  id: string;
  time: string;
  title: string;
  voiceover: string;
  visual: string;
  overlay: string;
  renderTool: "HyperFrames" | "ComfyUI" | "FFmpeg";
};

export type AssetTask = {
  id: string;
  owner: "RAG" | "TTS" | "ComfyUI" | "HyperFrames" | "FFmpeg";
  task: string;
  status: "ready" | "needs_review" | "blocked";
  note: string;
};

export type KnowledgeSource = {
  id: string;
  title: string;
  type: "product" | "certification" | "lead_time" | "quote_rule" | "brand_rule";
  snippet: string;
  sourceUri?: string;
};

export type VideoPlan = {
  selectedScript: string;
  hook: string;
  title: string;
  caption: string;
  hashtags: string[];
  ssml: string;
  scenes: Scene[];
  assetTasks: AssetTask[];
  checks: string[];
  publishCopy: Record<Platform, string>;
  sources: KnowledgeSource[];
};

export type AuditLogEntry = {
  at: string;
  actor: "system" | "operator";
  action: string;
  detail?: string;
};

export type VideoJob = {
  id: string;
  status: PipelineStatus;
  brief: Brief;
  scriptOptions: ScriptOption[];
  selectedScriptId?: string;
  selectedScript?: string;
  plan?: VideoPlan;
  approvedChecks: string[];
  auditLog: AuditLogEntry[];
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type ConfirmScriptRequest = {
  scriptId?: string;
  manualScript?: string;
};
