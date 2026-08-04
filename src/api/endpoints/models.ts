import { request } from "../client";
import type { ModelRefDto, ModelsResponse, ModelsUpdateRequest } from "../types";

/**
 * Project-level model & credential config: `/api/projects/:projectId/models`.
 *
 * A model's identity is the PAIR `(provider, modelId)` — string concatenation into
 * `provider/id` is forbidden throughout the pipeline, which is also why the connectivity
 * test takes the reference in its body rather than in the URL.
 *
 * `apiKey` never travels back to the client: GET returns `credential.apiKeyMasked`.
 */
const enc = encodeURIComponent;

const base = (projectId: string) => `/api/projects/${enc(projectId)}/models`;

/** Structural alias — `ModelUpdateEntry` is not re-exported from api/types. */
type ModelUpdateEntry = ModelsUpdateRequest["models"][number];
type ModelInfoDto = ModelsResponse["models"][number];

/**
 * POST /models/test body, exactly as the route validates it
 * (vendor `http/routes/models.ts` → `ModelTestRequest`):
 *   provider / modelId  required, the pair under test
 *   apiKey              plaintext draft key; an empty string is dropped by the server
 *   clearApiKey         test against the draft, ignoring the stored key
 *   speed               raises the probe's output cap (16 -> 64 tokens) to measure TTFT/TPS
 *   baseUrl             string = use it, null = explicitly clear, omitted = fall back to
 *                       the stored value. The server coerces "" to null.
 *   clientType          AgentHub protocol; required for unsaved custom models
 */
export interface ModelTestRequest {
  provider: string;
  modelId: string;
  apiKey?: string;
  clearApiKey?: boolean;
  speed?: boolean;
  baseUrl?: string | null;
  clientType?: string;
}

export interface ModelTestResponse {
  ok: boolean;
  latencyMs?: number;
  /** Time to the first streamed content, ms. */
  ttftMs?: number;
  /** Output tokens/second; omitted when the sample was too small to be meaningful. */
  tps?: number;
  message?: string;
}

export function getModels(projectId: string): Promise<ModelsResponse> {
  return request<ModelsResponse>(base(projectId));
}

export function testModel(
  projectId: string,
  body: ModelTestRequest,
): Promise<ModelTestResponse> {
  return request<ModelTestResponse>(`${base(projectId)}/test`, {
    method: "POST",
    body,
  });
}

/**
 * !!! FULL-TABLE REPLACE !!!
 *
 * `PUT /models` deletes every entry that is not present in `models` — along with its
 * inlined credential. This is deliberately NOT exported: the only supported way to write
 * is `setModelPointers`, which re-reads the table first. Do not call the raw PUT from a
 * component.
 */
function putModels(
  projectId: string,
  body: ModelsUpdateRequest,
): Promise<ModelsResponse> {
  return request<ModelsResponse>(base(projectId), { method: "PUT", body });
}

/**
 * Round-trip one GET entry back into a PUT entry without losing anything.
 *
 * Fidelity notes, verified against `project-config-service.ts`:
 *  - contextWindow / clientType / maxTokens / pricing come from the TOML only, so echoing
 *    them is byte-exact. Omitting any of them DELETES the annotation.
 *  - displayName is `toml ?? catalog`, and the server only persists it when it differs
 *    from the catalog — so echoing it back is also exact.
 *  - apiKey and baseUrl are deliberately OMITTED: omission means "keep the stored value".
 *    Sending the masked key back would overwrite the real credential with asterisks.
 *  - vision is `toml ?? catalog.supportsVision`; echoing may materialise a catalog-derived
 *    value into the TOML. Harmless (the effective value is unchanged) and the safe
 *    direction — dropping it would silently re-open a model annotated vision=false.
 */
function toUpdateEntry(m: ModelInfoDto): ModelUpdateEntry {
  return {
    provider: m.provider,
    modelId: m.modelId,
    ...(m.displayName !== undefined ? { displayName: m.displayName } : {}),
    ...(m.contextWindow !== undefined ? { contextWindow: m.contextWindow } : {}),
    ...(m.clientType !== undefined ? { clientType: m.clientType } : {}),
    ...(m.vision !== undefined ? { vision: m.vision } : {}),
    ...(m.maxTokens !== undefined ? { maxTokens: m.maxTokens } : {}),
    ...(m.pricing !== undefined ? { pricing: m.pricing } : {}),
  };
}

const sameRef = (a: ModelRefDto, b: { provider: string; modelId: string }) =>
  a.provider === b.provider && a.modelId === b.modelId;

/**
 * The ONLY model write the app performs: move the `defaultModel` and/or `visionModel`
 * pointer, leaving every entry in place.
 *
 * Discipline (mandatory, see the full-table-replace warning above):
 *   1. GET the live table.
 *   2. Map EVERY entry through `toUpdateEntry` — nothing is dropped.
 *   3. Merge the pointer change on top.
 *   4. PUT the whole array back.
 *
 * A pointer that is omitted from the request keeps its previous value server-side, so a
 * default-model change never disturbs the vision model and vice versa.
 */
export async function setModelPointers(
  projectId: string,
  patch: { defaultModel?: ModelRefDto; visionModel?: ModelRefDto },
): Promise<ModelsResponse> {
  const current = await getModels(projectId);
  // Refuse to write an empty table: a GET that came back empty (or failed into a stub)
  // must never be echoed back as "delete everything".
  if (current.models.length === 0) {
    throw new Error("模型列表为空，已中止写入以避免清空配置");
  }
  for (const ref of [patch.defaultModel, patch.visionModel]) {
    if (ref && !current.models.some((m) => sameRef(ref, m))) {
      throw new Error(`模型不在当前配置中：${ref.provider} / ${ref.modelId}`);
    }
  }
  return putModels(projectId, {
    models: current.models.map(toUpdateEntry),
    ...(patch.defaultModel ? { defaultModel: patch.defaultModel } : {}),
    ...(patch.visionModel ? { visionModel: patch.visionModel } : {}),
  });
}

/**
 * Onboarding's provider step: add (or update) one custom OpenAI-compatible entry with its
 * credential, optionally pointing `defaultModel` at it.
 *
 * A fresh install ships 77 preset entries and ZERO stored keys, so the very first task
 * fails with `model_credential_missing` until something like this runs — this is the real
 * gate a new user hits, and the only reason the wizard exists.
 *
 * Same full-table discipline as `setModelPointers`: every existing entry is mapped through
 * `toUpdateEntry` and sent back. `apiKey`/`baseUrl` are supplied ONLY on the new entry —
 * omitting them elsewhere is what preserves the other entries' stored credentials.
 */
export async function addCustomModel(
  projectId: string,
  entry: {
    provider: string;
    modelId: string;
    displayName?: string;
    baseUrl: string;
    apiKey: string;
    clientType?: string;
  },
  opts: { makeDefault?: boolean } = {},
): Promise<ModelsResponse> {
  const current = await getModels(projectId);
  if (current.models.length === 0) {
    throw new Error("模型列表为空，已中止写入以避免清空配置");
  }
  const ref = { provider: entry.provider, modelId: entry.modelId };
  const added: ModelUpdateEntry = {
    provider: entry.provider,
    modelId: entry.modelId,
    ...(entry.displayName ? { displayName: entry.displayName } : {}),
    ...(entry.clientType ? { clientType: entry.clientType } : {}),
    apiKey: entry.apiKey,
    baseUrl: entry.baseUrl,
  };
  // Re-configuring the same reference replaces that entry rather than duplicating it.
  const kept = current.models.filter((m) => !sameRef(ref, m)).map(toUpdateEntry);
  return putModels(projectId, {
    models: [...kept, added],
    ...(opts.makeDefault ? { defaultModel: ref } : {}),
  });
}
