# Simular

**Simular** executa o grafcet como o faria o autómato, sem autómato. Enquanto simula, o diagrama não pode ser alterado; «Parar» volta à edição.

## O que se vê

- **Etapa ativa**: verde, com um ponto.
- **Transição validada**: âmbar. **Transponível**: verde.
- **Ação emitida**: verde.
- No painel da direita, as **entradas** (interruptor ou botão de pressão), as **saídas** e as variáveis internas, contadores e temporizadores.

## Como se usa

- Ative uma entrada com um clique, ou com as teclas **1–9** (pela ordem do painel).
- Em **Pausa**, o botão **Passo** (⏭) transpõe uma de cada vez, para ver bem o que acontece (incluindo a evolução fugaz).
- A velocidade do tempo pode ser alterada: útil com esperas longas.
- Se algo não avançar, passe o rato pela transição: diz que condição falta.

## Planta virtual e esquema elétrico

Nos exemplos que a têm, a **planta** (cilindros, tapetes, detetores…) move-se com as suas saídas e ativa sozinha as entradas: é como testar na máquina. O **esquema elétrico** mostra o autómato cablado e também se simula. Ver [A planta virtual](planta) e [O esquema elétrico](esquema-electrico).

## Painéis flutuantes

O **cronograma**, o **diagrama espaço-fase** e os **cenários de teste** podem sair do painel: com o botão do seu título ou arrastando o título até à área de trabalho.

- Movem-se pela barra de título e redimensionam-se pelos bordos e cantos (com o teclado: setas para mover, Shift + setas para o tamanho).
- Mais largos, mostram mais: o cronograma, mais segundos.
- **Devolver** volta a pô-los no painel. O seu lugar e tamanho são recordados.

## Cenários

«Gravar cenário» regista as mudanças de entradas com o seu instante. Guardam-se no projeto e reproduzem-se com um clique: assim comprova, após cada alteração, que tudo continua a funcionar. O cronograma mostra entradas, etapas e saídas ao longo do tempo.

```ejemplo taladradora
Com planta virtual: clique em Simular e depois em Marcha.
```
