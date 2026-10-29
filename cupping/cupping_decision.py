from bigtree import BinaryNode


class CuppingDecision(BinaryNode):
    COMPARATORS = {
        "<=": lambda measure, threshold: measure <= threshold,
        ">=": lambda measure, threshold: measure >= threshold,
    }

    def __init__(self, decision_id, attribute=None, comparator=None, threshold=None, grade=None):
        super().__init__(name=decision_id)
        self.attribute = None
        self.comparator = None
        self.threshold = None
        self.grade = None
        self.lots_reached = 0
        if attribute is not None:
            self.set_criterion(attribute, comparator, threshold)
        else:
            self.set_grade(grade)

    @property
    def decision_id(self):
        return self.name

    @property
    def is_criterion(self):
        return self.attribute is not None

    @property
    def degree(self):
        return len([child for child in self.children if child is not None])

    @property
    def level(self):
        return self.depth

    @property
    def kind(self):
        if self.is_root:
            return "Raíz"
        if self.degree > 0:
            return "Rama"
        return "Hoja"

    @property
    def sibling(self):
        siblings = [node for node in self.siblings if node is not None]
        return siblings[0] if siblings else None

    @property
    def caption(self):
        if self.is_criterion:
            unit = f" {self.attribute.unit}" if self.attribute.unit else ""
            return f"¿{self.attribute.label} {self.comparator} {self.threshold:g}{unit}?"
        return self.grade

    def set_criterion(self, attribute, comparator, threshold):
        if comparator not in self.COMPARATORS:
            raise ValueError("La comparación debe ser <= o >=")
        self.attribute = attribute
        self.comparator = comparator
        self.threshold = attribute.validate(threshold)
        self.grade = None

    def set_grade(self, grade):
        grade = str(grade or "").strip()
        if not grade:
            raise ValueError("Toda hoja necesita una clasificación del lote")
        self.attribute = None
        self.comparator = None
        self.threshold = None
        self.grade = grade
        self.children = [None, None]

    def accepts(self, lot):
        measure = lot.measure(self.attribute.key)
        return self.COMPARATORS[self.comparator](measure, self.threshold)

    def next_decision(self, lot):
        return self.left if self.accepts(lot) else self.right

    def describe(self):
        parent = self.parent.decision_id if self.parent else None
        sibling = self.sibling.decision_id if self.sibling else None
        return {
            "id": self.decision_id,
            "kind": self.kind,
            "caption": self.caption,
            "isCriterion": self.is_criterion,
            "attribute": self.attribute.key if self.is_criterion else None,
            "comparator": self.comparator,
            "threshold": self.threshold,
            "grade": self.grade,
            "level": self.level,
            "degree": self.degree,
            "parent": parent,
            "sibling": sibling,
            "lotsReached": self.lots_reached,
        }

    def to_dict(self):
        data = self.describe()
        data["accept"] = self.left.to_dict() if self.left else None
        data["reject"] = self.right.to_dict() if self.right else None
        return data
