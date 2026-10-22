"""Webhook de Shopify: crea las variantes 100g / 250g / 500g / 1kg de un producto nuevo.

Seguridad:
- Solo acepta peticiones firmadas por Shopify (cabecera X-Shopify-Hmac-Sha256, HMAC-SHA256 del
  cuerpo crudo con SHOPIFY_WEBHOOK_SECRET). Sin esa variable configurada rechaza TODO: falla
  cerrado.
- No se fía del cuerpo del webhook: vuelve a leer el producto en Shopify y usa su precio real.
  Aunque alguien consiguiera una firma válida, no podría elegir precios.
- Ignora webhooks repetidos (X-Shopify-Webhook-Id), de otra tienda o de otro tema.
- No devuelve al llamante detalles internos ni respuestas de la API de Shopify.

Variables de entorno:
- SHOPIFY_TOKEN: token de la Admin API (read_products + write_products).
- SHOPIFY_WEBHOOK_SECRET: clave con la que Shopify firma los webhooks.
- SHOPIFY_API_VERSION (opcional): versión de la Admin API. Por defecto, la que se usaba.
"""

import base64
import hashlib
import hmac
import logging
import os
import threading
from collections import OrderedDict
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

import requests
from flask import Flask, jsonify, request

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("webhook-variantes")

SHOP = "a-granel-madrid.myshopify.com"
API_VERSION = os.environ.get("SHOPIFY_API_VERSION", "2024-01").strip()
ACCESS_TOKEN = os.environ.get("SHOPIFY_TOKEN", "").strip()
WEBHOOK_SECRET = os.environ.get("SHOPIFY_WEBHOOK_SECRET", "").strip()

TEMAS_ACEPTADOS = {"products/create", "products/update"}
TIMEOUT = (5, 15)  # (conexión, lectura) en segundos
PRECIO_MAX = Decimal("10000")
MAX_IDS_RECORDADOS = 2000

VARIANTES = [
    ("100g", Decimal("0.1")),
    ("250g", Decimal("0.25")),
    ("500g", Decimal("0.5")),
    ("1kg", Decimal("1")),
]

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # 2 MB: de sobra para un webhook de producto

if not WEBHOOK_SECRET:
    log.error("SHOPIFY_WEBHOOK_SECRET no está configurada: se rechazarán TODOS los webhooks.")
if not ACCESS_TOKEN:
    log.error("SHOPIFY_TOKEN no está configurada: no se podrán crear variantes.")

_ids_vistos = OrderedDict()
_ids_lock = threading.Lock()


def firma_valida(cuerpo, firma):
    """Compara en tiempo constante la firma de Shopify con la calculada sobre el cuerpo crudo."""
    if not WEBHOOK_SECRET or not firma:
        return False
    try:
        recibida = firma.strip().encode("ascii")
    except UnicodeEncodeError:
        return False
    calculada = base64.b64encode(
        hmac.new(WEBHOOK_SECRET.encode("utf-8"), cuerpo, hashlib.sha256).digest()
    )
    return hmac.compare_digest(calculada, recibida)


def ya_procesado(webhook_id):
    """True si ya vimos este webhook (Shopify reintenta y puede repetir entregas)."""
    if not webhook_id:
        return False
    with _ids_lock:
        if webhook_id in _ids_vistos:
            return True
        _ids_vistos[webhook_id] = True
        while len(_ids_vistos) > MAX_IDS_RECORDADOS:
            _ids_vistos.popitem(last=False)
    return False


def olvidar(webhook_id):
    """Si el procesado falla, permitimos que el reintento de Shopify vuelva a intentarlo."""
    if not webhook_id:
        return
    with _ids_lock:
        _ids_vistos.pop(webhook_id, None)


def cabeceras_shopify():
    return {"X-Shopify-Access-Token": ACCESS_TOKEN, "Content-Type": "application/json"}


def url_producto(producto_id):
    return f"https://{SHOP}/admin/api/{API_VERSION}/products/{producto_id}.json"


def precio_por_kg(valor):
    try:
        precio = Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        return None
    if not precio.is_finite() or precio <= 0 or precio > PRECIO_MAX:
        return None
    return precio


@app.route("/")
def index():
    return "Webhook activo", 200


@app.route("/webhook/producto-nuevo", methods=["POST"])
def producto_nuevo():
    cuerpo = request.get_data(cache=True)

    if not firma_valida(cuerpo, request.headers.get("X-Shopify-Hmac-Sha256")):
        log.warning("Webhook rechazado: firma ausente o no válida (ip=%s)", request.remote_addr)
        return jsonify({"error": "No autorizado"}), 401

    if request.headers.get("X-Shopify-Shop-Domain", "").strip().lower() != SHOP:
        log.warning("Webhook rechazado: tienda inesperada")
        return jsonify({"error": "No autorizado"}), 401

    tema = request.headers.get("X-Shopify-Topic", "").strip().lower()
    if tema not in TEMAS_ACEPTADOS:
        return jsonify({"msg": "Ignorado, tema no gestionado"}), 200

    webhook_id = request.headers.get("X-Shopify-Webhook-Id", "").strip()
    if ya_procesado(webhook_id):
        return jsonify({"msg": "Ignorado, ya procesado"}), 200

    datos = request.get_json(silent=True)
    producto_id = datos.get("id") if isinstance(datos, dict) else None
    if not isinstance(producto_id, int) or isinstance(producto_id, bool) or producto_id <= 0:
        return jsonify({"msg": "Ignorado, sin id de producto"}), 200

    if not ACCESS_TOKEN:
        olvidar(webhook_id)
        log.error("No hay SHOPIFY_TOKEN: no se puede procesar el producto %s", producto_id)
        return jsonify({"error": "Servicio no configurado"}), 503

    # No nos fiamos del cuerpo: leemos el producto tal como está ahora en Shopify.
    try:
        r = requests.get(
            url_producto(producto_id),
            headers=cabeceras_shopify(),
            params={"fields": "id,variants"},
            timeout=TIMEOUT,
        )
    except requests.RequestException as e:
        olvidar(webhook_id)
        log.error("Error de red leyendo el producto %s: %s", producto_id, type(e).__name__)
        return jsonify({"error": "Error temporal"}), 502

    if r.status_code == 404:
        return jsonify({"msg": "Ignorado, el producto no existe"}), 200
    if r.status_code != 200:
        olvidar(webhook_id)
        log.error("Shopify devolvió %s al leer el producto %s", r.status_code, producto_id)
        return jsonify({"error": "Error temporal"}), 502

    try:
        variantes = r.json()["product"]["variants"]
    except (ValueError, KeyError, TypeError):
        olvidar(webhook_id)
        log.error("Respuesta inesperada de Shopify para el producto %s", producto_id)
        return jsonify({"error": "Error temporal"}), 502

    if not isinstance(variantes, list) or len(variantes) != 1 or variantes[0].get("title") != "Default Title":
        return jsonify({"msg": "Ignorado, ya tiene variantes"}), 200

    precio_kg = precio_por_kg(variantes[0].get("price"))
    if precio_kg is None:
        return jsonify({"msg": "Ignorado, precio no válido"}), 200

    variantes_payload = [
        {
            "option1": nombre,
            "price": str((precio_kg * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "requires_shipping": True,
            "taxable": True,
        }
        for nombre, factor in VARIANTES
    ]
    payload = {
        "product": {
            "id": producto_id,
            "options": [{"name": "Cantidad"}],
            "variants": variantes_payload,
        }
    }

    try:
        r = requests.put(url_producto(producto_id), headers=cabeceras_shopify(), json=payload, timeout=TIMEOUT)
    except requests.RequestException as e:
        olvidar(webhook_id)
        log.error("Error de red creando variantes del producto %s: %s", producto_id, type(e).__name__)
        return jsonify({"error": "Error temporal"}), 502

    if r.status_code == 200:
        log.info("OK - Variantes creadas para %s a %s EUR/kg", producto_id, precio_kg)
        return jsonify({"msg": "OK"}), 200

    olvidar(webhook_id)
    log.error("Shopify devolvió %s al crear variantes del producto %s: %s", r.status_code, producto_id, r.text[:300])
    return jsonify({"error": "No se pudieron crear las variantes"}), 502


@app.errorhandler(413)
def demasiado_grande(_):
    return jsonify({"error": "Petición demasiado grande"}), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
