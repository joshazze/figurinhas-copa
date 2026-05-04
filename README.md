# Figurinhas Copa 2026

PWA mobile-first pra acompanhar o álbum oficial da Copa do Mundo 2026 (Panini): **980 figurinhas** (912 normais + 68 especiais metalizadas), pacote padrão de **7 figurinhas / R$ 7,00**.

Acompanhe o que você tem, o que falta, repetidas pra trocar e quanto já gastou.

- **Offline-first** — depois da primeira visita, funciona sem internet.
- **Instalável** — adiciona à tela inicial no iOS/Android e abre como app.
- **100% local** — seus dados ficam no `localStorage` do celular. Backup/restore em JSON.
- **Zero servidor** — hospedado de graça no GitHub Pages.

## Stack

- Svelte 5 (runes) + Vite
- Tailwind CSS
- vite-plugin-pwa (service worker via Workbox)
- localStorage para persistência

## Rodar local

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm run preview
```

## Deploy no GitHub Pages

1. Crie um repositório no GitHub e suba o projeto.
2. Em **Settings → Pages**, selecione **GitHub Actions** como source.
3. Faça push na `main`. O workflow `deploy.yml` builda e publica.

A URL final fica `https://<user>.github.io/<repo>/`. O `vite.config.js` ajusta o `base` automaticamente quando rodando no CI.

## Editar a base de figurinhas

- `src/lib/data/teams.js` — 48 seleções (nome, código, grupo).
- `src/lib/data/album.js` — geração programática: capa, abertura, sedes, escudos, jogadores, lendas.

Edite os times ou aumente `PLAYERS_PER_TEAM` para refletir o álbum real quando ele sair.

## Atalhos

- **Tap** numa figurinha: marca como tem (ou incrementa a repetida, até ×9).
- **Long press**: zera (apaga).
- Página **Repetidas**: lista com `+/-`, botão de compartilhar.
- Página **Ajustes**: backup JSON, troca de moeda, reset.
