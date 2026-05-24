import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, Lock, XCircle } from "lucide-react";
import { Button, Input } from "../../components";

type Status = "loading" | "valid" | "invalid" | "expired" | "done";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    fetch(`/api/auth/reset-password/${token}`)
      .then((r) => {
        if (r.status === 410) return r.json().then((j) => { throw new Error(j.error ?? "Expirado"); });
        if (!r.ok) throw new Error("Inválido");
        return r.json();
      })
      .then(() => setStatus("valid"))
      .catch((err: Error) => {
        setStatus(err.message.toLowerCase().includes("expirou") ? "expired" : "invalid");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("A senha deve ter ao menos 6 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? "Erro"); }
      setStatus("done");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao redefinir.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1B3E] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <img src="/images/menuflow-logo.png" alt="BoxSys" className="h-14 object-contain mx-auto drop-shadow-xl" />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {status === "loading" && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-white/20 border-t-[#C9A227] rounded-full animate-spin mx-auto" />
              <p className="text-white/40 text-sm mt-4">Verificando link...</p>
            </div>
          )}

          {(status === "invalid" || status === "expired") && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">
                  {status === "expired" ? "Link expirado" : "Link inválido"}
                </p>
                <p className="text-white/50 text-sm mt-2 leading-relaxed">
                  {status === "expired"
                    ? "Este link de redefinição de senha expirou. Solicite um novo."
                    : "Este link é inválido ou já foi utilizado."}
                </p>
              </div>
              <Link
                to="/esqueci-senha"
                className="inline-block px-5 py-2.5 rounded-xl bg-[#C9A227] text-white text-sm font-bold hover:bg-[#b8911f] transition-colors"
              >
                Solicitar novo link
              </Link>
            </div>
          )}

          {status === "done" && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">Senha redefinida!</p>
                <p className="text-white/50 text-sm mt-2">
                  Sua senha foi alterada com sucesso. Redirecionando para o login...
                </p>
              </div>
            </div>
          )}

          {status === "valid" && (
            <>
              <div className="mb-7">
                <h1 className="text-xl font-bold text-white">Nova senha</h1>
                <p className="text-white/40 text-sm mt-1.5">Escolha uma senha segura para sua conta.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">
                    Nova senha
                  </label>
                  <Input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    iconLeft={<Lock className="w-4 h-4" />}
                    iconRight={
                      <button type="button" onClick={() => setShowPwd((v) => !v)} className="text-white/30 hover:text-white/60 transition-colors">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                    placeholder="Mínimo 6 caracteres"
                    className="rounded-xl h-12"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">
                    Confirmar senha
                  </label>
                  <Input
                    type={showPwd ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    iconLeft={<Lock className="w-4 h-4" />}
                    placeholder="Repita a senha"
                    error={error || undefined}
                    className="rounded-xl h-12"
                  />
                </div>

                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  className="bg-[#C9A227] hover:bg-[#b8911f] text-white h-12 rounded-xl font-bold text-sm tracking-wide"
                >
                  Redefinir senha
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
