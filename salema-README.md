# Salema 🃏

Versão digital do jogo de cartas **Salema** — um jogo de vazadas para 5 jogadores, variante
portuguesa próxima do *Hearts*. Esta entrega traz **dois modos jogáveis**: **offline** (tu contra 4
bots, tudo no teu dispositivo) e **online em tempo real** (vários humanos numa sala pública, com os
lugares vazios preenchidos por bots). O motor de regras é o mesmo nos dois — puro, isolado e testado.

O objetivo é **não perder**: termina-se com a menor pontuação possível. Cada **Copas** vale 1 ponto
e a **Dama de Espadas** — a *Salema* — vale 10. Quando alguém chega a 100, o jogo acaba e **perdem
todos os que tiverem 100 ou mais**.

---

## ✅ O que já está incluído

- **Motor de regras** puro em TypeScript (`src/engine/`) — distribuição, ordenação à Sueca,
  abertura obrigatória com o 2 de Paus, seguir naipe, restrição da 1ª vazada, quebrar Copas,
  pontuação, "acertar na lua" e fim de jogo com múltiplos perdedores. **21 testes a passar.**
- **Bots simples** (`src/bots/`) — jogam jogadas legais com uma heurística sensata.
- **Modo offline em React** (`src/ui/`) — mesa com os 5 lugares, a tua mão em baixo, a vazada ao
  centro, revisão da vazada anterior a qualquer momento, e ecrãs de fim de mão e de fim de jogo.
- **Modo online** — servidor **autoritativo** em Node + **Colyseus** (`server/`) que corre o mesmo
  motor, com lobby público, preenchimento com bots até 5, e uma **vista filtrada por jogador** (só
  vês a tua mão; as dos outros aparecem como contagem). O cliente online em React está em
  `src/online/`. Se um humano se desligar a meio, o lugar passa a ser jogado por um bot.

> **Fase seguinte (ainda por construir):** contas (nome + id + password com *hash*) e
> **estatísticas** guardadas em **Postgres** (ex. Neon). O modo online já está preparado para as
> receber.

---

## 📦 Pré-requisitos

- **Node.js 18 ou superior** (inclui o `npm`). Confirma com `node --version`.
  Se não tiveres, instala a versão LTS a partir de <https://nodejs.org>.

---

## 🚀 Como correr (passo a passo)

A partir da pasta do projeto (a que contém o `package.json`):

**1. Instalar as dependências** (só na primeira vez, ou quando mudarem):

```bash
npm install --legacy-peer-deps
```

> A flag `--legacy-peer-deps` é necessária porque o Colyseus sugere (opcionalmente) uma versão do
> Vite mais recente do que a do projeto. É inofensivo — não afeta o servidor.

### Modo offline (só o browser)

```bash
npm run dev
```

Abre o endereço que o terminal mostrar (normalmente <http://localhost:5173>), escolhe
**"Jogar offline"** e joga. Para parar, `Ctrl + C`.

### Modo online (servidor + browser)

Precisas de **dois processos**: o servidor de jogo e a aplicação web. O mais simples é um comando:

```bash
npm run online
```

Isto arranca, ao mesmo tempo, o **servidor** (porta `2567`) e a **aplicação** (porta `5173`).
Abre <http://localhost:5173>, escolhe **"Jogar online"**, mete o teu nome e entra numa sala.
Para jogarem vários, cada pessoa abre o mesmo endereço (na mesma rede) e entra — ficam na mesma
sala; quem quiser carrega em **"Começar"** e os lugares que faltam são preenchidos por bots.

Se preferires dois terminais separados:

```bash
# terminal 1 — servidor
npm run server

# terminal 2 — aplicação
npm run dev
```

---

## 🛠️ Comandos úteis

| Comando                  | O que faz                                                                  |
| ------------------------ | -------------------------------------------------------------------------- |
| `npm run dev`            | Aplicação web em desenvolvimento (recarrega ao guardar).                   |
| `npm run server`         | Servidor de jogo (Colyseus) em desenvolvimento.                            |
| `npm run online`         | Arranca servidor **e** aplicação ao mesmo tempo.                           |
| `npm test`               | Corre a bateria de testes do motor de regras (21).                         |
| `npm run typecheck`      | Verifica os tipos do cliente.                                              |
| `npm run typecheck:server` | Verifica os tipos do servidor.                                           |
| `npm run check`          | Tipos do cliente + tipos do servidor + testes.                            |
| `npm run build`          | Gera a versão de produção da aplicação web em `dist/`.                     |
| `npm run preview`        | Serve localmente o resultado do `build`.                                   |

Há ainda um teste de integração do servidor (para correr num terminal normal):

```bash
node server/__smoke__/online-smoke.mjs
```

---

## 🌐 Publicar o modo online (gratuito)

- **Aplicação web (frontend)** → **Cloudflare Pages** (ou Vercel). Faz `npm run build` e publica a
  pasta `dist/`. Define a variável de ambiente **`VITE_SERVER_URL`** com o endereço do servidor em
  produção, usando `wss://` (WebSocket seguro), por exemplo `wss://salema.onrender.com`.
- **Servidor de jogo (backend)** → **Render** (Web Service gratuito, suporta WebSockets). O Render
  fornece a porta na variável `PORT` — o servidor já a respeita. Comando de arranque sugerido:
  `npm run server:start`. (No plano gratuito o servidor "adormece" quando está inativo e demora
  ~1 min a acordar no primeiro acesso.)
- **Base de dados** → só será precisa na fase das contas/estatísticas: **Neon** (Postgres, *free*).

O modo **offline** continua a poder ser publicado sozinho em qualquer alojamento estático, sem
servidor nem base de dados.

---

## 🗂️ Estrutura do projeto

```
salema/
├── index.html
├── package.json
├── tsconfig.json           # tipos do cliente
├── tsconfig.server.json    # tipos do servidor
├── server/                 # 🌐 SERVIDOR ONLINE (Node + Colyseus)
│   ├── index.ts            #   arranque do servidor (CORS, /health, porta)
│   ├── SalemaRoom.ts       #   sala autoritativa: lobby, bots, vistas filtradas
│   └── __smoke__/          #   teste de integração do servidor
└── src/
    ├── engine/             # ❤️ NÚCLEO PURO — as regras do jogo (partilhado)
    ├── bots/               #   bot heurístico (usa só a API do motor)
    ├── shared/
    │   └── protocol.ts     #   contrato de mensagens servidor ↔ cliente
    ├── ui/                 #   interface do modo OFFLINE (React)
    └── online/             #   interface do modo ONLINE (React)
        ├── useOnlineGame.ts#     ligação ao servidor (Colyseus)
        ├── OnlineGame.tsx  #     ligar → lobby → mesa
        └── OnlineTable.tsx #     a mesa, vista do servidor, rodada para ti
```

### Porque é que o motor está separado

**O motor de regras não conhece o React, nem o servidor, nem a base de dados.** É uma função pura:
recebe um estado e uma jogada, devolve um novo estado. Tanto o modo offline como o servidor online
são apenas "adaptadores" por cima do **mesmo** motor — sem duplicar lógica. Testa-se isoladamente
(ver `src/engine/__tests__`), e trocar a interface ou o transporte nunca toca nas regras.

---

## 🎮 Como se joga (resumo das regras)

- 5 jogadores, baralho de 40 cartas (sem 8, 9 e 10), 8 cartas para cada um.
- Quem tem o **2 de Paus** abre cada mão, obrigatoriamente com essa carta.
- Segue-se o naipe da primeira carta; quem não tiver, joga o que quiser.
- Ganha a vazada a **carta mais alta do naipe pedido**, pela ordem à Sueca:
  **A > 7 > K > J > Q > 6 > 5 > 4 > 3 > 2**. Quem ganha abre a vazada seguinte.
- Não se pode dar pontos na 1ª vazada, nem abrir com Copas antes de estarem "quebradas".
- **Pontos:** cada Copas = 1; Dama de Espadas = 10. Quem captura, soma.
- **Acertar na lua:** se um jogador apanhar os 20 pontos todos, leva 0 e os outros 4 levam 20 cada.
- **Fim:** quando alguém chega a 100, **perdem todos os que tiverem 100 ou mais**.

---

## ❓ Resolução de problemas

- **`npm: command not found`** → falta instalar o Node.js (ver pré-requisitos).
- **Erros de dependências ao instalar** → usa `npm install --legacy-peer-deps`.
- **A porta 5173 ou 2567 está ocupada** → o Vite escolhe outra automaticamente; para o servidor,
  define `PORT` (ex.: `PORT=2600 npm run server`).
- **Online: "não foi possível ligar ao servidor"** → confirma que o servidor está a correr
  (`npm run server`) e que o `VITE_SERVER_URL` aponta para o sítio certo (em produção, `wss://`).
- **Quero jogar no telemóvel** → corre `npm run dev -- --host` e abre, no telemóvel (mesma rede
  Wi-Fi), o endereço de rede que o terminal indica.
