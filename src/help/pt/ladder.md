# Do grafcet ao autómato

O botão **Ladder** traduz o grafcet para programa de autómato, em várias linguagens:

- **Ladder** (contactos), para ver e imprimir.
- **ST** (texto estruturado IEC 61131-3) e **SCL** do TIA Portal.
- **AWL / STL** para S7-300 e S7-200, pronto a importar.

## O método

É o método clássico de **uma memória por etapa com SET e RESET**, o que se ensina nas aulas. O programa organiza-se em secções:

1. **Inicialização**: no primeiro ciclo ativam-se as etapas iniciais e desativam-se as outras.
2. **Condições de transposição**: uma memória por transição = etapas anteriores ativas · receptividade.
3. **Desativação** das etapas anteriores e **ativação** das seguintes (RESET e SET).
4. **Temporizações** e **contadores**.
5. **Ações**: memorizadas com SET/RESET; contínuas, uma bobina por saída com o OU das suas etapas.

Calcular primeiro todas as transições e depois ativar e desativar faz com que as que podem ser transpostas ao mesmo tempo o sejam simultaneamente, como diz a norma.

> **Atenção:** as saídas escrevem-se uma só vez, no fim. Se uma saída aparecer em várias etapas, a sua bobina leva o OU de todas: não ponha duas bobinas na mesma saída.

## Levá-lo ao autómato

- **STEP 7-Micro/WIN (S7-200)**: descarregue o `.awl` e importe-o com Ficheiro > Importar. A tabela de símbolos copia-se e cola-se.
- **TIA Portal**: copie o SCL para uma fonte externa ou um bloco SCL.
- **Outros (CODESYS, etc.)**: o ST é normalizado.

Clique direito numa etapa ou transição > «Ver no ladder» leva aos segmentos que gera.

```ejemplo taladradora
Abra-o e clique em Ladder.
```
