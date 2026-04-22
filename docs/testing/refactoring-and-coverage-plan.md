# Plano de Refatoração e Cobertura de Testes

## Contexto

Este documento define o plano para melhorar a arquitetura do frontend do CloudEasyFiles,
fragmentando componentes grandes em unidades menores e focadas, e em seguida aumentar
a cobertura de testes aproveitando a maior testabilidade resultante.

### Estado atual (pós Milestone C)

- Frontend line coverage: `42.77%`
- Rust line coverage: `46.83%`
- Maior gargalo: `ConnectionNavigator.tsx` — 6.299 linhas, 0% de cobertura,
  78 state variables, 148 hook usages, 44 handlers, JSX começa na linha 323

---

## Princípios do Plano

1. **Segurança acima de velocidade** — cada passo deve deixar o app funcionando
2. **Incremental** — extrações pequenas e verificáveis, não rewrites
3. **Testabilidade primeiro** — cada extração deve produzir algo diretamente testável
4. **Sem mudança de comportamento** — refactoring puro; features novas são separadas

---

## Parte 1 — Refatoração de Arquitetura

### 1.1 ConnectionNavigator.tsx — Decomposição em Fases

O componente atual acumula 11 responsabilidades distintas num único arquivo.
A estratégia é extrair responsabilidades em camadas, da mais fácil para a mais complexa.

#### Fase CN-1: Extração de Hooks de Estado (menor risco)

Extrair grupos de state+handlers em custom hooks. O componente principal continua
existindo como orquestrador; os hooks apenas organizam o state internamente.

| Hook | Conteúdo extraído | Estimativa |
|------|------------------|-----------|
| `useConnectionFormState` | state do formulário de conexão (modo, draft, errors, test state) | CN-1a |
| `useTransferState` | estado de uploads/downloads ativos, progress, cancellation | CN-1b |
| `useContentListingState` | listagem, paginação, filtros, seleção de itens | CN-1c |
| `useModalOrchestrationState` | estado dos 6+ modais (restore, change-tier, delete, create-folder, upload-settings, conflict) | CN-1d |
| `useNavigationPreferencesState` | sidebar width, view mode, page size, cache directory | CN-1e |

Cada hook fica em `src/features/navigation/hooks/`.
Cada hook é testável independentemente com `renderHook` do `@testing-library/react`.

#### Fase CN-2: Extração de Componentes de Renderização (risco médio)

Após os hooks estarem estabilizados, extrair seções do JSX em componentes focados.

| Componente | Responsabilidade | Depende de |
|-----------|-----------------|-----------|
| `ConnectionsSidebar` | árvore de conexões, filtro de árvore, botão de adicionar conexão | `useConnectionFormState`, tree state |
| `ContentExplorerHeader` | breadcrumb, barra de ferramentas (upload, criar pasta, filtro de conteúdo, view mode) | `useContentListingState` |
| `ContentItemList` | lista de arquivos/pastas, seleção, menus contextuais, status badges | `useContentListingState`, `useTransferState` |
| `TransferProgressBar` | barra de progresso de uploads/downloads ativos | `useTransferState` |
| `ConnectionFormModal` | formulário completo de criar/editar conexão (já tem lógica complexa) | `useConnectionFormState` |
| `NavigatorModalOrchestrator` | renderização condicional de todos os modais | `useModalOrchestrationState` |

Cada componente fica em `src/features/navigation/components/`.

#### Fase CN-3: Contexto Compartilhado (risco maior, opcional)

Se a prop-drilling entre CN-2 se tornar pesada, extrair um `NavigatorContext` para
compartilhar estado entre os subcomponentes sem prop drilling.

Avaliar após CN-2: se a interface entre os componentes extraídos for limpa e estável,
o contexto não é necessário.

---

### 1.2 Outros Candidatos a Refatoração

#### `navigationPresentation.ts` (289 linhas)

Arquivo com 8+ responsabilidades distintas. Separar em:

| Arquivo destino | Conteúdo |
|----------------|---------|
| `navigationFormatting.ts` | `formatBytes`, `formatDateTime`, `normalizeFilterText`, `getFileNameFromPath` |
| `navigationStatusUtils.ts` | `getDisplayContentStatus`, `getContentStatusLabel`, `getSummaryContentStatuses`, `getFileStatusBadgeDescriptors`, `getPreferredFileStatusBadgeDescriptors`, `isTemporaryRestoredArchivalFile`, `buildAvailableUntilTooltip` |
| `navigationTreeUtils.ts` | `filterTreeNodes`, `matchesFilter`, `buildBreadcrumbs`, `getPathTitle`, `buildContentCounterLabel` |
| `navigationErrorUtils.ts` | `extractErrorMessage`, `buildConnectionFailureMessage`, `isCancelledTransferError`, `isUploadExistsPreflightPermissionError`, `getConnectionActions` |

O arquivo original pode ser mantido como re-export de tudo para preservar compatibilidade
com os imports existentes enquanto a migração acontece.

#### `navigationGuards.ts` (339 linhas)

Mistura tipos, guards de validação e builders de estado. Separar em:

| Arquivo destino | Conteúdo |
|----------------|---------|
| `navigationTypes.ts` | todos os tipos e interfaces de navigation (`NavigationFileActionId`, etc.) |
| `navigationItemGuards.ts` | `canDownloadItem`, `canRestoreItem`, `canChangeTierItem`, `canDeleteItem`, `canDownloadAsItem`, `hasActiveTransferForItem` |
| `navigationSelectionGuards.ts` | `toggleSelectedItemId`, `toggleVisibleSelection`, `getBatchSelectionActions` |
| `navigationOperationBuilders.ts` | `buildPendingDeleteState`, `buildFileIdentity`, `buildUploadObjectKey`, `normalizeDirectoryPrefix`, `dedupeDirectoryPrefixes` |

#### `connectionService.ts` (338 linhas)

Mistura normalização, validação e persistência para dois providers. Separar em:

| Arquivo destino | Conteúdo |
|----------------|---------|
| `connectionNormalization.ts` | `normalizeConnectionName`, `normalizeStorageAccountName`, etc. |
| `connectionValidation.ts` | `isConnectionNameFormatValid`, `isStorageAccountNameFormatValid`, etc. |
| `awsConnectionService.ts` | operações CRUD específicas de AWS |
| `azureConnectionService.ts` | operações CRUD específicas de Azure |

O `connectionService.ts` passa a ser apenas uma fachada que delega às implementações.

---

## Parte 2 — Cobertura de Testes

### 2.1 Metas de Cobertura

| Milestone | Frontend | Rust | Pré-requisito |
|-----------|----------|------|--------------|
| **D** | `50%` | `55%` | CN-1 (hooks extraídos) + splits de `navigationPresentation.ts` |
| **E** | `65%` | `65%` | CN-2 (componentes extraídos) |
| **Final** | `75%` | `75%` | CN-3 opcional + cobertura residual |

### 2.2 Ganhos por Fase de Refatoração

#### Após CN-1 (hooks) → Milestone D

Cada custom hook extraído é testável com `renderHook`. Estimativa de novas linhas cobertas:

| Hook | Linhas estimadas cobertas |
|------|--------------------------|
| `useTransferState` | ~200 |
| `useContentListingState` | ~300 |
| `useConnectionFormState` | ~200 |
| `useModalOrchestrationState` | ~150 |
| `useNavigationPreferencesState` | ~50 |

Splits de `navigationPresentation.ts` + `navigationGuards.ts` contribuem mais ~150 linhas.
**Estimativa total para Milestone D**: +850 linhas cobertas (de 4.079 → ~4.900, ~43%)

#### Após CN-2 (componentes) → Milestone E

Componentes isolados são testáveis com `render` do `@testing-library/react`.
Cada componente extraído tem menos de 300 linhas e dependências mockáveis.

| Componente | Linhas estimadas cobertas |
|-----------|--------------------------|
| `ConnectionsSidebar` | ~400 |
| `ContentItemList` | ~500 |
| `ContentExplorerHeader` | ~200 |
| `ConnectionFormModal` | ~300 |
| `NavigatorModalOrchestrator` | ~150 |

**Estimativa total para Milestone E**: +1.500 linhas adicionais (~56% total)

#### Cobertura residual → Final 75%

Após CN-2, o `ConnectionNavigator.tsx` original será um orquestrador com <300 linhas,
testável com um teste de integração simples. O caminho para 75% fica viável com
cobertura de componentes restantes (formulários de conexão, `main.tsx`, etc.).

---

## Parte 3 — Roadmap de Execução

### Etapas imediatas (próxima sessão)

- [x] **Step RF1** — Split de `navigationPresentation.ts` em 4 arquivos focados
  - `navigationFormatting.ts`, `navigationErrorUtils.ts`, `navigationTreeUtils.ts`, `navigationStatusUtils.ts`
  - `navigationPresentation.ts` → barrel de 44 linhas
- [x] **Step RF2** — Split de `navigationGuards.ts` em 4 arquivos focados
  - `navigationTypes.ts`, `navigationOperationBuilders.ts`, `navigationItemGuards.ts`, `navigationSelectionGuards.ts`
  - `navigationGuards.ts` → barrel de re-exports
- [x] **Step V2** — Re-medir cobertura após splits
  - Frontend: `36.41%` (sem alteração — splits puros, sem novos testes)

### CN-1: Hooks de Estado

- [x] **Step CN-1a** — Extrair `useNavigationPreferencesState` (menor, menos dependências)
  - Hook em `src/features/navigation/hooks/useNavigationPreferencesState.ts`
  - 7 testes em `useNavigationPreferencesState.test.ts`
  - Build e 273 testes passando
- [x] **Step CN-1b** — Extrair `useTransferState`
  - Hook em `src/features/navigation/hooks/useTransferState.ts`
  - 7 testes em `useTransferState.test.ts`
  - Build e 280 testes passando
- [x] **Step CN-1c** — Extrair `useModalOrchestrationState`
  - Hook em `src/features/navigation/hooks/useModalOrchestrationState.ts`
  - 7 testes em `useModalOrchestrationState.test.ts`
  - Adicionado `name?: string` a `NavigationContentItem`
  - Build e 287 testes passando
- [x] **Step CN-1d** — Extrair `useContentListingState`
  - Hook em `src/features/navigation/hooks/useContentListingState.ts`
  - 7 testes em `useContentListingState.test.ts`
  - Build e 294 testes passando
- [x] **Step CN-1e** — Extrair `useConnectionFormState`
  - Hook em `src/features/navigation/hooks/useConnectionFormState.ts`
  - 7 testes em `useConnectionFormState.test.ts`
  - Build e 301 testes passando
- [x] **Step V3** — Re-medir após hooks + escrever testes dos hooks
  - CN-1 completo: 5 hooks extraídos
  - Frontend line coverage: `38.63%`
  - 42 arquivos de teste, 301 testes passando

### CN-2: Componentes

- [x] **Step CN-2a** — Extrair `ContentItemList`
  - Componente em `src/features/navigation/components/ContentItemList.tsx`
  - 6 testes em `ContentItemList.test.tsx`
  - Build e 307 testes passando
- [ ] **Step CN-2b** — Extrair `ContentExplorerHeader`
- [ ] **Step CN-2c** — Extrair `ConnectionsSidebar`
- [ ] **Step CN-2d** — Extrair `ConnectionFormModal`
- [ ] **Step CN-2e** — Extrair `NavigatorModalOrchestrator`
- [ ] **Step V4** — Re-medir após componentes + escrever testes dos componentes

### Splits de suporte

- [ ] **Step RF3** — Split de `navigationGuards.ts`
- [ ] **Step RF4** — Split de `connectionService.ts`
- [ ] **Step V5** — Re-medir e confirmar Milestone Final

---

## Parte 4 — Regras de Execução

1. Cada step termina com:
   - testes passando (`npm run test:frontend`)
   - build passando (`npm run build`)
   - medição de cobertura registrada neste arquivo
   - commit dedicado

2. Ao extrair um hook ou componente de `ConnectionNavigator.tsx`:
   - o comportamento do app deve ser **idêntico** antes e depois
   - a verificação é manual: testar os fluxos principais no app

3. Ao criar novos arquivos de teste:
   - preferir testes de comportamento, não de implementação
   - não testar detalhes de renderização HTML; testar outputs observáveis

4. Ao fazer splits de módulos `.ts`:
   - manter um arquivo de re-export no caminho original enquanto houver imports apontando para ele
   - atualizar imports gradualmente, não em massa

---

## Latest Measurements

- Baseline Milestone C: Frontend `36.39%`, Rust `46.83%`
- Post CN-1a: 38 test files, 273 tests passing (7 novos do hook)
- Post CN-1b: 39 test files, 280 tests passing (7 novos do hook)
- Post CN-1c: 40 test files, 287 tests passing (7 novos do hook)
- Post CN-1d: Frontend `38.34%`, 41 test files, 294 tests passing (7 novos do hook)
- Post CN-1e: Frontend `38.63%`, 42 test files, 301 tests passing (7 novos do hook)
- Post CN-2a: Frontend `42.77%`, 43 test files, 307 tests passing (6 novos do componente)
