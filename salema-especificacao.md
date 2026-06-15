# Salema — Especificação do Projeto e Prompt de Contexto

> **Propósito deste documento.** Serve de contexto completo para desenvolver uma versão digital
> do jogo de cartas **Salema**. Reúne tudo o que foi decidido até agora. Está organizado em três
> níveis de certeza, claramente assinalados:
>
> - **[DECIDIDO]** — fechado e confirmado. Não mexer sem decisão explícita em contrário.
> - **[RECOMENDADO — a escolher]** — proposta técnica fundamentada, ainda por validar.
> - **[A REFINAR]** — definido na direção, mas com detalhes a fechar mais tarde.
>
> Nenhum código deve ser escrito sem luz verde explícita.

---

## 1. Visão geral [DECIDIDO]

Versão digital do jogo de cartas **Salema**, um jogo de vazadas (*trick-taking*) para 5 jogadores,
variante portuguesa próxima do Hearts. O objetivo de cada jogador é **terminar com a MENOR
pontuação possível** — ou, mais precisamente neste projeto, **não perder**.

A aplicação terá:

- Um **modo offline** (1 humano contra 4 bots).
- Um **modo online** (cliente-servidor, vários humanos em interfaces diferentes, bots a preencher
  os lugares em falta).
- Uma aba de **ranking/estatísticas** que compara os jogadores (apenas com dados do modo online).

Contexto de utilização: grupo de **≈20 amigos**. Por vezes haverá **mais do que um jogo a decorrer
em simultâneo**.

---

## 2. Regras do jogo [DECIDIDO]

### 2.1 Objetivo e fim do jogo
- Jogo de vazadas para **5 jogadores**.
- Ganha quem tiver menos pontos; **mas neste projeto só se regista quem PERDE**, não quem ganha.
- O jogo termina assim que um jogador **atinge ou ultrapassa 100 pontos**.
- **Perdedores:** no fim do jogo, **perdem TODOS os jogadores com pontuação ≥ 100**, e não apenas
  o de pontuação mais alta. É possível haver vários perdedores em simultâneo.

### 2.2 Baralho e distribuição
- Baralho de **40 cartas** (sem 8, 9 e 10). Cada naipe tem: 2, 3, 4, 5, 6, 7, Q, J, K, A.
- **5 jogadores × 8 cartas = 40.** Não sobram cartas; não há monte nem cartas de lado.
- **Não existe fase de troca de cartas.** Joga-se a mão exatamente como foi distribuída.

### 2.3 Ordenação das cartas (à Sueca)
Por ordem **decrescente de força**:

```
A  >  7  >  K  >  J  >  Q  >  6  >  5  >  4  >  3  >  2
```

Notas importantes:
- O **7 é a segunda carta mais forte** (logo abaixo do Ás).
- A **Dama de Espadas (Q♠)** é a pior em *pontos*, mas em *força* fica a meio da tabela
  (ganha ao 6/5/4/3/2, perde para J/K/7/A). Por isso, muitas vezes consegue-se descartá-la numa
  vazada de Espadas sem a ganhar.

### 2.4 Pontuação
- Cada carta de **Copas (♥) = 1 ponto**.
- **Dama de Espadas (Q♠) = 10 pontos**.
- Todas as outras cartas = 0 pontos.
- **Total em jogo por ronda = 20 pontos.**

### 2.5 Fluxo de uma ronda
- A ronda tem **8 vazadas** (8 cartas por jogador). No fim, somam-se os pontos e redistribui-se.
- **Quem abre:** o jogador que tiver o **2 de Paus (♣2)** é obrigado a jogá-lo para abrir a
  **primeira vazada**. Isto aplica-se a **todas as mãos** (a cada nova distribuição), não só à
  primeira do jogo.
- Joga-se à vez, no **sentido dos ponteiros do relógio**.
- **Seguir o naipe:** é obrigatório seguir o naipe da primeira carta da vazada. Quem não tiver
  cartas desse naipe pode jogar qualquer outra.
- **Ganhar a vazada:** ganha quem jogar a carta mais alta do **naipe inicial** (segundo a
  ordenação à Sueca acima). Quem ganha recolhe as cartas e **abre a vazada seguinte**.

### 2.6 Restrição da 1ª vazada
- Na **primeiríssima vazada de cada mão** (aquela em que se joga o ♣2), nenhum jogador pode jogar
  cartas que dêem pontos (**Copas ou a Q♠**) — **exceto** se só tiver cartas de pontos na mão.

### 2.7 Quebrar Copas (*breaking hearts*)
- Não se pode **abrir** uma vazada com uma carta de **Copas (♥)** enquanto alguém não tiver já
  descartado uma Copas numa vazada anterior (por não ter o naipe pedido).
- **Exceção:** se o jogador que vai abrir só tiver Copas na mão, pode abrir com Copas.
- A Q♠ é uma carta de **Espadas**: abrir com Espadas (incluindo a Q♠) é sempre permitido, sujeito
  apenas à restrição da 1ª vazada (2.6). A regra de quebrar Copas não se aplica à Q♠.

### 2.8 "Acertar na Lua" / fazer os 20 (*shooting the moon*)
- Se **um único jogador** acumular **todas as 10 Copas + a Q♠** (os 20 pontos todos) numa ronda:
  - esse jogador recebe **0 pontos**;
  - cada um dos outros **4 adversários recebe +20 pontos**.
- **Não há** opção de o jogador que acerta na lua "levar com os 20" em vez de os distribuir.
- Se acertar na lua **empurrar adversários para ≥ 100**, esses adversários **perdem** (aplica-se a
  regra de fim de jogo da secção 2.1).

---

## 3. Requisitos de produto [DECIDIDO]

### 3.1 Modos de jogo
- **Offline:** 1 humano vs **4 bots**. Funciona de forma autónoma, idealmente sem depender de
  servidor (corre tudo no cliente). **Não regista estatísticas.**
- **Online:** **cliente-servidor**. Vários humanos juntam-se ao jogo a partir de **interfaces
  diferentes**, através de um servidor.
  - Se só se ligarem **2, 3 ou 4 humanos**, **preenchem-se os lugares com bots até perfazer 5**.
  - Acesso através de **lobby público** (é um grupo de amigos, não precisa de salas privadas).
  - **É o único modo que regista estatísticas.**

### 3.2 Plataforma
- **Web**, de modo a funcionar tanto em **computador** como em **mobile** (browser).

### 3.3 Isolamento do motor de regras (requisito rígido)
- O **motor de regras** tem de ficar **totalmente isolado da interface**.
- O mesmo motor deve servir os dois modos (offline e online) sem alterações.

### 3.4 Escala e concorrência
- Grupo de **≈20 utilizadores** (amigos).
- Tem de suportar **vários jogos em simultâneo**, independentes entre si.

### 3.5 Estatísticas e ranking
- **Só são contabilizadas no modo online.** O modo offline nunca afeta o ranking.
- Persistência de estatísticas **por jogador**, comparáveis numa **aba de ranking**.
- Métricas a registar, por jogador:
  - **Jogos** — total de jogos disputados (contagem acumulada).
  - **Derrotas** — total de vezes que terminou um jogo com pontuação ≥ 100 (contagem acumulada).
  - **Pontos por jogo** — **média** (única métrica "por jogo"). Guarda-se o total de pontos e o
    número de jogos, e calcula-se a média.
  - **Salemas** — **total acumulado** de vezes que capturou a Q♠ (NÃO por jogo).
  - **20s / luas** — **total acumulado** de vezes que acertou na lua (NÃO por jogo).

### 3.6 Contas de jogador
- Cada jogador tem **nome + id + password**.
- A password serve para impedir que outra pessoa use a conta alheia.
- **Nota de segurança:** as passwords devem ser guardadas com *hash* (bcrypt ou argon2), nunca em
  texto simples. Em alternativa, pode usar-se um serviço com autenticação incluída (ex.: Supabase).

---

## 4. Stack tecnológica [DECIDIDO]

- **Motor de regras:** **TypeScript**. Corre nativamente no browser (offline) e em Node (online) —
  uma só fonte de verdade, sem duplicação.
- **Frontend:** **React** (com build estático via Vite; opção de embrulhar como **PWA** para
  instalável + offline). *Nota: é a primeira vez que o programador trabalha com React.*
- **Backend / tempo real:** **Node + Colyseus** (framework de salas multiplayer autoritativas;
  encaixa o requisito "sala de 5, preencher com bots").
- **Base de dados:** **Postgres gerido** (apenas para o modo online: estatísticas e contas).
  Ver avisos de alojamento na secção 6.
- **Bots:** **versão simples primeiro** (que jogue jogadas legais e funcione de ponta a ponta);
  sofisticação (heurísticas mais fortes) numa fase posterior.

---

## 5. Arquitetura [DECIDIDO]

### 5.1 Topologia do sistema
- **Monólito modular** (um único implantável, dividido internamente em módulos com fronteiras
  claras), com **cliente-servidor autoritativo** para o modo online (o servidor detém a verdade e
  corre o motor; os clientes enviam ações e renderizam o estado).
- Microserviços ficam de fora a esta escala (sobre-engenharia). O monólito modular permite extrair
  um serviço mais tarde, se alguma vez for necessário.
- Módulos previstos: `engine` (regras puras), `game-session` (jogos ao vivo, tempo real,
  preenchimento com bots), `stats` (ranking) e `accounts` (contas/autenticação).

### 5.2 Organização interna do código
- **Ports & Adapters (arquitetura hexagonal)**, com o **motor de regras como núcleo puro**, sem
  conhecimento de UI, servidor ou base de dados.
- Adaptadores: UI-browser (offline), servidor-websocket (online), base de dados (persistência de
  estatísticas e contas). Trocar a UI, o transporte ou a BD nunca toca no domínio.

### 5.3 Jogos em simultâneo
- Cada jogo é o seu próprio objeto de estado. Um `Map<gameId, GameState>` (ou salas do Colyseus)
  guarda muitos jogos independentes. Como o motor é uma **função pura de (estado, ação)** sem
  estado global mutável partilhado, jogos simultâneos não interferem entre si.

### 5.4 Persistência e estatísticas
- A persistência só existe no **modo online** e usa **Postgres gerido** — **não SQLite em disco**,
  porque os alojamentos considerados têm sistema de ficheiros efémero (apagado em cada
  *redeploy*/hibernação), o que perderia os dados.
- Padrão **orientado a eventos (leve)**: quando um jogo online termina, o motor emite um
  **resultado estruturado**; o módulo `stats` consome-o e atualiza o ranking. As estatísticas ficam
  desacopladas da jogabilidade.

### 5.5 Ordem de construção recomendada
1. **Motor de regras puro** (`engine`) — testável de forma isolada, com testes exaustivos das
   regras (ordenação à Sueca, ♣2 a abrir, seguir naipe, restrição da 1ª vazada, quebrar Copas,
   pontuação, lua, múltiplos perdedores ≥100). Maior alavancagem, zero dependência de stack.
2. **Bots simples** — consomem a API de "jogadas legais" do motor.
3. **UI offline (React)** — protótipo jogável vs 4 bots.
4. **Servidor + modo online** (Node + Colyseus) — reutiliza o mesmo motor; lobby público;
   preenchimento com bots.
5. **Contas + estatísticas + ranking** — módulos `accounts` e `stats` + Postgres.

---

## 6. Alojamento (hosting) [DECIDIDO — opção gratuita]

Objetivo: **custo zero**. Nota-chave: o **modo offline** corre 100% no browser (React + motor +
bots), por isso não precisa de servidor nem de base de dados — é gratuito por natureza. O custo só
diz respeito ao **modo online** (servidor + BD).

Setup escolhido:

- **Frontend (React/Vite estático):** **Cloudflare Pages** (ou Vercel) — gratuito permanente, sem
  cartão. Serve também o modo offline.
- **Backend (Node + Colyseus):** **Render (Web Service gratuito)** — *deploy* por *git push*,
  gratuito, sem cartão, com WebSockets. Senão: hiberna ao fim de 15 min sem tráfego (*cold start*
  de ~1 min na primeira ligação); durante a partida, o tráfego WebSocket mantém-no acordado.
  Aceitável para um grupo de amigos.
- **Base de dados (Postgres):** **Neon** (*free tier* persistente, sem cartão).

**Caminhos de evolução (se um dia o *cold start* incomodar):**
- Render Starter (~7 $/mês) para o backend ficar sempre ligado; ou
- **Oracle Cloud Always Free** — VPS ARM sempre ligada e gratuita para sempre (gere-se o Linux com
  nginx + pm2; exige cartão só para verificação e pode haver fricção de capacidade ao provisionar).
- Como o motor está isolado, mudar o servidor Colyseus de sítio não toca nas regras.

**Fora de questão:** PythonAnywhere (sem WebSockets em produção) e o Postgres **gratuito do Render**
(apagado ao fim de 30 dias).

---

## 7. Decisões a refinar mais tarde [A REFINAR]

- **Sofisticação dos bots** — começar simples; definir depois as heurísticas (evitar pontos,
  livrar-se da Q♠, gestão de naipes, etc.).
- **Detalhes de autenticação** — *hash* próprio (bcrypt/argon2) vs. delegar a um serviço (ex.:
  Supabase).

---

## 8. Glossário rápido

- **Vazada** — ronda de uma carta por jogador; o vencedor recolhe-as.
- **Salema** — neste projeto, captar a **Dama de Espadas (Q♠)** (vale 10 pontos).
- **20 / Lua** — acertar na lua (*shooting the moon*): captar os 20 pontos todos.
- **Quebrar Copas** — momento a partir do qual passa a ser permitido abrir vazadas com Copas.
- **À Sueca** — a ordenação de força das cartas (A > 7 > K > J > Q > 6 > 5 > 4 > 3 > 2).
