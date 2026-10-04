# Grafcets parciais e forçagem

Um automatismo real tem várias partes que funcionam ao mesmo tempo: a produção, a segurança, os modos de marcha… Cada uma desenha-se como um **grafcet parcial** (G1, G2…) e umas podem **mandar** nas outras.

## Grafcets parciais

Selecione as etapas e transições de uma parte e, com clique direito, «Enquadrar num grafcet parcial»: desenham-se dentro de uma moldura G1. Todos os grafcets parciais evoluem ao mesmo tempo, e cada um pode ler as etapas dos outros (`X12` numa receptividade).

## Forçagem

Uma **ordem de forçagem** é uma ação que impõe uma situação a outro grafcet parcial enquanto durar a etapa que a tem:

| Ordem | Efeito sobre G2 |
|---|---|
| `F/G2{3}` | só a etapa 3 ativa |
| `F/G2{3, 5}` | só as etapas 3 e 5 ativas |
| `F/G2{}` | nenhuma etapa ativa (vazio) |
| `F/G2{*}` | congelado: fica como estiver |
| `F/G2{INIT}` | na sua situação inicial |

Enquanto está forçado, **G2 não evolui**: as suas transições não são transpostas. Ao acabar a forçagem, continua a partir da situação imposta.

> **Atenção:** a forçagem é uma hierarquia. O grafcet que força (segurança, modos de marcha) está *acima* do forçado (produção). Um grafcet não se pode forçar a si próprio, e Verificar avisa se se forçar um grafcet que não existe ou uma etapa que não é sua.

## O caso típico: a emergência

- G1 (segurança) está em repouso enquanto não há emergência.
- Com a emergência, G1 passa a uma etapa com `F/G2{}`: a produção para de imediato.
- Após o rearme, uma etapa com `F/G2{INIT}` deixa a produção na sua situação inicial, pronta a começar.

```ejemplo emergencia
A segurança G1 força a produção G2 a parar e a reiniciar-se.
```

Para organizar os modos de marcha e paragem de forma sistemática, ver [GEMMA](gemma).
