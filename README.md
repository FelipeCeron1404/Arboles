# Catación Nariño · Taller de Árboles

Taller de **Estructuras de Datos** (Universidad Cooperativa de Colombia, sede Pasto).
Docente: Jhonatan Andrés Mideros Narváez · Estudiante: Felipe Alejandro Cerón Cifuentes.

## Caso de estudio

En las cooperativas y laboratorios de calidad de café de Nariño (Buesaco, Sandoná, La Unión, Consacá, El Tablón de Gómez…) cada lote que llega se somete a una **cata**: se mide la humedad del grano, se cuentan los defectos en una muestra de 350 g y el catador califica aroma, acidez y cuerpo. Con esa ficha se decide si el lote es **café especial**, **excelso** o **pasilla**, o si se devuelve por estar mal secado.

Esa decisión es una cadena de preguntas de sí o no, así que se modela como un **árbol de decisión binario**:

- Cada **rama** es una pregunta sobre un atributo de la ficha (por ejemplo, ¿Humedad <= 12 %?).
- El hijo **izquierdo** recibe el lote que cumple (Sí) y el **derecho** el que no (No).
- Cada **hoja** es la clasificación final del lote.

El árbol no es fijo: el jefe de calidad puede **crecerlo** (convertir una hoja en una nueva pregunta con dos salidas), **editar** un criterio o **podar** una rama completa cuando una regla deja de servir.

## Librería de árboles

Se usa **[bigtree](https://github.com/kayjan/bigtree)**. Su clase `BinaryNode` aporta los enlaces `left`/`right`/`parent`, la profundidad de cada nodo, la altura del árbol, hojas y hermanos, y los iteradores de recorrido (`preorder_iter`, `inorder_iter`, `postorder_iter`, `levelorder_iter`). Sobre ella se construyen las clases propias del caso:

| Clase | Archivo | Responsabilidad |
|---|---|---|
| `CuppingAttribute`, `CuppingAttributeCatalog` | `cupping/cupping_attribute.py` | Atributos de la ficha de cata y sus rangos válidos |
| `CoffeeLot` | `cupping/coffee_lot.py` | Lote de café con su finca, municipio y medidas |
| `CuppingDecision` | `cupping/cupping_decision.py` | Nodo del árbol (hereda de `BinaryNode`): pregunta o clasificación |
| `CuppingTree` | `cupping/cupping_tree.py` | Árbol: clasificar, crecer, editar, podar, propiedades y recorridos |
| `CuppingLab`, `CuppingRecord` | `cupping/cupping_lab.py` | Laboratorio: registro de lotes catados |
| `CuppingLabServer` | `app.py` | API Flask que expone el laboratorio al frontend |

## Conceptos del tema en la aplicación

- **Raíz, rama, hoja, padre, hijo y hermano**: se ven por colores en el árbol y en el inspector de cada nodo.
- **Nivel y grado** de cada nodo: en el inspector.
- **Altura, peso, orden y grado del árbol**, hojas, ramas y nodos por nivel: en el panel *Propiedades del árbol*, recalculados después de cada cambio.
- **Recorridos** preorden, inorden, postorden y por niveles: en el panel *Recorridos*.
- **Búsqueda**: catar un lote es recorrer el árbol desde la raíz hasta una hoja; el camino queda resaltado en rojo.
- **Inserción y eliminación**: crecer una hoja y podar una rama.

## Cómo ejecutarlo

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Linux / macOS
pip install -r requirements.txt
python app.py
```

Abrir <http://127.0.0.1:5000>. El laboratorio arranca con cinco lotes de ejemplo; el botón *Reiniciar laboratorio* devuelve el árbol y el registro a su estado inicial.

## Frontend

Flask sirve una página HTML/CSS/JavaScript propia (`templates/index.html`, `static/styles.css`, `static/app.js`). El dibujo del árbol en SVG lo calcula el propio código a partir de la estructura que devuelve la API; no se usan librerías externas para renderizar.
