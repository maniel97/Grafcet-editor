# El esquema eléctrico

El botón **Esquema eléctrico** abre el esquema de la instalación: mando, potencia y conexiones del autómata, con los símbolos de la norma IEC 60617. Y se **simula**: pulsa un pulsador y verás pasar la corriente, cerrar contactores y girar motores.

## Lo que se puede hacer

- **Insertar montaje**: montajes clásicos listos para simular y modificar (marcha-paro con autorretención, inversión de giro, estrella-triángulo, variador, electroneumática con electroválvulas 5/2…).
- **Conexiones del autómata**: crea el autómata con un aparato en cada entrada y salida de la tabla de variables, ya cableado.
- **Conectar con el autómata y la planta**: el esquema, el grafcet y la planta funcionan juntos. El pulsador del esquema da la entrada del autómata, la salida activa el contactor y el contactor mueve la cinta de la planta.
- **Poner aparatos (tampón)**: pulsa un aparato de la paleta y después pulsa en el esquema: se pone uno en cada clic, con su vista previa bajo el ratón. Esc, «Terminar» o el botón derecho lo sueltan. Doble clic en la paleta: uno en el primer hueco libre. Con el dedo, igual: toca la paleta y luego el esquema.
- **Varias hojas** con marco, columnas numeradas y referencias cruzadas; números de cable y bornas.
- **Exportar el esquema** (PDF vectorial, PNG o SVG), también dentro del dossier de la práctica.

## Usar y Editar

En **Editar** se colocan aparatos y se tiran cables de borna a borna. En **Usar** se accionan pulsadores y selectores con el ratón.

## Averías y polímetro

En Usar, cada aparato puede tener averías (contacto abierto, soldado, cable cortado). «Avería al azar (oculta)» esconde una para buscarla con el **polímetro**, midiendo tensiones entre bornas como en el taller.

> **Ojo:** los cables neumáticos (tubos) no se mezclan con los eléctricos: una electroválvula se manda por su bobina eléctrica y mueve el cilindro por sus tubos.

```ejemplo estrella-triangulo-plc
Arranque estrella-triángulo mandado por el autómata.
```
