import React, { useRef, useEffect, useCallback } from "react";

// ─── TokenTextarea ───────────────────────────────────────────────────────────
// Editor de texto simples onde variáveis {{...}} aparecem como badges (chips)
// não-editáveis dentro do contentEditable. O valor salvo é sempre o texto puro
// com {{variavel}} como string (para compatibilidade com o backend WPP).

interface TokenTextareaProps {
  value: string;
  onChange: (plain: string) => void;
  placeholder?: string;
  rows?: number;
  availableVars?: { key: string; desc: string }[];
}

const TOKEN_REGEX = /(\{\{[^}]+\}\})/g;

// Converte texto puro "oi {{nome_cliente}}" → HTML com spans não-editáveis
function toHtml(plain: string): string {
  const parts = plain.split(TOKEN_REGEX);
  return parts
    .map(part => {
      if (TOKEN_REGEX.test(part)) {
        TOKEN_REGEX.lastIndex = 0;
        return `<span contenteditable="false" data-var="${part}" class="token-chip">${part}</span>`;
      }
      // Preserva quebras de linha
      return part
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
    })
    .join("");
}

// Extrai texto puro do DOM: texto normal + data-var para chips
function toPlain(node: HTMLElement): string {
  let result = "";
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent ?? "";
    } else if (child instanceof HTMLElement) {
      if (child.dataset.var) {
        result += child.dataset.var;
      } else if (child.tagName === "BR") {
        result += "\n";
      } else if (child.tagName === "DIV" || child.tagName === "P") {
        result += "\n" + toPlain(child);
      } else {
        result += toPlain(child);
      }
    }
  });
  return result;
}

export function TokenTextarea({
  value,
  onChange,
  placeholder = "Escreva a mensagem...",
  rows = 6,
  availableVars = [],
}: TokenTextareaProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternal = useRef(false);

  // Sync value → DOM (only when external change)
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternal.current) { isInternal.current = false; return; }
    const html = toHtml(value);
    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, [value]);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    isInternal.current = true;
    onChange(toPlain(editorRef.current));
  }, [onChange]);

  // Prevent editing inside token chips (contenteditable=false handles most,
  // but we guard Backspace/Delete near chips too)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertLineBreak");
      emitChange();
    }
  }, [emitChange]);

  const insertVar = useCallback((varKey: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const chip = `<span contenteditable="false" data-var="${varKey}" class="token-chip">${varKey}</span>`;
    document.execCommand("insertHTML", false, chip + " ");
    isInternal.current = true;
    onChange(toPlain(editor));
  }, [onChange]);

  const minH = `${rows * 1.75}rem`;

  return (
    <div className="space-y-2">
      {/* Variáveis disponíveis */}
      {availableVars.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
            Clique para inserir variável:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableVars.map(v => (
              <button
                key={v.key}
                type="button"
                title={v.desc}
                onClick={() => insertVar(v.key)}
                className="text-[11px] px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 font-mono rounded-lg hover:bg-amber-100 transition-colors font-semibold"
              >
                {v.key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        style={{ minHeight: minH }}
        className="token-editor w-full border border-zinc-200 rounded-2xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-300 transition-all bg-white text-zinc-800 font-medium"
      />

      <style>{`
        .token-editor:empty::before {
          content: attr(data-placeholder);
          color: #a1a1aa;
          pointer-events: none;
        }
        .token-editor br { display: block; }
        .token-chip {
          display: inline-flex;
          align-items: center;
          padding: 1px 8px;
          margin: 0 2px;
          background: #fef3c7;
          border: 1px solid #fcd34d;
          color: #92400e;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 700;
          font-family: ui-monospace, monospace;
          user-select: none;
          cursor: default;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
