import React from "react";

interface AnimatedLogoProps {
  className?: string;
  /** Esconde o texto "Menu BoxSys" e mostra só a caixinha de peças — para espaços pequenos. */
  markOnly?: boolean;
}

// Versão React da animação de logo.html: as peças coloridas se encaixam e depois
// "Menu" (laranja) + "BoxSys" (azul) entram do texto — reaproveitada aqui em vez de
// duplicada como imagem estática pra manter a mesma identidade animada em toda
// tela de entrada no sistema (login, loading).
const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ className, markOnly = false }) => {
  return (
    <svg
      viewBox={markOnly ? "150 20 340 220" : "0 0 667 420"}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Menu BoxSys"
      className={className}
    >
      <style>{`
        .al-piece {
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
          animation: al-encaixar-peca 680ms cubic-bezier(.22, .9, .34, 1) both;
        }
        .al-piece-top-left  { animation-delay: 0ms;   --x: -24px; --y: -34px; --r: -8deg; }
        .al-piece-top-right { animation-delay: 70ms;  --x: 24px;  --y: -30px; --r: 8deg; }
        .al-piece-left      { animation-delay: 140ms; --x: -42px; --y: 3px;   --r: -6deg; }
        .al-piece-right     { animation-delay: 210ms; --x: 42px;  --y: 3px;   --r: 6deg; }
        .al-piece-bottom-left  { animation-delay: 280ms; --x: -18px; --y: 28px; --r: -3deg; }
        .al-piece-bottom-right { animation-delay: 350ms; --x: 18px;  --y: 28px; --r: 3deg; }

        .al-word-menu, .al-word-boxsys {
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
        }
        .al-word-menu { animation: al-entrar-menu 620ms cubic-bezier(.16, 1, .3, 1) 570ms both; }
        .al-word-boxsys { translate: 0 6px; animation: al-entrar-boxsys 620ms cubic-bezier(.16, 1, .3, 1) 670ms both; }

        @keyframes al-encaixar-peca {
          0% { opacity: 0; transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(.82); }
          72% { opacity: 1; transform: translate(-2px, 1px) rotate(0) scale(1.025); }
          100% { opacity: 1; transform: translate(0) rotate(0) scale(1); }
        }
        @keyframes al-entrar-menu {
          from { opacity: 0; transform: translateX(-22px) scale(.97); }
          78% { opacity: 1; transform: translateX(2px) scale(1.01); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes al-entrar-boxsys {
          from { opacity: 0; transform: translateX(22px) scale(.97); }
          78% { opacity: 1; transform: translateX(-2px) scale(1.01); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .al-piece, .al-word-menu, .al-word-boxsys { animation: none; opacity: 1; }
        }
      `}</style>
      <g aria-hidden="true">
        <polygon className="al-piece al-piece-top-left" points="367,77 328,57 236,104 234,109 269,127 273,127 366,80" fill="#297ed1" stroke="#297ed1" strokeWidth="1.2" strokeLinejoin="round" />
        <polygon className="al-piece al-piece-top-right" points="348,105 350,108 385,126 389,126 422,108 420,104 387,87" fill="#297ed1" stroke="#297ed1" strokeWidth="1.2" strokeLinejoin="round" />
        <polygon className="al-piece al-piece-left" points="196,149 198,155 282,198 287,198 319,167 319,163 233,119 228,119" fill="#ed670e" stroke="#ed670e" strokeWidth="1.2" strokeLinejoin="round" />
        <polygon className="al-piece al-piece-right" points="458,149 427,119 422,119 338,162 337,167 369,198 373,198 455,156" fill="#eb5e10" stroke="#eb5e10" strokeWidth="1.2" strokeLinejoin="round" />
        <polygon className="al-piece al-piece-bottom-left" points="224,183 225,238 308,284 321,289 322,186 292,214 287,215" fill="#e53b2c" stroke="#e53b2c" strokeWidth="1.2" strokeLinejoin="round" />
        <polygon className="al-piece al-piece-bottom-right" points="430,184 369,216 365,216 334,186 335,288 430,238" fill="#f7920c" stroke="#f7920c" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
      {!markOnly && (
        <g>
          <text className="al-word-menu" x="35" y="393" fill="#f58d0a" fontFamily="Arial, Helvetica, sans-serif" fontSize="88" fontWeight="800" letterSpacing="-4">Menu</text>
          <path className="al-word-boxsys" fill="#297ed1" d="M362.3 368.9Q362.3 376.9 356.8 381.5Q351.3 386.1 341.4 386.1H312V322.9H340.4Q350 322.9 355.4 327.3Q360.9 331.7 360.9 339.3Q360.9 344.9 358 348.6Q355 352.3 350.2 353.7Q355.7 354.9 359 359.2Q362.3 363.4 362.3 368.9ZM327.4 348.5H337.4Q341.2 348.5 343.2 346.8Q345.2 345.1 345.2 341.9Q345.2 338.7 343.2 337Q341.2 335.2 337.4 335.2H327.4ZM346.8 366.9Q346.8 363.5 344.6 361.6Q342.4 359.7 338.5 359.7H327.4V373.7H338.7Q342.5 373.7 344.7 371.9Q346.8 370.2 346.8 366.9ZM368.2 361Q368.2 353.3 371.6 347.4Q375 341.5 380.9 338.3Q386.8 335.2 394.2 335.2Q401.6 335.2 407.5 338.3Q413.4 341.5 416.8 347.4Q420.3 353.3 420.3 361Q420.3 368.7 416.8 374.6Q413.3 380.5 407.4 383.7Q401.4 386.9 394 386.9Q386.7 386.9 380.8 383.7Q374.9 380.5 371.5 374.7Q368.2 368.8 368.2 361ZM404.6 361Q404.6 355 401.6 351.7Q398.6 348.5 394.2 348.5Q389.7 348.5 386.8 351.7Q383.8 354.9 383.8 361Q383.8 367 386.7 370.3Q389.6 373.5 394 373.5Q398.4 373.5 401.5 370.3Q404.6 367 404.6 361ZM458.1 386.1 448.5 372.2 440.4 386.1H423.8L440.3 360.5L423.3 335.9H440.6L450.2 349.7L458.3 335.9H474.9L458.1 361.2L475.3 386.1ZM479.5 367.2H495.8Q496.2 370.7 498.2 372.6Q500.3 374.4 503.6 374.4Q507.1 374.4 509 372.8Q511 371.3 511 368.5Q511 366.1 509.4 364.6Q507.9 363.1 505.6 362.1Q503.3 361.1 499.1 359.8Q492.9 357.9 489.1 356Q485.2 354.2 482.4 350.5Q479.6 346.8 479.6 340.8Q479.6 332 486 327Q492.4 322 502.6 322Q513.1 322 519.4 327Q525.8 332 526.3 340.9H509.7Q509.5 337.9 507.4 336.1Q505.3 334.3 502.1 334.3Q499.3 334.3 497.6 335.8Q495.9 337.3 495.9 340.1Q495.9 343.2 498.8 344.9Q501.7 346.6 507.8 348.6Q513.9 350.6 517.7 352.5Q521.5 354.4 524.3 358Q527.1 361.6 527.1 367.3Q527.1 372.7 524.3 377.1Q521.6 381.5 516.4 384.1Q511.2 386.8 504.1 386.8Q497.2 386.8 491.7 384.5Q486.2 382.3 482.9 377.8Q479.6 373.4 479.5 367.2ZM587.7 335.9 556.3 410H539.8L551.3 384.4L530.9 335.9H548L559.6 367.3L571.1 335.9ZM590.6 369.6H605.8Q606.1 372.3 608.2 373.9Q610.4 375.5 613.5 375.5Q616.4 375.5 618 374.4Q619.5 373.3 619.5 371.4Q619.5 369.3 617.3 368.3Q615 367.2 610 366Q604.6 364.7 601 363.3Q597.4 361.9 594.8 358.9Q592.2 355.9 592.2 350.7Q592.2 346.4 594.6 342.9Q597 339.3 601.6 337.2Q606.2 335.2 612.6 335.2Q622.1 335 627.5 339.8Q632.9 344.5 633.7 352.3H619.5Q619.2 349.7 617.2 348.1Q615.3 346.6 612.2 346.6Q609.5 346.6 608 347.6Q606.6 348.7 606.6 350.5Q606.6 352.6 608.9 353.7Q611.2 354.8 616 355.9Q621.6 357.3 625.1 358.7Q628.6 360.1 631.3 363.2Q633.9 366.3 634 371.5Q634 376 631.5 379.4Q629.1 382.9 624.4 384.9Q619.8 386.9 613.7 386.9Q607.1 386.9 602 384.6Q596.9 382.3 593.9 378.4Q591 374.5 590.6 369.6Z" />
        </g>
      )}
    </svg>
  );
};

export default AnimatedLogo;
