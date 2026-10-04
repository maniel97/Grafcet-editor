# Ações

As **ações** dizem o que se faz enquanto uma etapa está ativa. Desenham-se em retângulos à direita da etapa. Acrescentam-se com o **+** à direita da etapa, a partir das suas propriedades (duplo clique) ou com clique direito > «Adicionar ação».

## Tipos (IEC 60848)

- **Contínua**: a saída vale 1 enquanto a etapa está ativa. É a mais habitual: `Motor`.
- **Condicionada**: além da etapa, exige uma condição, escrita sobre um traço vertical por cima da ação. `Motor` com a condição `!Termico`.
- **Atrasada ou limitada no tempo**: uma condicionada com tempo. `3s/X2` por cima: liga-se 3 s depois de a etapa se ativar.
- **Memorizada na ativação** (seta ↑): executa-se uma vez, ao ativar-se a etapa. `A:=1` põe A a 1 e deixa-a assim até que outra ação a ponha a 0. Também para contadores: `C:=C+1`.
- **Memorizada na desativação** (seta ↓): igual, ao desativar-se a etapa.
- **No evento**: executa-se no instante de um evento enquanto a etapa está ativa, p. ex. `↑b`.

## Contínua ou memorizada?

Com ações **contínuas** basta olhar para as etapas ativas para saber que saídas estão ligadas. Com **memorizadas**, não: é preciso saber o que aconteceu antes. Por isso:

- Use contínuas sempre que puder.
- Use memorizadas quando a saída tem de durar várias etapas não seguidas, ou para contadores e valores.
- Cada `A:=1` tem de ter algures o seu `A:=0`; senão, a saída fica a 1 para sempre.

> **Atenção:** se uma saída aparece como contínua em duas etapas, vale 1 se qualquer uma das duas estiver ativa (é um OU). Se além disso estiver memorizada noutra, as duas formas pisam-se: Verificar assinala-o com um conselho.

```ejemplo cilindros
Só ações contínuas: cada etapa, um movimento.
```

```ejemplo contador
Ações memorizadas: C:=0 ao começar e C:=C+1 em cada volta.
```
