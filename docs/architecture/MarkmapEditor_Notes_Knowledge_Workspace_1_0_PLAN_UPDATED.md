# MarkmapEditor 1.0: arquitetura de Notas e Workspace opcional

**Estado:** proposta consolidada para revisão no checkout real. Não autoriza implementação, commit, push nem alteração de versão.  
**Substitui:** `MarkmapEditor_Notes_Knowledge_Workspace_1_0_PLAN.md` (versão anterior).  
**Base de análise:** arquivo fornecido `repomix-output-depaulo-MarkmapEditor (16).xml` e decisões do proprietário nesta conversa.  
**Destino sugerido no repositório:** `docs/architecture/MarkmapEditor_Notes_Knowledge_Workspace_1_0_PLAN.md`.

## 1. Decisão central de produto

Um documento Markdown é a unidade canônica. O Editor simples continua disponível sem Workspace: criar/abrir, editar, visualizar Markmap e HTML Preview e salvar onde o usuário escolher. Abrir um Workspace é opcional e acrescenta navegação e agregação. Nenhuma experiência deve obrigar o usuário a escolher entre tipos físicos Journal e Concept antes de capturar conteúdo.

No Workspace, documentos Markdown compartilham inicialmente a pasta `notes/` e o mesmo Index. **Today e Named Note são duas formas de criar a mesma Note**, não tipos de documento. **Notes é a lista de todas as notas ativas**, inclusive as promovidas. **Knowledge é uma view filtrada das Notes**; **Pinned é um destaque independente**. Nenhuma dessas ações move o arquivo. A diferença entre Note e Knowledge não exige mudança de filename.

```text
Workspace escolhido/
  notes/                  # todos os documentos Markdown do Workspace
  assets/                 # futuro: imagens/anexos, apenas quando necessário
  generated/              # futuro: relatórios e outras saídas
  templates/              # futuro: templates
```

Somente `notes/` faz parte da hipótese de armazenamento inicial. Não criar subpastas auxiliares vazias por antecipação. Um arquivo aberto fora do Workspace permanece um documento standalone e não passa automaticamente a integrar `notes/`.

## 2. Contrato de identidade e classificação

| Conceito | Significado | Efeito físico |
| --- | --- | --- |
| Note | Documento `.md` do Workspace; sem metadata é Note normal | Arquivo em `notes/` |
| Today | Atalho que abre ou cria a nota diária única da data corrente | Filename inicial `YYYY-MM-DD.md` |
| Named Note | Atalho que cria uma Note com nome escolhido | Filename descritivo definido na criação |
| Knowledge | Classificação opcional e reversível | Atualização controlada de metadata, sem mover |
| Pinned | Destaque/acesso rápido, independente de Knowledge | Atualização controlada de metadata, sem mover |
| Archived | Fora das views ativas; acessível em Archive | Metadata, sem mover, se aprovado no Gate 0 |
| Library | Conjunto de documentos e navegação do Workspace | View, não pasta adicional |
| Rename File | Mudança explícita de filename/path | Fluxo separado e de maior risco |

**Identidade física:** handle e path relativo comprovado. H1 é título de apresentação, nunca chave de navegação. Duas notas com o mesmo H1 continuam distintas. Nome do arquivo e path ficam disponíveis como informação secundária. Ao editar H1, views indexadas podem continuar com o título salvo até Save e rebuild. Não indexar o Workspace a cada tecla.

**Metadata:** opcional e contida no Markdown. `knowledge`, `pinned`, `archived` e `date` são conceitos propostos; os nomes exatos das chaves, serialização, política de `false` e preservação de frontmatter existente exigem contrato e fixtures antes de editar código. Um arquivo sem frontmatter não deve ser inválido. Ao modificar metadata, preservar todo o conteúdo e campos não gerenciados; falha/cancelamento não pode deixar escrita parcial.

**Pin e Knowledge são ortogonais:** qualquer Note, inclusive uma Note de Today, pode ser pinned, promovida, ambas ou nenhuma. Promote/Remove Knowledge altera a classificação da **mesma Note**. Extrair uma seção da nota diária para uma nova nota temática é outro fluxo, não é Promote; manter como ideia futura.

## 3. Criação: uma entrada, dois atalhos

### 3.1 Controle proposto

```text
[ + Nova nota ▾ ]
  Hoje               -> abre ou cria a nota diária; sem modal
  Nota com nome...   -> abre modal compacto
```

Um dropdown curto deixa as opções visíveis sem impor formulário para Today. O modal só aparece quando é preciso fornecer filename. Se um controle principal e seta separada (split button) for adotado, o clique principal pode abrir Today, mas isso depende de teste de clareza com novos usuários; não fixar como requisito.

### 3.2 Today

- No Workspace, procurar `notes/YYYY-MM-DD.md` para a data local do usuário; se existir, abrir **o mesmo arquivo**. Se não existir, criar de modo seguro, sem sobrescrever.
- A nota criada por Today recebe a **data da nota** correspondente ao dia, com política de metadata/fallback definida no Gate 0. Não criar um tipo `journal` ou uma pasta `journals/`.
- O filename datado é o contrato de localização do atalho Today. Renomear fisicamente essa nota depois pode fazer Today criar outra nota para a mesma data; o fluxo Rename deve explicar isso ou impedir a operação até existir política explícita.
- Abrir Today deve respeitar alterações não salvas, sessões, handles, Report guard e cancelamento. Não usar a data de qualquer número encontrado no corpo do Markdown.

### 3.3 Nota com nome

Modal mínimo sugerido:

```text
Nova nota
Nome: [                                  ]
Data da nota: [data local de hoje]  (editável)
[ ] Adicionar a Knowledge
[Cancelar] [Criar nota]
```

- O nome serve para criar um filename reconhecível no explorador; título humano H1 pode ser igual ao nome inicial, mas sua alteração posterior não renomeia o arquivo.
- A data inicial é a data local atual; o usuário pode alterá-la antes de criar. Assim a Named Note e Today podem aparecer no mesmo dia na Timeline.
- Knowledge começa desmarcado. Se marcado, a mesma Note nasce classificada; não há segunda pasta nem outro editor. Pin não aparece no modal: é uma ação posterior e independente.
- Validar nome vazio, caracteres inválidos, colisão de filename, nome de Today reservado e cancelamento **antes de criar arquivo**. Não inventar sufixos nem sobrescrever automaticamente. Se o nome escolhido gerar `YYYY-MM-DD.md`, explicar a colisão com o atalho Today e pedir outro nome.
- Fora do Workspace, New/Open File do Editor simples continuam funcionando. O menu Workspace `Nova nota` não deve forçar a criação de `notes/` para quem só quer um arquivo standalone.

### 3.4 Data da nota e Timeline

A **data da nota** é a chave de agrupamento da Timeline. A mesma data pode ter Today e diversas Named Notes; Today continua identificável pelo filename reservado, não por exclusividade da data. Exemplo:

```text
25/09/2026
  2026-09-25                (Today)
  Estratégia Brasil 2026    (Named Note)
  Reunião com cliente       (Named Note, Knowledge)
```

Arquivos importados sem data confiável aparecem em `Sem data` até receberem data explícita, salvo uma regra de filename estritamente validada e aprovada no Gate 0. Não usar modificação do sistema de arquivos como substituto silencioso da data da nota. **Timeline/lista agrupada é o MVP**; calendário mensal clicável é evolução opcional, não requisito para entregar a criação unificada.

## 4. Sidebar, filtros e ações

### 4.1 Modelo inicial recomendado

```text
Workspace
  + Nova nota
  Busca
  Notes                 todas as notas ativas
    Fixadas             subseção no topo, sem duplicar na lista abaixo
    Por data            Today e Named Notes misturadas
    Sem data
  Knowledge             filtro das notas ativas com knowledge=true
  Archive               filtro das notas arquivadas
  Tasks / Projects / Reports / Index conforme evolução
```

**Notes inclui Knowledge.** Essa regra substitui explicitamente a regra anterior `Notes = não-Knowledge`. Knowledge não deve se tornar um destino exclusivo ou um segundo tipo de arquivo. Uma Note pinned aparece na subseção Fixadas e não se repete no restante da lista Notes. Em Knowledge, a mesma nota pode aparecer com marcador de pin, sem duplicação dentro dessa view. Ao desfixar, ela volta à posição normal do grupo de data. Archive não aparece em Notes/Knowledge ativas, mas mantém classificação e data para Restore.

A busca deve manter filename/path e, se H1 for incluído, fazê-lo como alteração funcional testada separadamente. Filtros de data e Knowledge operam sobre os mesmos registros do Index. Definir no Gate 0 se Library será apenas o nome do painel geral ou um botão/view próprio; não criar um terceiro menu redundante sem necessidade.

### 4.2 Ações por nota

- `Pin / Unpin`: metadata, sem promoção.
- `Add to Knowledge / Remove from Knowledge`: metadata, sem rename ou movimento.
- `Archive / Restore`: metadata se aprovada; nunca excluir para arquivar.
- `Rename File`: ação independente, **não automática na promoção**. Requer validação de nome, colisões, links afetados, handle/path/lastActive/history/Index, prévia e rollback; planejar separadamente. Não tornar o Rename pré-requisito para Knowledge.
- H1 e filename são exibidos separadamente quando necessário. Para Today, manter filename datado é aceitável; para conteúdo durável com nome físico descritivo, criar Named Note ou usar futuro Rename seguro. Extrair conteúdo do Today para outra nota é fluxo futuro distinto.

## 5. Evidência do Repomix e impacto no código

O Repomix é um **snapshot**, não prova branch, HEAD ou working tree do checkout do coder. Antes de qualquer ACT, conferir o repositório real.

- `js/workspace/workspace-state.js` define pastas `journals`, `concepts`, `archive` e `activeFile`; `js/workspace/workspace-controller.js:184-202` cria subpastas ao abrir. Alterar para `notes/` requer validar o diretório selecionado **antes** de criar ou escrever qualquer coisa. Não migrar pastas antigas automaticamente.
- `js/main.js:997-1038` constrói o Index a partir de Journals e Concepts; `js/main.js:1126-1154` publica registros e `mme-workspace-index-ready`. Adaptar o owner existente para uma coleção de Notes, sem criar um segundo Index permanente.
- `js/workspace/workspace-parser.js:732-768` produz título, headings, Tasks, tags, links e Projects; `js/main.js:587-594` extrai H1. Testar frontmatter, headings em blocos de código, H1 vazio e fallback antes de mudar o parser. O parser de Projects em `js/workspace/workspace-parser.js:450-495` ainda usa a sintaxe `Project:`; reconciliar com a decisão posterior de declaração mínima antes de Projects.
- `js/workspace/workspace-sidebar.js:11-50` renderiza filename; `js/main.js:5231-5257` atualiza somente Journals com título do Index. Se a Sidebar antiga for substituída, não criar abstração ampla para a lista Concepts que será removida. A nova lista Notes deve usar título salvo e path físico desde o início.
- `css/workspace.css:227-263` exibe Sidebar apenas em Journal; `js/main.js:3255-3279` adia painéis sem Workspace. Separar UI standalone de agregações sem expor painéis vazios ou duplicar listeners.
- `js/main.js:3692-3763` filtra Search por name/path e usa cache de consulta. H1 como termo de busca exige mudança funcional e invalidação do cache após rebuild; não é mero ajuste de label.
- `js/workspace/task-review.js:223-226` e `js/tasks/task-board.js:501-525` já priorizam títulos do Index em parte dos casos; manter origem por path/handle. Relatórios dependem de Index e lifecycle próprio; não fingir que standalone equivale a Workspace de um arquivo.
- `js/release/release.js` e `sw.js` contêm identidade 0.6.1 no snapshot. Verificar owners atuais antes do fechamento; não alterar versão, cache, Help, Release Notes ou VERIFY durante experimentos não aceitos.

## 6. Compatibilidade conscientemente quebrada, sem perda silenciosa

O proprietário aceita reorganizar manualmente os poucos Workspaces existentes; o aplicativo não precisa migrar arquivos antigos. Ao selecionar uma pasta no formato antigo, mostrar incompatibilidade antes de criar `notes/` ou alterar conteúdo. Um Workspace misto deve ter comportamento definido e testado; não ignorar silenciosamente documentos antigos. Recomendar cópia de segurança antes da reorganização manual. Arquivos standalone fora da pasta continuam editáveis; pertencimento ao Workspace não é deduzido de filename igual.

Escritas de metadata devem respeitar Save, Save As, permissões, dirty state, cancelamento, falha e Report virtual. Não alterar outro arquivo por suposição de basename. Ações de classificação não podem mover, excluir ou renomear o documento. Paths e Wiki Links antigos podem exigir revisão manual depois da reorganização; não prometer atualização automática.

## 7. Plano de execução em gates e ACTs

Cada ACT abaixo é uma fronteira de revisão. O coder deve planejar primeiro, agrupar ACTs relacionados quando seguro, executar validação estática após cada grupo e pedir browser testing nos checkpoints de UI. Nenhum ACT amplo é autorizado por este documento.

### Gate 0: contrato final, PLAN ONLY

1. Confirmar branch, HEAD, working tree, release e validators no checkout real. Ler `docs/PRODUCT_PRINCIPLES.md`, `docs/AI_DEVELOPMENT_WORKFLOW.md` e este plano.
2. Inventariar todos os consumidores/escritores de `journals/`, `concepts/`, `archive/`, `WORKSPACE_STATE.files`, `byKind`, `activeFile.kind`, Today, Wiki Links, Search, Related, Task Review/Board, Projects, Reports/Draw.io, Save, Hot Reload, navigation history, Help e presets.
3. Definir esquema de metadata, data da nota, filename Today, validação de filename e política para pastas vazias/antigas/mistas. Definir como Notes/Knowledge/Pinned/Archive derivam do Index e como o editor standalone convive com Workspace.
4. Definir transações de escrita e rollback para criação/classificação; sem criar pastas/arquivos nem editar runtime nesta fase.
5. Entregar matriz de arquivos, dependências, riscos, validadores e checkpoints. Confirmar escolhas de produto ainda abertas antes do primeiro ACT estrutural.

### ACT 1: modelo e scanner/Index de Notes

Validar o Workspace antes de mutação; substituir as fontes físicas `journals`/`concepts` pela coleção `notes/` no Index existente; ler metadata opcional; título/path/data/classificações normalizados. Testar pasta vazia, antiga, mista, arquivos sem metadata, H1 duplicado, links, Task/Project records e regressão do Index. Não reescrever arquivos do usuário. Checkpoint com Workspace de teste.

### ACT 2: criação unificada

Implementar `Nova nota` com Hoje imediato e Nota com nome em modal compacto. Nome, data e checkbox Knowledge conforme seção 3; ambos criam a mesma Note. Validar colisão, cancelamento, Save/handle, reabertura de Today, data local e atualização do Index. Não incluir Pin no modal. Checkpoint de criação desktop/mobile.

### ACT 3: Sidebar e views

Notes contém todas as notas ativas; Fixadas no topo sem duplicação; agrupamento por data e Sem data; Knowledge é filtro, Archive é view; path preservado para clique. Adaptar Search/Related/Index conforme owners existentes. Não introduzir uma segunda estrutura de estado. Checkpoint com Note normal, Knowledge, Pinned, Today, Named e H1 duplicado.

### ACT 4: ações de metadata

Pin/Unpin, Add/Remove Knowledge, Archive/Restore com um owner de escrita, preservação de frontmatter, guard de dirty/Report, permissão, idempotência, Cancel e rollback. Nada de rename ou `removeEntry()` para Archive. Checkpoint após cada grupo de ações relacionadas.

### ACT 5: Timeline e experiência opcional

Today e Named Notes agrupadas pela data da nota. Editor simples continua acessível sem Workspace; Workspace adiciona agregação. Verificar paridade de Today, navegação, sessões, Tasks e Reports existentes. Remover/renomear o modo Journal apenas em ACT próprio após aceitação no navegador; Slides permanece especializado. Não modificar ModeSession sem bug demonstrado.

### ACT 6: Tasks, Projects e Reports em escopos

Tasks do documento atual reutilizam parser e lifecycle de Save; Workspace agrega. Projects: reconciliar parser legado `Project:` com declaração Markdown mínima acordada, depois metadata opcional e Expanded View em pacotes separados. Quick Report de documento atual precisa de definição de produto própria, Markdown revisável primeiro; Draw.io depois. Não transformar esta seção em um ACT único.

### ACT 7: closure de 1.0

Confirmar o mínimo valioso para novos usuários; avaliar Reminders/Highlights, Mermaid e Workspace Overview conforme prioridade aprovada. Onboarding, Help contextual, Release Notes e VERIFY após browser acceptance; um bump de versão/cache por pacote aceito, smoke online/offline/update e regressão final. Rename File seguro é pacote independente e não deve ser escondido em Promote.

## 8. Critérios de aceitação e regressão

- Today cria/abre `notes/YYYY-MM-DD.md` sem duplicar nem sobrescrever; Named Note com data do mesmo dia aparece no mesmo grupo.
- Checkbox Knowledge na criação Named classifica a mesma Note; desmarcado cria Note normal. Notes mostra ambas; Knowledge filtra; Pin não promove.
- Note promoted continua em Notes; Fixadas não duplicam na própria lista; Archive sai das views ativas e Restore preserva classificação.
- Filename e H1 podem diferir; cliques usam path/handle; H1 duplicado não mescla registros; mudança de H1 indexado ocorre após Save/rebuild.
- Workspace antigo ou misto não é modificado silenciosamente; pasta de assets não vira Note; arquivo standalone não se torna membro do Workspace por nome igual.
- Criação, metadata e Save/Save As respeitam dirty state, cancelamento, permissões, falhas, Report virtual e rollback; nenhuma ação implícita reescreve Wiki Links.
- Manter validators existentes verdes, adicionar fixtures nos owners reais, `node --check` nos JS/CJS tocados, `git diff --check` e browser checkpoints desktop/mobile/dark/offline.

## 9. Decisões pendentes que não devem ser presumidas pelo coder

1. Nome exato e serialização das chaves de metadata; preservar frontmatter de terceiros.
2. Definição precisa de data para notas importadas sem metadata e para notas Today fisicamente renomeadas.
3. Library como cabeçalho da Sidebar ou view própria, evitando terceira lista redundante.
4. Se o calendário mensal é necessário na 1.0; recomendação: iniciar pela Timeline agrupada.
5. Se Rename File seguro entra antes de 1.0; recomendação: não bloquear Promote por Rename.
6. Se Journal desaparece do seletor antes de 1.0; decidir após paridade real.

**Próximo comando ao coder:** ler este arquivo como proposta; conferir checkout e devolver apenas Gate 0 com matriz de impacto e decisões pendentes. Não implementar ACT 1-7, não alterar versão e não fazer commit/push sem autorização específica.
