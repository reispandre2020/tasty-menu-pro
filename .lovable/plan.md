# Refatoração do Checkout — Fluxo de 10 Passos (estilo MenuDino)

Substituir a página única `/checkout` por um fluxo guiado, passo a passo, igual ao MIX DO SABOR. Cada passo é uma tela com header (seta voltar + título) e o card "Resumo" fixo (no desktop à direita, no mobile abaixo).

## Estrutura de rotas

Vou usar uma única rota `/checkout` com **state machine interna** (etapas controladas por `useState` + URL search param `?step=`), evitando criar 10 rotas separadas e mantendo o estado do pedido vivo entre os passos.

```
/checkout?step=identificacao   → Passo 1-2
/checkout?step=entrega         → Passo 3-4
/checkout?step=endereco        → Passo 6
/checkout?step=confirmar-entrega → Passo 7
/checkout?step=pagamento       → Passo 8-9
/checkout?step=revisao         → Passo 10
```

O passo 5 (mapa) é um **Dialog** sobreposto, não rota.

## Os 10 passos

1. **Identificação** — nome + WhatsApp (ícone WhatsApp no input)
2. **Validação** — mensagens vermelhas "*O nome deve ter 3 ou mais caracteres!*" e "*Informe o número de telefone!*" abaixo dos campos
3. **Opções de entrega (com endereço salvo)** — cards: "Usar minha localização atual", endereço salvo, "Digitar meu endereço" (com input CEP + botão BUSCAR CEP), e card "Ir até o estabelecimento" no fim
4. **Opções de entrega (sem endereço salvo)** — mesma tela, sem o card de endereço salvo
5. **Modal de mapa** — Dialog com mapa estático (placeholder com pin), título "A localização está correta?", endereço, botões AJUSTAR / CONFIRMAR. *(Mapa real do Google exigiria API key — uso um placeholder visual fiel.)*
6. **Form de endereço completo** — Novo CEP, UF, Cidade (Select), Bairro, Endereço, Número (+ checkbox "Sem número"), Complemento (+ "Sem compl."), Ponto de Referência. Botão CONFIRMAR.
7. **Confirmação de entrega** — endereço escolhido + taxa de entrega + opção "Agora (50-60min)" selecionável + link "Alterar entrega ou endereço"
8. **Pagamento** — Tabs "Pague na entrega" + radios: Dinheiro, Cartão de Crédito, Cartão de Débito, Pix Manual (cada um com ícone colorido)
9. **Troco** — Bottom sheet/section que abre ao escolher Dinheiro: "Preciso de troco para: R$ ___" com botões NÃO PRECISO / CONTINUAR
10. **Revisão final** — "Confirmar pedido" com Minha Sacola (itens + "Ver e Editar"/"Adicionar mais itens"), Entregar no endereço (+ Trocar), Pagamento (+ Trocar), campos Cupom, CPF/CNPJ, Observação, e botão grande **ENVIAR PEDIDO** dentro do card Resumo

## Card Resumo (lateral)

Fixo à direita em telas ≥`lg`, abaixo do conteúdo no mobile. Mostra:
- "X item(s) — R$ XX,XX"
- "Taxa de entrega — GRÁTIS / R$ X,XX" (some quando modo é retirada)
- Linha divisória
- "Total — R$ XX,XX"
- Botão ENVIAR PEDIDO **só no passo 10**

## Persistência

Estado do checkout vive em um `useReducer` dentro do `/checkout`. Itens do carrinho continuam no `cart-store` (localStorage). O pedido só é gravado no Supabase ao clicar **ENVIAR PEDIDO** no passo 10 — mesma lógica atual de insert em `orders` + `order_items`.

## Arquivos a alterar

- `src/routes/checkout.tsx` — reescrita completa com state machine de 10 passos
- *(opcional)* `src/components/checkout/CheckoutSummary.tsx`, `StepHeader.tsx`, `MapConfirmDialog.tsx` para organizar

## Detalhes técnicos

- Sem mudanças no schema do banco — usa as mesmas colunas (`customer_name`, `customer_phone`, `customer_address`, `notes`, `payment_method`, etc.)
- Troco é salvo como sufixo em `notes`: `"Troco para R$ 50,00. <obs do cliente>"`
- CEP/UF/Cidade/Bairro/Número são concatenados em `customer_address` (string única, sem alterar schema)
- Busca de CEP via API pública `viacep.com.br` (sem necessidade de key)
- Cupom e CPF são UI-only por enquanto (sem coluna no schema) — mostro toast "Cupom inválido" / aceito o CPF mas só registra em `notes`

## Fora do escopo

- Mapa real do Google Maps (precisa API key — uso placeholder visual)
- Geolocalização real do navegador (uso fluxo direto para o form de endereço)
- Integração de cupons reais (UI apenas)