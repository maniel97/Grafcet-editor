# O que é um grafcet?

Um **grafcet** descreve, com um desenho normalizado, como se comporta um automatismo: o que a máquina faz em cada momento e o que tem de acontecer para passar de uma situação à seguinte. É definido pela norma **IEC 60848**.

## Porquê um grafcet e não diretamente o programa?

- **Entende-se sem saber programar.** O mecânico, o eletricista e o programador leem o mesmo.
- **Separa o quê do como.** Primeiro pensa-se a sequência; depois traduz-se para ladder, ST ou AWL para o autómato que for. Este editor faz essa tradução.
- **Evita esquecimentos.** Cada situação é uma etapa e cada mudança, uma transição com a sua condição: se faltar algo, nota-se (e Verificar assinala-o).

## As peças

- **Etapas** (quadrados): as situações em que o sistema pode estar. As ativas indicam onde está. Ver [Etapas](etapas).
- **Transições** (traços horizontais): a passagem de umas etapas a outras, com a sua **receptividade**, a condição que a permite. Ver [Transições](transiciones).
- **Ações** (retângulos à direita da etapa): o que se faz enquanto a etapa está ativa. Ver [Ações](acciones).
- **Ligações**: unem etapas e transições, que se alternam sempre. Leem-se de cima para baixo; as que sobem levam seta.

## Como evolui

1. Ao arrancar ativam-se as **etapas iniciais** (quadrado duplo).
2. Uma transição está **validada** quando todas as suas etapas anteriores estão ativas.
3. Se, além disso, a sua receptividade for verdadeira, é **transposta**: desativam-se as etapas anteriores e ativam-se as seguintes, ao mesmo tempo.
4. As transições que podem ser transpostas ao mesmo tempo são-no simultaneamente.

> **Atenção:** uma transição validada com a receptividade falsa espera. O grafcet não «salta» etapas: há sempre uma transição pelo meio.

```ejemplo marcha-paro
O grafcet mais simples: duas etapas, duas transições. Abra-o e clique em Simular.
```

Para desenhar o seu passo a passo:

```tutorial primer-grafcet
```
