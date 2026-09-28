# /api-externa-tenants — API externa server-to-server (criar/consultar/editar/bloquear/deletar estabelecimentos)

Referência de como outra aplicação (ex: store-stock) consome a API de gerenciamento de
estabelecimentos do Cardápio Delivery/BoxSys, sem depender de login de sessão humana.

## Onde vive

- Código: `src/backend/routes/external-api-routes.ts`
- Registrada em `server.ts` via `registerExternalApiRoutes`
- Produção: `https://menu.boxsys.com.br/api/external/...`

## Autenticação

Toda chamada precisa do header `x-api-key` com o valor de `EXTERNAL_API_KEY` (variável de
ambiente no `.env` da VPS, `/var/www/develoi-cardapio/.env`). Sem essa chave ou com chave
errada, retorna `401`. Se a env var não estiver setada no servidor, retorna `503`.

```
x-api-key: <valor de EXTERNAL_API_KEY>
```

Nunca commitar essa chave em texto puro em nenhum repositório — ela só existe no `.env` de
cada ambiente (local e VPS).

## Endpoints

### `GET /api/external/tenants`
Lista todos os estabelecimentos, cada um com a conta dona e a assinatura mais recente.

### `GET /api/external/tenants/:id`
Consulta um estabelecimento específico.

Resposta (ambos os GETs acima retornam esse formato, um array no list):
```json
{
  "id": "tenant_id",
  "name": "Nome da Loja",
  "slug": "nome-da-loja",
  "isOpen": true,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "account": { "id": "acc_id", "name": "Dono", "email": "dono@email.com" },
  "subscription": {
    "id": "sub_id",
    "status": "ACTIVE",
    "planId": "plan_id",
    "planName": "Plano Pro",
    "pricePaid": 99.9,
    "startsAt": "...",
    "expiresAt": "..."
  }
}
```
`account`/`subscription` vêm `null` se não houver (ex: tenant órfão sem membership OWNER).

### `POST /api/external/tenants`
Cria Account (dono) + Tenant (loja) + TenantMembership (role OWNER) numa chamada só, e
opcionalmente já ativa uma assinatura se `planId` for enviado.

Body:
```json
{
  "ownerName": "Nome do Dono",
  "ownerEmail": "dono@email.com",
  "ownerPassword": "senha-em-texto-puro-sera-hasheada",
  "tenantName": "Nome da Loja",
  "tenantSlug": "nome-da-loja",
  "planId": "opcional-id-do-plano"
}
```
`ownerName`, `ownerEmail`, `ownerPassword` e `tenantName` são obrigatórios. `tenantSlug` é
opcional (deriva de `tenantName` se omitido, via `sanitizeSlug`). Retorna `400` se já existir
conta com esse e-mail ou tenant com esse slug. Sucesso: `201` com `{ account, tenant }`.

### `PATCH /api/external/tenants/:id`
Edita campos do tenant. Body aceita qualquer subconjunto de: `name`, `description`,
`address`, `whatsapp`. Retorna o tenant atualizado no mesmo formato do GET.

### `POST /api/external/tenants/:id/block`
"Bloqueia" o cliente cancelando (`status: "CANCELLED"`) qualquer assinatura `ACTIVE` da
conta dona daquele tenant. Não deleta nada — é reversível via `/unblock`.

### `POST /api/external/tenants/:id/unblock`
Reativa o cliente criando uma nova `Subscription` com `status: "ACTIVE"`. Body opcional:
```json
{ "planId": "opcional", "durationDays": 30 }
```
Se `planId` for omitido, reusa o plano da assinatura mais recente da conta (cancelada ou
não). Se não houver nenhuma assinatura anterior e `planId` não for enviado, retorna `400`.

### `DELETE /api/external/tenants/:id`
Deleta o tenant permanentemente (cascade do Prisma cuida de limpar dados relacionados,
conforme `onDelete` do schema). **Não deleta a Account do dono** — só o tenant. Isso é
destrutivo e não tem undo; confirme com o usuário antes de chamar isso a partir de outra
aplicação de forma automática.

### `GET /api/external/plans`
Lista os planos de assinatura ativos (`isActive: true`), para "ver valores" antes de criar
ou desbloquear um tenant.
```json
[{ "id": "plan_id", "name": "Plano Pro", "description": "...", "price": 99.9, "durationDays": 30 }]
```

## Exemplo de uso (curl)

```bash
# Listar estabelecimentos
curl -s https://menu.boxsys.com.br/api/external/tenants \
  -H "x-api-key: $EXTERNAL_API_KEY"

# Criar um novo cliente
curl -s -X POST https://menu.boxsys.com.br/api/external/tenants \
  -H "x-api-key: $EXTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ownerName": "Maria Silva",
    "ownerEmail": "maria@restaurante.com",
    "ownerPassword": "senha-forte-aqui",
    "tenantName": "Restaurante da Maria",
    "planId": "plan_xxx"
  }'

# Bloquear um cliente inadimplente
curl -s -X POST https://menu.boxsys.com.br/api/external/tenants/TENANT_ID/block \
  -H "x-api-key: $EXTERNAL_API_KEY"
```

## Notas de implementação

- Tenant não tem `accountId` direto no schema — o vínculo dono↔loja é via
  `TenantMembership` com `role: "OWNER"`. Toda consulta/edição que precisa da conta dona
  primeiro busca essa membership.
- "Bloquear" não é um campo booleano no Tenant — é o `status` da `Subscription` mais
  recente da conta (`ACTIVE` → `CANCELLED` e vice-versa). Mesmo mecanismo que o painel
  Super Admin usa internamente.
- Se precisar de mais endpoints (ex: editar senha do dono, listar apenas tenants
  bloqueados, webhooks de eventos), adicionar em `external-api-routes.ts` seguindo o
  mesmo padrão de `requireApiKey` + serialização plana em JSON.
