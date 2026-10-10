// Proteção do Access Token da Cielo (credencial por tenant em tenant.cieloConfig).
// O token nunca sai do servidor: toda resposta JSON passa por sanitizeCieloInJson
// (middleware em server.ts), que troca accessToken por accessTokenSet.
import type { NextFunction, Request, Response } from "express";

function parseObj(raw: unknown): Record<string, any> | null {
  if (!raw) return null;
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return v && typeof v === "object" ? (v as Record<string, any>) : null;
  } catch {
    return null;
  }
}

/** Remove accessToken e devolve accessTokenSet. Aceita string JSON ou objeto. */
export function sanitizeCieloConfig(raw: unknown): string | null {
  const cfg = parseObj(raw);
  if (!cfg) return typeof raw === "string" ? raw : null;
  const { accessToken, ...rest } = cfg;
  return JSON.stringify({
    ...rest,
    accessTokenSet: typeof accessToken === "string" && accessToken.trim() !== "",
  });
}

/**
 * Calcula o cieloConfig a gravar: preserva o accessToken já salvo quando o
 * frontend não envia um novo (vazio/ausente). accessTokenSet nunca é persistido.
 */
export function mergeCieloConfigForSave(incoming: unknown, existingRaw: unknown): string | null {
  const inc = parseObj(incoming);
  if (!inc) return null;
  const prev = parseObj(existingRaw);
  const { accessTokenSet: _ignored, accessToken, ...rest } = inc;
  const next: Record<string, any> = { ...rest };
  const sent = typeof accessToken === "string" ? accessToken.trim() : "";
  if (sent) next.accessToken = sent;
  else if (typeof prev?.accessToken === "string" && prev.accessToken) next.accessToken = prev.accessToken;
  if (typeof next.clientId === "string") next.clientId = next.clientId.trim();
  if (typeof next.merchantId === "string") next.merchantId = next.merchantId.trim();
  return JSON.stringify(next);
}

// Copy-on-write: nunca altera o objeto original (pode estar em cache/memória e ser usado depois
// por getCieloCfg); só copia os nós no caminho até um cieloConfig e devolve a cópia sanitizada.
function scrub(value: any, depth: number): any {
  if (!value || typeof value !== "object" || depth > 12 || value instanceof Date) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const n = scrub(v, depth + 1);
      if (n !== v) changed = true;
      return n;
    });
    return changed ? out : value;
  }
  let copy: Record<string, any> | null = null;
  for (const k of Object.keys(value)) {
    const v = value[k];
    let n = v;
    if (k === "cieloConfig" && v && (typeof v === "string" || typeof v === "object")) {
      const clean = sanitizeCieloConfig(v);
      n = typeof v === "string" ? clean : JSON.parse(clean || "null");
    } else if (v && typeof v === "object") {
      n = scrub(v, depth + 1);
    }
    if (n !== v) {
      if (!copy) copy = { ...value };
      copy[k] = n;
    }
  }
  return copy ?? value;
}

/** Middleware: sanitiza cieloConfig em qualquer res.json (painel, cardápio público, owner, superadmin...). */
export function cieloSecretGuard(_req: Request, res: Response, next: NextFunction) {
  const original = res.json.bind(res);
  (res as any).json = (body: any) => {
    let safe = body;
    try {
      safe = scrub(body, 0);
    } catch {
      /* nunca falha a resposta por causa da sanitização */
    }
    return original(safe);
  };
  next();
}
