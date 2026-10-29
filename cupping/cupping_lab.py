from dataclasses import dataclass
from datetime import datetime

from cupping.coffee_lot import CoffeeLot
from cupping.cupping_attribute import CuppingAttributeCatalog
from cupping.cupping_tree import CuppingTree


@dataclass
class CuppingRecord:
    lot: CoffeeLot
    grade: str
    leaf_id: str
    route: list
    cupped_at: datetime

    def to_dict(self):
        return {
            "lot": self.lot.to_dict(),
            "grade": self.grade,
            "leafId": self.leaf_id,
            "route": self.route,
            "cuppedAt": self.cupped_at.strftime("%d/%m/%Y %H:%M"),
        }


class CuppingLab:
    SAMPLE_LOTS = (
        {"code": "BUE-014", "farm": "El Mirador", "municipality": "Buesaco",
         "moisture": 11.2, "defects": 2, "aroma": 8.5, "acidity": 8.25, "body": 8.0, "altitude": 1950},
        {"code": "SAN-031", "farm": "La Cascada", "municipality": "Sandoná",
         "moisture": 11.6, "defects": 4, "aroma": 8.25, "acidity": 8.0, "body": 7.75, "altitude": 1720},
        {"code": "LAU-008", "farm": "Los Robles", "municipality": "La Unión",
         "moisture": 11.8, "defects": 4, "aroma": 7.5, "acidity": 7.75, "body": 7.75, "altitude": 1680},
        {"code": "CON-022", "farm": "Villa Galeras", "municipality": "Consacá",
         "moisture": 11.4, "defects": 11, "aroma": 7.25, "acidity": 7.5, "body": 7.0, "altitude": 1600},
        {"code": "TAB-005", "farm": "Alto Bonito", "municipality": "El Tablón de Gómez",
         "moisture": 13.4, "defects": 3, "aroma": 8.0, "acidity": 8.0, "body": 7.5, "altitude": 2100},
    )

    def __init__(self):
        self.catalog = CuppingAttributeCatalog()
        self.tree = CuppingTree(self.catalog)
        self.records = []
        self.cup_samples()

    def cup_samples(self):
        for sample in self.SAMPLE_LOTS:
            self.cup(sample)

    def cup(self, form):
        lot = CoffeeLot.from_form(form, self.catalog)
        if any(record.lot.code == lot.code for record in self.records):
            raise ValueError(f"El lote {lot.code} ya fue catado")
        leaf, route = self.tree.classify(lot)
        record = CuppingRecord(lot, leaf.grade, leaf.decision_id, route, datetime.now())
        self.records.insert(0, record)
        return record

    def grow(self, decision_id, form):
        return self.tree.grow(
            decision_id,
            form.get("attribute"),
            form.get("comparator"),
            form.get("threshold"),
            form.get("acceptGrade"),
            form.get("rejectGrade"),
        )

    def prune(self, decision_id, form):
        return self.tree.prune(decision_id, form.get("grade"))

    def edit(self, decision_id, form):
        decision = self.tree.find(decision_id)
        if decision.is_criterion:
            return self.tree.edit_criterion(
                decision_id, form.get("attribute"), form.get("comparator"), form.get("threshold")
            )
        return self.tree.rename_grade(decision_id, form.get("grade"))

    def restart(self):
        self.tree.plant_default()
        self.records = []
        self.cup_samples()

    def grade_summary(self):
        summary = {}
        for record in self.records:
            summary[record.grade] = summary.get(record.grade, 0) + 1
        return [{"grade": grade, "lots": lots} for grade, lots in sorted(summary.items(), key=lambda item: -item[1])]

    def snapshot(self):
        return {
            "tree": self.tree.to_dict(),
            "metrics": self.tree.metrics(),
            "traversals": self.tree.traversals(),
            "attributes": [attribute.to_dict() for attribute in self.catalog.all()],
            "grades": self.tree.grades(),
            "records": [record.to_dict() for record in self.records],
            "summary": self.grade_summary(),
        }
