# O seu primeiro grafcet

Vamos desenhar um **marcha-paragem**: ao carregar em Marcha liga-se um motor; ao carregar em Paro (paragem), desliga-se. Se preferir que o próprio editor o guie, faça o tutorial:

```tutorial primer-grafcet
```

## Passo a passo

1. **Etapa inicial.** Na barra, «Etapa inicial» (ou clique direito na tela > «Etapa inicial aqui»). É a etapa 0: a situação de repouso.
2. **Transição.** Selecione a etapa e clique no **+** que aparece por baixo: acrescenta uma transição já ligada.
3. **Receptividade.** Faça duplo clique na transição e escreva `Marcha`. É a condição para sair do repouso.
4. **Etapa 1.** Selecione a transição e clique no seu **+**.
5. **Ação.** Duplo clique na etapa 1 > «Adicionar ação» e escreva `Motor` (ou o **+** à direita da etapa).
6. **Voltar ao repouso.** Acrescente uma transição por baixo da etapa 1 com a receptividade `Paro`. Clique direito nela > «Retorno à etapa» e clique na etapa 0.
7. **Verificar.** O botão fica verde (✓) se tudo cumprir a norma.
8. **Simular.** Clique em Simular, ative Marcha (clique ou tecla 1) e veja a etapa 1 ativar-se e Motor ligar-se.

> **Atenção:** as variáveis (Marcha, Paro, Motor) aparecem sozinhas na tabela de variáveis ao escrevê-las. Aí dá-lhes o seu endereço do autómato; ver [Variáveis e endereços](variables).

## E se o botão de paragem for normalmente fechado?

Por segurança, os botões de paragem costumam ser **NF**: em repouso dão 1 e ao carregar, 0 (assim um fio partido também para a máquina). Então a receptividade é `!Paro` («Paro não acionado»), com a barra por cima. O exemplo fá-lo assim:

```ejemplo marcha-paro
```
