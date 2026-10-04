# Etapas

Uma **etapa** é uma situação estável do sistema: «à espera», «a baixar a broca», «a encher»… Em cada momento, cada etapa está **ativa** ou **inativa**; o conjunto de etapas ativas é a *situação* do grafcet.

## Tipos

- **Etapa** (quadrado com o seu número): a normal.
- **Etapa inicial** (quadrado duplo): ativa ao arrancar. Todo o grafcet precisa de pelo menos uma.
- **Macroetapa** (quadrado com traços em cima e em baixo, M1…): representa um pedaço de grafcet desenhado à parte, a sua *expansão*, com uma etapa de entrada E1 e uma de saída S1.
- **Etapa encapsulante** (com os cantos cortados): enquanto está ativa, também o está o grafcet que encapsula. Ver a página «Notação IEC 60848».

## A variável de etapa

Cada etapa tem uma variável, **X** seguido do seu número: `X2` vale 1 enquanto a etapa 2 está ativa. Serve nas receptividades (`X2 · b`), para sincronizar grafcets e nas [temporizações](temporizaciones) (`5s/X2`).

> **Atenção:** os números de etapa não têm de ser seguidos, mas têm de ser únicos em todo o projeto (todas as folhas). Verificar marca um erro se houver dois iguais.

## Bons hábitos

- Numere pela ordem em que se percorrem: lê-se melhor e o ladder fica ordenado.
- Uma etapa sem ações é normal (esperas, repouso).
- Se duas etapas fazem sempre o mesmo e se passa de uma para a outra sem condição (receptividade `1`), provavelmente uma delas sobra.

```ejemplo taladradora
Etapas com ações e uma etapa de repouso sem elas.
```
