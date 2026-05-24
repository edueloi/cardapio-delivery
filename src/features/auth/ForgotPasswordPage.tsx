import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState("");

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
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ══ ESQUERDA — branding (espelho do login) ══ */}
      <div className="hidden lg:flex flex-col w-[55%] shrink-0 bg-[#071020] relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#C9A227]/[0.08] blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-950/60 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full px-16 py-14">
          <div className="self-start">
            <div className="bg-white rounded-2xl px-6 py-4 shadow-2xl shadow-black/40 inline-block">
              <img src="/images/menu-flow-continue.png" alt="BoxSys" className="h-14 object-contain" />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-[#C9A227]/10 border border-[#C9A227]/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#C9A227]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div className="space-y-3">
              <h1 className="text-[2.8rem] font-black text-white leading-tight tracking-tight">
                Recupere seu<br />
                <span className="text-[#C9A227]">acesso</span>
              </h1>
              <p className="text-white/30 text-sm leading-relaxed max-w-[260px]">
                Enviaremos um link seguro para você redefinir sua senha em instantes.
              </p>
            </div>
          </div>

          <p className="text-white/15 text-[11px]">© 2025 BoxSys · Sistema de Gestão para Restaurantes</p>
        </div>
      </div>

      {/* ══ DIREITA — formulário branco ══ */}
      <div className="flex-1 flex flex-col bg-white min-h-screen">

        {/* Header mobile */}
        <div className="lg:hidden flex items-center justify-center pt-10 pb-2">
          <div className="bg-[#071020] rounded-2xl px-6 py-4 shadow-xl">
            <img src="/images/menu-flow-continue.png" alt="BoxSys" className="h-12 object-contain brightness-0 invert" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-10">
          <div className="w-full max-w-[420px]">

            {sent ? (
              /* ── Estado de sucesso ── */
              <div className="text-center space-y-6">
                <div className="w-20 h-20 rounded-3xl bg-green-50 border border-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-[#071020]">E-mail enviado!</h2>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Se houver uma conta associada a{" "}
                    <span className="font-semibold text-slate-600">{email}</span>
                    , você receberá um link para redefinir sua senha em instantes.
                  </p>
                </div>
                <p className="text-slate-300 text-xs">Não recebeu? Verifique a caixa de spam.</p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#C9A227] hover:text-[#b8911f] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar ao login
                </Link>
              </div>
            ) : (
              /* ── Formulário ── */
              <>
                <div className="mb-9">
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#C9A227] mb-2">
                    Recuperar acesso
                  </p>
                  <h2 className="text-[2rem] font-black text-[#071020] tracking-tight leading-tight">
                    Esqueci minha senha
                  </h2>
                  <p className="text-slate-400 text-sm mt-1.5">
                    Informe seu e-mail e enviaremos um link para redefinir sua senha.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      placeholder="seuemail@dominio.com"
                      autoComplete="email"
                      required
                      className="w-full py-3.5 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-300 text-sm focus:outline-none focus:border-[#C9A227] focus:bg-white focus:ring-2 focus:ring-[#C9A227]/15 transition-all"
                    />
                    {error && <p className="text-red-500 text-xs font-medium pt-0.5">{error}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-[#071020] hover:bg-[#0f1f3d] active:scale-[0.98] text-white font-black text-sm tracking-wide shadow-lg shadow-[#071020]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Enviando...
                      </>
                    ) : (
                      "Enviar link de redefinição"
                    )}
                  </button>
                </form>

                <div className="text-center mt-8">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                  </Link>
                </div>
              </>
            )}

          </div>
        </div>
      </div>

    </div>
  );
}
