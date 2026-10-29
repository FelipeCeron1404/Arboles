from dataclasses import dataclass, field


@dataclass
class CoffeeLot:
    code: str
    farm: str
    municipality: str
    measures: dict = field(default_factory=dict)

    @classmethod
    def from_form(cls, data, catalog):
        code = str(data.get("code", "")).strip().upper()
        farm = str(data.get("farm", "")).strip()
        municipality = str(data.get("municipality", "")).strip()
        if not code:
            raise ValueError("El lote necesita un código")
        if not farm:
            raise ValueError("El lote necesita el nombre de la finca")
        if not municipality:
            raise ValueError("El lote necesita el municipio de origen")
        measures = {
            attribute.key: attribute.validate(data.get(attribute.key))
            for attribute in catalog.all()
        }
        return cls(code, farm, municipality, measures)

    def measure(self, key):
        return self.measures[key]

    def to_dict(self):
        return {
            "code": self.code,
            "farm": self.farm,
            "municipality": self.municipality,
            "measures": dict(self.measures),
        }
