# O esquema elétrico

O botão **Esquema elétrico** abre o esquema da instalação: comando, potência e ligações do autómato, com os símbolos da norma IEC 60617. E **simula-se**: carregue num botão e verá passar a corrente, fechar contactores e rodar motores.

## O que se pode fazer

- **Inserir montagem**: montagens clássicas prontas a simular e modificar (marcha-paragem com autorretenção, inversão de marcha, estrela-triângulo, variador, eletropneumática com eletroválvulas 5/2…).
- **Ligações do autómato**: cria o autómato com um aparelho em cada entrada e saída da tabela de variáveis, já cablado.
- **Ligar ao autómato e à planta**: o esquema, o grafcet e a planta funcionam juntos. O botão do esquema dá a entrada do autómato, a saída ativa o contactor e o contactor move o tapete da planta.
- **Colocar aparelhos (carimbo)**: clique num aparelho da paleta e depois clique no esquema: coloca-se um em cada clique, com a sua pré-visualização sob o rato. Esc, «Terminar» ou o botão direito largam-no. Duplo clique na paleta: um no primeiro espaço livre. Com o dedo, igual: toque na paleta e depois no esquema.
- **Várias folhas** com moldura, colunas numeradas e referências cruzadas; números de condutor e bornes.
- **Exportar o esquema** (PDF vetorial, PNG ou SVG), também dentro do dossier do trabalho prático.

## Usar e Editar

Em **Editar** colocam-se aparelhos e puxam-se condutores de borne a borne. Em **Usar** acionam-se botões e seletores com o rato.

## Avarias e multímetro

Em Usar, cada aparelho pode ter avarias (contacto aberto, soldado, condutor cortado). «Avaria ao acaso (oculta)» esconde uma para a procurar com o **multímetro**, medindo tensões entre bornes como na oficina.

## Eletro-hidráulica

Na paleta, o grupo **Hidráulica** (ISO 1219): central hidráulica (motor, bomba e depósito), válvula limitadora de pressão, manómetro, distribuidores 4/3 e 4/2, cilindro e regulador de caudal. Monta-se e simula-se como a pneumática, com três diferenças que se veem ao simular:

- **O óleo não se comprime**: com as duas ligações do cilindro fechadas (centro fechado ou em tandem do 4/3), fica parado onde estiver, mesmo a meio curso.
- **A bomba dá caudal, não pressão**: se o óleo não tem saída (cilindro no fim de curso, centro fechado), a pressão sobe até a **limitadora** abrir e o óleo voltar por ela ao depósito. O **manómetro** mostra-o: pressão baixa ao mover, a da regulação no fim de curso, 0 com o centro em tandem (a bomba descarrega).
- Uma ligação sem tubo **derrama óleo**, e sem limitadora há um aviso de que a pressão sobe sem controlo.

Os tubos com pressão veem-se a laranja. Há dois circuitos em «Inserir montagem»: a prensa (4/3 em tandem) e o elevador com descida travada (centro fechado).

> **Atenção:** as linhas pneumáticas (tubos) não se misturam com os condutores elétricos: uma eletroválvula comanda-se pela sua bobina elétrica e move o cilindro pelos seus tubos.

```ejemplo estrella-triangulo-plc
Arranque estrela-triângulo comandado pelo autómato.
```
