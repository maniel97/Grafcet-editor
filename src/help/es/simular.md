# Simular

**Simular** ejecuta el grafcet como lo haría el autómata, sin autómata. Mientras simulas, el diagrama no se puede cambiar; «Detener» vuelve a editar.

## Qué se ve

- **Etapa activa**: verde, con un punto.
- **Transición validada**: ámbar. **Franqueable**: verde.
- **Acción emitida**: verde.
- En el panel de la derecha, las **entradas** (interruptor o pulsador), las **salidas** y las variables internas, contadores y temporizadores.

## Cómo se maneja

- Activa una entrada con un clic, o con las teclas **1–9** (en el orden del panel).
- Con **Pausa**, el botón **Paso** (⏭) franquea de una en una, para ver bien qué pasa (también la evolución fugaz).
- La velocidad del tiempo se puede cambiar: útil con esperas largas.
- Si algo no avanza, pasa el ratón por la transición: dice qué condición falta.

## Planta virtual y esquema

En los ejemplos que la tienen, la **planta** (cilindros, cintas, detectores…) se mueve con tus salidas y activa sola las entradas: es como probar en la máquina. El **esquema eléctrico** muestra el autómata cableado y también se simula. Ver [La planta virtual](planta) y [El esquema eléctrico](esquema-electrico).

## Paneles flotantes

El **cronograma**, el **diagrama espacio-fase** y los **escenarios de prueba** se pueden sacar del panel: con el botón de su título o arrastrando el título hasta el lienzo.

- Se mueven por su barra de título y se redimensionan por los bordes y las esquinas (con el teclado: flechas para mover, Mayús + flechas para el tamaño).
- Más anchos, muestran más: el cronograma, más segundos.
- **Devolver** los vuelve al panel. Su sitio y su tamaño se recuerdan.

## Escenarios

«Grabar escenario» anota los cambios de entradas con su instante. Se guardan en el proyecto y se reproducen con un clic: así compruebas, tras cada cambio, que todo sigue funcionando. El cronograma muestra entradas, etapas y salidas en el tiempo.

```ejemplo taladradora
Con planta virtual: pulsa Simular y luego Marcha.
```
