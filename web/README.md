# tarjador · front-end

Front-end do Tarjador, gerado a partir do template `componentes-react-dafn`
(rota de documentação já removida). Conversa com a API local `../api.py`.

## Desenvolvimento

Dois terminais, na pasta `read-doc`:

```bash
# terminal 1 — API (porta 5000)
python api.py

# terminal 2 — front com recarga automática (porta 5173)
cd web
npm install      # só na primeira vez
npm run dev
```

Abra http://localhost:5173. O Vite repassa as chamadas `/api` para a API
(veja `server.proxy` em `vite.config.ts`), então não há CORS nem `.env` para
configurar.

## Produção (uso diário)

```bash
cd web && npm run build   # gera web/dist
cd .. && python api.py    # a API passa a servir a tela
```

Abra http://127.0.0.1:5000. Quem só vai usar a ferramenta não precisa de Node:
basta a pasta `web/dist` já compilada.

## Onde está cada coisa

Veja a tabela no `README.md` da pasta acima e o passo a passo do VS Code.
A organização da tela está detalhada em `docs/wiki/Front-end.md`.

## Ajustes feitos no template

- `src/ui/Header/types.ts`: faltava exportar `HeaderActionsProps`, usado pelos
  containers do Header. Sem ele o `npm run build` (tsc) falhava.
- `public/src/assets/govbr.webp`: o Header carrega o logo por caminho relativo
  (`../src/assets/govbr.webp`), que só existe no servidor de desenvolvimento.
  A cópia em `public/` faz o logo aparecer também no build.
- `src/index.scss`: registra a Rawline (`@font-face` para `public/fonts`), que o
  template trazia nos arquivos mas não carregava, e solta o `#root` para a
  largura toda da tela.
