import { prisma as _prisma } from "../../lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// Escapa para uso seguro dentro de atributos/texto HTML — evita quebrar o head
// (ou permitir injeção) quando nome/descrição da loja têm aspas, & ou < >.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SITE_BASE_URL =
  process.env.MAIL_APP_URL ?? process.env.APP_URL ?? "https://boxsys.com.br";
const DEFAULT_OG_IMAGE = `${SITE_BASE_URL}/images/logo.png`;
const SEO_EXCLUDED_SLUGS = [
  "api",
  "login",
  "register",
  "admin",
  "assets",
  "uploads",
  "cond",
  "garcom",
  "pdv",
  "cozinha",
];

export function toAbsoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url)
    ? url
    : `${SITE_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Resolve título/descrição/imagem do preview de compartilhamento (Open Graph) a partir
// do slug na URL — usado tanto no fallback de produção (dist/index.html) quanto em dev
// (index.html transformado pelo Vite), para o link do cardápio de cada loja mostrar o
// nome, a descrição e o logo dela em vez dos valores genéricos do sistema.
export async function resolveSeoMeta(
  requestPath: string,
  hostname?: string
): Promise<{
  title: string;
  description: string;
  image: string;
  url: string;
  appleTitle: string;
  appleIcon: string;
}> {
  const segments = requestPath.split("/").filter(Boolean);
  const slug = segments[0];
  const isKitchen = hostname === "cozinha.boxsys.com.br";
  const appleTitle = isKitchen ? "Cozinha BoxSys" : "Box Sys";
  const appleIcon = isKitchen
    ? "/images/cozinha-icon.png"
    : "/images/app_celular.png";

  let title = "Box Sys — Cardápio Digital";
  let description = "Peça agora pelo nosso cardápio digital!";
  let image = DEFAULT_OG_IMAGE;

  // /cond/:slug usa o segundo segmento como slug real — o primeiro é o literal "cond"
  if (slug === "cond" && segments[1]) {
    try {
      const condominium = await prisma.condominium.findUnique({
        where: { slug: segments[1] },
      });
      if (condominium) {
        title = `${condominium.name} | Cardápios do Condomínio`;
        description =
          condominium.description ||
          "Confira os estabelecimentos parceiros e faça seu pedido!";
        image = condominium.logoUrl
          ? toAbsoluteUrl(condominium.logoUrl)
          : DEFAULT_OG_IMAGE;
      }
    } catch (e) {
      console.error("SEO Error:", e);
    }
  } else if (slug && !SEO_EXCLUDED_SLUGS.includes(slug)) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (tenant) {
        title = `${tenant.name} | Cardápio Digital`;
        description =
          tenant.description ||
          "Confira nosso cardápio e faça seu pedido online!";
        image = tenant.logoUrl
          ? toAbsoluteUrl(tenant.logoUrl)
          : DEFAULT_OG_IMAGE;
      }
    } catch (e) {
      console.error("SEO Error:", e);
    }
  }

  return {
    title,
    description,
    image,
    url: `${SITE_BASE_URL}${requestPath}`,
    appleTitle,
    appleIcon,
  };
}

export function injectSeoMeta(
  html: string,
  seo: {
    title: string;
    description: string;
    image: string;
    url: string;
    appleTitle: string;
    appleIcon: string;
  }
): string {
  const safeTitle = escapeHtml(seo.title);
  const safeDescription = escapeHtml(seo.description);
  const safeAppleTitle = escapeHtml(seo.appleTitle);
  return html
    .replace(/<title>.*?<\/title>/, `<title>${safeTitle}</title>`)
    .replace(/{{TITLE}}/g, safeTitle)
    .replace(/{{DESCRIPTION}}/g, safeDescription)
    .replace(/{{IMAGE}}/g, seo.image)
    .replace(/{{APPLE_TITLE}}/g, safeAppleTitle)
    .replace(/{{APPLE_ICON}}/g, seo.appleIcon)
    .replace(
      /<meta property="og:image" content="[^"]*"\s*\/>/,
      `<meta property="og:image" content="${seo.image}" />\n    <meta property="og:url" content="${seo.url}" />\n    <meta property="og:site_name" content="Box Sys" />`
    );
}
