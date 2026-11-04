export function formatNfceEventDate(date: Date): string {
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Data inválida para o evento de cancelamento da NFC-e.");
  }
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

export function normalizeNfceEventEnvironment(xml: string, appEnvironment: unknown): string {
  if (appEnvironment !== 1 && appEnvironment !== 2) return xml;
  const officialEnvironment = appEnvironment === 1 ? 2 : 1;
  return xml.replace(/<tpAmb>[12]<\/tpAmb>/, `<tpAmb>${officialEnvironment}</tpAmb>`);
}

export function interpretNfceCancellationResponse(
  response: unknown,
  accessKey: string
): { success: boolean; motivo?: string } {
  const pending: unknown[] = [response];
  const visited = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    const event = record.infEvento;
    if (event && typeof event === "object" && !Array.isArray(event)) {
      const details = event as Record<string, unknown>;
      if (String(details.chNFe ?? "") === accessKey) {
        const status = String(details.cStat ?? "");
        const reason = String(details.xMotivo ?? "");
        if (status === "135" || status === "155") return { success: true, motivo: reason };
        return { success: false, motivo: reason || `Cancelamento rejeitado pela SEFAZ (cStat ${status || "desconhecido"}).` };
      }
    }

    pending.push(...Object.values(record));
  }

  return { success: false, motivo: "A SEFAZ não confirmou o cancelamento da NFC-e." };
}
