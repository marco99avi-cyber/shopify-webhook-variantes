import base64
import hashlib
import hmac
import importlib
import json

import pytest

SECRETO = "secreto-de-prueba"
TIENDA = "a-granel-madrid.myshopify.com"


class Respuesta:
    def __init__(self, status, datos=None, texto=""):
        self.status_code = status
        self._datos = datos
        self.text = texto or json.dumps(datos or {})

    def json(self):
        if self._datos is None:
            raise ValueError("sin json")
        return self._datos


def cargar(monkeypatch, secreto=SECRETO, token="shpat_token_de_prueba"):
    for k, v in {"SHOPIFY_WEBHOOK_SECRET": secreto, "SHOPIFY_TOKEN": token}.items():
        if v is None:
            monkeypatch.delenv(k, raising=False)
        else:
            monkeypatch.setenv(k, v)
    import app as modulo

    modulo = importlib.reload(modulo)
    modulo.app.config["TESTING"] = True
    return modulo


def firmar(cuerpo, secreto=SECRETO):
    return base64.b64encode(hmac.new(secreto.encode(), cuerpo, hashlib.sha256).digest()).decode()


def cabeceras(cuerpo, firma=None, tienda=TIENDA, tema="products/create", webhook_id="wh-1"):
    h = {
        "Content-Type": "application/json",
        "X-Shopify-Hmac-Sha256": firma if firma is not None else firmar(cuerpo),
        "X-Shopify-Shop-Domain": tienda,
        "X-Shopify-Topic": tema,
    }
    if webhook_id:
        h["X-Shopify-Webhook-Id"] = webhook_id
    return h


PRODUCTO_SIN_VARIANTES = {"product": {"id": 123, "variants": [{"title": "Default Title", "price": "12.00"}]}}


@pytest.fixture
def llamadas(monkeypatch):
    registro = {"get": [], "put": []}

    def falso_get(url, **kw):
        registro["get"].append((url, kw))
        return registro.get("respuesta_get", Respuesta(200, PRODUCTO_SIN_VARIANTES))

    def falso_put(url, **kw):
        registro["put"].append((url, kw))
        return registro.get("respuesta_put", Respuesta(200, {"product": {"id": 123}}))

    registro["instalar"] = lambda modulo: (
        monkeypatch.setattr(modulo.requests, "get", falso_get),
        monkeypatch.setattr(modulo.requests, "put", falso_put),
    )
    return registro


def enviar(modulo, cuerpo_dict=None, cuerpo_bytes=None, **kw):
    cuerpo = cuerpo_bytes if cuerpo_bytes is not None else json.dumps(cuerpo_dict).encode()
    h = kw.pop("headers", None) or cabeceras(cuerpo, **kw)
    return modulo.app.test_client().post("/webhook/producto-nuevo", data=cuerpo, headers=h)


# --- El ataque que motivó el arreglo ---------------------------------------------------------


def test_ataque_sin_firma_no_toca_precios(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    ataque = {"id": 123, "variants": [{"title": "Default Title", "price": "0.01"}]}
    r = m.app.test_client().post("/webhook/producto-nuevo", json=ataque)
    assert r.status_code == 401
    assert llamadas["get"] == [] and llamadas["put"] == []


def test_firma_valida_pero_precio_del_cuerpo_se_ignora(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    # Aunque el cuerpo diga 0,01 €, se usa el precio real que devuelve Shopify (12,00 €/kg).
    r = enviar(m, {"id": 123, "variants": [{"title": "Default Title", "price": "0.01"}]})
    assert r.status_code == 200
    precios = [v["price"] for v in llamadas["put"][0][1]["json"]["product"]["variants"]]
    assert precios == ["1.20", "3.00", "6.00", "12.00"]


# --- Firma -----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "firma",
    ["", "no-es-base64", base64.b64encode(b"x" * 32).decode(), "firmá-con-acentos", firmar(b"otro cuerpo")],
)
def test_firmas_invalidas(monkeypatch, llamadas, firma):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    r = enviar(m, {"id": 123}, firma=firma)
    assert r.status_code == 401
    assert llamadas["put"] == []


def test_sin_cabecera_de_firma(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    cuerpo = json.dumps({"id": 123}).encode()
    h = cabeceras(cuerpo)
    del h["X-Shopify-Hmac-Sha256"]
    assert enviar(m, cuerpo_bytes=cuerpo, headers=h).status_code == 401


def test_cuerpo_alterado_tras_firmar(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    original = json.dumps({"id": 123}).encode()
    alterado = json.dumps({"id": 999}).encode()
    r = enviar(m, cuerpo_bytes=alterado, headers=cabeceras(original))
    assert r.status_code == 401
    assert llamadas["get"] == []


@pytest.mark.parametrize("secreto", [None, "", "   "])
def test_falla_cerrado_sin_secreto(monkeypatch, llamadas, secreto):
    m = cargar(monkeypatch, secreto=secreto)
    llamadas["instalar"](m)
    cuerpo = json.dumps({"id": 123}).encode()
    # Ni siquiera una firma hecha con clave vacía pasa.
    r = enviar(m, cuerpo_bytes=cuerpo, headers=cabeceras(cuerpo, firma=firmar(cuerpo, "")))
    assert r.status_code == 401
    assert llamadas["get"] == [] and llamadas["put"] == []


def test_firma_con_otra_clave(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    cuerpo = json.dumps({"id": 123}).encode()
    assert enviar(m, cuerpo_bytes=cuerpo, firma=firmar(cuerpo, "otra-clave")).status_code == 401


def test_otra_tienda(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    assert enviar(m, {"id": 123}, tienda="otra-tienda.myshopify.com").status_code == 401
    assert llamadas["get"] == []


# --- Comportamiento --------------------------------------------------------------------------


def test_crea_variantes_como_antes(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    r = enviar(m, {"id": 123, "variants": [{"title": "Default Title", "price": "12.00"}]})
    assert r.status_code == 200
    url, kw = llamadas["put"][0]
    assert url == f"https://{TIENDA}/admin/api/2024-01/products/123.json"
    assert kw["headers"]["X-Shopify-Access-Token"] == "shpat_token_de_prueba"
    assert kw["timeout"]
    producto = kw["json"]["product"]
    assert producto["options"] == [{"name": "Cantidad"}]
    assert [v["option1"] for v in producto["variants"]] == ["100g", "250g", "500g", "1kg"]
    assert all(v["requires_shipping"] and v["taxable"] for v in producto["variants"])


def test_redondeo_de_dinero(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    llamadas["respuesta_get"] = Respuesta(200, {"product": {"variants": [{"title": "Default Title", "price": "10.70"}]}})
    enviar(m, {"id": 123})
    precios = [v["price"] for v in llamadas["put"][0][1]["json"]["product"]["variants"]]
    assert precios == ["1.07", "2.68", "5.35", "10.70"]  # 2,675 → 2,68 (redondeo comercial)


def test_ya_tiene_variantes_en_shopify(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    llamadas["respuesta_get"] = Respuesta(
        200, {"product": {"variants": [{"title": "100g", "price": "1"}, {"title": "1kg", "price": "9"}]}}
    )
    r = enviar(m, {"id": 123, "variants": [{"title": "Default Title", "price": "9"}]})
    assert r.status_code == 200
    assert llamadas["put"] == []


@pytest.mark.parametrize("precio", ["0", "0.00", "-5", "abc", None, "NaN", "Infinity", "999999"])
def test_precios_no_validos(monkeypatch, llamadas, precio):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    llamadas["respuesta_get"] = Respuesta(200, {"product": {"variants": [{"title": "Default Title", "price": precio}]}})
    assert enviar(m, {"id": 123}).status_code == 200
    assert llamadas["put"] == []


@pytest.mark.parametrize("cuerpo", [b"no es json", b"[]", b'{"id": "123"}', b'{"id": true}', b'{"id": -1}', b"{}"])
def test_cuerpos_raros_no_rompen(monkeypatch, llamadas, cuerpo):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    r = enviar(m, cuerpo_bytes=cuerpo)
    assert r.status_code == 200
    assert llamadas["get"] == [] and llamadas["put"] == []


def test_tema_no_gestionado(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    assert enviar(m, {"id": 123}, tema="orders/create").status_code == 200
    assert llamadas["get"] == []


def test_webhook_repetido_se_procesa_una_vez(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    enviar(m, {"id": 123}, webhook_id="wh-repetido")
    enviar(m, {"id": 123}, webhook_id="wh-repetido")
    assert len(llamadas["put"]) == 1


def test_si_shopify_falla_no_filtra_detalles_y_permite_reintento(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    llamadas["respuesta_put"] = Respuesta(422, {"errors": {"detalle": "interno-secreto"}})
    r = enviar(m, {"id": 123}, webhook_id="wh-fallo")
    assert r.status_code >= 500
    assert b"interno-secreto" not in r.data
    llamadas["respuesta_put"] = Respuesta(200, {"product": {"id": 123}})
    assert enviar(m, {"id": 123}, webhook_id="wh-fallo").status_code == 200  # el reintento vale


def test_error_de_red(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)

    def caido(*a, **k):
        raise m.requests.ConnectionError("caído")

    monkeypatch.setattr(m.requests, "get", caido)
    r = enviar(m, {"id": 123})
    assert r.status_code == 502
    assert b"ca\xc3\xaddo" not in r.data


def test_sin_token_de_shopify(monkeypatch, llamadas):
    m = cargar(monkeypatch, token=None)
    llamadas["instalar"](m)
    assert enviar(m, {"id": 123}).status_code == 503
    assert llamadas["get"] == []


def test_cuerpo_demasiado_grande(monkeypatch, llamadas):
    m = cargar(monkeypatch)
    llamadas["instalar"](m)
    cuerpo = b"{" + b" " * (3 * 1024 * 1024) + b"}"
    r = m.app.test_client().post("/webhook/producto-nuevo", data=cuerpo, headers=cabeceras(cuerpo))
    assert r.status_code == 413


def test_get_no_permitido_y_raiz(monkeypatch):
    m = cargar(monkeypatch)
    c = m.app.test_client()
    assert c.get("/webhook/producto-nuevo").status_code == 405
    assert c.get("/").status_code == 200
