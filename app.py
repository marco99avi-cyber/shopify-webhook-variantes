import os
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

SHOP         = "a-granel-madrid.myshopify.com"
ACCESS_TOKEN = os.environ.get("SHOPIFY_TOKEN")

HEADERS = {
    "X-Shopify-Access-Token": ACCESS_TOKEN,
    "Content-Type": "application/json"
}

VARIANTES = [
    ("100g", 0.1),
    ("250g", 0.25),
    ("500g", 0.5),
    ("1kg",  1.0),
]

@app.route("/")
def index():
    return "Webhook activo", 200

@app.route("/webhook/producto-nuevo", methods=["POST"])
def producto_nuevo():
    data = request.get_json()
    producto_id = data.get("id")
    variantes   = data.get("variants", [])

    if len(variantes) != 1 or variantes[0].get("title") != "Default Title":
        return jsonify({"msg": "Ignorado, ya tiene variantes"}), 200

    precio_kg = float(variantes[0].get("price", 0))
    if precio_kg == 0:
        return jsonify({"msg": "Precio 0, ignorado"}), 200

    variantes_payload = []
    for nombre, factor in VARIANTES:
        precio = round(precio_kg * factor, 2)
        variantes_payload.append({
            "option1": nombre,
            "price":   str(precio),
            "requires_shipping": True,
            "taxable": True
        })

    url = f"https://{SHOP}/admin/api/2024-01/products/{producto_id}.json"
    payload = {
        "product": {
            "id": producto_id,
            "options": [{"name": "Cantidad"}],
            "variants": variantes_payload
        }
    }
    r = requests.put(url, headers=HEADERS, json=payload)

    if r.status_code == 200:
        print(f"OK - Variantes creadas para {producto_id} a {precio_kg} EUR/kg")
        return jsonify({"msg": "OK"}), 200
    else:
        print(f"ERROR {r.status_code}: {r.text}")
        return jsonify({"error": r.text}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
