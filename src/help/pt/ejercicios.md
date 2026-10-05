# Exercícios

Um **exercício** traz um enunciado e o que o professor dá já feito (a planta, a tabela de variáveis, o esquema…). O grafcet desenha-o o aluno, e o editor diz se está certo.

## Para os alunos

1. Abra o exercício: Abrir > Exercícios, ou com Abrir > Abrir ficheiro o ficheiro que o professor lhe deu (um .json ou a ficha de prática em PDF: o exercício vai dentro).
2. Leia o enunciado no painel **Exercício** (à direita; o botão da barra abre-o e fecha-o).
3. Desenhe o grafcet. Pode simulá-lo e verificá-lo como sempre.
4. Clique em **Comprovar** quantas vezes quiser. Cada verificação aparece a verde ou a vermelho, com o que falha.

> **Atenção:** o que o professor dá bloqueado (por exemplo, a tabela de variáveis) não se pode alterar: use esses nomes no grafcet. Se escrever um que não está, a verificação assinala-o como possível gralha.

## O que se verifica

- Que há um grafcet (etapa inicial e alguma transição).
- Que cumpre a norma: Verificar sem erros.
- Com a tabela de variáveis dada, que só usa as suas variáveis.
- Nos exercícios com planta, que a máquina faz a sequência pedida com o cenário de teste do professor.
- Com cada cenário de teste, que a máquina responde como a do professor: as saídas ligam-se e desligam-se nos mesmos momentos (com uma margem de tempo) e chegam as mesmas peças. Se algo falhar, **Ver na simulação** reproduz esse cenário para que veja onde.

## Para os professores

1. Resolva o exercício no editor: essa é a sua solução e não se distribui.
2. Prepare os cenários de teste: grave-os na simulação (por exemplo, carregar em Marcha e esperar um ciclo) ou clique em **Desenhar cenário** e arraste na linha de cada entrada para decidir quando se prime; em baixo vê ao vivo o que faz o seu grafcet.
3. Exportar > **Exercício para os alunos**: escreva o enunciado, escolha o que se dá feito (e se vai bloqueado) e o que se verifica. Clique em **Testar**: com a sua solução, tudo deve ficar a verde.
4. **Guardar e descarregar para os alunos** cria o ficheiro a distribuir, sem o seu grafcet.
5. **Ficha de prática (PDF)** cria uma ficha como as de sempre, para imprimir ou distribuir: cabeçalho para o nome, enunciado, o que se fornece (tabela, planta, esquema), os critérios de avaliação por extenso e os cenários de teste. O ficheiro do exercício vai dentro do PDF como anexo: ao abrir o PDF no editor carrega-se o exercício. Qualquer pessoa pode avaliar o exercício com o papel, sem conhecer o programa, e a **impressão digital** do rodapé identifica o ficheiro de dentro.

> **Atenção:** as verificações viajam seladas no ficheiro, mas não é um sistema de segurança: o corretor baseia-se no comportamento, não em copiar o seu grafcet.

```ejemplo cilindros
Um bom ponto de partida para um exercício com planta.
```
