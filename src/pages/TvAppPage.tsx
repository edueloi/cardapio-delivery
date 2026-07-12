import { useEffect, useRef, useState } from "react";
import { Tv, Loader2 } from "lucide-react";

const DEVICE_TOKEN_KEY = "boxsys_tv_device_token";
const STATUS_POLL_MS = 4000;

// Tela inicial do app de TV (Android TV / Fire Stick). Fluxo tipo Netflix:
// 1) na primeira abertura, registra o aparelho e ganha um deviceToken permanente
//    (salvo no localStorage do WebView — sobrevive a reboot);
// 2) enquanto não estiver vinculado a um estabelecimento, pede um código de
//    6 dígitos e fica mostrando na tela, checando o status periodicamente;
// 3) assim que o dono vincular o código em Configurações > TVs, redireciona
//    pro Painel de Pedidos (/:slug/display) — rota pública, sem exigir login.
export default function TvAppPage() {
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      let token = window.localStorage.getItem(DEVICE_TOKEN_KEY);
      if (!token) {
        try {
          const res = await fetch("/api/tv/register", { method: "POST" });
          const data = await res.json();
          token = data.deviceToken;
          window.localStorage.setItem(DEVICE_TOKEN_KEY, token as string);
        } catch {
          if (!cancelled) setError("Sem conexão com o servidor. Verifique a internet da TV.");
          return;
        }
      }
      if (!cancelled) setDeviceToken(token);
    };

    boot();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!deviceToken) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/tv/status?deviceToken=${encodeURIComponent(deviceToken)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setError(null);
        setLoading(false);

        if (data.paired && data.slug) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          window.location.href = `/${data.slug}/display`;
          return;
        }

        // Ainda não pareado — garante que tem um código válido pra mostrar.
        const codeRes = await fetch("/api/tv/pairing-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceToken }),
        });
        const codeData = await codeRes.json();
        if (codeData.paired) return; // pareou entre as duas chamadas — próximo poll redireciona
        setPairingCode(codeData.pairingCode);
      } catch {
        setLoading(false);
        setError("Sem conexão com o servidor. Verifique a internet da TV.");
      }
    };

    checkStatus();
    pollRef.current = window.setInterval(checkStatus, STATUS_POLL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [deviceToken]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
        <Tv className="w-10 h-10 text-amber-400" />
      </div>

      {loading && !pairingCode && (
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-6" />
      )}

      {error && (
        <p className="text-red-400 text-lg font-bold max-w-md">{error}</p>
      )}

      {!error && pairingCode && (
        <>
          <p className="text-white/50 text-lg font-bold uppercase tracking-[0.2em] mb-4">
            Vincule esta TV
          </p>
          <div className="bg-white/5 border-2 border-amber-400/40 rounded-3xl px-12 py-8 mb-6">
            <span className="text-white text-7xl font-black tracking-[0.25em] tabular-nums">
              {pairingCode}
            </span>
          </div>
          <p className="text-white/40 text-base max-w-md leading-relaxed">
            No computador ou celular, acesse o painel do seu estabelecimento em{" "}
            <strong className="text-white/70">Configurações → TVs</strong> e digite este código
            para vincular este aparelho.
          </p>
        </>
      )}
    </div>
  );
}
