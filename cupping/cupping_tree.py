from bigtree import find_name, inorder_iter, levelorder_iter, postorder_iter, preorder_iter

from cupping.cupping_decision import CuppingDecision


class CuppingTree:
    ORDER = 2

    def __init__(self, catalog):
        self.catalog = catalog
        self.root = None
        self._sequence = 0
        self.plant_default()

    def _next_id(self):
        self._sequence += 1
        return f"N{self._sequence}"

    def _criterion(self, attribute_key, comparator, threshold, accept, reject):
        decision = CuppingDecision(
            self._next_id(), self.catalog.get(attribute_key), comparator, threshold
        )
        decision.left = accept
        decision.right = reject
        return decision

    def _grade(self, grade):
        return CuppingDecision(self._next_id(), grade=grade)

    def plant_default(self):
        self._sequence = 0
        self.root = CuppingDecision(self._next_id(), self.catalog.get("moisture"), "<=", 12.0)
        low_defects = CuppingDecision(self._next_id(), self.catalog.get("defects"), "<=", 5)
        self.root.left = low_defects
        self.root.right = self._grade("Rechazado: reprocesar secado")
        fine_aroma = CuppingDecision(self._next_id(), self.catalog.get("aroma"), ">=", 8.0)
        low_defects.left = fine_aroma
        low_defects.right = self._criterion(
            "defects", "<=", 15, self._grade("Excelso estándar"), self._grade("Pasilla")
        )
        bright_acidity = CuppingDecision(self._next_id(), self.catalog.get("acidity"), ">=", 8.0)
        fine_aroma.left = bright_acidity
        fine_aroma.right = self._criterion(
            "body", ">=", 7.5, self._grade("Excelso premium"), self._grade("Excelso estándar")
        )
        bright_acidity.left = self._criterion(
            "altitude",
            ">=",
            1800,
            self._grade("Especial de alta montaña"),
            self._grade("Café especial"),
        )
        bright_acidity.right = self._grade("Excelso premium")
        self._number_by_levels()

    def _number_by_levels(self):
        decisions = list(levelorder_iter(self.root))
        for position, decision in enumerate(decisions, start=1):
            decision.name = f"N{position}"
        self._sequence = len(decisions)

    def find(self, decision_id):
        decision = find_name(self.root, decision_id)
        if decision is None:
            raise ValueError(f"No existe el nodo {decision_id} en el árbol de cata")
        return decision

    def classify(self, lot):
        route = []
        current = self.root
        while current.is_criterion:
            accepted = current.accepts(lot)
            route.append(
                {
                    "id": current.decision_id,
                    "caption": current.caption,
                    "measure": lot.measure(current.attribute.key),
                    "accepted": accepted,
                }
            )
            current = current.left if accepted else current.right
        current.lots_reached += 1
        route.append({"id": current.decision_id, "caption": current.grade, "measure": None, "accepted": None})
        return current, route

    def grow(self, decision_id, attribute_key, comparator, threshold, accept_grade, reject_grade):
        leaf = self.find(decision_id)
        if leaf.is_criterion:
            raise ValueError("Solo se puede crecer el árbol desde una hoja")
        accept = CuppingDecision(self._next_id(), grade=accept_grade)
        reject = CuppingDecision(self._next_id(), grade=reject_grade)
        leaf.set_criterion(self.catalog.get(attribute_key), comparator, threshold)
        leaf.lots_reached = 0
        leaf.left = accept
        leaf.right = reject
        return leaf

    def prune(self, decision_id, grade):
        branch = self.find(decision_id)
        if not branch.is_criterion:
            raise ValueError("Ese nodo ya es una hoja, no hay nada que podar")
        reached = sum(leaf.lots_reached for leaf in branch.leaves)
        branch.set_grade(grade)
        branch.lots_reached = reached
        return branch

    def edit_criterion(self, decision_id, attribute_key, comparator, threshold):
        decision = self.find(decision_id)
        if not decision.is_criterion:
            raise ValueError("Solo se puede editar el criterio de una raíz o rama")
        decision.set_criterion(self.catalog.get(attribute_key), comparator, threshold)
        return decision

    def rename_grade(self, decision_id, grade):
        decision = self.find(decision_id)
        if decision.is_criterion:
            raise ValueError("Solo las hojas tienen clasificación")
        decision.set_grade(grade)
        return decision

    def decisions(self):
        return list(preorder_iter(self.root))

    def grades(self):
        return sorted({leaf.grade for leaf in self.root.leaves})

    def metrics(self):
        decisions = self.decisions()
        levels = {}
        for decision in decisions:
            levels[decision.level] = levels.get(decision.level, 0) + 1
        leaves = [decision for decision in decisions if decision.kind == "Hoja"]
        branches = [decision for decision in decisions if decision.kind == "Rama"]
        return {
            "height": self.root.max_depth,
            "weight": len(decisions),
            "order": self.ORDER,
            "degree": max(decision.degree for decision in decisions),
            "leaves": len(leaves),
            "branches": len(branches),
            "levels": [{"level": level, "count": levels[level]} for level in sorted(levels)],
        }

    def traversals(self):
        return {
            "preorder": [decision.decision_id for decision in preorder_iter(self.root)],
            "inorder": [decision.decision_id for decision in inorder_iter(self.root)],
            "postorder": [decision.decision_id for decision in postorder_iter(self.root)],
            "levelorder": [decision.decision_id for decision in levelorder_iter(self.root)],
        }

    def to_dict(self):
        return self.root.to_dict()
