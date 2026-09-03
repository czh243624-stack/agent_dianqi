import type { Brief, ConfirmScriptRequest, VideoJob } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("短视频服务暂不可用，请先启动 video-agent-demo 后端（端口 8787）");
  }
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `请求失败：${response.status}`);
  }
  return payload;
}

export async function createVideoJob(brief: Brief): Promise<VideoJob> {
  const payload = await request<{ job: VideoJob }>("/api/video-jobs", {
    method: "POST",
    body: JSON.stringify({ brief }),
  });
  return payload.job;
}

export async function confirmVideoScript(jobId: string, body: ConfirmScriptRequest): Promise<VideoJob> {
  const payload = await request<{ job: VideoJob }>(`/api/video-jobs/${jobId}/confirm-script`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return payload.job;
}

export async function approveVideoJob(jobId: string, checks: string[]): Promise<VideoJob> {
  const payload = await request<{ job: VideoJob }>(`/api/video-jobs/${jobId}/approve`, {
    method: "POST",
    body: JSON.stringify({ checks }),
  });
  return payload.job;
}

export async function scheduleVideoJob(jobId: string): Promise<VideoJob> {
  const payload = await request<{ job: VideoJob }>(`/api/video-jobs/${jobId}/schedule`, {
    method: "POST",
  });
  return payload.job;
}
