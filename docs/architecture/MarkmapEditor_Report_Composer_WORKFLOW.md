# MarkmapEditor Report Composer: contrato de produto e integração

**Status:** direção aprovada pelo owner. Este documento descreve o comportamento desejado, não certifica a implementação existente.

**Destino sugerido:** `docs/architecture/MarkmapEditor_Report_Composer_WORKFLOW.md`. Se já houver um contrato R1A aprovado no repositório, atualize o documento canônico em vez de manter dois contratos ativos. Preserve a parte válida sobre o Host, o adapter read-only e os owners protegidos. Este contrato substitui especificamente a decisão anterior de remover os controles globais do Sidebar.

## 1. Fluxos aprovados

### Criar

1. No Sidebar, em **Report**, escolha Start e End e marque Projects, Tasks e Notes. Essas datas são inclusivas e aplicam-se às seções habilitadas que herdam o período global. Defaults de inclusão: Projects e Tasks ligados; Notes desligado.
2. Clique **Configure Report**. Esse botão abre o Composer, não gera nem salva. Use o Host existente e preserve o documento ativo.
3. No topo do Composer, os mesmos controles globais editam a mesma sessão. As alterações retornam ao Sidebar; não existe uma cópia editável separada. O fluxo legado de Quick Report tem sua própria configuração e não é atualizado implicitamente.
4. Cada domínio tem um bloco com **Use global period** ou um par próprio de datas, lista de candidatos com um checkbox por item, e escolha do estilo inicial. O override de Projects não mexe em Tasks ou Notes. Alterar o período global atualiza só os domínios que o herdam. Voltar a herdar é explícito.
5. **Review selection** mostra uma revisão inline, atualizada a partir das escolhas reais. **Generate Report**, numa entrega posterior, usa a revisão confirmada e abre uma tela de leitura com um novo rascunho. A ação não grava arquivo, não altera registros fonte e não precisa abrir editor ou mind map automaticamente.
6. **Edit Markdown** usa o editor existente. **Save** usa o owner existente e só é invocado explicitamente. Para um rascunho novo, use o caminho existente para nome e destino novos, sem reutilizar o handle de um relatório anterior. Cancelar não grava. O Markdown é a fonte de verdade.

### Reabrir e atualizar

1. **Open Report…** no Sidebar seleciona um `.md` salvo via owner existente. Comece pelo seletor de arquivo. Lista de 5–6 recentes e pasta `reports/` como destino sugerido são melhorias posteriores, não pré-requisitos nem migração obrigatória.
2. Abra o Composer no modo de relatório salvo. Restaure global, overrides, opções reconhecidas e estilos iniciais. A lista inicial contém **somente os itens incluídos no snapshot salvo**, inicialmente marcados. Não refiltre o Index ou reconstrua candidatos não incluídos. **View saved report** mostra o original sem regenerar.
3. **Refresh from Workspace** é explícito. Consulte o Index atual usando as configurações efetivas. Preserve as escolhas válidas e as exclusões deliberadas. Novos candidatos entram desmarcados. Diferencie registros ausentes de registros ainda existentes que deixaram de corresponder; mostre diagnósticos sem retargeting. Não altere o arquivo salvo. Se um item não estiver mais disponível, não o inclua automaticamente numa nova geração. O snapshot original permanece legível.
4. Mudanças de configuração em modo salvo não devem parecer uma atualização do snapshot. Sinalize que a configuração foi alterada e que uma atualização explícita é necessária para obter candidatos atuais. Sem Refresh e sem mudanças, a regeneração pode usar os dados salvos, não dados misturados do Workspace.
## 2. Superfícies e UX

| Superfície | Conteúdo e ações | Não faz |
|---|---|---|
| Sidebar Report | Datas globais, três domínios, Configure Report, futuramente Open Report…; ações legadas secundárias | Lista longa de registros, configuração por seção, geração automática |
| Composer | Um Back to Workspace, configuração global, blocos por seção, revisão inline e depois Generate Report | Save, modificação de Workspace, outro Host |
| Reader | Título, período global, status de rascunho/salvo, período efetivo onde sobrescrito, seções, seletores de estilo e ações explícitas | Refazer elegibilidade, gerar ao trocar estilo, editar registros fonte |
| Editor | Markdown editável pelo owner existente | Um segundo fluxo de persistência |

### Layout e estados

- Reutilize `#layout`, `MME_WORKSPACE_HOST` e a experiência Expanded View existente. Mantenha um único Back. O Composer não limpa `workspaceReportPanel`, não move painéis, não deixa splitters do editor ativos e não grava preferências de largura.
- Sidebar em aproximadamente 280 px: um rótulo por checkbox, datas legíveis, um botão principal temático. Rastreie e preserve o comportamento do `Config` legado se for distinto; não o converta numa segunda entrada do Composer. Quick Report e Draw.io ficam secundários até o novo caminho ser aceito. Não deixe um botão Open Report sem ação.
- Composer: configuração global primeiro; depois cartões/seções de Projects, Tasks e Notes. Em cada bloco, período efetivo, opção para herdar ou sobrescrever, lista, contagens e ações da seção. Um corpo rolável, navegação e ação principal alcançáveis no S22 com teclado aberto. Use controles nativos rotulados, foco visível e feedback acessível; não substitua o elemento focado a cada tecla.
- Sem datas, mostre uma instrução para definir o período, não `No matches`. Separe: sem Workspace; Index preparando; leitura/projeção indisponível; período incompleto/inválido; domínio desligado; projeção pronta sem candidatos; candidatos disponíveis, mas sem seleção. Um domínio desligado não bloqueia a revisão por override inválido. Uma seção ligada com período inválido deve explicar o bloqueio sem ocultar a configuração das demais.
- Reader: use a área Expanded View com coluna de leitura, título e status destacados, subtítulos e divisórias discretas. Tabelas podem rolar dentro da seção em telas estreitas; não alargue a página inteira. Mostre `Unsaved draft` ou `Saved report` claramente.

### Estilos iniciais e estilos da leitura

| Seção | Estilos contemplados | Padrão sugerido |
|---|---|---|
| Projects | Tabela/colunas, cartões compactos inspirados em Projects Review | Tabela |
| Tasks | Lista agrupada, tabela e cartões compactos inspirados em Task Review | Lista agrupada |
| Notes / Highlights | Texto, lista | Texto |
| Summary | Texto | Texto |

O estilo inicial escolhido por seção no Composer pode ser salvo na configuração do relatório. No Reader, um seletor discreto no cabeçalho da seção muda **somente a apresentação da sessão de leitura**. Não altera conteúdo Markdown, itens, contagens, totais, referências, estado dirty ou Save. Não copie botões de edição, movimentação ou exclusão dos cartões de Tasks e Projects. Se um relatório antigo não tiver dados estruturados suficientes para uma visualização alternativa, mostre a leitura textual em vez de inferir registros.
## 3. Dados e regras

- Uma sessão do Composer tem um owner. Sidebar e Expanded View escrevem pelos mesmos setters e leem snapshots defensivos. O Host monta/restaura a superfície; snapshots do Host não podem sobrescrever alterações mais recentes do Composer. Back preserva estado e documento ativo. Reload volta aos defaults do novo relatório enquanto um salvo não for reaberto.
- Separe **configuração**, **candidatos derivados**, **seleção** e **preferência de leitura**. Não use candidatos como fonte de verdade do relatório salvo. Use identidades canônicas e contexto de Workspace; não reaproveite IDs de um Workspace diferente sem correspondência comprovada.
- Leia a prontidão e as coleções pelo owner existente do Index. Workspace ativo vem do owner do Workspace, não de um handle presumido no Index. Confira no source a forma real dos registros Notes, Projects e Tasks. Nenhum scan independente, parser duplicado, rebuild, polling ou alteração de schema.
- Projects: Order, Delivery e Billing no período efetivo, com interpretação canônica de datas/trimestres. Multi-match aparece uma vez, com todos os motivos. Stage e State continuam separados. Totais só por moeda.
- Tasks: Completed e Due no período, Open e Overdue no fim do período efetivo. Use os campos existentes; se o Index não sustenta uma conclusão histórica, exponha a limitação. Não use a data de hoje para atraso histórico. Não descarte uma Task aberta apenas por falta de um campo opcional se há base para classificá-la.
- Notes: data de documento reconhecida, depois nome de arquivo conforme convenção existente; sem data vai para **Undated / Manual**. Não use mtime nem infira riscos, decisões ou resumos de prosa arbitrária.
- Um checkbox por candidato, motivos legíveis e caminho de origem secundário. **Select eligible** e **Clear selection** operam só na seção. Use defaults iniciais já planejados: Projects elegíveis marcados; Tasks open/due/overdue marcadas; completed-only e Notes desmarcados. Não reaplique defaults em rerender nem marque entradas novas no Refresh de relatório salvo. Desligar uma seção exclui da saída sem apagar escolhas de sessão. Preserve exclusões enquanto o item voltar ao conjunto elegível no mesmo rascunho. Embaralhar ou mudar posição da linha não muda identidade.
- Review recalcula entradas efetivas a partir do snapshot válido; descarta IDs que não são elegíveis e diagnostica os indisponíveis. Conte itens únicos. Revise novamente se configuração, seleção ou dados mudarem antes da geração. Preserve a interface read-only existente, adicionando só o contexto mínimo exigido para os períodos efetivos, sem quebrar consumidores legados.
## 4. Contrato conceitual em JavaScript

Os exemplos são código de referência para adaptar ao estado e às APIs existentes. Não registre outro script, global, store, parser, Host ou Save owner. Nomes e schema não foram verificados contra o checkout atual.

```js
const config = {
  globalPeriod: { startDate: '', endDate: '' },
  sections: {
    projects: { enabled: true, periodOverride: null, initialView: 'table' },
    tasks: { enabled: true, periodOverride: null, initialView: 'grouped-list' },
    notes: { enabled: false, periodOverride: null, initialView: 'text' }
  }
};

function effectivePeriod(config, domain) {
  const section = config.sections[domain];
  // An incomplete override is not the same thing as inheritance.
  return section.periodOverride ?? config.globalPeriod;
}

function reconcileRefreshedIds({ selectedIds, includedSnapshotIds,
  eligibleIds, indexedIds }) {
  // All IDs are canonical, from one domain and one Workspace.
  const previous = new Set(includedSnapshotIds);
  const eligible = new Set(eligibleIds);
  const indexed = new Set(indexedIds);
  const wanted = [...new Set(selectedIds)];
  return {
    selectedIds: wanted.filter(id => eligible.has(id)),
    newCandidateIds: [...eligible].filter(id => !previous.has(id)),
    unavailableIds: wanted.filter(id => !indexed.has(id)),
    outOfScopeIds: wanted.filter(id => indexed.has(id) && !eligible.has(id))
  };
}
```

`newCandidateIds` é sugestão visual, nunca uma instrução para marcar itens. Se Refresh sucessivos precisarem distinguir candidatos já vistos de descobertas mais recentes, passe as identidades do último snapshot observado para essa comparação, sem alterar a referência ao relatório original. O estado de exclusões deliberadas fica na sessão, não precisa ser exportado como lista descartada.

## 5. Markdown e geração (entrega posterior)

Um `.md` precisa ser legível fora do app e reabrível sem o Workspace original. Guarde uma configuração versionada no mecanismo de metadados já existente: período global, domínios, overrides, estilos iniciais e referências estáveis dos itens **incluídos**. O corpo contém o snapshot legível de somente esses itens. Não grave candidatos desmarcados, handles, caminhos absolutos pessoais nem credenciais. Reuse o contrato legível `type: report` se confirmado no import existente. Este exemplo é um modelo lógico, não aprovação automática de chaves de frontmatter:

```yaml
# Exemplo de payload de configuração; integrar só após revisar parser/import.
report_config_version: 1
report_config:
  global_period: { start: '2026-11-01', end: '2026-11-30' }
  sections:
    projects:
      enabled: true
      period_override: { start: '2026-10-01', end: '2026-12-31' }
      initial_view: table
      included_refs: ['<canonical-project-id>']
    tasks: { enabled: true, period_override: null, initial_view: grouped-list }
    notes: { enabled: false, period_override: null, initial_view: text }
```

Se uma seção habilada não incluir nenhum item, preserve a configuração sem gerar linhas de dados fictícias. Para leitura, separe Summary (quando houver), Projects e totais por moeda, Tasks concluídas no período e abertas/atrasadas no corte, Notes/Highlights selecionadas e Sources. Uma linha com vários motivos não vira registros duplicados. Preserve referências relativas ao Workspace quando disponíveis. O Reader usa o conteúdo do Markdown do rascunho ou do salvo, sem buscar dados atuais para completar o texto. Use renderização segura e helpers existentes para Markdown e metadados. Estilos alternativos são projeções da mesma revisão/conteúdo, nunca uma segunda versão editável.

## 6. Entregas e gates

1. **Configurar e selecionar:** corrigir a direção atual do Sidebar, conectar o Index e produzir revisão read-only real. Sem `.md`, Save, Reader ou Open Report funcional nesta etapa. Preservar Quick Report e Draw.io.
2. **Gerar, apresentar e salvar opcionalmente:** confirmar revisão, gerar um novo Markdown em memória, apresentar na tela de leitura, levar ao editor existente quando solicitado e salvar pelo owner existente. Estilos iniciais e overrides visuais podem entrar após a leitura básica funcionar.
3. **Reabrir e atualizar:** picker existente, restauração de snapshot, leitura original e Refresh explícito. Recentes e pasta sugerida são melhorias separadas. HTML e outros artefatos ficam fora deste pacote.

Gate manual da primeira entrega: abrir uma nota de teste, definir um período global conhecido no Sidebar, abrir Composer, verificar valores, dar a Projects um intervalo próprio, mudar o período global e verificar que Tasks/Notes herdam e Projects não; desmarcar um registro real e verificar a revisão; voltar à mesma nota e confirmar os valores globais no Sidebar. Verificar também o caso de datas vazias. Não confundir código integrado ou revisão de diff com aceitação no navegador.

Após aceite manual, decidir os checks direcionados e o checkpoint. Sem promover a main, atualizar versão/cache, tocar no Service Worker ou remover fluxo legado nesta fase. O ponto de retirada do atalho Quick Report é depois de validar geração, leitura, Save opcional e reabertura no novo fluxo.
5. **Generate Report** após reabrir cria um novo rascunho. O original permanece intacto. Se o arquivo legado só tiver período, recupere somente o que reconhecer, deixe claro o que não pôde ser recuperado e não invente identidades ou seleções. Metadados ausentes, malformados ou de versão desconhecida não devem impedir a leitura do Markdown original.