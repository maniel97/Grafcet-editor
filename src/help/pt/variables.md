# Variáveis e endereços

As **variáveis** são os nomes que usa nas receptividades e ações: `Marcha`, `Motor`, `C`… Aparecem sozinhas na **tabela de variáveis** ao escrevê-las, classificadas em entradas, saídas, internas, contadores e analógicas.

## A tabela

- Botão **Variáveis** da barra: a tabela completa. Também se pode pôr na tela (clique direito > «Tabela de variáveis aqui»), para que saia na impressão.
- Cada variável tem **endereço** do autómato (`I0.0`, `Q0.1`, `M0.0`…) e **comentário**.
- «Preencher vazias» (na tabela completa; na da tela, clique direito > «Preencher endereços vazios») atribui endereços às que não têm, segundo o formato escolhido: **S7-200**, **S7-300/1200** ou **IEC 61131-3** (`%I0.0`).
- Arraste uma variável para outra secção para mudar o seu tipo.

## Mudar um nome

Escreva o nome novo na tabela: muda em todas as receptividades e ações, na planta e no esquema, e **mantém** o seu endereço e o seu comentário.

## Variáveis de etapa

`X2` é a etapa 2. Na tabela pode escolher que o ladder, o ST, o AWL e a simulação lhe chamem `E2` (hábito nalgumas escolas); no grafcet continua a escrever-se `X2`, como manda a norma.

## Analógicas

Uma entrada comparada com um número (`[Temperatura > 60]`) é analógica. Na tabela escolhe o seu sinal (4–20 mA ou 0–10 V) e a sua gama física; o ladder escala-a e a simulação usa um cursor nessas unidades.

> **Atenção:** o nome de uma variável não pode ter espaços nem começar por número. Use `PiezaArriba` ou `pieza_arriba`.
