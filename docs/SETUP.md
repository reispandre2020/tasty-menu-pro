# Cardápio Digital Integrado Consumer — Setup

## 1. Supabase

1. Acesse seu projeto em https://supabase.com/dashboard
2. **SQL Editor → New query** → cole todo o conteúdo de `docs/SUPABASE_MIGRATIONS.sql` → **Run**
3. Em **Authentication → Providers → Email**: deixe ativo. Para testes mais rápidos, desligue "Confirm email".
4. Crie seu primeiro usuário admin:
   - Opção A: **Authentication → Users → Add user** (Email + senha).
   - Copie o `id` (UUID) do usuário.
   - Volte ao **SQL Editor** e rode:
     ```sql
     insert into public.user_roles (user_id, role) values ('COLE-AQUI-O-UUID','admin');
     ```

## 2. Variáveis de ambiente

Já configuradas neste projeto:

| Nome | Tipo | Onde |
|------|------|------|
| `VITE_SUPABASE_URL` | público | `.env` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | público | `.env` |
| `SB_SERVICE_ROLE_KEY` | **secret** (server) | gerenciador de secrets |
| `CONSUMER_API_TOKEN` | **secret** (server) | adicionar antes de habilitar Consumer |

> O `SB_SERVICE_ROLE_KEY` substitui o `SUPABASE_SERVICE_ROLE_KEY` (esse prefixo é reservado pela plataforma).

## 3. Acesso ao admin

- URL: `/admin/login`
- Logue com o usuário que recebeu role `admin`.
- Áreas: **Pedidos** (Kanban), **Produtos**, **Categorias**, **Configurações**.

## 4. Integração com o Programa Consumer

Endpoints expostos por este projeto (todos sob `/api/consumer/*`):

| Método | Caminho | Função |
|--------|---------|--------|
| GET | `/api/consumer/orders` | **Polling de eventos** (PLC/CFM/CAN/DSP/CON). Marca eventos como lidos automaticamente — passe `?ack=false` para dry-run. |
| GET | `/api/consumer/orders/:id` | Detalhes do pedido no formato oficial (consulta) |
| POST | `/api/consumer/orders/details` | Envio de detalhes conforme PDF: aceita o pedido completo (`Id`, `Items`, `Total`, `Payments`...) e responde `{ statusCode: 0 }`. Também aceita a variação `{ OrderId, EventCode, EventFull }`. |
| PATCH | `/api/consumer/orders/:id/status` | Atualizar status. Body: `{ orderId, status, justification? }`. Enums: `CONFIRMED`, `CANCELLED`, `READY_FOR_PICKUP`, `DISPATCHED`, `CONCLUDED` |

**Autenticação:** Bearer token estático no header `Authorization: Bearer <CONSUMER_API_TOKEN>`.

### Configuração no painel Consumer (https://ajuda.programaconsumer.com.br/integracao-api-do-parceiro/)

1. **Token:** valor configurado no secret `CONSUMER_API_TOKEN`
2. **Consulta de eventos / polling:** `https://SEU-DOMINIO.lovable.app/api/consumer/orders`
3. **Consulta de detalhes:** `https://SEU-DOMINIO.lovable.app/api/consumer/orders/{orderId}`
4. **Envio de detalhes:** `https://SEU-DOMINIO.lovable.app/api/consumer/orders/details`
5. **Alteração de status:** `https://SEU-DOMINIO.lovable.app/api/consumer/orders/{orderId}/status`
6. **Merchant ID:** o ID do seu estabelecimento no Consumer — salve em `store_settings.consumer_merchant_id` via tela de Configurações.

> Para habilitar a integração, adicione o secret `CONSUMER_API_TOKEN` (qualquer string longa e aleatória) no gerenciador de secrets do projeto e cole o mesmo valor no painel do Consumer.

## 5. Modalidades de pedido

O checkout suporta:
- **Retirada no balcão** (`mode = pickup`)
- **Delivery** (`mode = delivery`, exige endereço)
- **Mesa** (`mode = dine_in`, exige número da mesa)
