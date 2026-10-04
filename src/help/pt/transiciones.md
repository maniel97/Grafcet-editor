# Transições e receptividades

Uma **transição** é a passagem de umas etapas a outras. Desenha-se como um traço horizontal na ligação, com a sua **receptividade** à direita: a condição lógica que permite a passagem.

## Quando é transposta

1. Está **validada** se todas as suas etapas anteriores estiverem ativas.
2. É **transposta** se estiver validada e a sua receptividade valer 1.
3. Ao transpô-la desativam-se as etapas anteriores e ativam-se as seguintes, tudo ao mesmo tempo.

Na simulação, uma transição validada aparece a âmbar e uma transponível, a verde. Se não avançar, passe o rato por cima: diz o que falta.

## Como se escreve uma receptividade

| Escreva | Significa |
|---|---|
| `a · b` (ou `a*b`) | a E b |
| `a + b` | a OU b |
| `!a` | a negada (desenha-se com barra por cima) |
| `↑a` | flanco ascendente de a: só no instante em que passa a 1 |
| `↓a` | flanco descendente |
| `X2` | a etapa 2 está ativa |
| `5s/X2` | passaram 5 s desde que a etapa 2 se ativou (ver [Temporizações](temporizaciones)) |
| `[C >= 3]` | comparação numérica (contadores, analógicas) |
| `1` | sempre verdadeira |

Ao escrever, o preenchimento automático propõe as variáveis que já existem e os operadores.

> **Atenção:** com a receptividade `1`, a transição é transposta assim que é validada: a etapa anterior é atravessada sem parar (*evolução fugaz*) e as suas ações contínuas não chegam a executar-se. Verificar avisa com um conselho.

## Transições fonte e poço

Uma transição **fonte** não tem etapa anterior: está sempre validada e, cada vez que se cumpre (normalmente um flanco, `↑Pieza`), ativa as suas etapas seguintes. Uma **poço** não tem etapa seguinte: ao ser transposta, só desativa.

```ejemplo contador
Receptividades com flancos e comparações.
```
