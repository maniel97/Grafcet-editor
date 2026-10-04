# Verificar

O botão **Verificar** revê o grafcet continuamente. O seu número indica quantos **erros** (vermelho) ou **avisos** (âmbar) há; com **✓**, tudo em ordem. Clique numa mensagem para ir ao elemento; «Mais na ajuda» abre o artigo que explica a regra.

## O que verifica

- **A sintaxe da norma**: que haja etapa inicial, que toda a etapa tenha número e não se repita, que etapas e transições se alternem, que toda a transição tenha receptividade.
- **A estrutura**: etapas sem entrada (nunca se ativam) ou sem saída (nunca se desativam), transições soltas, retornos que ao mesmo tempo continuam para baixo, etapas a que não se chega a partir de nenhuma inicial.
- **As divergências em OU**: se dois caminhos se puderem cumprir ao mesmo tempo, di-lo e dá um exemplo de valores em que acontece.
- **Macroetapas, grafcets parciais e encapsulamento**: que cada macroetapa tenha a sua expansão (com entrada e saída), que as forçagens apontem para grafcets que existem, que cada encapsulante tenha o seu grafcet encapsulado.
- **Conselhos**: erros típicos de quem aprende, como receptividades que usam saídas, temporizações de outra etapa, receptividades sempre falsas, etapas atravessadas sem parar ou saídas comandadas ao mesmo tempo por ação contínua e memorizada.

## Erros, avisos e conselhos

- Um **erro** faz com que o grafcet não seja conforme ou não possa funcionar: tem de ser corrigido.
- Um **aviso** assinala algo que provavelmente não quer, mas pode ser intencional.
- Um **conselho** é pedagógico: explica a regra e não impede nada.

Se tiver a certeza de que um aviso é intencional, deixe-o: não impede simular nem gerar o ladder.

> **Atenção:** Verificar não sabe o que a sua máquina tem de fazer. Um grafcet conforme pode estar mal pensado: é para isso que existe a [simulação](simular).
