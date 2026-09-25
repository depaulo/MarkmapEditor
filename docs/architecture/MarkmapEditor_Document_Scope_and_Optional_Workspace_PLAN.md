# MarkmapEditor: documento unico e Workspace opcional

> Documento de planejamento para adicionar ao repositorio em `docs/architecture/MarkmapEditor_Document_Scope_and_Optional_Workspace_PLAN.md`.
> Estado: PROPOSTA, nao implementado. Base inspecionada: Repomix `repomix-output-depaulo-MarkmapEditor (16).xml`, recebido em 25/09/2026. Nao substitui uma auditoria do checkout real antes de cada ACT.

## 1. Decisao de produto

Preservar o Editor simples como a experiencia original: abrir/criar Markdown, editar, visualizar Markmap/HTML e salvar em qualquer lugar. Recursos adicionais do documento atual sao opcionais e nao exigem selecionar uma pasta. Selecionar Workspace adiciona navegacao e agregacao entre arquivos; nao muda a natureza canonica do documento. Esta etapa e uma **evolucao de escopo e experiencia**, nao uma migracao fisica de dados.

Destino proposto:

```text
Documento unico, sem Workspace -> Editor simples + recursos locais sob demanda
Workspace selecionado          -> mesmo documento + biblioteca e agregacoes
Slides                        -> contexto especializado preservado
```

Nao prometer que o destino ja existe. O modo Journal e a Sidebar ainda estao acoplados na interface atual. O fim do seletor Journal e uma decisao posterior, apos validacao da experiencia equivalente.

### Nao objetivos desta etapa

Nao mover `journals/`, `concepts/` ou `archive/`; nao converter Archive em flag; nao unificar fisicamente as pastas; nao criar `type: note` obrigatorio; nao reescrever Wiki Links; nao alterar a sintaxe de Tasks; nao substituir Report/Draw.io; nao remover Slides; nao criar um segundo editor, segundo Index, segundo parser de Tasks ou store paralelo. Pinned, Knowledge, Timeline substituindo Journal e pasta unica permanecem no redesign completo futuro.

## 2. Evidencia diretamente observada no snapshot

- `js/main.js:501-519` define `WORKSPACE_INDEX_STATE` e o publica globalmente. `js/main.js:997-1038` so constroi o indice se existe `WORKSPACE_STATE.rootHandle` e agrega arquivos das listas `journals` e `concepts`. `js/main.js:1126-1154` publica os registros e dispara `mme-workspace-index-ready`.
- `js/workspace/workspace-state.js:1-20` e o owner do root, das pastas e do `activeFile`. `js/workspace/workspace-controller.js:184-202` seleciona a pasta e garante subpastas fisicas. Portanto, 'Workspace opcional' nao equivale hoje a 'Workspace sem estrutura de pastas'.
- `js/main.js:9289-9318`, `9643-9703`, `9875-9956` mostram os caminhos New/Open/Save, com handle e baseline de Tasks. `js/main.js:9275-9285` atualiza o Index apos salvar quando existe `activeFile`. O comportamento exato de cada transicao com arquivo externo, Save As e relatorio virtual precisa de testes no checkout.
- `css/workspace.css:227-263` oculta a Sidebar fora do contexto `journal`; `js/main.js:3255-3279` adia paineis sem root. O modulo Report tem um ciclo proprio de `ensure` em `js/report/report-panel.js:157-180`. Tornar a Sidebar visivel em Editor nao torna seus paineis independentes do Workspace.
- `js/main.js:587-594` implementa `getMarkdownTitle`. `js/workspace/workspace-parser.js:732-768` grava `parsed.title` no registro do Index. O extrator atual de headings (`js/main.js:568-584`) usa linhas com regex: nao presumir suporte a headings em fences, H1 formatado ou todos os casos de frontmatter sem teste.
- `js/workspace/workspace-sidebar.js:11-50` mostra `file.name` e preserva `data-path`; `js/main.js:5231-5257` atualiza SOMENTE os botoes `data-kind="journals"` a partir do Index. Esta e a explicacao direta para o Concept continuar com filename na Sidebar. `js/main.js:3494-3533` ja usa `parsed.title` no Active. `js/main.js:5121-5156` usa titulo do Journal e ordenacao cronologica.
- `js/main.js:3692-3763` filtra Search por `name` e `path`, nao por H1, e usa `__workspaceSearchLastQuery`. Portanto, 'mostrar H1' e 'buscar por H1' sao mudancas diferentes; atualizar o Index pode exigir invalidar a consulta em cache para mostrar novo titulo.
- `js/main.js:2261-2289` usa `file.name || file.title` em Related; `js/workspace/workspace-index-document.js:226-241` ja mostra nome e titulo em linhas distintas; `js/workspace/task-review.js:223-226` e `js/tasks/task-board.js:501-525` ja priorizam `parsed.title` em boa parte dos casos. Nao reescrever tudo por simetria visual.
- `js/workspace/workspace-parser.js:450-495` ja contem parser de Projects com pares `Project:` e coleta blocos ate outro Project ou heading. `docs/architecture/MarkmapEditor_Projects_Discovery_MVP_PLAN.md:148-198` documenta sintaxe mais rica/legada. Isso NAO e a declaracao minima posteriormente acordada; antes de Projects, atualizar a proposta e definir convivencia com dados existentes sem migracao automatica.
- `js/release/release.js:15-18` e `sw.js:21` indicam 0.6.1. `STATUS.md:3-9` ainda chama um checkpoint antigo de atual; tratar `STATUS.md` como historico/desatualizado ate reconciliacao, nao como prova do estado atual. O Repomix nao prova branch/HEAD/working tree do checkout ao executar os ACTs.
- `docs/PRODUCT_PRINCIPLES.md:255-275` ja explicita standalone-first e Workspace opt-in. A proposta segue essa direcao sem pressupor que cada recurso ja a implementou.

## 3. Revisao do PLAN anterior do coder

**Preservar:** owners de documento/Workspace, fases independentes, titulo humano separado de path, ausencia de migracao fisica, validadores e checkpoints.

**Corrigir antes de executar:**

1. Nao copiar literalmente o pseudocodigo `MME_SCOPE`: `isAvailable: true` incondicional; `getParsed()` alterna entre Index salvo e texto live; `title` e `getText()` podem representar instantes diferentes; `path` do `activeFile` pode nao corresponder ao handle corrente; inferencia de `kind` por prefixo recria acoplamento.
2. `workspace-parser.js` e IIFE/classic script que expõe `WORKSPACE_PARSER`, nao um modulo ESM com `export function`. Um helper novo deve respeitar o loader existente, se necessario; primeiro preferir o `parsed.title` existente.
3. Nao criar outro extrator de H1. Primeiro testar e, se preciso, corrigir o owner atual, considerando headings em fences, frontmatter, H1 vazio e Markdown inline. Nao alterar sem fixture.
4. Search nao busca H1 atualmente; nao descrever a mudanca como apenas cosmetica. O cache `__workspaceSearchLastQuery` tambem precisa de tratamento se a busca for alterada.
5. Nao abrir Sidebar em Editor por uma regra CSS isolada: `finalizeWorkspaceSidebar()` exige root e o Report tem lifecycle proprio.
6. Nao editar `mode-session.js` para preservar conexao de pasta sem reproduzir defeito. A conexao pertence ao Workspace; a sessao de texto pertence ao ModeSession.
7. Nao incluir Close Workspace nem migracao fisica como precondicao do arquivo unico. Se for adicionado depois, testar guardas de dirty, handles e Report.
8. Nao introduzir `#project` ou frontmatter como sintaxe de Projects. A decisao de produto e uma declaracao Markdown minima, com metadata opcional posterior; o parser atual deve ser avaliado como legado.
9. Nao presumir `package.json`, `main.js` ou `release-parity.cjs` como owners de versao. Reauditar `js/release/release.js` e `sw.js` no fechamento.
10. Nao afirmar que sete suites verdes provam novos fluxos de Sidebar/Tasks/Reports standalone. Sao gates de regressao da base, nao aceitacao do redesign.

## 4. Contratos a decidir antes da implementacao transversal

### 4.1 Identidade e frescor

- Identidade fisica: handle do documento, mais path relativo quando comprovadamente pertence ao Workspace. H1 e rotulo, nunca chave de navegacao.
- Documento atual: texto live do editor e identidade do runtime. Workspace Index: snapshot de arquivos fisicamente salvos. Nao retornar ambos sob um campo ambiguo `parsed`.
- Em arquivo standalone aberto enquanto um Workspace esta conectado, distinguir `workspaceAvailable=true` de `currentDocumentInWorkspace=true`. Verificar pertencimento pelo owner/handle, nao apenas nome igual ou `activeFile` remanescente.
- Em relatorio virtual/salvo, preservar a classificacao existente; nao apresentar source file do Workspace como se fosse o documento atual.
- Em Save As fora da pasta, decidir e testar se `activeFile` deixa de representar o documento aberto. Nao derivar path de filename.
- Duplicatas de H1 nao mudam identidade. Mostrar path secundario onde houver ambiguidade.

### 4.2 Titulo

- Superficies do Index: `parsed.title` salvo com fallback ja produzido pelo parser; filename/path secundario quando necessario. Nao usar H1 nao salvo.
- Superficies do documento atual: se exibirem titulo live, nomear explicitamente essa fonte; nao alterar o Index a cada tecla.
- O parser atual faz fallback retirando apenas `.md` (`workspace-parser.js:750`). Se `.markdown`/`.txt` forem indexados, adicionar testes e ajustar no owner; nao assumir suporte por causa do Open File picker.
- Search por H1 e um requisito de produto separado do rotulo. Se incluido, preservar match por filename/path, resultado atual e politica de atualizacao apos Save.

### 4.3 Experiencia

- Editor simples sem Sidebar obrigatoria. Oferecer recursos locais sob demanda, mantendo o fluxo rapido de criar, editar, visualizar e salvar.
- New/Open nao exigem pasta. Workspace so e selecionado por acao explicita.
- Paineis agregados continuam dependentes do Index; paineis locais devem usar parser ja existente, sem gravar metadata ao abrir.
- Nao prometer 'todas as funcionalidades do Journal em arquivo unico' ate classificar cada funcionalidade. Search global, backlinks globais, Today e Archive sao inerentemente dependentes de uma pasta; Tasks, Projects e Reports locais exigem desenho especifico.

## 5. Sequencia recomendada de ACTs e gates

Os ACTs sao fronteiras de revisao, nao estimativas de duracao. Em todos: ler `docs/AI_DEVELOPMENT_WORKFLOW.md` e `docs/PRODUCT_PRINCIPLES.md`, conferir branch/HEAD/tree real, planejar antes de editar, agrupar alteracoes relacionadas, executar sintaxe e validadores, nao deixar tool calls pendentes, nao fazer bump nem commit/push sem aprovacao.

### ACT 0: reconciliacao documental (PLAN/edicao documental, se aprovada)

- Verificar divergencias em `STATUS.md`, `TODO.md` e no antigo Projects Discovery PLAN; distinguir historico de estado vigente.
- Adicionar ESTE plano a `docs/architecture/`, marcado como proposta; nao alterar a historia de validacao. Referenciar no roadmap vigente depois de confirmacao no checkout.
- Saida: documento versionado e matriz de decisoes, sem codigo, sem APP_VERSION.

### ACT 1: Concept Sidebar title fix, risco baixo

- Inspecionar no checkout `renderSidebarFiles`, `updateWorkspaceJournalSidebarTitlesFromIndex`, `buildWorkspaceIndex`, refresh e fallback. Proposta minima: generalizar a atualizacao de labels indexados de Journals para Concepts, preservando `data-path`, `data-name`, `data-kind`, tooltip e cronologia.
- Evitar alterar Active, Task Review/Board e parser se ja corretos. Search por H1 e Related/Index com titulo primario sao ACTs de UX opcionais separados se a mudanca deixar de ser local.
- Testes: H1 diferente de filename, sem H1, duplicatas, H1 alterado + Save + rebuild, re-scan da Sidebar, clique por path, Journal ordenado, Wiki Links intactos. Browser checkpoint antes de ampliar.
- Arquivos provaveis: `js/main.js`; validator focado novo em `scripts/`; `js/workspace/workspace-sidebar.js` apenas se houver prova de necessidade. Sem mudanca de versao durante experimento.

### ACT 2: matriz de identidade/frescor e contrato minimo, risco medio

- PLAN antes de codigo. Casos: New, Open standalone, Workspace file, arquivo externo com Workspace aberto, Save, Save As dentro/fora, troca Editor/Journal, dirty, Report virtual, Archive e Index ainda nao pronto.
- Especificar accessors derivados para identidade do documento e disponibilidade do Workspace apenas se consumidores concretos justificarem. Sem segundo state store, sem `getParsed()` que oscila entre live/saved e sem novos eventos sem necessidade.
- Verificar `MME_APP.getCurrentDocumentRuntimeState()`, `WORKSPACE_STATE`, `WORKSPACE_INDEX_STATE`, `MME_MODE_RUNTIME_SESSIONS` e guards de Report.
- Gate: testes de identidade e handle; zero mudanca de Save/ModeSession se nenhum bug for demonstrado.

### ACT 3: Sidebar opt-in de documento unico, risco medio/alto

- Primeiro decidir a UI mais simples: Editor permanece sem Sidebar por padrao; um controle revela um shell local leve. Sem Workspace: identidade do documento, Outline e acoes New/Open/Open Workspace. Nao copiar todos os paineis Journal.
- Com Workspace: manter a experiencia existente e seus paineis; evitar rewire duplicado. Validar layout/presets, mobile, dark mode e estados de retorno Editor/Journal.
- Auditar `index.html`, `css/workspace.css`, `js/main.js`, `js/workspace/workspace-sidebar.js`, `js/workspace/workspace-controller.js` e `js/ui/view-layout.js`. Alterar somente owners demonstrados.
- Gate: checkpoints desktop/mobile e regressao da Sidebar Journal antes de acrescentar Tasks locais.

### ACT 4: Tasks do documento atual, risco medio/alto

- Reusar parser `parseMarkdownTasks` e lifecycle de Save fisico. Nao gerar metadata ao abrir painel; nao criar segundo Index. Primeiro lista local read-only, depois operacoes de checkbox/status com caminho de mutacao e Save ja existente. Task Board local somente apos provar origem/navegacao e transicoes.
- Separar estado live de Index salvo; apos Save atualizar views locais e agregadas sem misturar dois snapshots. Testar duplicatas, idempotencia, arquivo novo sem handle, externo e arquivo de Workspace.
- Owners candidatos: `js/main.js`, `js/workspace/task-review.js`, `js/tasks/task-board.js`, `js/tasks/task-lifecycle.js` (nao modificar o ultimo salvo necessidade comprovada).

### ACT 5: decisao de interface Journal/Workspace, risco alto

- Comparar a experiencia standalone validada com Journal atual. Se houver paridade suficiente, planejar como expor Workspace no Editor sem duplicar estados nem retirar Journal imediatamente. O simples seletor CSS nao basta.
- Preservar Today, Timeline, Concepts, Archive, Search, Related, Tags, Workspace Index e Reports; testar mudanca de modo, Report guard, handles e ultimo arquivo.
- Nao remover Journal, nem criar Close Workspace automaticamente. Propor remocao/renomeacao somente em PLAN proprio, com rollback.

### ACT 6: Projects standalone-first, risco medio/alto

- Antes de editar parser, reconciliar o parser `Project:` existente e o plano antigo com a decisao atual: uma declaracao Markdown minima (exemplo acordado: `## Project: Nome`), so a linha de declaracao e estrutural; linhas seguintes sao Markdown normal. Sem obrigar frontmatter ou campos legados.
- Definir leitura conservadora de arquivos existentes sem migracao automatica. Criar parser/Index para documento atual e Workspace, depois metadata opcional `mme-project`, Sidebar leve e Expanded View. Parents principais, subprojects compactos, archive em vez de delete.
- Nao colocar toda a experiencia de Projects num unico ACT. Gates independentes: declaracao/parser; agregacao; metadata; Expanded View.

### ACT 7: Reports do documento atual, risco alto

- O gerador atual depende de periodo e Workspace Index. Definir primeiro o produto 'Quick Report de um documento': quais secoes, Tasks, Projects e contexto entram e como convive com Report virtual/Save/Draw.io. Nao simular um Workspace de um arquivo para reutilizar o gerador.
- Entregar Markdown revisavel antes de adaptar Draw.io. Manter o workflow agregado existente e os guardas de Report.

### ACT 8: fechamento da experiencia e 1.0, risco variavel

- Reminders/Highlights basicos em documento e agregados; Mermaid Markdown-native; Workspace Overview alto nivel; simplificacao de starters; acessibilidade/mobile; Help contextual, Release Notes e VERIFY apos aceitacao; unico bump de versao/cache por pacote aceito; regressao online/offline e update.
- Reavaliar no gate de 1.0 se Journal permanece como contexto compatibilidade ou se sua eliminacao e essencial ao produto. Nao declarar 'modos unificados' antes de implementar e testar a transicao.

## 6. Estrategia de validacao transversal

- Novos validadores devem executar os owners reais, nao apenas procurar strings. Negativos: H1 duplicado, path diferente com filename igual, arquivo externo com Workspace conectado, Save As, Index atrasado, Report virtual, checkbox sem Save, cancelamento de picker.
- Em cada ACT: `node --check` nos JS/CJS alterados, validator focado, sete suites existentes quando tocadas indiretamente, strict release parity, `git diff --check`, diff/status e ausencia de instrumentacao.
- Browser checkpoints depois de titulos, Sidebar, Tasks e transicao Workspace; testar PWA publicado so apos closure. O snapshot Repomix nao substitui esses testes.
- Release closure segue owners reais `js/release/release.js` e `sw.js`, Help, Release Notes e VERIFY. Nao atualizar versionamento durante experimento nao aceito. O smoke offline especifico de 0.6.1 deve ser registrado conforme evidencia real, nao presumido pelo log online.

## 7. Complexidade relativa e alternativas

- **Apenas titulos + Projects no modelo atual:** menor risco imediato, mas deixa o documento unico enriquecido e a simplificacao de modos para depois.
- **Evolucao de escopo antes de Projects (recomendado):** ACTs 1-4 validam identidade, Sidebar e Tasks locais; depois Projects nasce nos dois escopos. O acoplamento Journal/Workspace e revisitado com evidencia, sem migracao fisica. Maior trabalho inicial, menor retrabalho potencial.
- **Unificacao fisica agora:** afeta scans, Today, Archive, Wiki Links, paths, handles, relatorios e documentos existentes. Nao recomendada para esta etapa, mesmo com poucos usuarios.

Nao estimar dias ou numero fixo de releases sem validar os checkpoints no checkout real. A quantidade de usuarios reduz a necessidade de migracao em massa, nao elimina risco de perda de dados ou referencias.

## 8. Roadmap de produto depois desta fundacao

1. Corrigir Concept Sidebar title e consolidar politica de identidade visual.
2. Contrato de documento atual vs Workspace e Sidebar standalone opt-in.
3. Tasks locais e paridade de origem/navegacao.
4. Projects minimo, Index, metadata opcional, Expanded View.
5. Quick Report de documento e aprimoramentos Draw.io estritamente necessarios.
6. Reminders/Highlights, Mermaid, Workspace Overview e polimento para 1.0.
7. Redesign posterior: tipo unico de Nota, Library, Timeline, Pinned/Knowledge, Archive como estado, pasta unica, revisao dos nomes e promocao somente se ainda fizer sentido; shared `@`, Graph View e Reveal.js conforme prioridade.

## 9. Decisao aberta do proprietario

**O marco 1.0 deve remover o modo Journal do seletor, ou e aceitavel mante-lo como compatibilidade enquanto o Editor de arquivo unico recebe recursos enriquecidos e o Workspace permanece opcional?**

Recomendacao inicial: manter Journal durante os ACTs acima; so decidir a remocao apos o checkpoint de paridade. Essa resposta determina se o trabalho de desacoplamento de modos e requisito para 1.0 ou redesign posterior.

## 10. Proximo handoff imediato

Solicitar ao coder: conferir checkout/HEAD e instrucoes de desenvolvimento; adicionar este documento ao repositorio como PROPOSTA, corrigir referencias de roadmap que tratem snapshots antigos como release atual apenas com evidencia; devolver PLAN de ACT 1 limitado a Concept Sidebar + regressao Journal/Active; implementar apenas apos revisao; validar e pedir browser checkpoint; nao mudar versao/cache/Help/Release Notes antes de aceite; nao commitar/push automaticamente.
