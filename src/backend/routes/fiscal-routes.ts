import type { Express, Request, RequestHandler, Response } from "express";

export interface RegisterFiscalRoutesOptions {
  app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  requireAuth: RequestHandler;
  requireTenantById: (
    req: Request,
    res: Response,
    tenantId: string,
    tabId?: string | string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any | null>;
}

export function registerFiscalRoutes({
  app,
  prisma,
  requireAuth,
  requireTenantById,
}: RegisterFiscalRoutesOptions) {
  // ─── NFC-e Fiscal Endpoints ───────────────────────────────────────────────────
  // Precisa ficar registrado ANTES do catch-all "app.get(\"*\", ...)" do SPA (mais abaixo)
  // — Express avalia rotas na ordem de registro, e um catch-all sem guarda de path
  // intercepta qualquer GET seguinte, mesmo de rotas de API distintas, devolvendo o
  // index.html do frontend em vez de JSON (bug real: nfce/list, nfce/status e nfce/danfe
  // nunca eram alcançados, só as rotas POST — emit/cancel — funcionavam).

  // POST /api/owner/tenants/:tenantId/nfce/emit — emite NFC-e para um pedido
  app.post(
    "/api/owner/tenants/:tenantId/nfce/emit",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "finance"
      );
      if (!tenant) return;

      const { orderId } = req.body as { orderId: string };
      if (!orderId)
        return res.status(400).json({ error: "orderId é obrigatório." });

      try {
        if (!tenant.fiscalConfig)
          return res
            .status(400)
            .json({ error: "Configuração fiscal não encontrada." });
        const fiscal = JSON.parse(
          tenant.fiscalConfig as string
        ) as import("../../types.js").FiscalConfig;
        if (!fiscal.enabled)
          return res.status(400).json({ error: "Módulo fiscal desativado." });

        // Busca pedido com itens e produtos
        const order = await prisma.order.findFirst({
          where: { id: orderId, tenantId: tenant.id },
          include: { items: { include: { product: true } } },
        });
        if (!order)
          return res.status(404).json({ error: "Pedido não encontrado." });
        if (order.nfceStatus === "AUTHORIZED")
          return res
            .status(409)
            .json({ error: "NFC-e já autorizada para este pedido." });

        // Reserva o próximo número de forma atômica ANTES de emitir — se só incrementarmos
        // depois de autorizado (como era antes), duas emissões concorrentes (duplo clique,
        // reprocessamento) leem o mesmo proximoNumero e tentam emitir com o MESMO número,
        // e a SEFAZ rejeita a segunda com "Duplicidade de NF-e com diferença na Chave de
        // Acesso" (foi exatamente o que aconteceu: nota 101 já autorizada, mas o contador
        // nunca avançou, então a próxima tentativa reusou 101 e colidiu). O updateMany com
        // WHERE no valor lido garante compare-and-swap: só uma requisição consegue avançar
        // o contador para este número; a perdedora vê count=0 e tenta de novo com o valor
        // atualizado. Se a emissão falhar depois de reservado, o número fica pulado (nunca
        // reaproveitado) — aceitável e seguro, ao contrário de duplicar.
        let numero = fiscal.proximoNumero || 1;
        for (let attempt = 0; attempt < 5; attempt++) {
          const reserved = await prisma.tenant.updateMany({
            where: { id: tenant.id, fiscalConfig: JSON.stringify(fiscal) },
            data: { fiscalConfig: JSON.stringify({ ...fiscal, proximoNumero: numero + 1 }) },
          });
          if (reserved.count > 0) break;
          // Outra requisição reservou primeiro — relê o config atual e tenta o próximo número.
          const fresh = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { fiscalConfig: true } });
          const freshFiscal = JSON.parse(fresh?.fiscalConfig as string) as import("../../types.js").FiscalConfig;
          Object.assign(fiscal, freshFiscal);
          numero = fiscal.proximoNumero || 1;
          if (attempt === 4) {
            return res.status(409).json({ error: "Não foi possível reservar um número de NFC-e — tente novamente." });
          }
        }

        // Monta items fiscais — prioriza o snapshot congelado no pedido (não muda mesmo
        // que o produto seja editado ou excluído depois), com o produto vivo como
        // fallback só para pedidos criados antes desse snapshot existir.
        const { emitirNfce } = await import("../../lib/fiscal.js");
        const fiscalItems = order.items.map((item: any) => ({
          productName: item.productName ?? item.product?.name ?? "Produto",
          ncm: item.ncm ?? item.product?.ncm ?? "00000000",
          cfop: item.cfop ?? item.product?.cfop ?? "5102",
          csosn: item.csosn ?? item.product?.csosn ?? "400",
          unitCom: item.unitCom ?? item.product?.unitCom ?? "UN",
          origem: item.origem ?? item.product?.origem ?? 0,
          aliqIcms: item.aliqIcms ?? item.product?.aliqIcms ?? 0,
          quantity: item.quantity,
          unitPrice: item.price,
        }));

        let emitAddress = { street: "", number: "", neighborhood: "", cep: "" };
        try {
          const parsed = tenant.address
            ? JSON.parse(tenant.address as string)
            : null;
          if (parsed) {
            emitAddress = {
              street: parsed.street || "",
              number: parsed.number || "",
              neighborhood: parsed.neighborhood || "",
              cep: parsed.cep || "",
            };
          }
        } catch {
          /* endereço inválido — segue com campos vazios, fiscal.ts aplica fallback */
        }

        // amountReceived (valor recebido em dinheiro) vem do paymentDetail salvo na hora da
        // venda (PDVPanel envia isso em paymentMetadata) — sem isso, o troco nunca chega no
        // XML e a SEFAZ rejeita vendas em dinheiro com valor pago maior que o total.
        let amountPaid: number | undefined;
        try {
          const detail = order.paymentDetail ? JSON.parse(order.paymentDetail as string) : null;
          if (detail && typeof detail.amountReceived === "number") amountPaid = detail.amountReceived;
        } catch {
          /* paymentDetail inválido/ausente — segue sem amountPaid, fiscal.ts trata como sem troco */
        }

        const result = await emitirNfce(tenant.id, fiscal, {
          numero,
          serie: fiscal.serie || 1,
          items: fiscalItems,
          total: order.total,
          paymentMethod: order.paymentMethod,
          amountPaid,
          customerName: order.customerName || undefined,
          customerCpf: order.customerCpf || undefined,
          emitName: tenant.name,
          emitAddress,
        });

        // Atualiza pedido com resultado — o número sequencial já foi reservado
        // atomicamente ANTES da emissão (ver bloco de reserva acima), então não há mais
        // incremento condicional aqui: autorizada ou rejeitada, o número não é reutilizado.
        await prisma.order.update({
          where: { id: orderId },
          data: {
            nfceStatus: result.status,
            nfceKey: result.chave ?? null,
            nfceProtocol: result.protocolo ?? null,
            nfceNumber: result.numero ?? null,
            nfceXml: result.xmlAutorizado
              ? JSON.stringify({ xml: result.xmlAutorizado })
              : null,
          },
        });

        res.json(result);
      } catch (err: any) {
        console.error("[NFC-e] Erro ao emitir:", err);
        res.status(500).json({ error: err?.message ?? "Erro ao emitir NFC-e." });
      }
    }
  );

  // POST /api/owner/tenants/:tenantId/nfce/cancel — cancela NFC-e
  app.post(
    "/api/owner/tenants/:tenantId/nfce/cancel",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "finance"
      );
      if (!tenant) return;

      const { orderId, justificativa } = req.body as {
        orderId: string;
        justificativa: string;
      };
      if (!orderId)
        return res.status(400).json({ error: "orderId é obrigatório." });
      if (!justificativa || justificativa.length < 15)
        return res
          .status(400)
          .json({ error: "Justificativa deve ter ao menos 15 caracteres." });

      try {
        const order = await prisma.order.findFirst({
          where: { id: orderId, tenantId: tenant.id },
        });
        if (!order)
          return res.status(404).json({ error: "Pedido não encontrado." });
        if (order.nfceStatus !== "AUTHORIZED")
          return res
            .status(400)
            .json({ error: "Apenas NFC-e autorizada pode ser cancelada." });
        if (!order.nfceKey || !order.nfceProtocol)
          return res
            .status(400)
            .json({ error: "Chave ou protocolo da NFC-e não encontrados." });

        const fiscal = JSON.parse(
          tenant.fiscalConfig as string
        ) as import("../../types.js").FiscalConfig;
        const { cancelarNfce } = await import("../../lib/fiscal.js");

        const result = await cancelarNfce(
          tenant.id,
          fiscal,
          order.nfceKey,
          order.nfceProtocol,
          justificativa
        );

        if (result.success) {
          await prisma.order.update({
            where: { id: orderId },
            data: { nfceStatus: "CANCELLED" },
          });
        }

        res.json(result);
      } catch (err: any) {
        console.error("[NFC-e] Erro ao cancelar:", err);
        res
          .status(500)
          .json({ error: err?.message ?? "Erro ao cancelar NFC-e." });
      }
    }
  );

  // GET /api/owner/tenants/:tenantId/nfce/list — histórico de notas fiscais emitidas (paginado)
  app.get(
    "/api/owner/tenants/:tenantId/nfce/list",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "finance"
      );
      if (!tenant) return;

      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;

      const where = {
        tenantId: tenant.id,
        nfceStatus: status ? status : { not: null },
        ...((from || to) && {
          createdAt: {
            ...(from && { gte: new Date(`${from}T00:00:00`) }),
            ...(to && { lte: new Date(`${to}T23:59:59.999`) }),
          },
        }),
      } as any;

      const [total, orders] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            customerName: true,
            total: true,
            createdAt: true,
            nfceStatus: true,
            nfceKey: true,
            nfceNumber: true,
            nfceProtocol: true,
          },
        }),
      ]);

      res.json({ orders, total, page, pageSize });
    }
  );

  // GET /api/owner/tenants/:tenantId/nfce/status/:orderId — status da NFC-e de um pedido
  app.get(
    "/api/owner/tenants/:tenantId/nfce/status/:orderId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "finance"
      );
      if (!tenant) return;

      const order = await prisma.order.findFirst({
        where: { id: req.params.orderId, tenantId: tenant.id },
        select: {
          nfceStatus: true,
          nfceKey: true,
          nfceProtocol: true,
          nfceNumber: true,
        },
      });
      if (!order)
        return res.status(404).json({ error: "Pedido não encontrado." });
      res.json(order);
    }
  );

  // DELETE /api/owner/tenants/:tenantId/nfce/:orderId — remove um pedido com NFC-e
  // REJEITADA (tentativa de teste sem valor fiscal). Nunca permite excluir uma nota
  // AUTORIZADA — essa tem valor legal e só pode ser cancelada (rota /nfce/cancel), nunca
  // apagada do banco.
  app.delete(
    "/api/owner/tenants/:tenantId/nfce/:orderId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "finance"
      );
      if (!tenant) return;

      try {
        const order = await prisma.order.findFirst({
          where: { id: req.params.orderId, tenantId: tenant.id },
          select: { id: true, nfceStatus: true },
        });
        if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
        if (order.nfceStatus === "AUTHORIZED")
          return res.status(400).json({
            error: "NFC-e autorizada não pode ser excluída — cancele-a em vez disso.",
          });

        // OrderItem tem FK obrigatória pra Order (sem onDelete: Cascade no schema) — precisa
        // apagar os itens antes, senão o delete do pedido falha por violação de constraint.
        await prisma.$transaction([
          prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
          prisma.order.delete({ where: { id: order.id } }),
        ]);
        res.json({ success: true });
      } catch (err: any) {
        console.error("[NFC-e] Erro ao excluir pedido:", err);
        res.status(500).json({ error: err?.message ?? "Erro ao excluir pedido." });
      }
    }
  );

  // GET /api/owner/tenants/:tenantId/nfce/xml/:orderId — baixa o XML autorizado (procNFe) puro
  app.get(
    "/api/owner/tenants/:tenantId/nfce/xml/:orderId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "finance"
      );
      if (!tenant) return;

      try {
        const order = await prisma.order.findFirst({
          where: { id: req.params.orderId, tenantId: tenant.id },
          select: { nfceStatus: true, nfceKey: true, nfceXml: true },
        });
        if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
        if (order.nfceStatus !== "AUTHORIZED" || !order.nfceKey || !order.nfceXml)
          return res.status(400).json({ error: "NFC-e não autorizada para este pedido." });

        const { xml } = JSON.parse(order.nfceXml as string) as { xml: string };
        res
          .set({
            "Content-Type": "application/xml; charset=utf-8",
            "Content-Disposition": `attachment; filename="NFCe${order.nfceKey}.xml"`,
          })
          .send(xml);
      } catch (err: any) {
        console.error("[NFC-e] Erro ao baixar XML:", err);
        res.status(500).json({ error: err?.message ?? "Erro ao baixar XML." });
      }
    }
  );

  // GET /api/owner/tenants/:tenantId/nfce/danfe/:orderId — dados prontos pro DANFE (cupom fiscal com QR Code)
  app.get(
    "/api/owner/tenants/:tenantId/nfce/danfe/:orderId",
    requireAuth,
    async (req, res) => {
      const tenant = await requireTenantById(
        req,
        res,
        req.params.tenantId,
        "finance"
      );
      if (!tenant) return;

      try {
        const order = await prisma.order.findFirst({
          where: { id: req.params.orderId, tenantId: tenant.id },
          include: { items: { include: { product: true } } },
        });
        if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
        if (order.nfceStatus !== "AUTHORIZED" || !order.nfceKey || !order.nfceProtocol || !order.nfceXml)
          return res.status(400).json({ error: "NFC-e não autorizada para este pedido." });
        if (!tenant.fiscalConfig)
          return res.status(400).json({ error: "Configuração fiscal não encontrada." });

        const fiscal = JSON.parse(
          tenant.fiscalConfig as string
        ) as import("../../types.js").FiscalConfig;
        const { xml } = JSON.parse(order.nfceXml as string) as { xml: string };

        let emitAddress = "";
        try {
          const parsed = tenant.address ? JSON.parse(tenant.address as string) : null;
          if (parsed) {
            const parts = [
              `${parsed.street || ""}${parsed.number ? `, ${parsed.number}` : ""}`,
              parsed.neighborhood || "",
              `${fiscal.xMun || ""}${fiscal.uf ? ` - ${fiscal.uf}` : ""}`,
            ].filter(Boolean);
            emitAddress = parts.join(" · ");
          }
        } catch {
          /* endereço inválido — segue sem endereço no DANFE */
        }

        const { buildDanfeData } = await import("../../lib/danfe.js");
        const { getUrlChave, getUrlQrCode } = await import("../../lib/fiscal.js");

        // "Venda PDV" é o nome padrão de pedido de balcão sem cliente identificado (não um
        // cliente real) — não faz sentido exibir "Cliente: Venda PDV" no cupom impresso.
        const customerName =
          order.customerName && order.customerName !== "Venda PDV"
            ? order.customerName
            : undefined;

        const danfe = buildDanfeData({
          fiscal,
          emitName: tenant.name,
          emitAddress,
          numero: order.nfceNumber ?? 0,
          serie: fiscal.serie || 1,
          chave: order.nfceKey,
          protocolo: order.nfceProtocol,
          xmlAutorizado: xml,
          consultaUrlBase: getUrlChave(fiscal.uf, fiscal.ambiente),
          qrCodeUrlBase: getUrlQrCode(fiscal.uf, fiscal.ambiente),
          customerName,
          customerCpf: order.customerCpf || undefined,
          subtotal: order.items.reduce(
            (sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.price || 0),
            0
          ),
          discountAmount: order.discount || undefined,
          feeAmount: order.feeAmount || undefined,
          feePercent: order.feePercent || undefined,
          feePassedToCustomer: order.feePassedToCustomer,
          serviceFeeAmount: order.serviceFeeAmount || undefined,
          serviceFeePercent: order.serviceFeePercent || undefined,
          realItemNames: order.items.map(
            (item: any) => item.productName ?? item.product?.name ?? ""
          ),
        });

        const QRCode = (await import("qrcode")).default;
        const qrCodeDataUrl = await QRCode.toDataURL(danfe.qrCodeUrl, { margin: 1, width: 200 });

        res.json({ ...danfe, qrCodeDataUrl });
      } catch (err: any) {
        console.error("[NFC-e] Erro ao montar DANFE:", err);
        res.status(500).json({ error: err?.message ?? "Erro ao montar DANFE." });
      }
    }
  );

  // PATCH /api/owner/products/:productId/fiscal — salva dados fiscais de um produto
  app.patch(
    "/api/owner/products/:productId/fiscal",
    requireAuth,
    async (req, res) => {
      const { productId } = req.params;
      const { ncm, cfop, csosn, unitCom, origem, aliqIcms } = req.body;
      try {
        const product = await prisma.product.findUnique({
          where: { id: productId },
          select: { tenantId: true },
        });
        if (!product)
          return res.status(404).json({ error: "Produto não encontrado." });
        const tenant = await requireTenantById(
          req,
          res,
          product.tenantId,
          "menu"
        );
        if (!tenant) return;

        const updated = await prisma.product.update({
          where: { id: productId },
          data: {
            ...(ncm !== undefined && { ncm: ncm || null }),
            ...(cfop !== undefined && { cfop: cfop || null }),
            ...(csosn !== undefined && { csosn: csosn || null }),
            ...(unitCom !== undefined && { unitCom: unitCom || "UN" }),
            ...(origem !== undefined && { origem: Number(origem) }),
            ...(aliqIcms !== undefined && { aliqIcms: Number(aliqIcms) }),
          },
        });
        res.json(updated);
      } catch (err: any) {
        res.status(500).json({ error: err?.message });
      }
    }
  );

  // Manifest do PWA varia por subdomínio: cozinha.boxsys.com.br precisa de nome/ícone
  // próprios ("Cozinha BoxSys"), senão o atalho "Adicionar à Tela de Início" no
  // celular/iPad sai com o nome e ícone genéricos do sistema (Box Sys). Precisa vir antes
  // do express.static (que serve o manifest.webmanifest genérico gerado pelo build).
  app.get("/manifest.webmanifest", (req, res) => {
    const isKitchen = req.hostname === "cozinha.boxsys.com.br";
    res.set("Content-Type", "application/manifest+json").json({
      name: isKitchen ? "Cozinha BoxSys" : "Box Sys PDV",
      short_name: isKitchen ? "Cozinha BoxSys" : "Box Sys",
      description: isKitchen
        ? "Painel de pedidos da cozinha BoxSys"
        : "Cardápio digital e PDV Box Sys",
      theme_color: "#0D1B3E",
      background_color: "#0D1B3E",
      display: "standalone",
      orientation: "portrait",
      start_url: isKitchen ? "/" : "/painel",
      scope: "/",
      icons: [
        {
          src: isKitchen ? "/images/cozinha-icon.png" : "/images/app_celular.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: isKitchen ? "/images/cozinha-icon.png" : "/images/app_celular.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    });
  });
}
