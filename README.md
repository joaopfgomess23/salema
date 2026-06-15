# Salema 🃏

Versão digital do jogo de cartas **Salema** — um jogo de vazadas para 5 jogadores, variante
portuguesa próxima do *Hearts*. Esta entrega traz o **modo offline jogável** (tu contra 4 bots),
com o motor de regras totalmente isolado e testado, pronto para mais tarde receber o modo online.

O objetivo é **não perder**: termina-se com a menor pontuação possível. Cada **Copas** vale 1 ponto
e a **Dama de Espadas** — a *Salema* — vale 10. Quando alguém chega a 100, o jogo acaba e **perdem
todos os que tiverem 100 ou mais**.

---

## ✅ O que já está incluído

- **Motor de regras** puro em TypeScript (`src/engine/`) — distribuição, ordenação à Sueca,
  abertura obrigatória com o 2 de Paus, seguir naipe, restrição da 1ª vazada, quebrar Copas,
  pontuação, "acertar na lua" e fim de jogo com múltiplos perdedores. **21 testes a passar.**
- **Bots simples** (`src/bots/`) — jogam jogadas legais com uma heurística sensata (evitam ganhar
  pontos, livram-se da Dama de Espadas e das Copas altas).
- **Interface offline em React** (`src/ui/`) — mesa com os 5 lugares, a tua mão em baixo, a vazada
  ao centro, marcação de quem é a vez, ecrã de fim de mão e de fim de jogo.

> O **modo online** (servidor Colyseus + base de dados + contas + estatísticas) está desenhado na
> especificação e descrito mais abaixo como a **fase seguinte**. Ainda não está implementado.

---

## 📦 Pré-requisitos

Só precisas de uma coisa instalada no teu computador:

- **Node.js 18 ou superior** (inclui o `npm`). Confirma com:

  ```bash
  node --version
  ```

  Se não tiveres, instala a partir de <https://nodejs.org> (versão LTS).

---

## 🚀 Como correr (passo a passo)

A partir da pasta do projeto (a pasta que contém o `package.json`):

**1. Instalar as dependências** (só na primeira vez, ou quando mudarem):

```bash
npm install
```

**2. Arrancar a aplicação em modo de desenvolvimento:**

```bash
npm run dev
```

O terminal vai mostrar um endereço local, normalmente <http://localhost:5173>.
Abre-o no browser (computador ou telemóvel na mesma rede) e **joga**.

Para parar o servidor, carrega `Ctrl + C` no terminal.

---

## 🛠️ Outros comandos úteis

| Comando             | O que faz                                                             |
| ------------------- | --------------------------------------------------------------------- |
| `npm run dev`       | Arranca em modo de desenvolvimento (recarrega ao guardar alterações). |
| `npm test`          | Corre a bateria de testes do motor de regras.                         |
| `npm run typecheck` | Verifica os tipos de TypeScript sem gerar ficheiros.                  |
| `npm run build`     | Gera a versão de produção otimizada na pasta `dist/`.                 |
| `npm run preview`   | Serve localmente o resultado do `build`, para confirmar antes de publicar. |

### Publicar o modo offline (opcional)

O modo offline corre 100% no browser, por isso a pasta `dist/` (gerada pelo `npm run build`) pode
ser publicada **gratuitamente** em qualquer alojamento estático — por exemplo **Cloudflare Pages**
ou **Vercel**. Não precisa de servidor nem de base de dados.

---

## 🗂️ Estrutura do projeto

```
salema/
├── index.html              # ponto de entrada da página
├── package.json            # dependências e comandos
├── tsconfig.json           # configuração de TypeScript
├── vite.config.ts          # configuração do Vite
└── src/
    ├── engine/             # ❤️ NÚCLEO PURO — as regras do jogo
    │   ├── cards.ts        #   cartas, baralho, ordenação à Sueca, pontos
    │   ├── rng.ts          #   baralhar de forma determinística (testável)
    │   ├── engine.ts       #   estado do jogo, jogadas legais, pontuação, fim de jogo
    │   ├── index.ts        #   API pública do motor
    │   └── __tests__/      #   testes exaustivos das regras
    ├── bots/
    │   └── simpleBot.ts    # bot heurístico (usa só a API do motor)
    └── ui/                 # interface React (modo offline)
        ├── App.tsx         #   ecrã inicial + jogo
        ├── useGame.ts      #   liga a interface ao motor; faz jogar os bots
        ├── GameTable.tsx   #   a mesa, os lugares, a vazada, os ecrãs de fim
        ├── CardView.tsx    #   desenho de uma carta
        └── styles.css      #   aspeto visual
```

### Porque é que o motor está separado

O requisito mais importante da arquitetura: **o motor de regras não conhece o React, nem o
servidor, nem a base de dados**. É uma função pura — recebe um estado e uma jogada, devolve um novo
estado. A interface (e, no futuro, o servidor) é apenas um "adaptador" por cima.

Vantagens práticas:

- As regras testam-se isoladamente, sem abrir o jogo (ver `src/engine/__tests__`).
- O **mesmo** motor servirá o modo offline e o modo online, sem duplicar lógica.
- Trocar a interface, o transporte (WebSocket) ou a base de dados nunca toca nas regras.

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

## 🔭 Fase seguinte — modo online (ainda por construir)

Tudo isto está planeado na especificação (`salema-especificacao.md`). A base já está preparada para
o receber, porque o motor é reutilizável tal como está.

1. **Servidor (`game-session`)** — Node + **Colyseus**: uma sala por jogo, lobby público, e
   preenchimento dos lugares vazios com bots até 5. O servidor é autoritativo (corre o motor; os
   clientes só enviam ações e mostram o estado). Vários jogos em simultâneo num
   `Map<gameId, GameState>` — possível porque o motor não tem estado global partilhado.
2. **Contas (`accounts`)** — nome + id + password (guardada com *hash*, ex. bcrypt/argon2).
3. **Estatísticas (`stats`)** — só no modo online: jogos, derrotas, média de pontos por jogo,
   total de Salemas e total de luas, guardados em **Postgres** (ex. **Neon**, *free tier*).
4. **Alojamento gratuito** — frontend em **Cloudflare Pages**, servidor no **Render** (Web Service
   gratuito, com WebSockets), base de dados no **Neon**.

---

## ❓ Resolução de problemas

- **`npm: command not found`** → falta instalar o Node.js (ver pré-requisitos).
- **A porta 5173 está ocupada** → o Vite escolhe outra automaticamente; usa o endereço que o
  terminal mostrar.
- **Quero jogar no telemóvel** → corre `npm run dev -- --host` e abre, no telemóvel, o endereço de
  rede que o terminal indica (o computador e o telemóvel têm de estar na mesma rede Wi-Fi).
