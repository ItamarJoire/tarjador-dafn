# Front-end

A tela fica em `web/`: React 19 + TypeScript, compilada pelo Vite. Uma tela só: envio à esquerda, tarjamentos numa barra à direita.

## Pastas

| Caminho | O que tem |
|---|---|
| `src/main.tsx` | Monta os provedores: Helmet (título), Router, tema, lotes, tutorial |
| `src/App.tsx` | Esqueleto: cabeçalho, conteúdo, faixa lateral dos tarjamentos, rodapé |
| `src/pages/Home` | A tela principal: liga o painel de envio aos tarjamentos |
| `src/components/Redator` | Tudo do tarjamento (tabela abaixo) |
| `src/components/Cabecalho` | Marca, Tutorial, fluxograma, perguntas frequentes e tema (`BotaoIcone` é o botão redondo de ícone) |
| `src/components/Rodape` | Contato da equipe e faixa institucional |
| `src/components/Equipe` | "Fale com a equipe responsável" e a lista de contatos (usada também no FAQ) |
| `src/components/Faq` | Perguntas frequentes (o texto fica em `perguntas.tsx`) |
| `src/components/Fluxo` | Fluxograma "Como o Tarjador funciona": desenho em SVG, zoom e arrastar. Os diagramas são dados em `diagramas.ts` |
| `src/components/Tutorial` | Tutorial guiado (Reactour): passos, exemplo com dados fictícios, sincronização |
| `src/contexts/LotesContext` | Estado dos lotes, consulta à API, aprovações, histórico, downloads, tarja à mão |
| `src/contexts/ThemeContext` | Tema claro/escuro |
| `src/contexts/AreaLateral` | O elemento da faixa lateral, onde a barra de tarjamentos é encaixada por portal |
| `src/services/RedatorService` | Chamadas à API e os tipos do contrato (`types.ts`) |
| `src/services/ambiente.ts` | Desenvolvimento ou produção, equipe responsável e textos de suporte |
| `src/services/armazenamento.ts` | Chaves e acesso ao `localStorage`/`sessionStorage` |
| `src/services/contarPaginas.ts` | Conta páginas com o pdf.js, carregado só na primeira vez |
| `src/ui` | Design system do ITI (`componentes-react-dafn`) |

### Componentes do tarjamento (`components/Redator`)

| Componente | Papel |
|---|---|
| `PainelEnvio` | Opções, checklist, upload, botão Tarjar, contagem de páginas e avisos |
| `ChecklistTipos` | Etiquetas do "O que tarjar" e o modal para editar |
| `OpcaoChave` | Chave liga/desliga com ícone de ajuda |
| `TarjamentosFlutuante` | A barra de tarjamentos (lateral; tela cheia no celular; minimizável) |
| `PainelRevisao` | Um lote: andamento, mensagens, arquivos, cancelar/apagar |
| `ArquivoRevisao` | Um arquivo: selo, conferência, Baixar e Ver páginas |
| `PendenciasArquivo` / `ListaPendencias` | As páginas para conferir, com motivo e check "Aprovada" |
| `PaginaPreview` | Ver página: imagem tarjada, navegação, aprovação e tarja à mão |
| `ConfirmarDownload` | Baixar e concluir, ou só baixar |
| `ConfirmarExclusao` | Confirmação em vermelho para cancelar/apagar |
| `HistoricoTarjamentos` | Lista dos concluídos, com rolagem e "Limpar lista" |

## Estado e armazenamento

O `LotesContext` concentra o estado. Ele consulta `GET /api/lotes/<id>` **a cada 1 segundo** enquanto algum lote está na fila ou processando, e para quando todos terminam.

| O quê | Onde | Dura |
|---|---|---|
| Ids dos lotes acompanhados | `sessionStorage` | Até fechar a aba (resiste ao F5) |
| Páginas aprovadas | `sessionStorage` | Até fechar a aba |
| Identificação dos arquivos enviados (nome, tamanho, data), para recusar repetido | `sessionStorage` | Até fechar a aba |
| Arquivos já concluídos | `sessionStorage` | Até fechar a aba |
| Histórico de concluídos (nome, páginas, tarjas, tipos) | `localStorage` | Até "Limpar lista" |
| Tema e escolhas do checklist | `localStorage` | Permanente |

Os lotes ficam só na aba: o id dá acesso aos PDFs tarjados e não deve reaparecer dias depois. Com processamento em andamento, o navegador pergunta antes de fechar a aba.

## Desenvolvimento ou produção

`services/ambiente.ts` usa `import.meta.env.DEV`:

- **Em desenvolvimento** (`npm run dev`), as mensagens de falha dão o comando para resolver (`python api.py`, `pip install ...`).
- **Em produção** (build), dizem a quem recorrer: a equipe responsável, pelo link do rodapé. O build não contém as mensagens técnicas.

## Tutorial

O tutorial (`components/Tutorial`) usa o Reactour e passa por todas as etapas. Na parte dos tarjamentos, a barra mostra **lotes fictícios** (`exemplo.ts`), e a janela de Ver página e a de download abrem sozinhas nos passos que as explicam. Os passos ficam em `passos.tsx` e cada um aponta para um elemento com `data-tour="..."`.

## Convenções

- Nomes em português, como o resto do projeto.
- Arquivos de componente: `Componente.tsx`, `Componente.module.scss`, `types.ts` e `index.ts`.
- Cores e tamanhos pelas variáveis do design system (`var(--...)`), com ajuste para `[data-theme='dark']`.
- `npm run lint` mostra 3 erros antigos em `ui/Datepicker`, `ui/Timepicker` e `ui/DateTimePicker`. Vêm do design system, e o Tarjador não usa esses componentes.
