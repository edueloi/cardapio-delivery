import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { Button, Input } from "../../components";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Informe seu e-mail."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? "Erro"); }
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1B3E] p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <img src="/images/menuflow-logo.png" alt="BoxSys" className="h-14 object-contain mx-auto drop-shadow-xl" />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {sent ? (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">E-mail enviado!</p>
                <p className="text-white/50 text-sm mt-2 leading-relaxed">
                  Se houver uma conta associada a <strong className="text-white/70">{email}</strong>, você receberá um link para redefinir sua senha em instantes.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-[#C9A227] hover:underline mt-2"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-xl font-bold text-white">Esqueci minha senha</h1>
                <p className="text-white/40 text-sm mt-1.5">
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">
                    E-mail
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    iconLeft={<Mail className="w-4 h-4" />}
                    placeholder="seuemail@dominio.com"
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
                  Enviar link de redefinição
                </Button>
              </form>

              <div className="text-center mt-5">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
