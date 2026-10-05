# Exercícios

Um **exercício** traz um enunciado e o que o professor dá já feito (a planta, a tabela de variáveis, o esquema…). O grafcet desenha-o o aluno, e o editor diz se está certo.

> **Modo educativo:** as ferramentas de aula (Abrir > Exercícios e Corrigir entregas, Exportar > Exercício para os alunos e Guião de práticas) aparecem ao ativar **Opções > Modo educativo**. Sem ele, os menus ficam mais simples; um exercício que lhe deem abre-se com Abrir > Abrir ficheiro e funciona igual.

## Para os alunos

1. Abra o exercício: Abrir > Exercícios, ou com Abrir > Abrir ficheiro o ficheiro que o professor lhe deu (um .json ou a ficha de prática em PDF: o exercício vai dentro). Há exercícios dos níveis 1 a 5; os marcados com **Guiado** acompanham-no passo a passo, dizendo-lhe o que clicar em cada momento.
2. Leia o enunciado no painel **Exercício** (à direita; o botão da barra abre-o e fecha-o).
3. Desenhe o grafcet. Pode simulá-lo e verificá-lo como sempre.
4. Clique em **Comprovar** quantas vezes quiser. Cada verificação aparece a verde ou a vermelho, com o que falha. Se ficar bloqueado, abra uma **pista** (se o professor as oferecer): aparecem uma a uma e ficam contadas; se houver nota, cada uma pode descontar.
5. Para entregar, Exportar > **Dossier do trabalho prático**: o PDF leva o seu projeto dentro (abre-se no editor) e tem secções para o conteúdo teórico, as melhorias e os problemas encontrados.

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
6. **Requisitos, pistas e nota** (no mesmo diálogo): marque o que o grafcet tem de usar (uma temporização, um contador, um flanco, uma divergência em OU ou em E, uma ação condicional ou memorizada, um máximo de etapas). Escreva pistas, uma por linha, da mais geral à mais concreta, ou desmarque **Oferecer pistas** se preferir dá-las pessoalmente. A **nota** é opcional e orientativa: a parte de critérios cumpridos, e cada pista vista pode descontar.

## Corrigir entregas

Com o seu exercício aberto (o que tem a sua solução), Abrir > **Corrigir entregas** e adicione os dossiers em PDF da turma (levam o projeto dentro) ou os seus .json.

- Cada entrega é corrigida de novo com as **suas** verificações, não com as que traz o ficheiro.
- A tabela mostra cada critério, as pistas vistas, a nota (se a pedir) e os dados do processo (se os pedir).
- Avisa de **trabalhos muito parecidos** (mesmo desenho e mesma lógica): é um aviso, não uma prova.
- **Descarregar CSV** leva-a para uma folha de cálculo. Nada sai do seu navegador.

**Dados do processo** (no diálogo do exercício, desativados por defeito): registam-se só totais (vezes que verifica, minutos com atividade, simulações e pistas vistas). O aluno é avisado ao abrir o exercício e os dados saem numa página do seu dossier.

## Guião de práticas

Várias práticas num só PDF, como um guião de sempre: Exportar > **Guião de práticas**.

- Dados do cabeçalho e do rodapé (disciplina, ano, curso, escola, professor/a) e as **normas gerais**: entrega, avaliação e o que deve incluir cada prática.
- As práticas: o projeto aberto e as que adicionar a partir de ficheiros (.json de exercícios ou fichas em PDF). Ordene-as com as setas.
- **Guiada**: o projeto aberto pode sair com a sua solução (grafcet, ligações, ladder e tabela), como a prática feita na aula como exemplo; o projeto resolvido vai também dentro.
- Ao abrir o guião no editor escolhe-se a prática.

Em Abrir > Exercícios há um guião de exemplo com cinco práticas de autómatos: abra a prática 1 resolvida e use **Usar o guião de exemplo**.

> **Atenção:** as verificações viajam seladas no ficheiro, mas não é um sistema de segurança: o corretor baseia-se no comportamento, não em copiar o seu grafcet.

```ejemplo cilindros
Um bom ponto de partida para um exercício com planta.
```
