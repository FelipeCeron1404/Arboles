from dataclasses import dataclass


@dataclass(frozen=True)
class CuppingAttribute:
    key: str
    label: str
    unit: str
    minimum: float
    maximum: float
    step: float

    def validate(self, value):
        try:
            number = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"El valor de {self.label} debe ser numérico")
        if number < self.minimum or number > self.maximum:
            raise ValueError(
                f"{self.label} debe estar entre {self.minimum:g} y {self.maximum:g} {self.unit}".strip()
            )
        return number

    def to_dict(self):
        return {
            "key": self.key,
            "label": self.label,
            "unit": self.unit,
            "minimum": self.minimum,
            "maximum": self.maximum,
            "step": self.step,
        }


class CuppingAttributeCatalog:
    def __init__(self):
        self._attributes = {
            attribute.key: attribute
            for attribute in (
                CuppingAttribute("moisture", "Humedad del grano", "%", 8, 16, 0.1),
                CuppingAttribute("defects", "Defectos en 350 g", "granos", 0, 60, 1),
                CuppingAttribute("aroma", "Aroma", "pts", 6, 10, 0.25),
                CuppingAttribute("acidity", "Acidez", "pts", 6, 10, 0.25),
                CuppingAttribute("body", "Cuerpo", "pts", 6, 10, 0.25),
                CuppingAttribute("altitude", "Altitud de la finca", "m s. n. m.", 1000, 2500, 10),
            )
        }

    def get(self, key):
        if key not in self._attributes:
            raise ValueError(f"El atributo '{key}' no existe en la ficha de cata")
        return self._attributes[key]

    def all(self):
        return list(self._attributes.values())

    def keys(self):
        return list(self._attributes.keys())
