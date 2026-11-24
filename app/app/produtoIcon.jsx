"use client";
// v1094 — ilustrações dos produtos copiadas da calculadora (nort-dashboard: ProdutoIcon.tsx)



/**
 * Ilustrações flat das peças. Traço cinza médio sobre fundo claro.
 * Mesmo viewBox 200x200 pra todas — escalonável.
 */
export default function ProdutoIcon({ produtoId, className }) {
  switch (produtoId) {
    case "pv-gola-vies":
    case "pv-gola-ribana":
    case "algodao-30-1":
    case "viscose":
      return <CamisetaBasica className={className} />;
    case "dry-fit-elastano":
      return <CamisetaDryFit className={className} />;
    case "dryfit-sublimacao-total":
      return <CamisetaSublimacao className={className} />;
    case "algodao-egipcio":
    case "modal":
      return <CamisetaEgipcio className={className} />;
    case "polo-piquet":
    case "polo-poliamida":
      return <CamisetaPolo className={className} />;
    case "calca-brim-leve":
    case "calca-brim-pesado":
    case "calca-social":
      return <Calca className={className} />;
    case "dtf-metro":
      return <BobinaDtf className={className} />;
    default:
      return <CamisetaBasica className={className} />;
  }
}

// DTF no metro: rolo de filme com estampas
function BobinaDtf({ className }) {
  return (
    <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M 52 60 L 150 60 L 150 150 L 52 150 Z" fill={FILL} stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      <ellipse cx="52" cy="105" rx="14" ry="45" fill={FILL} stroke={STROKE} strokeWidth="2.5" />
      <ellipse cx="52" cy="105" rx="5" ry="16" fill="none" stroke={STROKE} strokeWidth="1.5" />
      <rect x="72" y="74" width="28" height="22" rx="3" fill="none" stroke="#EE6500" strokeWidth="2" />
      <rect x="110" y="74" width="28" height="22" rx="3" fill="none" stroke="#EE6500" strokeWidth="2" />
      <rect x="72" y="110" width="28" height="22" rx="3" fill="none" stroke="#EE6500" strokeWidth="2" />
      <rect x="110" y="110" width="28" height="22" rx="3" fill="none" stroke="#EE6500" strokeWidth="2" />
      <path d="M 150 150 L 170 150" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const STROKE = "#0C2342";
const FILL = "#FFFFFF";

function CamisetaBasica({ className }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 60 50 L 40 70 L 50 90 L 65 80 L 65 160 L 135 160 L 135 80 L 150 90 L 160 70 L 140 50 L 120 50 Q 120 65 100 65 Q 80 65 80 50 Z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CamisetaDryFit({ className }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 60 50 L 40 70 L 50 90 L 65 80 L 65 160 L 135 160 L 135 80 L 150 90 L 160 70 L 140 50 L 120 50 Q 120 65 100 65 Q 80 65 80 50 Z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* costuras laterais sugerindo elastano */}
      <path
        d="M 75 90 L 75 155"
        stroke={STROKE}
        strokeWidth="1"
        strokeDasharray="2 3"
        fill="none"
      />
      <path
        d="M 125 90 L 125 155"
        stroke={STROKE}
        strokeWidth="1"
        strokeDasharray="2 3"
        fill="none"
      />
    </svg>
  );
}

function CamisetaSublimacao({ className }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="subli-pattern"
          x="0"
          y="0"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="3" cy="3" r="1.5" fill="#EE6500" opacity="0.35" />
          <circle cx="10" cy="10" r="1" fill="#0C2342" opacity="0.25" />
        </pattern>
        <clipPath id="subli-clip">
          <path d="M 60 50 L 40 70 L 50 90 L 65 80 L 65 160 L 135 160 L 135 80 L 150 90 L 160 70 L 140 50 L 120 50 Q 120 65 100 65 Q 80 65 80 50 Z" />
        </clipPath>
      </defs>
      <path
        d="M 60 50 L 40 70 L 50 90 L 65 80 L 65 160 L 135 160 L 135 80 L 150 90 L 160 70 L 140 50 L 120 50 Q 120 65 100 65 Q 80 65 80 50 Z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect
        x="40"
        y="50"
        width="120"
        height="120"
        fill="url(#subli-pattern)"
        clipPath="url(#subli-clip)"
      />
    </svg>
  );
}

function CamisetaEgipcio({ className }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 60 50 L 40 70 L 50 90 L 65 80 L 65 160 L 135 160 L 135 80 L 150 90 L 160 70 L 140 50 L 120 50 Q 120 65 100 65 Q 80 65 80 50 Z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* gola um pouco mais detalhada */}
      <path
        d="M 80 50 Q 100 70 120 50"
        stroke={STROKE}
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function CamisetaPolo({ className }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 60 50 L 40 70 L 50 90 L 65 80 L 65 160 L 135 160 L 135 80 L 150 90 L 160 70 L 140 50 L 120 50 L 110 75 L 100 80 L 90 75 L 80 50 Z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* abertura da polo */}
      <line
        x1="100"
        y1="80"
        x2="100"
        y2="105"
        stroke={STROKE}
        strokeWidth="1.5"
      />
      <circle cx="100" cy="92" r="1.5" fill={STROKE} />
      <circle cx="100" cy="102" r="1.5" fill={STROKE} />
    </svg>
  );
}

function Calca({ className }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 70 30 L 130 30 L 135 95 L 130 170 L 110 170 L 100 100 L 90 170 L 70 170 L 65 95 Z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* cinto */}
      <line
        x1="70"
        y1="42"
        x2="130"
        y2="42"
        stroke={STROKE}
        strokeWidth="1.5"
      />
      {/* bolso */}
      <path
        d="M 78 50 L 95 50 L 92 70"
        stroke={STROKE}
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

