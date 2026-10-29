from flask import Flask, jsonify, render_template, request

from cupping import CuppingLab


class CuppingLabServer:
    def __init__(self):
        self.lab = CuppingLab()
        self.app = Flask(__name__)
        self._register_routes()

    def _register_routes(self):
        self.app.add_url_rule("/", "home", self.home)
        self.app.add_url_rule("/api/state", "state", self.state, methods=["GET"])
        self.app.add_url_rule("/api/lots", "cup_lot", self.cup_lot, methods=["POST"])
        self.app.add_url_rule("/api/decisions/<decision_id>/grow", "grow", self.grow, methods=["POST"])
        self.app.add_url_rule("/api/decisions/<decision_id>/prune", "prune", self.prune, methods=["POST"])
        self.app.add_url_rule("/api/decisions/<decision_id>", "edit", self.edit, methods=["PUT"])
        self.app.add_url_rule("/api/restart", "restart", self.restart, methods=["POST"])
        self.app.register_error_handler(ValueError, self.invalid_request)

    def _payload(self):
        return request.get_json(silent=True) or {}

    def home(self):
        return render_template("index.html")

    def state(self):
        return jsonify(self.lab.snapshot())

    def cup_lot(self):
        record = self.lab.cup(self._payload())
        return jsonify({"record": record.to_dict(), "state": self.lab.snapshot()}), 201

    def grow(self, decision_id):
        self.lab.grow(decision_id, self._payload())
        return jsonify({"state": self.lab.snapshot()})

    def prune(self, decision_id):
        self.lab.prune(decision_id, self._payload())
        return jsonify({"state": self.lab.snapshot()})

    def edit(self, decision_id):
        self.lab.edit(decision_id, self._payload())
        return jsonify({"state": self.lab.snapshot()})

    def restart(self):
        self.lab.restart()
        return jsonify({"state": self.lab.snapshot()})

    def invalid_request(self, error):
        return jsonify({"error": str(error)}), 400


server = CuppingLabServer()
app = server.app

if __name__ == "__main__":
    app.run(debug=True)
