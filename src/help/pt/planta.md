# A planta virtual

A **planta virtual** é uma maqueta animada da máquina: botões, cilindros, tapetes, detetores, depósitos… Move-se com as **saídas** do grafcet e ativa sozinha as **entradas**: é como testar o programa na máquina real, sem estragar nada.

## Abri-la

Ao simular abre-se junto ao grafcet, se o projeto tiver planta; no painel de simulação, **«Planta virtual»** fecha-a e volta a abri-la. Arraste a separação para repartir a largura (duplo clique: metade e metade).

## Usar e Editar

- **Usar**: aciona-se como a máquina: botões, interruptores, alimentadores de peças. As entradas que a planta dá aparecem no painel com a marca «planta». Os potenciómetros ajustam-se com a roda do rato (com Shift, mais fino), com as setas do teclado ou, em ecrã tátil, arrastando o dedo devagar.
- **Editar**: colocam-se e configuram-se elementos. Arraste-os da paleta, rode-os com **R**, apague-os com **Supr**. Nas suas propriedades escolhe-se a variável de cada um (se não existir, acrescenta-se à tabela).

«Ligações» mostra o que está ligado e o que falta: entradas do grafcet que ninguém dá, saídas que não movem nada.

## Diagrama espaço-fase

Enquanto simula, a secção **«Diagrama espaço-fase»** do painel desenha o que os cilindros fizeram: uma linha por cilindro com as suas posições 0 (recolhido) e 1 (avançado) e uma coluna por fase, com cada movimento na diagonal. É o diagrama dos apontamentos de pneumática, mas do que faz o **seu** programa: compare-o com o que pede o enunciado.

- **Fases** ou **Tempo**: o eixo horizontal por fases (etapas) ou em segundos (diagrama espaço-tempo).
- Se no fim todos voltarem à posição inicial, a última fase marca-se «5=1»: o ciclo fecha-se.
- **Sequência esperada** (p. ex. `A+ B+ B− A−`; o gerador pneumático deixa-a preenchida): o seu diagrama desenha-se a cinzento por baixo e verifica-se se coincidem; se não, diz em que fase está a diferença. Também aparece no dossier, com o cenário de teste.
- **Linhas de sinal**: em cada mudança de fase, o fim de curso que dá passagem ao movimento seguinte (`a1`, `b1`…).

## Mais realismo

- **Gravidade**: vista de frente; as peças caem, apoiam-se em plataformas e na haste dos cilindros.
- **Relevo**: desenho com volume, só de apresentação.
- **Avarias** (em Usar): um detetor que não dá sinal, um cilindro que encrava… para praticar o diagnóstico.
- **Painel de comando**: os botões e sinalizadores podem ir numa consola à parte.
- **Os meus grupos**: guarde uma estação para a reutilizar noutros projetos.

> **Atenção:** se algo não se mexer, veja primeiro «Ligações» e depois a secção «O que o grafcet espera» do painel de simulação.

```ejemplo taladradora
Um engenho de furar com a sua planta.
```

```ejemplo cargador-gravedad
Com gravidade: as peças caem do carregador.
```

Para a experimentar passo a passo:

```tutorial planta
```
